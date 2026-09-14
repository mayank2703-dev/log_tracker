// ============================================================
//  AMRITA LOG TRACKER — BACKEND
//  v3.0  — clean rebuild
//
//  Edit config.js only. Nothing here needs changing to add a
//  server, a node or a log file.
//
//  Three jobs:
//    1. LIVE      stream new log lines to the browser
//    2. HISTORY   fetch a date + time window, capped, for viewing
//    3. EXPORT    stream the same window straight to a download,
//                 with no size limit and nothing stored on disk
//
//  Design note: all filtering happens here, in Node, on a stream.
//  Earlier versions filtered on the log host with awk. Several of
//  the Amrita log hosts are minimal environments with no awk, sed,
//  head, stat or cut, so that silently returned nothing. Reading
//  the file with cat/tail is the one thing every host can do.
// ============================================================

const CONFIG = require('./config');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const express = require('express');
const cors = require('cors');
const zlib = require('zlib');

const LOG_TYPES = CONFIG.logTypes;

// ── Tunables ───────────────────────────────────────────────
const PREVIEW_MAX_LINES = 500000;  // rows returned to the browser for viewing.
                                   // The viewer virtualises the list, so it
                                   // draws only the rows on screen and can
                                   // scroll through all of these. Beyond this,
                                   // use Download — it has no limit at all.
const PREVIEW_MAX_MS    = 120 * 1000;  // preview gives up after this; export has no limit
const BACKFILL_LINES    = 200;     // lines shown the moment you press Start
const PAST_END_LIMIT    = 5000;    // stop reading once clearly past the window
const CONNECT_TIMEOUT   = 15000;
const COMMAND_TIMEOUT   = 30 * 60 * 1000;   // 30 min: exports can be large
const MAX_FILES         = 10;      // archives scanned per request

// ── Small helpers ──────────────────────────────────────────

const shq = (v) => "'" + String(v).replace(/'/g, "'\\''") + "'";
const REMOTE_PATH = 'export PATH=/usr/bin:/bin:/usr/local/bin:/sbin:/usr/sbin; ';

function classifyLevel(line) {
  if (/\b(ERROR|EXCEPTION|FATAL|SEVERE)\b/i.test(line)) return 'ERROR';
  if (/\b(WARN|WARNING)\b/i.test(line)) return 'WARN';
  if (/\bINFO\b/i.test(line)) return 'INFO';
  return 'DEBUG';
}

function getNode(nodes, nodeId) {
  return nodes.find((n) => n.id === nodeId) || nodes[0];
}

function getLogFile(nodes, nodeId, logType) {
  const node = getNode(nodes, nodeId);
  if (!node) return null;
  return node.logs[logType] || node.logs.server || Object.values(node.logs).find((f) => f);
}

function getNodeLogTypes(node) {
  return LOG_TYPES.filter((lt) => node.logs[lt.id]);
}

// config.js values, overridable by environment:
//   LT_LIVE_USER / LT_LIVE_PASS, LT_MOCK_AE_PASS, ...  (from the server id)
function resolveSsh(srv) {
  const key = 'LT_' + String(srv.id).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return {
    ...srv.ssh,
    username: process.env[key + '_USER'] || srv.ssh.username,
    password: process.env[key + '_PASS'] || srv.ssh.password,
  };
}

// ── Dates ──────────────────────────────────────────────────
const DAY_MS = 86400000;
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

function today() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

function addDays(dateStr, k) {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + k * DAY_MS).toISOString().slice(0, 10);
}

// Add a margin to a "YYYY-MM-DD HH:MM:SS" instant. Used to allow for a file's
// mtime lagging slightly behind its final log line.
function addHours(ts, h) {
  const t = Date.parse(String(ts).replace(' ', 'T') + 'Z');
  if (isNaN(t)) return ts;
  return new Date(t + h * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

// A rotated log usually carries its date in the filename.
function dateInName(name) {
  let m = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) m = name.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ── SSH ────────────────────────────────────────────────────

// Run a command, collect all output. For short commands only.
function sshExec(sshCfg, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const chunks = [];
    let done = false;
    let timer = null;

    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { conn.end(); } catch (e) {}
      fn(arg);
    };

    conn.on('ready', () => {
      conn.exec(REMOTE_PATH + command, (err, stream) => {
        if (err) return finish(reject, err);
        stream.stdout.on('data', (d) => chunks.push(d));
        stream.stderr.on('data', (d) => console.error('[ssh]', d.toString().trim()));
        stream.on('close', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
      });
    });
    conn.on('error', (e) => finish(reject, e));
    timer = setTimeout(() => finish(reject, new Error('SSH command timed out')), 120000);
    conn.connect({ ...sshCfg, readyTimeout: CONNECT_TIMEOUT });
  });
}

