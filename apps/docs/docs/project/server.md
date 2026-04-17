---
title: server/
---

# Server (`server/`)

## Main idea

The **`server/`** directory is the **Node.js entry** for Vision v4: it creates the HTTP server, **hosts all browser apps** from `apps/` (and related static roots), wires **REST APIs** for recognition, reasoning, configuration, notifications, simple database helpers, annotation export, model-training file IO, streaming metadata, and **attaches Socket.IO** for realtime streaming/signaling.

## More detail

### Process role

When you start the main script, the process:

1. Loads environment (including optional API keys from `.env`).
2. Builds an Express application and an underlying HTTP server (needed for WebSocket upgrades).
3. Registers **static hosting** so browsers can load HTML, CSS, and JS from `apps/`, the repository root (for shared `config/` and `lib/` imports), `factory/web`, the shared UI kit, and the Docusaurus output at `/documentation/` when `apps/docs/build` exists.
4. Mounts **API routers** for cloud features: recognition, reasoning, notifications, database helpers, configuration listing/serving, annotate export, model-training uploads/list/delete, home-stream metadata, and Puppeteer-based captured-stream preview.
5. Attaches the **streaming** subsystem on the same HTTP port (signaling and related realtime behavior).
6. Listens on a configurable **port** (environment override or default).

### Health and operations

The server exposes a simple **health** URL for uptime checks. Startup logs indicate whether optional AI keys were found (without printing full secrets).

## Functional details

| Responsibility | What it enables |
|----------------|-----------------|
| **Static hosting** | Users open landing, streaming, training, compare, annotator, and other UIs in the browser without a separate frontend build step for those apps. |
| **Shared asset root** | Sibling folders like `config/` and `lib/` can be fetched by browser modules using absolute paths, keeping one copy of scripts for many apps. |
| **Recognition API** | Browser apps such as server-detection and compare can offload detection to the server. |
| **Reasoning API** | Server-reasoning and compare can obtain text answers about an image via configured providers. |
| **Configuration API** | Config manager and debug-style clients can list, fetch, and manage JSON-backed configs. |
| **Notification & DB helpers** | Action pipelines triggered from configs can POST lightweight events or records through dedicated endpoints. |
| **Streaming** | Multi-stream WebRTC flows use the same origin for Socket.IO and app static files. |
| **Capture preview** | A server-assisted capture path supports streaming “web capture” scenarios that need headless rendering. |
| **Annotate export** | Saves annotation exports from the VIA tool to a known folder on the server. |
| **Model training files** | Accepts placeholder checkpoint saves and serves a list for the training dashboard. |

**Deployment picture:** In production you run **one** Node process (or a process manager wrapping it) that serves both static frontends and APIs. Scale-out and TLS termination are outside this folder but consume the same HTTP entry.

## Code

### `server/main.js`

| Symbol | Type | Role |
|--------|------|------|
| `PORT` | `const` | `process.env.PORT \|\| 3001` — **number-like** string used by `server.listen`. |
| `app` | Express app | Created with **`express()`**; receives all middleware and routes from setup functions. |
| `server` | `http.Server` | **`http.createServer(app)`** — required so **Socket.IO** attaches to the same listener as Express. |
| OpenAI key check | branch | If **`process.env.OPENAI_API_KEY`** exists, logs first 7 + last 4 chars; else warns (wording references `/api/describe`). |

**Imports / setup order (logic):**

1. **`setupFrontendHosting(app)`** — static files and HTML routes (`server/hosting-server.js`).
2. **`setupApiServer(app)`** — CORS, JSON, **`/health`**, **`/api/describe`**, loads **`.env`** via **`api-server.js`** helper.
3. **`setupRecognitionServer(app)`** — **`POST /api/recognize`** (`lib/cloud/recognition-server.js`).
4. **`setupReasoningServer(app)`** — **`POST /api/reasoning`** (`lib/cloud/reasoning-server.js`).
5. **`setupNotificationServer`**, **`setupDbServer`**, **`setupConfigurationServer`** — action/notify/db/config APIs.
6. **`setupAnnotateExportServer`**, **`setupModelTrainingServer`**, **`setupStreamingHomeMetaServer`** — feature-specific REST.
7. **`setupStreamingServer(server)`** — Socket.IO on **`server`**, not `app` alone.
8. **`setupCapturedStreamServer(app)`** — Puppeteer capture preview routes.
9. **`server.listen(PORT, …)`** — binds HTTP.

**Used by:** `npm start` → **`package.json` `scripts.start`**.

**Uses:** every **`lib/cloud/*`** setup listed above; **`./hosting-server.js`**.

### `server/hosting-server.js`

| Export | Parameters | Returns | Role |
|--------|------------|---------|------|
| **`setupFrontendHosting`** | `app` (Express) | `void` | Registers **`app.get`** routes and **`express.static`** mounts. |

**Path `const` variables:** `v4Root`, `appsPath`, `landingPath`, `configCreatorPath`, `configManagerPath`, `cameraStreamPath`, `imageUploadPath`, `serverDetectionPath`, `serverReasoningPath`, `comparePath`, `factoryWebPath`, `debugPath`, `streamingPath`, `annotatePath`, `modelTrainingPath`, `uiKitPath`, `docsBuildPath` (`apps/docs/build`) — all **`path.join(__dirname, '..', …)`** from **`server/`** so files resolve under repo root.

**General logic:**

- **`/`**, **`/ua`** → send **`apps/landing`** `index.html` (UA variant under `ua/`).
- **`/documentation`** → **`301`** to **`/documentation/`**, then **`express.static(docsBuildPath)`** when **`index.html`** exists (otherwise startup logs a skip warning).
- **`app.use(express.static(v4Root))`** — serves **`config/`**, **`lib/`**, repo root files at **URL root** so browser imports like **`/lib/edge/...`** work.
- **`app.use(express.static(appsPath))`** — sibling assets for apps.
- **`/ui-kit`** — explicit static mount for **`apps/ui-kit`**.
- **`/factory`** (+ **`/factory/:id`**) — **`factory/web`** SPA shell.
- Per-app prefixes **`/config-creator`**, **`/config-manager`**, **`/camera-stream`**, **`/image-upload`**, **`/model-training`**, **`/model-training/dashboard`**, **`/server-detection`**, **`/server-reasoning`**, **`/compare`**, **`/debug`**, **`/streaming`**, **`/annotate`** — each pairs **`static`** middleware with **`sendFile(index.html)`** for clean URLs.

**Used by:** all **`apps/**`** pages loaded in the browser; **`factory/web`**; browser module imports from **`/lib`** and **`/config`**.

**Uses:** **`express`**, **`path`**, **`fileURLToPath`** for `__dirname` in ESM.
