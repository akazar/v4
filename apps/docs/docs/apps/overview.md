---
title: Applications overview
---

# Applications under `apps/`

## Main idea

The **`apps/`** directory contains **browser-facing experiences** for Vision v4: marketing/landing pages, configuration tools, live camera and image workflows, server-backed detection and reasoning, WebRTC streaming, annotation, training UI, debugging, and a shared **UI kit** stylesheet.

## More detail

All of these are served by the **main Node server** (see [Server](../project/server)) at path prefixes such as `/streaming`, `/camera-stream`, `/annotate`, etc. The server also exposes the repository root as static files so apps can import **`/lib/...`** and **`/config/...`** uniformly.

### Application index

| App | URL prefix | Purpose (one line) |
|-----|------------|---------------------|
| Landing (EN) | `/` | Product overview and links to all modules |
| Landing (UA) | `/ua` | Ukrainian landing variant |
| UI kit | `/ui-kit` | Shared CSS tokens and components |
| Factory demo | `/factory` (static files under `apps/factory/web/`) | Config-driven full pipeline |
| Config generator | `/config-creator` | Form-based builder for `config.js` |
| Config manager | `/config-manager` | List / view / delete configs in `config/public` |
| Camera stream | `/camera-stream` | Live camera with local detection controls |
| Image upload | `/image-upload` | Static image detection in-browser |
| Server detection | `/server-detection` | Image detection via server API |
| Server reasoning | `/server-reasoning` | Image + prompt → text via server API |
| Compare | `/compare` | Side-by-side local/server detection and reasoning |
| Streaming | `/streaming` | WebRTC multi-stream home, streamer, viewer, dashboard |
| Model training | `/model-training` | Simulated training job UI |
| Models dashboard | `/model-training/dashboard` | List/delete saved checkpoints |
| Annotate (VIA) | `/annotate` | Manual image/audio/video annotation |
| Debug | `/debug` | Minimal shell that loads config by id and runs a recognition loop |

Each app has a dedicated doc page with **visual elements** and **user workflows**.

## Functional details

- **Shared styling** — Most apps link `/ui-kit/ui-kit.css` for consistent typography, buttons, and layout primitives.
- **Shared logic** — Client modules under `lib/edge/` power recognition, drawing, and actions across camera, image, streaming viewer, compare, and factory-style flows.
- **Server coupling** — Apps that call APIs require the main server; pure-local apps can work offline only if assets and models are already cached (CDN models may still need network).

## Code

### Static mount layout (`server/hosting-server.js`)

| URL prefix | Filesystem | Typical entry |
|------------|------------|----------------|
| `/` | `apps/landing/` + `v4Root` static | `index.html` |
| `/ua` | `apps/landing/ua/index.html` | UA mirror |
| `/apps/...` (implicit) | `express.static(appsPath)` | per-folder assets |
| `/lib/...` | `v4Root` | **`lib/**/*.js`** ES modules |
| `/config/...` | `v4Root` | **`config/**/*.js`** |
| `/factory` | `apps/factory/web/` | factory SPA |
| … | (see server doc) | … |

### Import convention in browser apps

```text
import … from '/lib/edge/…';
import … from '../../config/config.js';
```

- **Leading `/`** resolves against origin (requires **`setupFrontendHosting`** exposing **`v4Root`**).
- **Relative `../..`** resolves from **`apps/<app>/script.js`** into **`config/`**.

### Per-app script entrypoints (representative)

| App folder | Primary JS | Imports |
|------------|------------|---------|
| `camera-stream` | `script.js` | `config/config.js`, `lib/edge/*` |
| `image-upload` | `script.js` | same |
| `server-detection` | `script.js` | `config` + **`fetch /api/recognize`** |
| `server-reasoning` | `script.js` | **`fetch /api/reasoning`** |
| `compare` | `app.js` | `config/public/config-default.js`, local + server fetches |
| `streaming` | `home.js`, `viewer.js`, `dashboard.js`, `streamer.js` | Socket.IO + `process.js` / dashboard events |
| `config-manager` | `app.js` | **`/api/configurations`**, static **`/config/public/`** |
| `config-creator` | `app.js` | form → string → download / POST |
| `model-training` | `app.js`, `dashboard.js` | **`/api/model-training/models-list`** |
| `debug` | `script.js` | **`/api/configurations/:id`** only |

**Cross-use:** **`lib/cloud/**`** is **never** imported from browser code; only **`lib/edge/**`** and occasional **`/lib/scheduled-actions-manager.js`** (streaming dashboard).
