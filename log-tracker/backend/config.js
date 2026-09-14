// ============================================================
//  AMRITA PRODUCTION LOG TRACKER — CONFIGURATION FILE
//  ✅ Only edit THIS file to add/remove servers & nodes
//  ✅ No changes needed in server.js or index.html
//  🔒 SSH hosts, usernames & passwords live in backend/.env
//     (not committed — see .env.example for the variable names)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {

  // ── App Settings ──────────────────────────────────────────
  app: {
    name:    'Amrita Log Tracker',
    version: '2.0',
  },

  // ── Frontend Web Server ───────────────────────────────────
  web: {
    port: 6060,   // Browser access port: http://IP:6060
  },

  // ── Log Type Definitions (shared across all servers) ──────
  // Add new log types here if needed
  logTypes: [
    { id: 'server',  name: 'Server Log'  },
    { id: 'console', name: 'Console Log' },
    { id: 'gc',      name: 'GC Log'      },
  ],

  // ── Servers ───────────────────────────────────────────────
  // Each server = one SSH host with its own WS + HTTP port pair
  // Add as many servers as needed below
  servers: [

    // ── SERVER 1: LIVE (Production) ───────────────────────
    {
      id:    'live',
      label: 'LIVE',                    // shown in UI tab/badge
      color: '#3fb950',                 // green

      // WebSocket & HTTP API ports for this server
      wsPort:   5050,
      httpPort: 5051,

      // SSH credentials for this server
      ssh: {
        host:     process.env.LT_LIVE_HOST,
        port:     22,
        username: process.env.LT_LIVE_USER,
        password: process.env.LT_LIVE_PASS,
      },

      // Nodes on this server
      // Each node can have multiple log files (server/console/gc)
      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            server:  '/home/fbdit/App_log/fbd-node1-reports/app1-server.log',
            console: '/home/fbdit/App_log/fbd-node1-reports/app1-console.log',
            gc:      '/home/fbdit/App_log/fbd-node1-reports/app1-gc.log',
          }
        },
        {
          id:   'node2',
          name: 'Node-2',
          logs: {
            server:  '/home/fbdit/App_log/fbd-node2-node3/app2-server.log',
            console: '/home/fbdit/App_log/fbd-node2-node3/app2-console.log',
            gc:      '/home/fbdit/App_log/fbd-node2-node3/app2-gc.log',
          }
        },
        {
          id:   'node3',
          name: 'Node-3',
          logs: {
            server:  '/home/fbdit/App_log/fbd-node3/app3-server.log',
            console: '/home/fbdit/App_log/fbd-node3/app3-console.log',
            gc:      '/home/fbdit/App_log/fbd-node3/app3-gc.log',
          }
        },
        {
          id:   'node4',
          name: 'Node-4',
          logs: {
            server:  '/home/fbdit/App_log/fbd-node4/app4-server.log',
            console: '/home/fbdit/App_log/fbd-node4/app4-console.log',
            gc:      '/home/fbdit/App_log/fbd-node4/app4-gc.log',
          }
        },
      ]
    },

        // ── SERVER 1: LIVE -AEPL (Production) ───────────────────────
    {
      id:    'live-ae',
      label: 'LIVE-AE',                    // shown in UI tab/badge
      color: '#5dc9c0',                 // green

      // WebSocket & HTTP API ports for this server
      wsPort:   5054,
      httpPort: 5055,

      // SSH credentials for this server
      ssh: {
        host:     process.env.LT_LIVE_AE_HOST,
        port:     22,
        username: process.env.LT_LIVE_AE_USER,
        password: process.env.LT_LIVE_AE_PASS,
      },

      // Nodes on this server
      // Each node can have multiple log files (server/console/gc)
      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            server:  '/home/fbdit/App-logs/ae-node1/app1-server.log',
            console: '/home/fbdit/App-logs/ae-node1/app1-console.log',
            gc:      '/home/fbdit/App-logs/ae-node1/app1-gc.log',
          }
        },
        {
          id:   'node2',
          name: 'Node-2',
          logs: {
            server:  '/home/fbdit/App-logs/ae-node1/app2-server.log',
            console: '/home/fbdit/App-logs/ae-node1/app2-console.log',
            gc:      '/home/fbdit/App-logs/ae-node1/app2-gc.log',
          }
        },
        {
          id:   'node3',
          name: 'Node-3',
          logs: {
            server:  '/home/fbdit/App-logs/ae-node2-reports/app3-server.log',
            console: '/home/fbdit/App-logs/ae-node2-reports/app3-console.log',
            gc:      '/home/fbdit/App-logs/ae-node2-reports/app3-gc.log',
          }
        },
      ]
    },

    // ── SERVER 2: MOCK (Testing/Staging) ──────────────────
    {
      id:    'mock-ae',
      label: 'MOCK',                    // shown in UI tab/badge
      color: '#c4751c',                 // yellow

      wsPort:   5052,
      httpPort: 5053,

      ssh: {
        host:     process.env.LT_MOCK_AE_HOST,
        port:     22,
        username: process.env.LT_MOCK_AE_USER,
        password: process.env.LT_MOCK_AE_PASS,
      },

      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            server:  '/home/fbdit/log/server.log',
            console: '/home/fbdit/log/consolelog.log',
            gc: '/home/fbdit/log/gc.log',
          }
        },
      ]
    },

    // ── SERVER 2: PP MOCK (Testing/Staging) ──────────────────
    {
      id:    'pp',
      label: 'MOCK-PP',                   
      color: '#e3b341',                 

      wsPort:   5058,
      httpPort: 5059,

      ssh: {
        host:     process.env.LT_PP_HOST,
        port:     22,
        username: process.env.LT_PP_USER,
        password: process.env.LT_PP_PASS,
      },

      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            server:  '/home/jail/home/fbdit/pplog/server.log',
          }
        },
      ]
    },

    // ── SERVER 2: MOCK (Testing/Staging) ──────────────────
    {
      id:    'mock',
      label: 'MOCK-AE',                    // shown in UI tab/badge
      color: '#e3b341',                 // yellow

      wsPort:   5056,
      httpPort: 5057,

      ssh: {
        host:     process.env.LT_MOCK_HOST,
        port:     22,
        username: process.env.LT_MOCK_USER,
        password: process.env.LT_MOCK_PASS,
      },

      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            server:  '/home/fbdit/log/server.log',
            console: '/home/fbdit/log/consolelog.log',
            gc: '/home/fbdit/log/gc.log',
          }
        },
      ]
    },

    // ── ZIP TEST: log archive on the Linux box ──────────────
    {
      id:    'zipbox',
      label: 'ZIP TEST',
      color: '#a371f7',

      wsPort:   5062,
      httpPort: 5063,

      ssh: {
        host:     process.env.LT_ZIPBOX_HOST,
        port:     22,
        username: process.env.LT_ZIPBOX_USER,
        password: process.env.LT_ZIPBOX_PASS,
      },

      nodes: [
        {
          id:   'node1',
          name: 'Node-1',
          logs: {
            console: '/home/node/logzips/app1-console.log-2026-09-04.gz'
          }
        }
      ]
    },
]
}; // end exports
