import { memo } from 'react';
import { LT_META } from '../config.js';
import { highlight } from '../lib/format.js';

// The entry animation is CSS, not GSAP.
//
// The old version called gsap.from(el, { opacity: 0 }) on mount. That sets
// opacity to 0 as an inline style immediately and only restores it on the next
// animation frame. If frames were throttled — a background tab, or hundreds of
// rows mounting at once — the rows stayed at zero opacity forever. They were
// in the page and in the export, but invisible on screen.
//
// A CSS keyframe always settles on the element's natural state, so a row can
// never end up stuck hidden. It is also far lighter: no animation object per
// log line.
function LogRow({ row, search, showType, animate }) {
  const L = row.level || 'DEBUG';
  const segs = highlight(row.line || '', (search || '').trim());

  return (
    <div className={animate ? 'row anim' : 'row'} data-l={L}>
      <span className="t">{row.time || ''}</span>
      <span className="bdg" data-l={L}>
        {L}
      </span>
      {showType && (
        <span className="ty">
          {LT_META[row.logType]?.tag || String(row.logType || '').toUpperCase()}
        </span>
      )}
      <span className="m">
        {segs.map((s, i) =>
          s.mark ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>,
        )}
      </span>
    </div>
  );
}

export default memo(LogRow);