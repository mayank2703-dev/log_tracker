// =====================================================================
//  WebSocket manager + history REST fetch.
//  One socket per environment, auto-reconnect. Live lines land in
//  ./buffers.js; a throttled "data" event tells the viewer to re-read.
// =====================================================================
import { SERVER_CONFIGS, HOST } from '../config.js';
import { getState, actions, activeNode, serverCfg } from '../store/store.js';
import { bkey, bpush, bget, bclearMany } from './buffers.js';

let started = false;
let seq = 0;
const conns = {};

// ---- data notifications (viewer subscribes) --------------------------
const dataListeners = new Set();
export const onData = (fn) => {
  dataListeners.add(fn);
  return () => dataListeners.delete(fn);
};
let flushT = null;
function pingData() {
  if (flushT) return;
  flushT = setTimeout(() => {
    flushT = null;
    dataListeners.forEach((f) => f());
  }, 120);
}
export const pokeData = () => dataListeners.forEach((f) => f());

// ---- lifecycle ------------------------------------------------------
export function initNet() {
  if (started) return; // guard React StrictMode double-invoke
  started = true;
  SERVER_CONFIGS.forEach(connect);
}

function connect(sc) {
  let ws;
  try {
    ws = new WebSocket(`ws://${HOST}:${sc.wsPort}`);
  } catch {
    setTimeout(() => connect(sc), 3000);
    return;
  }
  conns[sc.id] = ws;
  actions.setServerConn(sc.id, 'connecting');

  ws.onopen = () => {
    actions.setServerConn(sc.id, 'online');
    subscribeActive();
  };
  ws.onclose = () => {
    actions.setServerConn(sc.id, 'offline');
    setTimeout(() => connect(sc), 3000);
  };
  ws.onerror = () => actions.setServerConn(sc.id, 'offline');
  ws.onmessage = (evt) => {
    let m;
    try {
      m = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (m.type === 'nodes') {
      const st = getState().servers[sc.id];
      if (!st.nodes.length && m.nodes?.length) actions.setServerNodes(sc.id, m.nodes);
    } else if (m.type === 'log') {
      onLog(sc.id, m);
    }
  };
}

function onLog(serverId, msg) {
  msg.__id = ++seq;
  const lt = msg.logType || 'server';
  bpush(bkey(serverId, msg.nodeId, lt), msg);

  const s = getState();
  if (s.mode !== 'live' || !s.streaming) return;
  if (serverId !== s.serverId || msg.nodeId !== s.nodeId) return;
  if (s.logType !== 'all' && lt !== s.logType) return;
  pingData();
}

// ---- subscription control -----------------------------------------
export function subscribeActive() {
  const s = getState();
  const ws = conns[s.serverId];
  if (!ws || ws.readyState !== 1) return;

  if (s.mode !== 'live' || !s.streaming || !s.nodeId || !s.logType) {
    ws.send(JSON.stringify({ type: 'subscribe', nodeId: '__stopped__', logType: '' }));
    return;
  }
  const node = activeNode(s);
  const ids = s.logType === 'all' ? (node?.logTypes || []).map((l) => l.id) : [s.logType];
  ids.forEach((id) => ws.send(JSON.stringify({ type: 'subscribe', nodeId: s.nodeId, logType: id })));
}

export function clearActiveBuffers() {
  const s = getState();
  const node = activeNode(s);
  bclearMany((node?.logTypes || []).map((lt) => bkey(s.serverId, s.nodeId, lt.id)));
}

// ---- read side ----------------------------------------------------
export function activeBufferLogs() {
  const s = getState();
  if (!s.serverId || !s.nodeId || !s.logType) return [];
  const node = activeNode(s);

  if (s.logType === 'all') {
    const out = [];
    (node?.logTypes || []).forEach((lt) => {
      bget(bkey(s.serverId, s.nodeId, lt.id)).forEach((m) => out.push(m));
    });
    out.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    return out;
  }
  return bget(bkey(s.serverId, s.nodeId, s.logType)).slice();
}

// ---- history REST ------------------------------------------------
export async function fetchHistory({ date, start, end }) {
  const s = getState();
  const sc = serverCfg(s);
  const node = activeNode(s);
  const ids = s.logType === 'all' ? (node?.logTypes || []).map((l) => l.id) : [s.logType];
  const base = `http://${HOST}:${sc.httpPort}`;

  return Promise.all(
    ids.map(async (id) => {
      // `date` is what lets the backend reach rotated/archived files.
      // Without it the API can only ever see today's live log.
      const p = new URLSearchParams({
        date: date || '',
        start,
        end,
        nodeId: s.nodeId,
        logType: id,
      });
      const r = await fetch(`${base}/api/logs?${p}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'request failed');
      return {
        id,
        logs: d.logs || [],
        truncated: !!d.truncated,
        files: d.filesScanned || [],
      };
    }),
  );
}

// Build the direct download URL for the full window. The browser fetches this
// itself, so the file streams to disk without ever being held in the page —
// that is what makes a multi-GB extract possible.
export function exportUrl({ date, start, end }) {
  const s = getState();
  const sc = serverCfg(s);
  const logType = s.logType === 'all' ? 'server' : s.logType;
  const p = new URLSearchParams({
    date: date || '',
    start: start || '',
    end: end || '',
    nodeId: s.nodeId,
    logType,
    level: s.filters && s.filters.level && s.filters.level !== 'all' ? s.filters.level : '',
    keyword: (s.filters && s.filters.search) || '',
  });
  return `http://${HOST}:${sc.httpPort}/api/export?${p}`;
}