// Run a command and hand back one line at a time, never holding the whole
// output. `ctl` lets the caller stop, or pause and resume for backpressure —
// that is what keeps a multi-GB export from piling up in memory.
function sshStreamLines(sshCfg, command, onLine, opts) {
  const gunzip = !!(opts && opts.gunzip);
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let buf = '';
    let bytes = 0;
    let done = false;
    let stopped = false;
    let timer = null;
    let chan = null;
    let gzRef = null;

    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { conn.end(); } catch (e) {}
      fn(arg);
    };

    const ctl = {
      stop() {
        stopped = true;
        try { chan.close(); } catch (e) {}
        if (gzRef) { try { gzRef.end(); } catch (e) {} }
      },
      pause() { try { chan.pause(); } catch (e) {} },
      resume() { try { chan.resume(); } catch (e) {} },
    };

    conn.on('ready', () => {
      conn.exec(REMOTE_PATH + command, (err, stream) => {
        if (err) return finish(reject, err);
        chan = stream;

        // Feed decoded text through the same line splitter either way.
        const takeText = (text) => {
          if (stopped) return;
          buf += text;
          const lines = buf.split('\n');
          buf = lines.pop();                 // hold the incomplete tail
          for (const l of lines) {
            if (stopped) return;
            onLine(l, ctl);
          }
        };

        if (gunzip) {
          // Several Amrita hosts have no zcat. Node's own zlib does the
          // decompression here instead, so .gz archives need nothing at all
          // installed on the log server beyond cat.
          //
          // CRITICAL: resolve when the DECOMPRESSOR finishes, not when the SSH
          // channel closes. The channel closes as soon as the last compressed
          // byte arrives, but zlib still has a large backlog to expand.
          // Resolving on the channel meant the scan moved on while millions of
          // lines were still being produced — the same archive yielded
          // 4,406,508 lines one run and 624,249 the next, and lines arrived
          // after the search had already answered.
          const gz = zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
          gzRef = gz;

          gz.on('data', (d) => takeText(d.toString('utf8')));

          // We often stop a .gz stream on purpose (probing the first line, or
          // hitting a limit). zlib reports that as "unexpected end of file" —
          // only surface it when we did NOT ask to stop.
          gz.on('error', (e) => {
            if (!stopped) console.error('[gunzip]', e.message);
            try { chan.close(); } catch (x) {}
            finish(resolve, { bytes, stopped });
          });

          gz.on('end', () => {
            if (buf && !stopped) onLine(buf, ctl);
            finish(resolve, { bytes, stopped });
          });

          // Backpressure: if zlib cannot keep up, pause the SSH channel rather
          // than letting the backlog grow without limit.
          stream.stdout.on('data', (d) => {
            bytes += d.length;
            if (stopped) return;
            if (gz.write(d) === false) {
              try { chan.pause(); } catch (e) {}
              gz.once('drain', () => { try { chan.resume(); } catch (e) {} });
            }
          });

          stream.on('close', () => { try { gz.end(); } catch (e) {} });
        } else {
          stream.stdout.on('data', (d) => {
            if (stopped) return;
            bytes += d.length;
            takeText(d.toString('utf8'));
          });
        }

        stream.stderr.on('data', (d) => {
          const t = d.toString().trim();
          if (t) console.error('[ssh]', t);
        });

        // Plain files only — the gzip path resolves on the decompressor's end.
        if (!gunzip) {
          stream.on('close', () => {
            if (buf && !stopped) onLine(buf, ctl);
            finish(resolve, { bytes, stopped });
          });
        }
      });
    });

    conn.on('error', (e) => finish(reject, e));
    timer = setTimeout(() => finish(reject, new Error('Remote read timed out')), COMMAND_TIMEOUT);
    conn.connect({ ...sshCfg, readyTimeout: CONNECT_TIMEOUT });
  });
}

// ── Which files hold which day ─────────────────────────────

