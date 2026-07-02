---
title: lib/
---

# Shared libraries (`lib/`)

## Main idea

**`lib/`** holds **reusable building blocks** for Vision v4, split into **edge** (browser-oriented: camera, drawing, local models) and **cloud** (server-oriented: APIs, streaming, orchestration, shared server utilities). Apps import from here; the server mounts the repo root so browsers can load these modules as static ES modules.

## More detail

### Edge (`lib/edge/`)

Focused on **in-browser** experiences:

- **Capture** — acquire a camera stream, attach it to video, wait until frames are ready.
- **Image / canvas** — normalize video frames or files to canvases or data URLs for detectors.
- **Local recognition** — MediaPipe and YOLO paths that run entirely in the browser (subject to CDN or bundled weights).
- **Overlays** — draw detection boxes aligned with video or image display geometry.
- **Actions** — run side effects from recognition results (logging, hooks, scheduled-style triggers on the client).
- **UI helpers** — optional injected controls (e.g. on/off affordances) when configs enable UI chrome.

### Cloud (`lib/cloud/`)

Focused on **server** and **hybrid** flows:

- **HTTP API surfaces** — recognition, reasoning, notifications, database helpers, configuration, model-training file endpoints, annotate export, home-stream metadata.
- **Streaming** — WebRTC-oriented server pieces: signaling, registry of streams, optional SFU-style paths, helpers for video frame formats, recognition-on-stream pipelines where applicable.
- **Action servers** — orchestrate declarative actions (notify, HTTP callbacks, DB posts) triggered from recognition or reasoning outcomes.
- **Captured stream** — server-side capture preview for “web capture” streaming.
- **Shared state** — coordination data for multi-client scenarios.
- **Utilities** — image format helpers, notifications, lightweight persistence helpers.

## Functional details

| Layer | User-visible outcomes |
|-------|------------------------|
| **Edge** | Live camera apps show boxes; image upload draws results locally; streaming viewer can run local detection on a grabbed frame without a round trip. |
| **Cloud** | Compare and server-detection UIs get server-side boxes; reasoning UIs get text; streaming home can resolve stream metadata; config manager lists files; training UI can persist placeholder weights. |
| **Cross-cutting** | The same conceptual “detection result” shape can move between client and server panels so compare views stay aligned. |

**Documentation note:** `lib/API.md` in the repo is a **developer reference** for edge functions. This documentation site stays at the **capability** level per your request.

## Code

### `lib/edge/` (browser)

| Module (path) | Main exports (symbols) | Parameters / behavior summary | Used by |
|---------------|------------------------|------------------------------|---------|
| `capture.js` | `getCameraStream`, `attachCameraStreamToVideo`, `waitForVideoAndPlay` | **constraints** optional for `getUserMedia`; **`doc`**, **`cameraStream`** for attach; **video** for play **Promise** | `apps/camera-stream/script.js`, `apps/factory/script.js`, `apps/debug/script.js` |
| `image-format.js` | `toDataUrl`, `dataUrlToCanvas` | **source** → JPEG data URL; **dataUrl** → **Canvas** | Image upload, server-detection/reasoning clients |
| `source-to-canvas.js` | `imageToCanvas`, `videoToReusableCanvas` (and related) | Normalize **video**/blob to **canvas** with size limits | Camera stream, factory, debug |
| `bounding-boxes.js` | `boundingBoxes`, `clearBoundingBoxes`, `drawBoundingBoxes` | **recognitionResults**, **video**/canvas, **styles**; low-level **ctx**, **boxes** | All live-overlay UIs |
| `recognition/mediapipe/recognize-mediapipe.js` | `recognize` | **source** canvas or data URL; **config** thresholds/classes | Camera, image upload, compare |
| `recognition/yolo/recognize-yolo.js` | `recognizeWithYolo`, `getImageFromSource` | **source** blob/image/canvas/string; **config** needs **classes** array | Camera, image upload, compare, factory |
| `actions.js` | `action`, `localRecognitionActions`, `localRecognitionActionsFromConfig`, … | **recognitionResults** + function list or config rows | Camera stream, factory, image upload |
| `ui.js` | `injectTopButtons` | **`doc`**, **`config`** with **`config.ui`** | Factory demo |

### `server/services/` (Express API wiring)

| Module | Export | Role |
|--------|--------|------|
| `recognition-service.js` | `setupRecognitionService(app)` | **`POST /api/recognize`** — body **`image`**, optional **`mime`**, **`config`**; loads **`db/configs/config.js`** default; dispatches YOLO/MediaPipe **server** recognizers; **`serverRecognitionActions`**, **`setLastRecognitionResults`**. |
| `reasoning-service.js` | `setupReasoningService(app)` | **`POST /api/reasoning`** — **`model`**, **`prompt`**, **`imageBase64`**; **`parseModelSelector`**; **OpenAI** / **Gemini** lazy clients from env; **`setLastReasoningResult`**. |
| `configuration-service.js` | `setupConfigurationService(app)` | **`GET /api/configurations`**, **`GET/POST/DELETE …/:id`**; reads **`db/configs/public`**; **`getConfiguration(id)`** dynamic `import`; **`configObjectToJsSource`**. |
| `streaming-service.js` | `setupStreamingService(server)` | Socket.IO signaling, registry (**`lib/cloud/streaming-service/*.js`** family). |
| `action-services/api-service.js` | `setupApiService(app)` | CORS, JSON, **`/health`**, **`/api/describe`**, **`.env` loader**; pulls **`serverReasoningActionFunctions`** from **`config.js`**. |
| `model-training-service.js` | `setupModelTrainingService(app)` | List/save/delete under **`db/models`**. |
| `annotate-export-service.js` | `setupAnnotateExportService(app)` | Receives COCO/VIA exports into **`apps/annotate/annotation-list`**. |
| `captured-stream-service.js` | `setupCapturedStreamService(app)` | Puppeteer-based capture endpoints for streaming workflow. |
| `hosting-service.js` | `setupHostingService(app)` | Static hosting for apps, docs, **`/lib`**, **`/db/configs`**. |

### `lib/cloud/` (shared server libraries)

| Module | Export | Role |
|--------|--------|------|
| `shared-state.js` | getters/setters | Last reasoning / recognition results for action orchestrators. |

### `lib/scheduled-actions-manager.js`

Used by **`apps/streaming/dashboard.js`** (`createScheduledActionsManager`) to align timed **config actions** with streaming recognition events.

**Cross-cutting rule:** Browser code **imports `/lib/...`** only because **`server/services/hosting-service.js`** exposes the repo root as static files.
