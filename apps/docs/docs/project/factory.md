---
title: factory/
---

# Factory (`factory/`)

## Main idea

**`factory/`** holds the **production-style web demo** that exercises the full **config-driven** vision pipeline in a single browser experience. The static bundle under **`factory/web/`** is served at **`/factory`** (and deep links like `/factory/:id` still serve the same shell so client routers can read the id).

## More detail

The demo is intentionally **minimal in HTML**: scripts bootstrap the app, load ONNX runtime when YOLO is selected, pull the active **factory configuration**, start the camera pipeline, and render recognition overlays according to config.

Behavior highlights:

- **Model toggle** — run YOLO or MediaPipe locally depending on configuration.
- **Actions** — recognition-timed and periodic actions follow the config’s lists.
- **UI visibility** — configuration can enable or suppress on-screen controls for automated or human-driven runs.

## Functional details

| Aspect | Outcome |
|--------|---------|
| **Config binding** | Operators see how a single JSON-like config steers detection, drawing, and actions without rebuilding the app. |
| ** parity with tooling** | Config Generator and Config Manager are the expected companions: create a profile, save it, then launch factory with that id. |
| **Deployment story** | Because it is static assets + shared `lib/`, hosting matches other apps: same Node server, same origin, no separate bundler step for the demo shell. |
| **Deep links** | Optional path segments let bookmarked URLs select a configuration identity on the client. |

**Relation to `apps/`:** Functionally similar to camera/streaming clients, but **lives under `factory/`** as the curated “showcase” build referenced from the landing page and docs.

## Code

### `factory/web/index.html`

- **Head** — loads **`/ui-kit/ui-kit.css`** (or relative) and **`styles.css`** if present; **body** minimal.
- **Scripts** — **`onnxruntime-web`** CDN **`ort.min.js`**, then **`type="module"`** → **`script.js`**.

### `factory/web/script.js`

**Imports (edge):**

- **`../../lib/edge/capture.js`** — **`getCameraStream`**, **`attachCameraStreamToVideo`**, **`waitForVideoAndPlay`**.
- **`../../lib/edge/source-to-canvas.js`** — **`videoToReusableCanvas`**, **`scaleDetectionsToVideo`**.
- **`../../lib/edge/bounding-boxes.js`** — **`boundingBoxes`**, **`clearBoundingBoxes`**.
- **`../../lib/edge/actions.js`** — **`action`**, **`localRecognitionActions`**, **`localRecognitionActionsFromConfig`**.
- **`../../lib/edge/ui.js`** — **`injectTopButtons`**.

**Module-level state variables:** **`cameraStream`**, **`videoElement`**, **`recognitionInterval`**, **`boundingBoxInterval`**, **`regularActionIntervals`**, **`recognitionResults`**, **`recognitionRunning`**, **`recognitionCanvas`** — same lifecycle pattern as **`apps/camera-stream`**.

**`startRecognitionLoop(config)`**

- Reads **`config.localRecognition.model`** (`YOLO` / `MEDIAPIPE`); **dynamic `import()`** of the matching **`recognize-*`** module.
- **`setInterval`** callback: guards **`recognitionRunning`**, builds **`recognitionCanvas`** via **`videoToReusableCanvas`**, runs recognizer (**canvas**, **`config`**), scales with **`scaleDetectionsToVideo`**, and runs configured recognition actions.
- Parallel **`boundingBoxInterval`** when **`boundingBoxStyles`** exists.

**`initApp(config)`**

- If **`config.ui`**: **`injectTopButtons(document, config)`** and listens for **`ui:state`** custom events (**`detail.active`**) to **start/stop** recognition and **clear** boxes; if **`!config.ui`**, starts **`startRecognitionLoop`** immediately.
- Registers **`beforeunload`** cleanup.

**`getConfigIdFromPath()`** — reads **`?id=`** from **`URLSearchParams`**, default **`'config'`**.

**`main()`** — **`fetch('/api/configurations/' + encodeURIComponent(configId))`**, then **`res.json()`** as **`config`**, then **`initApp(config)`**. On failure, **alert** and return (no local fallback in script; server **`getConfiguration`** may still fall back to **`config/config.js`**).

**`config-factory.js`** on disk is a **reference preset** for authors; the **running** factory page always consumes the **API-normalized** object.

**Used by:** operators visiting **`/factory`**; **hosted** via **`server/hosting-server.js`**.

**Uses:** **`config/config-factory.js`** or **configuration API**; all listed **`lib/edge/*`** modules.
