import { useStore } from '../store/useStore.js';
import { serverCfg, activeNode } from '../store/store.js';
import { LT_META } from '../config.js';

export default function ModeStrip() {
  const mode = useStore((s) => s.mode);
  const streaming = useStore((s) => s.streaming);
  // subscribe to the ids so this re-renders when selection changes
  const serverId = useStore((s) => s.serverId);
  const nodeId = useStore((s) => s.nodeId);
  const logType = useStore((s) => s.logType);
  const hist = useStore((s) => s.hist);

  void serverId;
  void nodeId;

  const path = [serverCfg()?.label, activeNode()?.name, LT_META[logType]?.name]
    .filter(Boolean)
    .join(' / ');

  const text =
    mode === 'history'
      ? `History${path ? ` — ${path}` : ''}${
          hist.start ? `  ·  ${hist.date} ${hist.start} → ${hist.end}` : ''
        }`
      : `${streaming ? 'Live — streaming' : 'Live'}${
          path ? ` — ${path}` : ' — choose a source to begin'
        }`;

  return (
    <div className="strip" data-m={mode}>
      <span className="d" />
      <span>{text}</span>
    </div>
  );
}
