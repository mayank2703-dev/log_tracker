import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { actions } from '../store/store.js';
import { useClock } from '../hooks/useClock.js';
import { enter } from '../lib/motion.js';

export default function Header() {
  const clock = useClock();
  const theme = useStore((s) => s.theme);
  const serverId = useStore((s) => s.serverId);
  const conn = useStore((s) => (s.serverId ? s.servers[s.serverId]?.conn : null));
  const label = useStore((s) => (s.serverId ? s.servers[s.serverId]?.config.label : null));
  const ref = useRef(null);

  useEffect(() => {
    enter(ref.current, { y: -8 });
  }, []);

  return (
    <header ref={ref}>
      <div className="brand">
        <div className="mark">≣</div>
        <div>
          <h1>Amrita Log Tracker</h1>
          <div className="sub">Infrastructure log console</div>
        </div>
      </div>

      <div className="hgroup">
        <span className="clock">{clock}</span>
        <span className="conn" data-s={conn || 'offline'}>
          <i className="dot" />
          {serverId ? `${label} · ${conn}` : 'Not connected'}
        </span>
        <button
          type="button"
          className="icon-btn"
          title="Toggle theme"
          onClick={() => actions.setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
