import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { actions } from '../store/store.js';
import { SERVER_CONFIGS, LT_META, EMPTY } from '../config.js';
import { subscribeActive, clearActiveBuffers, pokeData } from '../net/net.js';
import Segmented from './Segmented.jsx';
import { enter } from '../lib/motion.js';

const MODE_OPTIONS = [
  { value: 'live', label: 'Live' },
  { value: 'history', label: 'History' },
];

export default function SourcePicker() {
  const serverId = useStore((s) => s.serverId);
  const nodeId = useStore((s) => s.nodeId);
  const logType = useStore((s) => s.logType);
  const mode = useStore((s) => s.mode);
  const nodes = useStore((s) => (s.serverId ? s.servers[s.serverId]?.nodes || EMPTY : EMPTY));
  const ref = useRef(null);

  useEffect(() => {
    enter(ref.current, { y: 10, delay: 0.06 });
  }, []);

  const node = nodes.find((n) => n.id === nodeId);
  const types = node?.logTypes || EMPTY;
  const ltOptions = [
    ...types.map((lt) => ({ value: lt.id, label: LT_META[lt.id]?.name || lt.name })),
    ...(types.length > 1 ? [{ value: 'all', label: 'All' }] : []),
  ];

  const pickServer = (id) => {
    actions.selectServer(id);
    subscribeActive();
    pokeData();
  };
  const pickNode = (id) => {
    actions.selectNode(id);
    subscribeActive();
    pokeData();
  };
  const pickLt = (v) => {
    actions.selectLogType(v);
    clearActiveBuffers();
    subscribeActive();
    pokeData();
  };
  const pickMode = (m) => {
    actions.setMode(m);
    subscribeActive();
    pokeData();
  };

  return (
    <section className="panel" ref={ref}>
      <div className="field">
        <span className="lbl">
          <span className="k">1</span> Environment
        </span>
        <select
          className="sel"
          title="Environment"
          value={serverId || ''}
          onChange={(e) => pickServer(e.target.value)}
        >
          <option value="">— select —</option>
          {SERVER_CONFIGS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="lbl">
          <span className="k">2</span> Node
        </span>
        <select
          className="sel"
          title="Node"
          value={nodeId || ''}
          disabled={!serverId}
          onChange={(e) => pickNode(e.target.value)}
        >
          <option value="">{serverId ? '— select node —' : '— pick environment —'}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field grow">
        <span className="lbl">
          <span className="k">3</span> Log type
        </span>
        {ltOptions.length ? (
          <Segmented
            ariaLabel="Log type"
            options={ltOptions}
            value={logType || ''}
            onChange={pickLt}
          />
        ) : (
          <div className="seg">
            <span className="empty">pick a node first</span>
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="field">
        <span className="lbl">Mode</span>
        <Segmented ariaLabel="Mode" options={MODE_OPTIONS} value={mode} onChange={pickMode} />
      </div>
    </section>
  );
}
