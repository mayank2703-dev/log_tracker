# Amrita Log Tracker — Frontend (React + Vite)

Component-based React app for the SSH log tracker. Streams live logs over
WebSocket, pulls historical windows over REST, and exports to CSV/TXT.
Animation is done with **GSAP** (kept subtle).

> No build tooling could run on the machine this was scaffolded on, so the
> dependency versions in `package.json` are pinned but **not lock-filed** —
> run `npm install` once to generate `package-lock.json`.

## Requirements

- Node.js 18+ and npm (only to build — the output is plain static files)

## Develop

```bash
cd log-tracker/frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies nothing — the page talks straight to the backend
WebSocket/HTTP ports (`ws://<host>:5050…5059`, `http://<host>:5051…5059`),
so run the backend too:

```bash
cd ../backend && npm start
```

Open the dev URL with the same hostname the backend is reachable on
(e.g. `http://10.125.x.x:5173`, not `localhost`, if testing a remote box).

## Build for IIS

```bash
npm run build        # → dist/
```

Copy the contents of `dist/` into the IIS site folder (or a sub-app, e.g.
`C:\inetpub\wwwroot\log-tracker\`). `vite.config.js` sets `base: './'` so it
works from any path without URL rewrites.

**Serve the page over plain HTTP.** The browser connects to
`ws://<host>:<port>` and `http://<host>:<port>` for the backend; an HTTPS page
would block those as mixed content unless the backend also gets TLS.

Optional `web.config` for correct MIME + SPA fallback:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".js" />
      <mimeMap fileExtension=".js" mimeType="application/javascript" />
    </staticContent>
  </system.webServer>
</configuration>
```

## Project layout

```
src/
├── main.jsx                 React entry, applies saved theme
├── App.jsx                  composes the components, boots the net layer
├── config.js                SERVER_CONFIGS (ports must match backend/config.js)
│
├── store/
│   ├── store.js             framework-agnostic state + actions + subscribe
│   └── useStore.js          useSyncExternalStore binding
├── net/
│   ├── buffers.js           per-stream ring buffers (raw ws messages)
│   └── net.js               1 WebSocket per env, reconnect, history fetch
├── lib/
│   ├── format.js            norm / matchFilter / highlight / countLevels
│   ├── motion.js            GSAP wrappers (enter, collapse, countTo, movePill)
│   └── export.js            CSV + TXT builders, download()
├── hooks/
│   ├── useClock.js
│   └── useHistory.js        History search: validate → fetch → merge → status
│
├── components/
│   ├── Header.jsx           brand · clock · connection pill · theme toggle
│   ├── SourcePicker.jsx     1 Environment → 2 Node → 3 Log type → Mode
│   ├── Segmented.jsx        reusable segmented control w/ sliding pill
│   ├── Stepper.jsx          guided 1-2-3 progress in the empty state
│   ├── TimeRange.jsx        History date/from/to/quick — animated collapse
│   ├── Toolbar.jsx          search · level · Start/Stop · stats · export · clear
│   ├── ModeStrip.jsx        current context line
│   ├── LogViewer.jsx        the stream: buffers/history → filtered rows
│   ├── LogRow.jsx           one line (memoised; GSAP fade-in on mount)
│   └── Footer.jsx
└── styles/global.css        design tokens + all component styling
```

## Notes

- `standalone.html` in this folder is the **zero-build** version of the same
  UI (open directly / drop on any static host). Kept as a fallback.
- Backend contract is unchanged: WS `{type:'subscribe',nodeId,logType}` and
  `GET /api/logs?start&end&nodeId&logType&lines`.
