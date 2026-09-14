import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { getState, actions, isReady, serverCfg, activeNode } from '../store/store.js';
import {
  subscribeActive,
  clearActiveBuffers,
  activeBufferLogs,
  pokeData,
} from '../net/net.js';
import { LT_META } from '../config.js';
import { norm, matchFilter } from '../lib/format.js';
import { countTo, enter } from '../lib/motion.js';
import { download, buildExport, exportName } from '../lib/export.js';

const LEVELS = [
  { v: 'ALL', t: 'All levels' },
  { v: 'ERROR', t: 'Error only' },
  { v: 'WARN', t: 'Warn + Error' },
  { v: 'INFO', t: 'Info and above' },
  { v: 'DEBUG', t: 'Debug only' },
];
const STAT_KEYS = ['shown', 'total', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

export default function Toolbar() {
  const filters = useStore((s) => s.filters);
  const mode = useStore((s) => s.mode);
  const streaming = useStore((s) => s.streaming);
  const autoScroll = useStore((s) => s.autoScroll);
  const stats = useStore((s) => s.stats);
  const ready = useStore((s) => isReady(s));

  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef(null);
  const numRefs = useRef({});

  useEffect(() => {
    enter(barRef.current, { y: 8, delay: 0.12 });
  }, []);

  useEffect(() => {
    STAT_KEYS.forEach((k) => countTo(numRefs.current[k], stats[k] || 0));
  }, [stats]);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const start = () => {
    if (!isReady(getState())) return;
    actions.setMode('live');
    actions.setStreaming(true);
    clearActiveBuffers();
    subscribeActive();
    pokeData();
  };
  const stop = () => {
    actions.setStreaming(false);
    subscribeActive();
    pokeData();
  };
  const clear = () => {
    const s = getState();
    if (s.mode === 'history') {
      actions.setHistLogs([]);
      actions.setHist({ date: '', start: '', end: '', truncated: false, fetched: 0 });
      actions.setMode('live');
      subscribeActive();
    } else {
      clearActiveBuffers();
    }
    pokeData();
  };

  const doExport = (fmt) => {
    setMenuOpen(false);
    const s = getState();
    const rows = (
      s.mode === 'history' ? s.histLogs : activeBufferLogs().map((m) => norm(m, s.logType))
    ).filter((o) => matchFilter(o, s.filters));
    if (!rows.length) {
      alert('Nothing to export — no visible lines.');
      return;
    }
    const sc = serverCfg(s);
    const node = activeNode(s);
    const meta = {
      server: sc?.label || '',
      node: node?.name || '',
      logType: LT_META[s.logType]?.name || s.logType || '',
      logTypeId: s.logType,
      mode: s.mode,
      ...s.hist,
      level: s.filters.level,
      keyword: (s.filters.search || '').trim(),
    };
    try {
      const { text, mime } = buildExport(fmt, rows, meta);
      download(text, exportName(meta, fmt), mime);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const toggleScroll = () => actions.setAutoScroll(!getState().autoScroll);

  return (
    <div className="bar" ref={barRef}>
      <div className="search">
        <input
          className="inp"
          placeholder="Filter messages…"
          value={filters.search}
          onChange={(e) => actions.setFilters({ search: e.target.value })}
        />
      </div>

      <select
        className="sel -sm"
        title="Level"
        style={{ minWidth: 150 }}
        value={filters.level}
        onChange={(e) => actions.setFilters({ level: e.target.value })}
      >
        {LEVELS.map((l) => (
          <option key={l.v} value={l.v}>
            {l.t}
          </option>
        ))}
      </select>

      {mode === 'live' && (
        <span className="stream">
          <button className="btn -go -sm" type="button" onClick={start} disabled={!ready || streaming}>
            ▶ Start
          </button>
          <button className="btn -stop -sm" type="button" onClick={stop} disabled={!ready || !streaming}>
            ■ Stop
          </button>
        </span>
      )}

      <div className="stats">
        <span className="stat -show">
          Showing{' '}
          <b
            ref={(el) => {
              numRefs.current.shown = el;
            }}
          >
            0
          </b>
        </span>
        <span className="stat">
          Total{' '}
          <b
            ref={(el) => {
              numRefs.current.total = el;
            }}
          >
            0
          </b>
        </span>
        {['ERROR', 'WARN', 'INFO', 'DEBUG'].map((k) => (
          <span
            key={k}
            className={`stat -clk -${k.toLowerCase()}`}
            onClick={() => actions.setFilters({ level: k })}
          >
            {k[0] + k.slice(1).toLowerCase()}{' '}
            <b
              ref={(el) => {
                numRefs.current[k] = el;
              }}
            >
              0
            </b>
          </span>
        ))}
      </div>

      <div className="spacer" />

      <button
        className={`btn -sm ${autoScroll ? '-on' : ''}`}
        type="button"
        onClick={toggleScroll}
      >
        ↓ Auto-scroll{autoScroll ? '' : ' off'}
      </button>

      <div className="menu">
        <button
          className="btn -sm"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          ⬇ Export ▾
        </button>
        {menuOpen && (
          <div className="list">
            <button type="button" onClick={() => doExport('xls')}>
              <span>Excel workbook</span>
              <span className="sub">.xls · opens as a grid</span>
            </button>
            <button type="button" onClick={() => doExport('csv')}>
              <span>CSV</span>
              <span className="sub">.csv · Sheets / import</span>
            </button>
            <button type="button" onClick={() => doExport('txt')}>
              <span>Text report</span>
              <span className="sub">.txt</span>
            </button>
          </div>
        )}
      </div>

      <button className="btn -sm -ghost" type="button" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
