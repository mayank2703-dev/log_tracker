import { useStore } from '../store/useStore.js';
import { isReady } from '../store/store.js';

export default function Footer() {
  const mode = useStore((s) => s.mode);
  const streaming = useStore((s) => s.streaming);
  const fetched = useStore((s) => s.hist.fetched);
  const ready = useStore((s) => isReady(s));

  const right =
    mode === 'history'
      ? `history · ${fetched || 0} lines`
      : streaming
        ? 'streaming'
        : ready
          ? 'ready'
          : 'idle';

  return (
    <footer className="ft">
      <span>AMRITA TECH · Log Tracker v3</span>
      <span>{right}</span>
    </footer>
  );
}
