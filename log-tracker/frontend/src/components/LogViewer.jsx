import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { actions } from '../store/store.js';
import { DISPLAY_CAP, LT_META } from '../config.js';
import { onData, activeBufferLogs } from '../net/net.js';
import { norm, matchFilter, countLevels } from '../lib/format.js';
import Stepper from './Stepper.jsx';
import LogRow from './LogRow.jsx';

export default function LogViewer() {
  const mode = useStore((s) => s.mode);
  const streaming = useStore((s) => s.streaming);
  const autoScroll = useStore((s) => s.autoScroll);
  const filters = useStore((s) => s.filters);
  const serverId = useStore((s) => s.serverId);
  const nodeId = useStore((s) => s.nodeId);
  const logType = useStore((s) => s.logType);
  const histLogs = useStore((s) => s.histLogs);
  const histLoading = useStore((s) => s.histLoading);

  const [tick, setTick] = useState(0);
  const scrollRef = useRef(null);
  const statsAt = useRef(0);

  // throttled "new live data" pulses from the net layer
  useEffect(() => onData(() => setTick((t) => (t + 1) % 1e9)), []);

  const source = useMemo(
    () => (mode === 'history' ? histLogs : activeBufferLogs().map((m) => norm(m, logType))),
    [mode, histLogs, serverId, nodeId, logType, tick],
  );

  const filtered = useMemo(
    () => source.filter((o) => matchFilter(o, filters)),
    [source, filters],
  );

  const capped =
    filtered.length > DISPLAY_CAP ? filtered.slice(-DISPLAY_CAP) : filtered;

  // publish counts for the toolbar — throttled so the numbers stay calm
  const pushStats = useCallback(() => {
    statsAt.current = Date.now();
    const c = countLevels(source);
    actions.setStats({ total: source.length, shown: filtered.length, ...c });
  }, [source, filtered.length]);

  useEffect(() => {
    const since = Date.now() - statsAt.current;
    if (since >= 600) {
      pushStats();
      return undefined;
    }
    const id = setTimeout(pushStats, 600 - since);
    return () => clearTimeout(id);
  }, [pushStats]);

  // keep the stream pinned to the newest line
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (mode === 'live' && autoScroll) el.scrollTop = el.scrollHeight;
    else if (mode === 'history') el.scrollTop = 0;
  }, [capped.length, autoScroll, mode]);

  const ready = !!(serverId && nodeId && logType);
  const activeStep = !serverId ? 1 : !nodeId ? 2 : !logType ? 3 : 4;
  const done = [serverId && 1, nodeId && 2, logType && 3].filter(Boolean);

  const showGuide = !ready && !histLogs.length && !histLoading;
  const showReady = ready && mode === 'live' && !streaming && capped.length === 0 && !histLoading;
  const showEmpty =
    !showGuide && !showReady && !histLoading && capped.length === 0 && (mode === 'history' || streaming);

  return (
    <div className="viewer">
      <div className="scroll" ref={scrollRef}>
        {showGuide && (
          <div className="state">
            <Stepper active={activeStep} done={done} />
            <p className="hint">
              Pick an <b>environment</b>, then the <b>node</b> to inspect (LIVE exposes all 4 nodes),
              then a <b>log type</b> — Server, Console or GC. Use <b>Live</b> to stream now or{' '}
              <b>History</b> for a past window, then export as a spreadsheet.
            </p>
          </div>
        )}

        {histLoading && (
          <div className="state">
            <div className="spin" />
            Fetching logs…
          </div>
        )}

        {showReady && (
          <div className="state">
            Ready — press <b style={{ color: 'var(--ok)' }}>▶ Start</b> to stream{' '}
            {LT_META[logType]?.name || logType} logs.
          </div>
        )}

        {showEmpty && (
          <div className="state" style={{ color: 'var(--fg-faint)' }}>
            {mode === 'history'
              ? histLogs.length === 0
                ? 'No logs found in this window.'
                : 'No lines match the current filters.'
              : source.length === 0
                ? 'Streaming — waiting for log lines…'
                : 'No lines match the current filters.'}
          </div>
        )}

        {!histLoading && capped.length > 0 && (
          <div className="list">
            {capped.map((o) => (
              <LogRow
                key={o.__id}
                row={o}
                search={filters.search}
                showType={logType === 'all'}
                animate={mode === 'live'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