// Uses only bash builtins, ls and date. No stat, cut, head or awk.
async function listFiles(sshCfg, logFile) {
  const dir = logFile.replace(/\/[^/]*$/, '') || '/';
  const base = logFile.slice(dir.length).replace(/^\//, '');
  const stem = base.replace(/\.[^.]*$/, '');

  const cmd =
    `for f in ${shq(dir + '/' + base)}* ${shq(dir + '/' + stem)}*; do ` +
    `  [ -f "$f" ] || continue; ` +
    `  d=$(date -r "$f" +"%F %T" 2>/dev/null); ` +
    `  echo "F|${'${d:0:19}'}|$f"; ` +
    `done; ` +
    `echo "D|$(date +%F 2>/dev/null)"`;

  let out = '';
  try {
    out = await sshExec(sshCfg, cmd);
  } catch (e) {
    console.error('[files] listing failed:', e.message);
  }

  const files = [];
  const seen = new Set();
  let remoteToday = '';

  out.split('\n').forEach((row) => {
    if (row.startsWith('D|')) { remoteToday = row.slice(2).trim(); return; }
    if (!row.startsWith('F|')) return;
    const parts = row.slice(2).split('|');
    const mtime = (parts.shift() || '').trim();     // "YYYY-MM-DD HH:MM:SS"
    const path = parts.join('|').trim();
    if (!path || seen.has(path)) return;
    seen.add(path);
    files.push({
      path,
      name: path.slice(path.lastIndexOf('/') + 1),
      day: mtime.slice(0, 10),
      mtimeClock: mtime.slice(11, 19),
      active: path === logFile,
      compressed: /\.(gz|bz2|xz)$/i.test(path),
    });
  });

  if (!isDate(remoteToday)) remoteToday = today();

  // If listing produced nothing at all, still search the file we know exists
  // — live tailing reads it successfully, so it is definitely there.
  if (!files.length) {
    files.push({
      path: logFile,
      name: logFile.slice(logFile.lastIndexOf('/') + 1),
      day: remoteToday,
      active: true,
      compressed: false,
    });
  }
  files.forEach((f) => { if (!f.day) f.day = remoteToday; });
  files.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return { files, remoteToday };
}

function pickFiles(all, dayFrom, dayTo) {
  // Rotation naming is not consistent across the Amrita hosts:
  //   MOCK  server.log.2026-09-04        holds 4 Sep
  //   LIVE  app1-console.log-2026-09-04  holds 3 Sep plus early 4 Sep,
  //                                      because the suffix is the date it
  //                                      was ROTATED, not the date inside.
  // So a file named for day D may hold D or D-1. Take both, and let the
  // content decide which lines actually match.
  const lo = dayFrom;
  const hi = addDays(dayTo, 1);
  const chosen = all.filter((f) => {
    const named = dateInName(f.name);
    if (named) return named >= lo && named <= hi;
    if (f.active) return true;
    return f.day >= lo && f.day <= hi;
  });
  return chosen.slice(-MAX_FILES);
}

// ── The filter ─────────────────────────────────────────────
//
// Gives every line a full "YYYY-MM-DD HH:MM:SS" and decides whether it is
// inside the window.
//   - a line with its own full date uses that
//   - a line with only a clock time uses the file's date
//   - a line with no timestamp (a stack-trace body) follows the line above,
//     so exceptions are never split from their message
//
// allowRollover is false when the filename already gives the date. Such a
// file covers exactly one day, so there is nothing to infer. Guessing there
// was an actual bug: a single out-of-order line, or a message that merely
// contained something shaped like a time, rolled the date forward and
// silently dropped the rest of the file.
const MONTHS = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
                 Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };

// The LIVE hosts write through syslog, so every line starts with a real date:
//   "Sep  3 11:51:30 fbdapp1 app1-console: 11:51:30,349 INFO [org.amma...]"
// That is the date to trust. It removes all guessing for these files — no
// anchoring from the file's timestamp, no midnight inference.
// Syslog omits the year, so it comes from the file's own year, with a
// correction for a file that spans a New Year boundary.
const SYSLOG_RE = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/;

function syslogTs(line, fileYear, fileMonth) {
  const m = line.match(SYSLOG_RE);
  if (!m) return null;
  const mon = MONTHS[m[1]];
  if (!mon) return null;
  let year = fileYear;
  if (mon === '12' && fileMonth === '01') year -= 1;   // December line in a January file
  if (mon === '01' && fileMonth === '12') year += 1;
  return `${year}-${mon}-${String(m[2]).padStart(2, '0')} ${m[3]}:${m[4]}:${m[5]}`;
}

