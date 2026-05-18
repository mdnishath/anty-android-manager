# Anty Android Manager

A desktop app to create, fingerprint and operate fleets of virtual Android
phones (powered by [redroid](https://github.com/remote-android/redroid-doc) on
the backend). Each phone has its own identity — IMEI, MAC addresses, build
fingerprint, phone number, proxy — designed for multi-account and automation
workflows.

> Status: pre-alpha. Frontend (Electron + React) is functional end-to-end with
> a Python sidecar; running real Android containers needs a binder-capable
> Linux kernel (see [Runtime modes](#runtime-modes)).

## Highlights

- 🎨 **Native-feeling Electron UI** — custom title bar, dark/light themes,
  command palette, keyboard shortcuts
- 📱 **105 real device templates** (Samsung, Google, OnePlus, Xiaomi, Oppo,
  Vivo, Realme, Honor, Sony, Nothing, Asus) with full specs and build
  fingerprints (`ro.build.*` props mapped to redroid env vars)
- 🪪 **Per-phone identity randomization** — IMEI (Luhn + brand-specific TAC),
  IMSI, Android ID, serial, MAC (Wi-Fi/BT/Ethernet), build number, phone
  number by country
- 🌐 **Proxy support** — paste a `http://user__cr.fr__sessid-X:pass@host:port`
  URL, sticky-session tokens preserved, structured fields auto-filled
- ⚙️ **Multilogin-style tabbed create form** — General · Proxy · Device info ·
  Extra
- 🖥️ **Python FastAPI sidecar** — spawned by Electron, talks to Docker via
  `docker-py`, falls back to a simulated runtime when the host kernel can't
  run real containers
- 📊 **Live dashboard** — fleet stats, recent phones, brand breakdown, backend
  health
- 💾 **Bulk creation** — generate N profiles in one click, each with unique
  identity

## Stack

| Layer | Tech |
| --- | --- |
| Desktop shell | Electron 32 + electron-vite |
| Renderer | React 18 + TypeScript + Vite + Tailwind v3 |
| State | Zustand (persisted to localStorage) |
| Routing | React Router v6 |
| UI primitives | Radix UI + Lucide icons + Framer Motion + Sonner |
| Sidecar | Python 3.11+ · FastAPI · uvicorn · pydantic v2 · docker · adb-shell |
| Container runtime | redroid via Docker (Linux host with binder) |

## Repository layout

```
.
├── electron/              # Main + preload (TypeScript)
│   ├── main.ts            # Window lifecycle, CSP, IPC bootstrap
│   ├── preload.ts         # Renderer ↔ main bridge (sandbox-safe)
│   ├── sidecar.ts         # Spawns and supervises the Python sidecar
│   ├── ipc-handlers.ts    # IPC channel registry
│   ├── settings-store.ts  # Persistent settings (electron-store)
│   └── wsl-keepalive.ts
├── shared/                # Types + IPC channel names shared between
│   └── ipc-schemas.ts     # main, preload, renderer (zod-validated)
├── src/                   # Renderer (React app)
│   ├── App.tsx
│   ├── main.tsx
│   ├── api/sidecar.ts     # Typed HTTP client for the sidecar
│   ├── components/        # UI primitives (Button, Badge, Card, …)
│   ├── data/
│   │   └── phoneTemplates.ts   # The 105-device catalog
│   ├── hooks/
│   ├── layout/            # Shell, Sidebar, TopBar, TitleBar, StatusBar
│   ├── lib/
│   │   ├── identity.ts    # IMEI / MAC / serial / phone generators
│   │   ├── proxy.ts       # Proxy URL parser
│   │   └── ids.ts
│   ├── pages/             # Routed pages
│   │   ├── Dashboard.tsx
│   │   ├── phones/{PhonesList,CreatePhone,PhoneDetail}.tsx
│   │   └── ...
│   ├── router/
│   ├── store/
│   │   ├── phones.ts      # Created phones (Zustand + persist)
│   │   └── settings.ts
│   ├── styles/global.css  # Theme tokens
│   └── theme/
├── backend/               # Python sidecar
│   ├── app/
│   │   ├── main.py        # FastAPI factory, lifespan
│   │   ├── config.py      # Env-driven settings
│   │   ├── security.py    # X-CP-Token guard
│   │   ├── docker_client.py
│   │   ├── runtime.py     # Real vs simulated probe
│   │   ├── redroid.py     # Container lifecycle (real path)
│   │   ├── simulated.py   # Fake container lifecycle
│   │   ├── schemas.py     # Pydantic models mirror frontend types
│   │   └── routers/{health,phones}.py
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── README.md
├── tailwind.config.ts
├── electron.vite.config.ts
└── package.json
```

## Getting started

### Prerequisites

| Tool | Why |
| --- | --- |
| **Node.js 20+** | Electron + Vite |
| **Python 3.11+** | Sidecar runtime |
| **Docker Desktop** (Windows/macOS) or **docker.io** (Linux) | Container engine |
| Optional: **Linux kernel with binder** | Run real redroid containers |

### Install

```bash
# 1. Frontend + Electron
npm install

# 2. Python sidecar (in its own venv)
cd backend
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
cd ..

# 3. Launch dev (spawns Electron + sidecar)
npm run dev
```

The first launch will:

1. Spin up Vite for the renderer (port 5173 by default)
2. Build the Electron main + preload bundles
3. Spawn the Python sidecar (port 38080, free-port fallback on conflict)
4. Open the Electron window

### Build a distributable

```bash
npm run build      # bundles main, preload, renderer
npm run dist       # electron-builder → .exe / .dmg / .AppImage / .deb
```

## Runtime modes

The sidecar probes the host on startup and picks one of three modes:

| Mode | When | Behavior |
| --- | --- | --- |
| **real** | Docker reachable AND host kernel has Android binder/binderfs | Actual redroid containers via `docker run`, ADB port forward, full fingerprint via `ro.*` env |
| **simulated** | Docker reachable but no binder | Fake in-memory containers with realistic lifecycle (~3s boot). UI flows are end-to-end testable; no real Android. |
| **unavailable** | No Docker | Phones list/CRUD still works, but Start is rejected |

The current mode is reported in `GET /health` (`runtime_mode`, `runtime_reason`) and surfaced in the Dashboard's Backend card.

### Why Windows Docker Desktop is `simulated` by default

Docker Desktop on Windows runs containers inside its own WSL2 VM. That VM
uses a minimal Microsoft kernel without `CONFIG_ANDROID_BINDER_IPC`. redroid
won't boot without binder — the container exits with code 129 and no logs.

Three ways out (none modify Docker Desktop's kernel):

1. **Hyper-V Ubuntu VM** with regular `docker.io` and a binder-patched
   kernel. Sidecar runs inside the VM; Electron points at the VM's IP.
2. **Linux VPS** (DigitalOcean / Hetzner / Vultr / your own). Bare-metal
   Linux has binder available with `modprobe binder_linux` or a kernel
   rebuild. Sidecar runs on the VPS; Electron app over a tunnel.
3. **Custom WSL2 kernel** with binder — works, but risks breaking Docker
   Desktop.

For now the app is fully usable in simulated mode for UI/UX iteration.

## Configuration

Settings are persisted by `electron-store` in:

- Windows: `%APPDATA%/cloudphone-manager/config.json`
- macOS: `~/Library/Application Support/cloudphone-manager/config.json`
- Linux: `~/.config/cloudphone-manager/config.json`

Sidecar env (passed from Electron at spawn time):

| var | default | purpose |
| --- | --- | --- |
| `CP_SIDECAR_HOST` | `127.0.0.1` | bind host |
| `CP_SIDECAR_PORT` | `38080` (or free port) | bind port |
| `CP_DATA_DIR` | (from settings) | where phone data lives |
| `CP_SNAPSHOT_DIR` | (from settings) | snapshot storage |
| `CP_APK_DIR` | (from settings) | APK library |
| `CP_LOG_LEVEL` | `info` / `debug` in dev | structlog level |
| `CP_IPC_TOKEN` | random per spawn | required `X-CP-Token` header |
| `CP_PYTHON` | _empty_ | override Python interpreter |
| `CP_REDROID_IMAGE` | _empty_ | override default redroid image tag |

## Sidecar API

Anonymous:

- `GET /health` — `{ ok, version, python, platform, docker_*, runtime_mode, … }`
- `GET /version`

Token-guarded (`X-CP-Token`):

- `GET /phones` — list
- `POST /phones` — upsert (frontend remains source of truth)
- `GET /phones/{id}`
- `DELETE /phones/{id}`
- `POST /phones/{id}/start` — `docker run` redroid (or simulate)
- `POST /phones/{id}/stop`
- `GET /phones/_/containers` — diagnostic, lists all CP-managed containers

## Scripts

| script | purpose |
| --- | --- |
| `npm run dev` | electron-vite dev — full app, HMR, sidecar |
| `npm run build` | bundle main/preload/renderer |
| `npm run dist` | build + electron-builder installer |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest |

## Roadmap

- [ ] WebSocket events for live container state
- [ ] Snapshots UI + `docker commit` / restore
- [ ] APK Library — upload + bulk install
- [ ] ADB shell + scrcpy launch from PhoneDetail
- [ ] PhoneInstance detail page (separate from template detail)
- [ ] Real backend deployment guide (VPS playbook)
- [ ] Multi-host fleet (Electron connects to remote sidecars)
- [ ] Settings page (data paths, default image, runtime override)
- [ ] Backup / restore phone library

## License

TBD.
