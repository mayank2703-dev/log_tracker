import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { collapse } from '../lib/motion.js';
import Segmented from './Segmented.jsx';
import { exportUrl } from '../net/net.js';

const QUICK = [
  { value: '10', label: '10m' },
  { value: '30', label: '30m' },
  { value: '60', label: '1h' },
  { value: '180', label: '3h' },
];

export default function TimeRange({ onSearch, status }) {
  const mode = useStore((s) => s.mode);
  const wrapRef = useRef(null);
  const firstRun = useRef(true);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [quick, setQuick] = useState('');

  // show/hide with an animated collapse; skip animation on first paint
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (wrapRef.current) wrapRef.current.style.display = mode === 'history' ? '' : 'none';
      return;
    }
    collapse(wrapRef.current, mode === 'history');
  }, [mode]);

  const applyQuick = (min) => {
    setQuick(String(min));
    const now = new Date();
    const from = new Date(now - min * 60000);
    const p = (n) => String(n).padStart(2, '0');
    setStart(`${p(from.getHours())}:${p(from.getMinutes())}:${p(from.getSeconds())}`);
    setEnd(`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`);
    setDate(now.toISOString().slice(0, 10));
  };

  return (
    <div className="timerange" ref={wrapRef}>
      <section className="panel">
        <div className="field">
          <span className="lbl">Date</span>
          <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <span className="lbl">From</span>
          <input
            className="inp"
            type="time"
            step="1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="field">
          <span className="lbl">To</span>
          <input
            className="inp"
            type="time"
            step="1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="field">
          <span className="lbl">Quick range</span>
          <Segmented
            ariaLabel="Quick range"
            options={QUICK}
            value={quick}
            onChange={(v) => applyQuick(Number(v))}
          />
        </div>

        <button className="btn -primary" type="button" onClick={() => onSearch({ date, start, end })}>
          Search logs
        </button>

                {/* Downloads the WHOLE window, not just the preview above.
            The browser fetches this URL directly and writes it to disk as it
            arrives, so file size is not limited by browser memory. */}
        <button
          className="btn"
          type="button"
          title="Download every matching line for this window as a file"
          onClick={() => {
            if (!date || !start || !end) return;
            window.location.href = exportUrl({ date, start, end });
          }}
        >
          Download full log
        </button>

        <span
          className="stat"
          style={{
            color:
              status.kind === 'err'
                ? 'var(--err)'
                : status.kind === 'ok'
                  ? 'var(--ok)'
                  : 'var(--fg-dim)',
          }}
        >
          {status.text}
        </span>
      </section>
    </div>
  );
}
