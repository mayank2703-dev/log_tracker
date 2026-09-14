// import { useCallback, useState } from 'react';
// import { getState, actions, activeNode } from '../store/store.js';
// import { fetchHistory, subscribeActive } from '../net/net.js';
// import { lineTime, matchFilter } from '../lib/format.js';

// // Owns the History search: validation, fetch, merge, client-side date
// // filter, and the little status line shown in the TimeRange panel.
// export function useHistory() {
//   const [status, setStatus] = useState({ text: '', kind: '' });

//   const run = useCallback(async ({ date, start, end }) => {
//     const s = getState();
//     if (!s.serverId) return setStatus({ text: 'Select an environment.', kind: 'err' });
//     if (!s.nodeId) return setStatus({ text: 'Select a node.', kind: 'err' });
//     if (!s.logType) return setStatus({ text: 'Select a log type.', kind: 'err' });
//     if (!start || !end) return setStatus({ text: 'Set both From and To times.', kind: 'err' });
//     if (!date) return setStatus({ text: 'Pick a date.', kind: 'err' });

//     actions.setMode('history');
//     actions.setStreaming(false);
//     subscribeActive();
//     setStatus({ text: 'Loading…', kind: '' });
//     actions.setHistLoading(true);
//     actions.setHistLogs([]);

//     try {
//       const parts = await fetchHistory({ date, start, end });
//       const node = activeNode();
//       let all = [];
//       let trunc = false;
//       let files = [];
//       let idc = 0;
//       parts.forEach((p) => {
//         p.logs.forEach((e) =>
//           all.push({
//             __id: `h${idc++}`,
//             // e.ts is the full "YYYY-MM-DD HH:MM:SS" the backend resolved,
//             // including for logs whose lines only carry a clock time.
//             ts: e.ts || '',
//             time: e.ts ? e.ts.slice(11, 19) : lineTime(e.line),
//             level: e.level || 'DEBUG',
//             node: node?.name || getState().nodeId,
//             logType: p.id,
//             line: e.line || '',
//           }),
//         );
//         if (p.truncated) trunc = true;
//         (p.files || []).forEach((f) => { if (!files.includes(f)) files.push(f); });
//       });

//       // Sort on the full timestamp so a 23:xx line never lands after a 00:xx
//       // line from the next day when the range crosses midnight.
//       all.sort((a, b) => (a.ts || a.time || '').localeCompare(b.ts || b.time || ''));

//       // No client-side date filter any more: the backend already scoped the
//       // window by real date, and filtering here would drop stack-trace lines.

//       actions.setHistLogs(all);
//       actions.setHist({ date, start, end, truncated: trunc, fetched: all.length });
//       actions.setHistLoading(false);

//       const shown = all.filter((o) => matchFilter(o, getState().filters)).length;
//       const src = files.length ? ` · ${files.join(', ')}` : '';
//       setStatus({
//         text: all.length
//           ? `${all.length} fetched · ${shown} shown${src}${trunc ? ' · ⚠ truncated (volume cap)' : ''}`
//           : `No lines for ${date} ${start}–${end}${files.length ? ` (searched ${files.join(', ')})` : ' — no log file on the server covers that date'}`,
//         kind: trunc || !all.length ? 'err' : 'ok',
//       });
//     } catch (err) {
//       actions.setHistLoading(false);
//       actions.setHistLogs([]);
//       setStatus({ text: `API error: ${err.message}`, kind: 'err' });
//     }
//   }, []);

//   return { status, run };
// }

import { useCallback, useState } from 'react';
import { getState, actions, activeNode } from '../store/store.js';
import { fetchHistory, subscribeActive } from '../net/net.js';
import { lineTime, matchFilter } from '../lib/format.js';

// Owns the History search: validation, fetch, merge, client-side date
// filter, and the little status line shown in the TimeRange panel.
export function useHistory() {
  const [status, setStatus] = useState({ text: '', kind: '' });

  const run = useCallback(async ({ date, start, end }) => {
    const s = getState();
    if (!s.serverId) return setStatus({ text: 'Select an environment.', kind: 'err' });
    if (!s.nodeId) return setStatus({ text: 'Select a node.', kind: 'err' });
    if (!s.logType) return setStatus({ text: 'Select a log type.', kind: 'err' });
    if (!start || !end) return setStatus({ text: 'Set both From and To times.', kind: 'err' });
    if (!date) return setStatus({ text: 'Pick a date.', kind: 'err' });

    actions.setMode('history');
    actions.setStreaming(false);
    subscribeActive();
    setStatus({ text: 'Loading…', kind: '' });
    actions.setHistLoading(true);
    actions.setHistLogs([]);

    try {
      const parts = await fetchHistory({ date, start, end });
      const node = activeNode();
      let all = [];
      let trunc = false;
      let files = [];
      let idc = 0;
      parts.forEach((p) => {
        p.logs.forEach((e) =>
          all.push({
            __id: `h${idc++}`,
            // e.ts is the full "YYYY-MM-DD HH:MM:SS" the backend resolved,
            // including for logs whose lines only carry a clock time.
            ts: e.ts || '',
            time: e.ts ? e.ts.slice(11, 19) : lineTime(e.line),
            level: e.level || 'DEBUG',
            node: node?.name || getState().nodeId,
            logType: p.id,
            line: e.line || '',
          }),
        );
        if (p.truncated) trunc = true;
        (p.files || []).forEach((f) => { if (!files.includes(f)) files.push(f); });
      });

      // Sort on the full timestamp so a 23:xx line never lands after a 00:xx
      // line from the next day when the range crosses midnight.
      all.sort((a, b) => (a.ts || a.time || '').localeCompare(b.ts || b.time || ''));

      // No client-side date filter any more: the backend already scoped the
      // window by real date, and filtering here would drop stack-trace lines.

      actions.setHistLogs(all);
      actions.setHist({ date, start, end, truncated: trunc, fetched: all.length });
      actions.setHistLoading(false);

      const shown = all.filter((o) => matchFilter(o, getState().filters)).length;
      const src = files.length ? ` · ${files.join(', ')}` : '';
      setStatus({
        text: all.length
          ? `${all.length} fetched · ${shown} shown${src}${trunc ? ` · ⚠ capped at ${all.length} — use Download full log for everything` : ''}`
          : `No lines for ${date} ${start}–${end}${files.length ? ` (searched ${files.join(', ')})` : ' — no log file on the server covers that date'}`,
        kind: trunc || !all.length ? 'err' : 'ok',
      });
    } catch (err) {
      actions.setHistLoading(false);
      actions.setHistLogs([]);
      setStatus({ text: `API error: ${err.message}`, kind: 'err' });
    }
  }, []);

  return { status, run };
}