function makeFilter(fileDay, startTs, endTs, emit, maxRollovers, stats) {
  const DATE_RE = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
  const TIME_RE = /\d{2}:\d{2}:\d{2}/;
  let day = fileDay;
  let prevSec = null;
  let keep = false;
  let lastTs = '';
  let pastEnd = 0;
  let rollsLeft = maxRollovers === true ? 2 : (maxRollovers || 0);

  const fileYear = +String(fileDay).slice(0, 4);
  const fileMonth = String(fileDay).slice(5, 7);

  return function (line) {
    let ts = null;
    let m = line.match(DATE_RE);

    const sys = ts === null ? syslogTs(line, fileYear, fileMonth) : null;

    if (m) {
      ts = m[0].replace('T', ' ');
    } else if (sys) {
      ts = sys;                       // date came from the line itself
    } else if ((m = line.match(TIME_RE))) {
      const t = m[0];
      const s = +t.slice(0, 2) * 3600 + +t.slice(3, 5) * 60 + +t.slice(6, 8);
      // Only a real late-night -> early-morning wrap counts as midnight, and
      // only as many times as the file's own span allows. A file that starts
      // and ends on the same day gets a budget of zero: without that, one
      // stray line — a stack trace, or a message that merely prints a time —
      // pushed the date forward and silently dropped the rest of the file.
      if (rollsLeft > 0 && prevSec !== null && prevSec > 72000 && s < 14400) {
        day = addDays(day, 1);
        rollsLeft--;
      }
      prevSec = s;
      ts = day + ' ' + t;
    }

    if (ts === null) {                      // continuation line
      if (keep) emit(lastTs, line);
      return true;
    }

    lastTs = ts;
    if (stats) {
      if (!stats.firstTs) stats.firstTs = ts;
      stats.lastTs = ts;
      stats.timestamped = (stats.timestamped || 0) + 1;
    }
    keep = ts >= startTs && ts <= endTs;
    if (keep) emit(ts, line);

    // Logs run in time order, so once we are well past the end we can stop.
    if (ts > endTs) { pastEnd++; if (pastEnd > PAST_END_LIMIT) return false; }
    else pastEnd = 0;

    return true;
  };
}

function readerFor(f) {
  // .gz is read raw and decompressed in Node — no zcat needed on the host.
  if (/\.bz2$/i.test(f.path)) return `bzcat ${shq(f.path)}`;
  if (/\.xz$/i.test(f.path)) return `xzcat ${shq(f.path)}`;
  return `cat ${shq(f.path)}`;
}

const isGzip = (f) => /\.gz$/i.test(f.path);

function resolveWindow(date, start, end) {
  const dayFrom = isDate(date) ? date : today();
  const crossesMidnight = !!(start && end) && end < start;
  const dayTo = crossesMidnight ? addDays(dayFrom, 1) : dayFrom;
  return {
    dayFrom,
    dayTo,
    startTs: `${dayFrom} ${start || '00:00:00'}`,
    endTs: `${dayTo} ${end || '23:59:59'}`,
  };
}

