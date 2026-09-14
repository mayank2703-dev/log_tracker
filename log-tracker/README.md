# Live Log Tracker

A real-time web dashboard that SSHs into your Linux server and streams log files live to the browser. Errors are highlighted in red with pop-up toast alerts.

---

## Features

- **Live streaming** via SSH + WebSocket (`tail -f` on the server)
- **Color-coded log levels** — ERROR (red), WARN (yellow), INFO (blue), DEBUG (gray)
- **Toast alert** on every ERROR line
- **Filter by level** — ERROR only, WARN+, INFO+, ALL
- **Keyword search** with inline highlighting
- **Auto-scroll** toggle
- **Live stats bar** — total, ERROR, WARN, INFO, DEBUG counts
- **Auto-reconnect** — SSH drops → retries in 5s; WebSocket drops → retries in 3s

---

## Project Structure

```
log-tracker/
├── backend/
│   ├── server.js        ← Node.js WebSocket + SSH server
│   ├── package.json     ← npm dependencies
│   └── .env             ← SSH credentials (edit this)
├── frontend/
│   └── index.html       ← Single-file browser UI
└── README.md
```

---

## Prerequisites

- **Node.js** v16 or higher — https://nodejs.org
- Access to the target server via SSH (port 22 open)

---

## Setup & Run

### Step 1 — Configure credentials

Copy the template and fill in the real SSH hosts, usernames and passwords:

```bash
cd backend
cp .env.example .env
```

```env
LT_LIVE_HOST='<ssh-host>'
LT_LIVE_USER='<ssh-user>'
LT_LIVE_PASS='<ssh-password>'
# ...one HOST / USER / PASS trio per server id in config.js
```

`backend/.env` is git-ignored — never commit it.

Change `LOG_FILE` if you want to tail a different log file.

### Step 2 — Install dependencies

```bash
cd backend
npm install
```

### Step 3 — Start the backend

```bash
npm start
```

You should see:
```
[LOG-TRACKER] WebSocket server running on ws://localhost:8080
[LOG-TRACKER] Connecting to SSH: <ssh-user>@<ssh-host>
[SSH] Connected successfully.
```

### Step 4 — Open the frontend

Simply open `frontend/index.html` in your browser:

```bash
# macOS
open ../frontend/index.html

# Linux
xdg-open ../frontend/index.html

# Windows
start ../frontend/index.html
```

Or serve it with a simple HTTP server (optional):

```bash
npx serve ../frontend
# Then open http://localhost:3000
```

---

## Tailing Multiple Log Files

To watch additional log files, duplicate the `startSshTail()` call in `server.js` and pass a different `LOG_FILE` path:

```js
startSshTail('/home/fbdit/log/server.log');
startSshTail('/home/fbdit/log/access.log');
startSshTail('/home/fbdit/log/error.log');
```

Update the function signature to accept a `logFile` parameter.

---

## Changing the WebSocket Port

Update `WS_PORT` in `.env` and also update this line in `frontend/index.html`:

```js
const WS_URL = 'ws://localhost:8080';
```

---

## Security Recommendations (Production)

| Risk | Fix |
|------|-----|
| Password in `.env` | Use SSH key auth instead (`privateKey` in ssh2 options) |
| No WS auth | Add a secret token query param: `ws://host:8080?token=SECRET` |
| Open to all IPs | Bind WebSocket to `127.0.0.1` and use Nginx reverse proxy with HTTPS |
| `.env` in git | Add `.env` to `.gitignore` immediately |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot reach log server on ws://localhost:8080` | Make sure `npm start` is running in `backend/` |
| `SSH error: All configured authentication methods failed` | Check `LT_<ID>_USER` / `LT_<ID>_PASS` in `backend/.env` |
| `SSH error: connect ECONNREFUSED` | Check SSH_HOST and SSH_PORT; verify server is reachable |
| No log lines appearing | Check LOG_FILE path exists on the server |
| Browser shows blank page | Open browser DevTools console for errors |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js |
| WebSocket server | `ws` npm package |
| SSH client | `ssh2` npm package |
| Config | `dotenv` |
| Frontend | Vanilla HTML + CSS + JavaScript |
| No framework | Zero build step required |

---

## License

MIT — free to use and modify.
