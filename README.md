# Sino Ito? — Filipino-themed Guess Who (online)

Two players in a browser: procedural cartoon roster (no real photos), Standard or Hard mode, room codes, and optional WebRTC voice in Hard mode.

## Requirements

- Node.js 20+ and npm
- Chrome or Edge recommended (Web Speech API + WebRTC)

### Windows: `npm` is not recognized

That means **Node.js is not installed** or **not on your PATH** for this terminal.

1. Install **Node.js LTS** from [https://nodejs.org](https://nodejs.org) (use the Windows Installer), **or** in an elevated PowerShell: `winget install OpenJS.NodeJS.LTS`
2. **Close and reopen** Cursor (or at least the integrated terminal), then run `npm install` again from `D:\GAMES\Who is it`.

Optional helper (searches common install paths, then installs + builds `shared`):

```powershell
cd "D:\GAMES\Who is it"
powershell -ExecutionPolicy Bypass -File .\scripts\install-deps.ps1
```

Until `npm install` succeeds, VS Code/Cursor will show TypeScript errors like “Cannot find module `express`” in `server/src/index.ts` — those clear once `node_modules` exists.

## Setup

```bash
npm install
npm run build -w shared
```

## Development

Run three processes (shared watch + server + client):

```bash
npm run dev
```

- Client: http://localhost:5173 (proxies Socket.IO to the server)
- Server: http://localhost:3001

If `shared` is already built, you can use:

```bash
npm run dev:quick
```

### Environment

- `CLIENT_ORIGIN` — single allowed browser origin for CORS (default `http://localhost:5173`)
- `CLIENT_ORIGINS` — optional **comma-separated** list (overrides `CLIENT_ORIGIN` when set), e.g. `https://game.example.com,https://www.game.example.com`
- `PORT` — server port (default `3001`)
- `VITE_SERVER_URL` — when you host the UI separately, set this at **build time** to your public API origin, e.g. `https://api.example.com` (see **Internet / different networks** below)
- `VITE_ICE_SERVERS_JSON` — optional JSON array of `RTCIceServer` objects for WebRTC (**TURN strongly recommended** when players are on different networks)

## Internet / different networks

Players on **different Wi‑Fi / mobile / countries** need:

1. **A public URL for the game server** (Node + Socket.IO), not only `localhost`.
2. **The browser UI** built or served with **`VITE_SERVER_URL`** pointing at that API, so Socket.IO connects across the internet.
3. **HTTPS on the real site** (browsers expect secure context for mic + WebRTC in production).
4. **TURN for WebRTC (Hard mode)** — peer‑to‑peer audio often fails across random networks with STUN alone. Run **coturn** (or a hosted TURN) and put the servers in `VITE_ICE_SERVERS_JSON` when you build the client.

### Minimal deployment pattern

- **API:** run `node server/dist/index.js` (after `npm run build`) on a host like **Fly.io**, **Railway**, **Render**, or a **VPS**, with `PORT` set by the platform.
- **CORS:** set `CLIENT_ORIGINS` to the exact origin(s) where you host the UI (including `https://` and no trailing slash), e.g. `https://guesswho.pages.dev`.
- **UI:** build the client with your API URL baked in:

```bash
npm run build -w shared
set VITE_SERVER_URL=https://YOUR-API-PUBLIC-URL
npm run build -w client
```

Upload `client/dist` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3+CloudFront, etc.).

### Quick tunnel test (not for production)

Tools like **ngrok** / **Cloudflare Tunnel** can expose `localhost:3001` with a temporary HTTPS URL so a friend can try from another network. You must set **`VITE_SERVER_URL`** to that tunnel URL when building the client, and **`CLIENT_ORIGINS`** / **`CLIENT_ORIGIN`** to wherever the UI is opened from. WebRTC may still need **TURN** depending on networks.

See also [`client/.env.example`](client/.env.example).

### Deploy the API on Render

1. Push this repo to **GitHub** (or GitLab / Bitbucket supported by Render).
2. In the [Render Dashboard](https://dashboard.render.com), **New → Blueprint** (or **Web Service** if you prefer typing commands manually).
3. If using the included [`render.yaml`](render.yaml), connect the repo and apply the blueprint. Otherwise create a **Web Service** with:
   - **Root directory:** repository root (where `package.json` lives).
   - **Build command:** `npm run render:build`
   - **Start command:** `npm run render:start`
4. After the first deploy, open the service URL (e.g. `https://sino-ito-api.onrender.com`) and confirm `GET /health` returns JSON.
5. In **Environment**, set **`CLIENT_ORIGINS`** to the **exact origin(s)** of your game UI (scheme + host + port if any), comma-separated if you have more than one. Examples:
   - UI on Render static site: `https://sino-ito-web.onrender.com`
   - UI on Cloudflare Pages: `https://your-game.pages.dev`
   - Include `http://localhost:5173` only if you still test locally against this same API.
6. **Build the client** with your API URL, then host `client/dist` anywhere static:

```bash
npm run build -w shared
set VITE_SERVER_URL=https://YOUR-SERVICE.onrender.com
npm run build -w client
```

(`VITE_SERVER_URL` must match the public API origin, **no** trailing slash.)

**Notes**

- Render sets **`PORT`** automatically; the server already reads it.
- The service listens on **`0.0.0.0`** so Render’s proxy can reach it.
- **Free** web services **sleep** after inactivity; the first request can take ~30–60s. Paid plans avoid sleep.
- **WebSockets** (Socket.IO) work on Render’s Node web services; keep ping intervals default.
- **Hard mode / WebRTC** across random networks still needs **TURN** in `VITE_ICE_SERVERS_JSON` on the client build.

See also [`render.yaml`](render.yaml).

## Tests

```bash
npm test
```

## How to play

1. Host: choose theme + difficulty → **Create room** → copy link.
2. Friend: open link or **Join room** with the 6-character code.
3. Each player picks a secret character, then take turns asking (Standard: typed/voice + Yes/No/Not sure; Hard: live call + voice answer lock-in).
4. Flip tiles manually on your own board; guess ends the match (wrong guess loses).

## License

Private project — use at your own discretion.