// Walk the chosen files and hand every matching line to `emit`.
// `shouldStop` lets the caller end it early (preview cap).
// Work out which calendar day a file's first line belongs to.
//
// The filename cannot be trusted: on MOCK, server.log.2026-09-04 holds 4 Sep,
// but on LIVE, app1-console.log-2026-09-04.gz holds 3 Sep plus the early hours
// of 4 Sep, because the suffix records when it was rotated rather than what is
// inside it.
//
// What IS reliable is the file's last-modified time: that is the moment the
// last line was written, so the file ENDS there. Read the clock time of the
// first line, compare it with the clock time of the mtime, and we know whether
// the file crossed midnight on its way there.
//
// If the lines carry their own full date, none of this matters and we say so.
async function anchorDay(sshCfg, f) {
  const endDay = f.day || today();
  const endClock = f.mtimeClock || '23:59:59';
  const toSec = (t) => +t.slice(0, 2) * 3600 + +t.slice(3, 5) * 60 + +t.slice(6, 8);

  let firstTime = null;
  let firstTs = null;      // full "YYYY-MM-DD HH:MM:SS" of the first line, when known
  let selfDated = false;
  let syslog = false;
  let checked = 0;

  try {
    await sshStreamLines(sshCfg, readerFor(f), (line, ctl) => {
      const iso = line.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
      if (iso) { selfDated = true; firstTs = iso[0].replace('T', ' '); return ctl.stop(); }
      if (SYSLOG_RE.test(line)) {
        selfDated = true;
        syslog = true;
        // Resolve it fully so we know the real instant this file begins.
        firstTs = syslogTs(line, +endDay.slice(0, 4), endDay.slice(5, 7));
        return ctl.stop();
      }
      const m = line.match(/\d{2}:\d{2}:\d{2}/);
      if (m) { firstTime = m[0]; return ctl.stop(); }
      if (++checked > 500) return ctl.stop();      // no timestamps near the top
    }, { gunzip: isGzip(f) });
  } catch (err) {
    console.error(`[anchor] ${f.name}: ${err.message}`);
  }

  if (selfDated) return { day: endDay, rollovers: 0, selfDated: true, syslog, firstTs };
  if (!firstTime) return { day: endDay, rollovers: 2, selfDated: false };

  // A file that ran right up to roughly the same clock time it started at has
  // been through a midnight. 10 minutes of slack absorbs rotation jitter.
  const crossed = toSec(firstTime) > toSec(endClock) - 600;
  return {
    day: crossed ? addDays(endDay, -1) : endDay,
    rollovers: crossed ? 1 : 0,     // exactly what the span allows, no more
    selfDated: false,
    firstTime,
    endClock,
  };
}

async function scanWindow(sshCfg, files, win, emit, shouldStop, maxMs) {
  let bytes = 0;
  let hitTimeCap = false;
  const scanned = [];

  for (const f of files) {
    if (shouldStop && shouldStop()) break;

    const a = await anchorDay(sshCfg, f);
    const fileDay = a.day;

    // We know roughly what span this file covers: it begins at its first line
    // and was last written at its mtime. If that span cannot overlap the
    // requested window, skip it — there is no point decompressing 40 million
    // lines of an archive that cannot hold a single match. This applies to
    // self-dated files too; excluding them meant one 3-September archive
    // consumed the entire time budget before the 4-September file was reached.
    if (f.mtimeClock) {
      const fileStart = a.firstTs || (a.firstTime ? `${fileDay} ${a.firstTime}` : null);
      // mtime can lag the last line slightly, so allow a couple of hours.
      const fileEnd = addHours(`${f.day} ${f.mtimeClock}`, 2);
      if ((fileEnd < win.startTs) || (fileStart && fileStart > win.endTs)) {
        console.log(`[scan] ${f.name}: covers ${fileStart || '?'} → ${f.day} ${f.mtimeClock}, outside the window — skipped`);
        scanned.push({ file: f.name, skipped: true, covers: `${fileStart || '?'} → ${f.day} ${f.mtimeClock}` });
        continue;
      }
    }

    let kept = 0;
    const stats = {};
    const filter = makeFilter(
      fileDay, win.startTs, win.endTs,
      (ts, line) => { kept++; emit(ts, line, ctlRef.current); },
      a.rollovers,
      stats,
    );

    const ctlRef = { current: null };
    const tFile = Date.now();     // budget is per file
    let res;
    try {
      res = await sshStreamLines(sshCfg, readerFor(f), (line, ctl) => {
        ctlRef.current = ctl;
        if (shouldStop && shouldStop()) return ctl.stop();
        // Guard for the preview only: a wide window over a very large file
        // can match few lines yet still read gigabytes. Stop and tell the
        // user to narrow it or use Download, rather than reading forever.
        if (maxMs && Date.now() - tFile > maxMs) {
          hitTimeCap = true;
          return ctl.stop();
        }
        if (filter(line) === false) return ctl.stop();
      }, { gunzip: isGzip(f) });
    } catch (err) {
      console.error(`[scan] ${f.name}: ${err.message}`);
      scanned.push({ file: f.name, error: err.message });
      continue;
    }

    bytes += res.bytes;
    scanned.push({ file: f.name, day: fileDay, bytes: res.bytes, kept });
    console.log(`[scan] ${f.name}: starts ${fileDay}` +
      (a.selfDated ? (a.syslog ? ' (syslog date in each line)' : ' (self-dated)') : ` (first ${a.firstTime || '?'}, mtime ${a.endClock}, midnights allowed ${a.rollovers})`) +
      ` — ${res.bytes} bytes read, ${kept} lines matched`);
    if (!kept) {
      // Say what the file actually contained, so a zero result explains itself
      // instead of leaving you to guess.
      console.log(`[scan] ${f.name}: saw ${stats.timestamped || 0} timestamped lines, ` +
        `${stats.firstTs || 'none'} → ${stats.lastTs || 'none'}; wanted ${win.startTs} → ${win.endTs}`);
    }
  }

  return { bytes, scanned, hitTimeCap };
}

