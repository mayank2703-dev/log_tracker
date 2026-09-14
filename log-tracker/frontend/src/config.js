// // =====================================================================
// //  Static config. Ports MUST match backend/config.js.
// // =====================================================================
// export const SERVER_CONFIGS = [
//   { id: 'live',    label: 'LIVE',    color: '#33d17a', wsPort: 5050, httpPort: 5051 },
//   { id: 'live-ae', label: 'LIVE-AE', color: '#5dc9c0', wsPort: 5054, httpPort: 5055 },
//   { id: 'mock-ae', label: 'MOCK',    color: '#e0a13d', wsPort: 5052, httpPort: 5053 },
//   { id: 'mock',    label: 'MOCK-AE', color: '#e3b341', wsPort: 5056, httpPort: 5057 },
//   { id: 'pp',      label: 'MOCK-PP', color: '#c98bff', wsPort: 5058, httpPort: 5059 },
//   { id: 'zipbox', label: 'ZIP TEST', color: '#a371f7', wsPort: 5062, httpPort: 5063 },
// ];

// // The backend runs on the same host the page is served from.
// export const HOST = window.location.hostname || 'localhost';

// export const RING_CAP = 6000;     // max raw lines kept per stream buffer
// export const DISPLAY_CAP = 2500;  // max rows painted into the DOM at once

// // History /api/logs can legitimately take a while (SSH + remote awk over
// // rotated files), but a hung request should still give up and say so
// // instead of leaving a socket open forever.
// export const HISTORY_TIMEOUT_MS = 60000;

// // WS reconnect backoff: starts fast, backs off while an environment stays
// // unreachable so 5 sockets don't hammer the OS network stack forever.
// export const RECONNECT_MIN_MS = 3000;
// export const RECONNECT_MAX_MS = 30000;
// export const RECONNECT_FACTOR = 1.6;

// export const LT_META = {
//   server:  { name: 'Server',  tag: 'SERVER'  },
//   console: { name: 'Console', tag: 'CONSOLE' },
//   gc:      { name: 'GC',      tag: 'GC'      },
//   all:     { name: 'All',     tag: 'ALL'     },
// };

// // shared stable empty array — avoids new refs in store selectors
// export const EMPTY = Object.freeze([]);

// =====================================================================
//  Static config. Ports MUST match backend/config.js.
// =====================================================================
export const SERVER_CONFIGS = [
  { id: 'live',    label: 'LIVE',    color: '#33d17a', wsPort: 5050, httpPort: 5051 },
  { id: 'live-ae', label: 'LIVE-AE', color: '#5dc9c0', wsPort: 5054, httpPort: 5055 },
  { id: 'mock-ae', label: 'MOCK',    color: '#e0a13d', wsPort: 5052, httpPort: 5053 },
  { id: 'mock',    label: 'MOCK-AE', color: '#e3b341', wsPort: 5056, httpPort: 5057 },
  { id: 'pp',      label: 'MOCK-PP', color: '#c98bff', wsPort: 5058, httpPort: 5059 },
  { id: 'zipbox', label: 'ZIP TEST', color: '#a371f7', wsPort: 5062, httpPort: 5063 }
];

// The backend runs on the same host the page is served from.
export const HOST = window.location.hostname || 'localhost';

// Live buffer size. The viewer virtualises its list now, so a large buffer
// costs memory only (~200 bytes a line) rather than DOM elements.
export const RING_CAP = 50000;    // max raw lines kept per stream buffer
// No longer used to truncate the list: LogViewer.jsx renders only the rows in
// the viewport, so every fetched line is scrollable. Kept for reference.
export const DISPLAY_CAP = 2500;

// History /api/logs can legitimately take a while (SSH + remote awk over
// rotated files), but a hung request should still give up and say so
// instead of leaving a socket open forever.
export const HISTORY_TIMEOUT_MS = 60000;

// WS reconnect backoff: starts fast, backs off while an environment stays
// unreachable so 5 sockets don't hammer the OS network stack forever.
export const RECONNECT_MIN_MS = 3000;
export const RECONNECT_MAX_MS = 30000;
export const RECONNECT_FACTOR = 1.6;

export const LT_META = {
  server:  { name: 'Server',  tag: 'SERVER'  },
  console: { name: 'Console', tag: 'CONSOLE' },
  gc:      { name: 'GC',      tag: 'GC'      },
  all:     { name: 'All',     tag: 'ALL'     },
};

// shared stable empty array — avoids new refs in store selectors
export const EMPTY = Object.freeze([]);