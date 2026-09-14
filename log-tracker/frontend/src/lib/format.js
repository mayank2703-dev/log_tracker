// // Pure log helpers — no React, no DOM.

// export const lineTime = (l) =>
//   (l && (l.match(/\b(\d{2}:\d{2}:\d{2})/) || [])[1]) || '';

// // Normalise a raw ws message OR a history entry into one shape.
// // Result is cached on the source object so repeated calls return the
// // SAME reference — lets React.memo skip unchanged <LogRow>s on re-render.
// export function norm(m, fallbackType) {
//   if (m.__norm) return m.__norm;
//   const o = {
//     __id: m.__id,
//     time: m.timestamp ? m.timestamp.slice(11, 19) : lineTime(m.line),
//     level: m.level || 'DEBUG',
//     node: m.nodeName || m.nodeId || m.node || '',
//     logType: m.logType || fallbackType || 'server',
//     line: m.line || '',
//   };
//   try {
//     Object.defineProperty(m, '__norm', { value: o, enumerable: false });
//   } catch {
//     m.__norm = o;
//   }
//   return o;
// }

// export function matchFilter(o, filters) {
//   const kw = (filters.search || '').toLowerCase().trim();
//   const L = o.level || 'DEBUG';
//   let ok;
//   switch (filters.level) {
//     case 'ERROR':
//       ok = L === 'ERROR';
//       break;
//     case 'WARN':
//       ok = L === 'ERROR' || L === 'WARN';
//       break;
//     case 'INFO':
//       ok = L === 'ERROR' || L === 'WARN' || L === 'INFO';
//       break;
//     case 'DEBUG':
//       ok = L === 'DEBUG';
//       break;
//     default:
//       ok = true;
//   }
//   return ok && (!kw || (o.line || '').toLowerCase().includes(kw));
// }

// export function countLevels(list) {
//   const c = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
//   for (const o of list) if (c[o.level] !== undefined) c[o.level]++;
//   return c;
// }

// // Split a line into [{t}, {t, mark:true}, ...] segments for search hi-lite.
// export function highlight(text, kw) {
//   if (!kw) return [{ t: text }];
//   let re;
//   try {
//     re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
//   } catch {
//     return [{ t: text }];
//   }
//   const out = [];
//   let last = 0;
//   let m;
//   while ((m = re.exec(text))) {
//     if (m.index > last) out.push({ t: text.slice(last, m.index) });
//     out.push({ t: m[0], mark: true });
//     last = m.index + m[0].length;
//     if (m.index === re.lastIndex) re.lastIndex++;
//   }
//   if (last < text.length) out.push({ t: text.slice(last) });
//   return out;
// }

// Pure log helpers — no React, no DOM.

export const lineTime = (l) =>
  (l && (l.match(/\b(\d{2}:\d{2}:\d{2})/) || [])[1]) || '';

// Normalise a raw ws message OR a history entry into one shape.
// Result is cached on the source object so repeated calls return the
// SAME reference — lets React.memo skip unchanged <LogRow>s on re-render.
export function norm(m, fallbackType) {
  if (m.__norm) return m.__norm;
  const o = {
    __id: m.__id,
    // Prefer the time written inside the log line — that is the real event
    // time, in the server's own timezone. m.timestamp is when the backend
    // received the line and is in UTC, so it read 5:30 behind IST and was
    // wrong for any line that was not brand new.
    time: lineTime(m.line) || (m.timestamp ? m.timestamp.slice(11, 19) : ''),
    level: m.level || 'DEBUG',
    node: m.nodeName || m.nodeId || m.node || '',
    logType: m.logType || fallbackType || 'server',
    line: m.line || '',
  };
  try {
    Object.defineProperty(m, '__norm', { value: o, enumerable: false });
  } catch {
    m.__norm = o;
  }
  return o;
}

export function matchFilter(o, filters) {
  const kw = (filters.search || '').toLowerCase().trim();
  const L = o.level || 'DEBUG';
  let ok;
  switch (filters.level) {
    case 'ERROR':
      ok = L === 'ERROR';
      break;
    case 'WARN':
      ok = L === 'ERROR' || L === 'WARN';
      break;
    case 'INFO':
      ok = L === 'ERROR' || L === 'WARN' || L === 'INFO';
      break;
    case 'DEBUG':
      ok = L === 'DEBUG';
      break;
    default:
      ok = true;
  }
  return ok && (!kw || (o.line || '').toLowerCase().includes(kw));
}

export function countLevels(list) {
  const c = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
  for (const o of list) if (c[o.level] !== undefined) c[o.level]++;
  return c;
}

// Split a line into [{t}, {t, mark:true}, ...] segments for search hi-lite.
export function highlight(text, kw) {
  if (!kw) return [{ t: text }];
  let re;
  try {
    re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  } catch {
    return [{ t: text }];
  }
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ t: m[0], mark: true });
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}