// ── One environment ────────────────────────────────────────
function bootServer(srv) {
  const { id, label, wsPort, httpPort, nodes } = srv;
  const ssh = resolveSsh(srv);
  const TAG = `[${label}]`;
  const hasCreds = !!(ssh.password || ssh.privateKey);

  console.log(`\n${TAG} ── Starting ──`);
  console.log(`${TAG} WS ${wsPort} · HTTP ${httpPort} · SSH ${ssh.username || '(none)'}@${ssh.host}`);
  if (!hasCreds) console.warn(`${TAG} no password or key set — live tail disabled, API still responds`);
  nodes.forEach((n) => {
    const f = Object.entries(n.logs).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(', ');
    console.log(`${TAG} ${n.name} : ${f}`);
  });

  // ── HTTP API ─────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, server: id, label, nodes: nodes.length }));

  app.get('/api/nodes', (req, res) =>
    res.json({
      success: true,
      server: id,
      label,
      color: srv.color || '#58a6ff',
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        logTypes: getNodeLogTypes(n).map((lt) => ({ id: lt.id, name: lt.name })),
      })),
    }));

  // Which log files exist on the host, and how far back they go.
  app.get('/api/logfiles', async (req, res) => {
    try {
      const logFile = getLogFile(nodes, req.query.nodeId, req.query.logType || 'server');
      if (!logFile) return res.status(400).json({ success: false, error: 'Log file not configured.' });
      const { files, remoteToday } = await listFiles(ssh, logFile);
      res.json({ success: true, server: id, active: logFile, remoteToday, files });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // HISTORY — capped, for viewing in the browser.
  app.get('/api/logs', async (req, res) => {
    const t0 = Date.now();
    try {
      const { date, start, end, nodeId, logType } = req.query;
      const logFile = getLogFile(nodes, nodeId, logType || 'server');
      if (!logFile) return res.status(400).json({ success: false, error: 'Log file not configured.' });

      const node = getNode(nodes, nodeId);
      const win = resolveWindow(date, start, end);
      console.log(`${TAG} [history] ${node.name}/${logType} ${win.startTs} → ${win.endTs}`);

      const { files: all } = await listFiles(ssh, logFile);
      const files = pickFiles(all, win.dayFrom, win.dayTo);

      const logs = [];
      let truncated = false;
      const { bytes, scanned, hitTimeCap } = await scanWindow(
        ssh, files, win,
        (ts, line) => { logs.push({ ts, line, level: classifyLevel(line) }); },
        () => {
          if (logs.length >= PREVIEW_MAX_LINES) { truncated = true; return true; }
          return false;
        },
        PREVIEW_MAX_MS,
      );
      if (hitTimeCap) {
        truncated = true;
        console.warn(`${TAG} [history] gave up after ${PREVIEW_MAX_MS / 1000}s — narrow the window, or use Download`);
      }

      logs.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

      console.log(`${TAG} [history] ${logs.length} lines in ${Date.now() - t0}ms` +
        (truncated ? ' (capped — use Download for everything)' : ''));

      res.json({
        success: true,
        server: id,
        label,
        node: node.name,
        logType,
        filtered: logs.length,
        logs,
        truncated,
        window: { start: win.startTs, end: win.endTs },
        filesScanned: files.map((f) => f.name),
        candidates: all.map((f) => f.name),
        bytesRead: bytes,
        scanned,
      });
    } catch (err) {
      console.error(`${TAG} [history] ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // EXPORT — the same window, streamed straight to a file download.
  // No line cap and no size cap: nothing is stored on this server and the
  // browser writes it to disk as it arrives, so a multi-GB extract is fine.
  app.get('/api/export', async (req, res) => {
    const t0 = Date.now();
    const { date, start, end, nodeId, logType, level, keyword } = req.query;

    try {
      const logFile = getLogFile(nodes, nodeId, logType || 'server');
      if (!logFile) return res.status(400).json({ success: false, error: 'Log file not configured.' });

      const node = getNode(nodes, nodeId);
      const win = resolveWindow(date, start, end);
      const wantLevel = (level || '').toUpperCase();
      const kw = (keyword || '').toLowerCase();

      const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');
      const fname = `${safe(label)}_${safe(node.name)}_${safe(logType || 'server')}` +
                    `_${safe(win.dayFrom)}_${safe((start || '000000').replace(/:/g, ''))}` +
                    `-${safe((end || '235959').replace(/:/g, ''))}.log`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.setHeader('Cache-Control', 'no-store');

      res.write(`# Amrita Log Tracker export\n`);
      res.write(`# ${label} / ${node.name} / ${logType || 'server'}\n`);
      res.write(`# Window: ${win.startTs} to ${win.endTs}\n`);
      if (wantLevel && wantLevel !== 'ALL') res.write(`# Level: ${wantLevel}\n`);
      if (kw) res.write(`# Keyword: ${keyword}\n`);
      res.write(`# Generated: ${new Date().toISOString()}\n`);
      res.write(`${'#'.repeat(70)}\n`);

      const { files: all } = await listFiles(ssh, logFile);
      const files = pickFiles(all, win.dayFrom, win.dayTo);
      res.write(`# Files searched: ${files.map((f) => f.name).join(', ') || 'none'}\n\n`);

      console.log(`${TAG} [export] ${node.name}/${logType} ${win.startTs} → ${win.endTs} → ${fname}`);

      let written = 0;
      let aborted = false;
      res.on('close', () => { aborted = true; });   // user cancelled the download

      // Backpressure: if the browser or network is slower than the log host,
      // pause the SSH stream instead of buffering in memory.
      let pendingCtl = null;
      res.on('drain', () => { if (pendingCtl) { const c = pendingCtl; pendingCtl = null; c.resume(); } });

      const emit = (ts, line, ctl) => {
        if (aborted) return;
        if (wantLevel && wantLevel !== 'ALL' && classifyLevel(line) !== wantLevel) return;
        if (kw && !line.toLowerCase().includes(kw)) return;
        written++;
        if (res.write(line + '\n') === false && ctl) {
          pendingCtl = ctl;
          ctl.pause();
        }
      };

      await scanWindow(
        ssh, files, win,
        emit,
        () => aborted,
      );

      res.write(`\n${'#'.repeat(70)}\n# ${written} lines · ${Math.round((Date.now() - t0) / 1000)}s\n`);
      res.end();
      console.log(`${TAG} [export] ${written} lines in ${Date.now() - t0}ms`);
    } catch (err) {
      console.error(`${TAG} [export] ${err.message}`);
      if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
      else { res.write(`\n# EXPORT FAILED: ${err.message}\n`); res.end(); }
    }
  });

  app.listen(httpPort, '0.0.0.0', () =>
    console.log(`${TAG} API ready → http://0.0.0.0:${httpPort}`));

  // ── Live streaming ───────────────────────────────────────
  const wss = new WebSocketServer({ port: wsPort, host: '0.0.0.0' });
  const subs = new Map();   // ws -> { nodeId, logType }

  function broadcast(nodeId, logType, msg) {
    const text = JSON.stringify(msg);
    wss.clients.forEach((c) => {
      if (c.readyState !== 1) return;
      const s = subs.get(c);
      if (s && s.nodeId === nodeId && s.logType === logType) c.send(text);
    });
  }

  // Read the tail of the file at the moment the viewer presses Start, so the
  // panel shows the file's real current content rather than a buffer captured
  // whenever this process happened to boot.
  async function backfill(ws, node, logType) {
    const logFile = node.logs[logType];
    if (!logFile || !hasCreds) return 0;
    try {
      const out = await sshExec(ssh, `tail -n ${BACKFILL_LINES} ${shq(logFile)}`);
      const lines = out.split('\n').filter((l) => l.trim());
      lines.forEach((line) => {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({
          type: 'log',
          serverId: id, serverLabel: label,
          nodeId: node.id, nodeName: node.name,
          logType,
          level: classifyLevel(line),
          line,
          backfill: true,
          timestamp: new Date().toISOString(),
        }));
      });
      return lines.length;
    } catch (err) {
      console.error(`${TAG} [live] backfill failed: ${err.message}`);
      return 0;
    }
  }

  // One persistent tail per node/log type. A failed connection schedules
  // exactly ONE retry — ssh2 emits both 'error' and 'close', and retrying on
  // each doubled the number of live connections every few seconds until the
  // process ran out of memory.
  function startTail(node, logType, attempt) {
    const logFile = node.logs[logType];
    if (!logFile) return;
    attempt = attempt || 0;

    const conn = new Client();
    let retried = false;

    const retry = () => {
      if (retried) return;
      retried = true;
      try { conn.end(); } catch (e) {}
      const wait = Math.min(60000, 5000 * Math.pow(2, Math.min(attempt, 4)))
                 + Math.floor(Math.random() * 2000);
      setTimeout(() => startTail(node, logType, attempt + 1), wait);
    };

    conn.on('ready', () => {
      attempt = 0;
      console.log(`${TAG} [live] tailing ${node.name}/${logType}`);
      // -F, not -f, so the stream survives log rotation at midnight.
      conn.exec(REMOTE_PATH + `tail -n 0 -F ${shq(logFile)}`, { pty: false }, (err, stream) => {
        if (err) return retry();
        let buf = '';
        stream.stdout.on('data', (d) => {
          buf += d.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach((line) => {
            if (!line.trim()) return;
            broadcast(node.id, logType, {
              type: 'log',
              serverId: id, serverLabel: label,
              nodeId: node.id, nodeName: node.name,
              logType,
              level: classifyLevel(line),
              line,
              timestamp: new Date().toISOString(),
            });
          });
        });
        stream.on('close', () => conn.end());
      });
    });

    conn.on('error', (err) => {
      if (attempt < 3) console.error(`${TAG} [live] ${node.name}/${logType}: ${err.message}`);
      else if (attempt === 3) console.error(`${TAG} [live] ${node.name}/${logType}: still failing, muting`);
      retry();
    });
    conn.on('close', retry);
    conn.on('end', retry);
    conn.connect({ ...ssh, readyTimeout: 10000, keepaliveInterval: 10000 });
  }

  wss.on('connection', (ws) => {
    console.log(`${TAG} [ws] connected (${wss.clients.size})`);

    ws.send(JSON.stringify({
      type: 'nodes',
      server: id, label, color: srv.color || '#58a6ff',
      nodes: nodes.map((n) => ({
        id: n.id, name: n.name,
        logTypes: getNodeLogTypes(n).map((lt) => ({ id: lt.id, name: lt.name })),
      })),
    }));
    ws.send(JSON.stringify({
      type: 'status', connected: true,
      message: `[${label}] Connected. Select a node and log type.`,
    }));

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (e) { return; }
      if (msg.type !== 'subscribe') return;

      subs.set(ws, { nodeId: msg.nodeId, logType: msg.logType });
      if (!msg.nodeId || msg.nodeId === '__stopped__') return;
      console.log(`${TAG} [ws] subscribed ${msg.nodeId}/${msg.logType}`);

      const node = nodes.find((n) => n.id === msg.nodeId);
      if (!node || !msg.logType || msg.logType === 'all') {
        ws.send(JSON.stringify({
          type: 'status', connected: true,
          message: `[${label}] Streaming ${msg.nodeId} / ${msg.logType}...`,
        }));
        return;
      }

      backfill(ws, node, msg.logType).then((n) => {
        if (ws.readyState !== 1) return;
        ws.send(JSON.stringify({
          type: 'status', connected: true,
          message: `[${label}] Streaming ${node.name} / ${msg.logType}` +
                   (n ? ` — last ${n} lines shown, watching for new` : ' — waiting for new lines'),
        }));
      });
    });

    ws.on('close', () => {
      subs.delete(ws);
      console.log(`${TAG} [ws] disconnected (${wss.clients.size})`);
    });
  });

  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30000);

  if (hasCreds) {
    nodes.forEach((node) => LOG_TYPES.forEach((lt) => {
      if (node.logs[lt.id]) startTail(node, lt.id);
    }));
  }
}

// ── Start ──────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(` ${CONFIG.app.name} v${CONFIG.app.version} — backend v3.0`);
console.log(` ${CONFIG.servers.length} environment(s)`);
console.log('='.repeat(60));

CONFIG.servers.forEach(bootServer);

// All environments share this process. Never let one take down the rest.
process.on('uncaughtException', (e) => console.error('[fatal]', e && e.message));
process.on('unhandledRejection', (e) => console.error('[fatal]', e && (e.message || e)));

module.exports = { makeFilter, pickFiles, dateInName, addDays, addHours, resolveWindow };