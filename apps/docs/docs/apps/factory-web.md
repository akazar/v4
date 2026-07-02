---
title: Factory web demo
---

# Factory web demo (`apps/factory` → `/factory`)

## Main idea

The **factory web demo** is the **single-page, config-driven** experience that runs the full **local** vision pipeline: camera capture, model inference (YOLO or MediaPipe per config), optional on-screen controls, and configured actions.

## More detail

The page body is **empty in HTML** by design; scripts mount the experience. ONNX runtime loads when YOLO is needed. Configuration is fetched using identifiers from the URL so operators can bookmark a specific profile.

## Visual elements

- **Full-page camera view** — Video fills the viewport as the primary canvas.
- **Optional top name bar** — When configuration supplies a display name and UI is enabled, a slim bar can show the active profile name.
- **Optional bottom control bar** — **ON** / **OFF** toggles that emit UI state events for demos or automation (exact behavior depends on config and injected UI helpers).
- **Detection overlay** — Bounding boxes and labels appear over the video when recognition is active and styling is enabled.

## User workflows

1. **Open the demo** — Navigate to `/factory` or `/factory/<configId>` (or use landing / config manager links).
2. **Grant camera permission** — Browser prompts for camera access; approve to proceed.
3. **Observe detections** — Boxes update on an interval defined by configuration.
4. **Toggle UI state** — If controls are visible, use ON/OFF to pause or resume higher-level behaviors tied to UI events.
5. **Iterate config** — Use Config Generator or edit `config/public` files, then reload with a new id.

**Outcome:** Stakeholders see **one** reference implementation that mirrors how production configs shape behavior.

## Code

See **[factory — Code](../project/factory#code)** for **`apps/factory/script.js`** (fetch **`/api/configurations/:id`**, **`initApp`**, **`injectTopButtons`**, **`startRecognitionLoop`**).

### `apps/factory/index.html` (recap)

**Scripts:** CDN **`ort.min.js`**, module **`script.js`**. **No inline UI** — identical bootstrap pattern to **`apps/debug`**.

### Difference vs `apps/camera-stream`

| Aspect | Factory | Camera stream |
|--------|---------|----------------|
| **Config source** | **GET `/api/configurations/:id`** (`?id=` query) | Static **`import '../../config/config.js'`** |
| **UI toggle** | **`injectTopButtons` + `ui:state`** | Explicit HTML buttons wired in `script.js` |
| **Location** | `apps/factory` (served **`/factory`**) | `apps/camera-stream` |
