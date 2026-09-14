// =====================================================================
//  Framework-agnostic store: plain state + subscribe + actions.
//  Consumed in React via ./useStore.js (useSyncExternalStore).
// =====================================================================
import { SERVER_CONFIGS } from '../config.js';

let state = {
  servers: Object.fromEntries(
    SERVER_CONFIGS.map((c) => [c.id, { config: c, nodes: [], conn: 'connecting' }]),
  ),
  serverId: null,
  nodeId: null,
  logType: null,
  mode: 'live', // 'live' | 'history'
  streaming: false,
  autoScroll: true,
  filters: { search: '', level: 'ALL' },
  stats: { total: 0, shown: 0, ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 },
  hist: { date: '', start: '', end: '', truncated: false, fetched: 0 },
  histLogs: [],
  histLoading: false,
  theme: readTheme(),
};

function readTheme() {
  try {
    return localStorage.getItem('lt-theme') || 'dark';
  } catch {
    return 'dark';
  }
}

const subs = new Set();
export const getState = () => state;
export const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

function set(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

export const actions = {
  setServerConn: (id, conn) =>
    set((s) => ({ servers: { ...s.servers, [id]: { ...s.servers[id], conn } } })),
  setServerNodes: (id, nodes) =>
    set((s) => ({ servers: { ...s.servers, [id]: { ...s.servers[id], nodes } } })),

  selectServer: (id) => set({ serverId: id || null, nodeId: null, logType: null, streaming: false }),
  selectNode: (id) => set({ nodeId: id || null, logType: null, streaming: false }),
  selectLogType: (v) => set({ logType: v || null, streaming: false }),
  setMode: (m) => set({ mode: m, streaming: false }),
  setStreaming: (v) => set({ streaming: v }),
  setAutoScroll: (v) => set({ autoScroll: v }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  setStats: (stats) => set({ stats }),

  setHist: (h) => set((s) => ({ hist: { ...s.hist, ...h } })),
  setHistLogs: (histLogs) => set({ histLogs }),
  setHistLoading: (histLoading) => set({ histLoading }),

  setTheme: (t) => {
    try {
      localStorage.setItem('lt-theme', t);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
};

// ---- derived selectors (pure, call with current or supplied state) ----
export const activeNode = (s = state) =>
  s.servers[s.serverId]?.nodes.find((n) => n.id === s.nodeId) || null;

export const serverCfg = (s = state) => SERVER_CONFIGS.find((c) => c.id === s.serverId) || null;

export const isReady = (s = state) => !!(s.serverId && s.nodeId && s.logType);
