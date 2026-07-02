---
title: Debug (config-driven shell)
---

# Factory debug (`/debug`)

## Main idea

**`/debug`** is a **minimal HTML shell** for developers: it loads a **configuration JSON** from the server by **`id` query parameter**, starts the **camera**, and runs a **continuous local recognition loop** (YOLO or MediaPipe per config). Bounding-box drawing and many action hooks are **commented out** in the current script—expect **console-oriented** output rather than a polished UI.

## More detail

Unlike `/camera-stream`, there is **no button row** in markup; the page is essentially blank apart from dynamically attached media elements. ONNX runtime is still loaded for YOLO.

## Visual elements

- **None by default** — The body only loads scripts; video/canvas elements are injected at runtime by capture helpers.
- **Implicit camera preview** — Full-screen or near full-screen video when permissions succeed; errors may surface via browser alerts.

## User workflows

1. **Start server** — Configuration API must answer for the chosen id.
2. **Open** `/debug?id=<configId>` (default id if omitted matches server defaults).
3. **Approve camera** — Browser permission prompt.
4. **Observe logs** — Open devtools console to inspect recognition outputs each interval.
5. **Iterate config** — Change thresholds/classes server-side, reload page.

**Outcome:** A **fast, low-noise** harness for validating config fetch + inference without navigating larger UIs.

## Code

### `apps/debug/script.js`

**Imports:** **`capture`**, **`source-to-canvas`**, **`bounding-boxes`**, **`actions`**; **`injectTopButtons`** from **`ui.js`** is **imported but unused** in the current **`initApp`** (dead import unless you wire it later).

**`startRecognitionLoop(config)`** — same overall pattern as **`apps/factory/script.js`** (dynamic YOLO/MediaPipe **`import()`**, **`recognitionRunning`** guard, **`videoToReusableCanvas`**, **`scaleDetectionsToVideo`**). Many branches that call **`boundingBoxes`** / **`localRecognitionActions`** are **commented out** in-repo — rely on **`console.log`** for inspection.

**`initApp(config)`** — on DOM ready calls **`initCameraBackground()`**, then **always** **`startRecognitionLoop(config)`** (no **`ui:state`** gating).

**`getConfigIdFromPath` / `main()`** — same as factory: query **`id`**, **`fetch('/api/configurations/…')`**, **`initApp`**.

**`index.html`** — only **`ort.min.js`** + **`type=module` script**; no UI chrome.

**Contrast:** **`apps/factory/script.js`** uses **`injectTopButtons`** and **`ui:state`** to start/stop recognition; **debug** runs the loop immediately after camera start.
