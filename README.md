# ExpenseSplitter (TypeScript)

Shared expense splitting with a TCP/WebSocket server and React apps (main client + admin).

## Prerequisites

- **Node.js** (LTS recommended, e.g. 18 or 20)
- **npm** (comes with Node)

## Project layout

| Folder       | Role |
|-------------|------|
| `server/`   | TypeScript server: TCP **54000**, WebSocket **54001** |
| `client-app/` | React UI for users (WebSocket client) |
| `admin-app/`  | React admin dashboard (same WebSocket port) |

Start the **server before** opening the web apps so the browser can connect to `ws://localhost:54001`.

---

## 1. Server

```bash
cd server
npm install
npm run build
npm start
```

- `npm start` runs the compiled app (`node dist/index.js`).
- For development without rebuilding each time: `npm run dev` (runs `src/index.ts` with `ts-node`).

**Important:** If you change server source under `server/src`, run `npm run build` again before `npm start`, or use `npm run dev`.

---

## 2. Client app

In a **new terminal**:

```bash
cd client-app
npm install
npm start
```

Opens the dev server (usually [http://localhost:3000](http://localhost:3000)). It expects the backend WebSocket at `ws://localhost:54001`.

---

## 3. Admin app (optional)

In another terminal:

```bash
cd admin-app
npm install
npm start
```

CRA may prompt for a different port (e.g. 3001) if 3000 is in use. It also uses `ws://localhost:54001`.

---

## Ports

| Service        | Port |
|----------------|------|
| WebSocket API  | **54001** |
| TCP (protocol) | **54000** |
| React (dev)    | **3000** or **3001** (see terminal) |

---

## Demo accounts

The server seeds test users (see server logs on startup). Example:

- Email: `jino@test.com` — Password: `pass123`

(Other demo accounts may be listed in the server console.)

---

## Receipts

Sample files can live under `server/receipts/`. The client can request a download by filename (e.g. `sample_receipt.jpg`) when the server exposes that file.

---

## Production builds

```bash
cd client-app && npm run build
cd admin-app && npm run build
```

Serve the `build/` folders with any static host; ensure the server is reachable and WebSocket URL matches your deployment (you may need to change `WS_URL` in the apps).
