import { useLayoutEffect, useRef } from 'react';
import { movePill } from '../lib/motion.js';

/**
 * options: [{ value, label, disabled? }]
 */
export default function Segmented({ options, value, onChange, ariaLabel }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    movePill(ref.current);
  }, [value, options]);

  return (
    <div className="seg" ref={ref} role="tablist" aria-label={ariaLabel}>
      <span className="pill" data-pill />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
      {!options.length && <span className="empty">—</span>}
    </div>
  );
}
