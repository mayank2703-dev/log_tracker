import { LT_META } from '../config.js';

export function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const COLS = ['Timestamp', 'Level', 'Node', 'LogType', 'Message'];

function fields(o, meta) {
  return [
    o.time || '',
    o.level || '',
    o.node || meta.node || '',
    LT_META[o.logType]?.name || o.logType || meta.logType || '',
    o.line || '',
  ];
}

/* ---- CSV --------------------------------------------------------------
   BOM + explicit "sep=," hint + CRLF line endings so Excel on any
   Windows locale opens it as real columns (not one text column). ------ */
export function toCSV(rows, meta) {
  const cell = (v) => {
    v = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
    return /[",;\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [COLS.join(','), ...rows.map((o) => fields(o, meta).map(cell).join(','))];
  return `﻿sep=,\r\n${lines.join('\r\n')}\r\n`;
}

/* ---- XLS (SpreadsheetML via HTML table) -----------------------------
   Opens directly in Excel as a worksheet — no import wizard, columns
   intact, level cells coloured. No external library needed. ---------- */
export function toXLS(rows, meta) {
  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const head = `<tr>${COLS.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows
    .map((o) => {
      const [t, lvl, node, lt, msg] = fields(o, meta);
      return (
        `<tr>` +
        `<td>${esc(t)}</td>` +
        `<td class="lvl ${esc(lvl)}">${esc(lvl)}</td>` +
        `<td>${esc(node)}</td>` +
        `<td>${esc(lt)}</td>` +
        `<td>${esc(msg)}</td>` +
        `</tr>`
      );
    })
    .join('');

  const title = `Amrita Log Tracker — ${meta.mode === 'history' ? 'History' : 'Live'} · ${meta.server} / ${meta.node} / ${meta.logType}`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Logs</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt}
  caption{font-weight:bold;text-align:left;padding:6px 4px;font-size:12pt}
  th{background:#1f3864;color:#fff;text-align:left;border:1px solid #7f8fb0;padding:4px 9px}
  td{border:1px solid #cccccc;padding:3px 9px;vertical-align:top;mso-number-format:"\\@"}
  td.lvl{font-weight:bold;text-align:center}
  .ERROR{color:#c00000}
  .WARN{color:#bf8f00}
  .INFO{color:#2f6fe0}
  .DEBUG{color:#808080}
</style></head>
<body><table><caption>${esc(title)} — ${rows.length} lines, exported ${new Date().toLocaleString()}</caption>
${head}${body}</table></body></html>`;
}

export function toTXT(rows, meta) {
  const c = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
  rows.forEach((o) => {
    if (c[o.level] !== undefined) c[o.level]++;
  });
  const bar = '='.repeat(74);
  let t = `${bar}\n  Amrita Log Tracker — ${meta.mode === 'history' ? 'History' : 'Live'} Export\n${bar}\n`;
  t += `  Environment : ${meta.server}\n  Node        : ${meta.node}\n  Log type    : ${meta.logType}\n`;
  t += `  Exported    : ${new Date().toLocaleString()}\n  Lines       : ${rows.length}\n`;
  if (meta.mode === 'history') t += `  Window      : ${meta.date} ${meta.start} → ${meta.end}\n`;
  if (meta.level && meta.level !== 'ALL') t += `  Level       : ${meta.level}\n`;
  if (meta.keyword) t += `  Keyword     : ${meta.keyword}\n`;
  if (meta.truncated) t += `  NOTE        : window TRUNCATED — volume exceeded buffer\n`;
  t += `${bar}\n  ERROR ${c.ERROR}   WARN ${c.WARN}   INFO ${c.INFO}   DEBUG ${c.DEBUG}\n${'-'.repeat(74)}\n\n`;
  rows.forEach((o) => {
    t += `[${(o.level || '').padEnd(5)}] ${o.time ? `[${o.time}] ` : ''}${o.line || ''}\n`;
  });
  t += `\n${bar}\n  End — ${rows.length} lines\n${bar}\n`;
  return t;
}

const MIME = {
  csv: 'text/csv;charset=utf-8',
  xls: 'application/vnd.ms-excel;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
};

export function buildExport(fmt, rows, meta) {
  if (fmt === 'xls') return { text: toXLS(rows, meta), mime: MIME.xls };
  if (fmt === 'csv') return { text: toCSV(rows, meta), mime: MIME.csv };
  return { text: toTXT(rows, meta), mime: MIME.txt };
}

export function exportName(meta, fmt) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stem = [
    meta.server,
    meta.node,
    meta.logTypeId,
    (meta.date || d.toISOString().slice(0, 10)).replace(/-/g, ''),
    p(d.getHours()) + p(d.getMinutes()),
  ]
    .filter(Boolean)
    .join('_')
    .replace(/\s+/g, '');
  return `${stem}.${fmt}`;
}
