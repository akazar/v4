---
title: Camera stream
---

# Camera stream (`/camera-stream`)

## Main idea

**Camera stream** is the **interactive live demo** for browser-side object detection: it shows your webcam full-bleed, runs **continuous** or **manual** recognition with **YOLO or MediaPipe**, and draws bounding boxes from configuration.

## More detail

The page loads ONNX runtime for YOLO. Controls sit in a top content strip so the camera remains the visual focus.

## Visual elements

- **Title & short description** — Explains the page purpose.
- **Control strip** — Row of actions:
  - **Start Camera** — Requests permission and begins preview.
  - **Stop Camera** — Ends tracks and releases devices.
  - **Start Recognition** — Begins timed inference loop.
  - **Stop Recognition** — Halts timed inference while optionally leaving camera on.
  - **Manual Recognition** — Runs a single pass on the current frame.
- **Model selector** — Dropdown to choose **YOLO** vs **MEDIAPIPE**.
- **Video layer** — Full-screen background video element with overlay canvas for boxes (injected by shared edge helpers).

## User workflows

1. **Start hardware** — Click **Start Camera**; approve browser permissions.
2. **Choose engine** — Pick YOLO or MediaPipe before or between runs.
3. **Continuous mode** — Click **Start Recognition** to see periodic updates; **Stop Recognition** to pause inference.
4. **Spot check** — With recognition paused, use **Manual Recognition** to inspect a single moment (useful for presentations or debugging lighting).
5. **Tear down** — **Stop Camera** when finished to free the webcam for other tabs.

**Outcome:** Operators validate **latency**, **class lists**, and **overlay styling** on real-world video without uploading files.

## Code

### `apps/camera-stream/script.js`

**Imports**

- **`CONFIG`** default from **`../../config/config.js`** (static, not API).
- **`lib/edge/capture.js`**, **`image-format.js`**, **`recognition/*`**, **`bounding-boxes.js`**, **`actions.js`**.

**State:** `cameraStream`, `videoElement`, `recognitionInterval`, `regularActionIntervals`, `recognitionResults`.

**`manualRecognition()`** — reads **`#modelSelect`**; **`toDataUrl(videoElement)`**; **`recognize` / `recognizeWithYolo`**; **`action(recognitionResults, manualRecognitionActionFunctions)`**.

**`startRecognitionLoop()`** — interval **`CONFIG.boundingBoxStyles.interval`**; inside: model branch, **`boundingBoxes`**, configured recognition actions; starts **`localRegularActionFunctions`** intervals calling **`action(recognitionResults, [funcObj.func])`**.

**`stopRecognitionLoop`**, **`startCameraStream`**, **`stopCamera` wiring** — **`getElementById`** for **`startBtn`**, **`stopBtn`**, **`startRecognitionBtn`**, **`stopRecognitionBtn`**, **`manualRecognitionBtn`**.

**Used by:** `index.html` (**`type="module"`**).

**Difference from factory:** local **import** config; explicit buttons instead of **`injectTopButtons`**.

### `apps/camera-stream/index.html`

- Buttons **`#startBtn` … `#manualRecognitionBtn`**, **`#modelSelect`**.
- **`ort.min.js`** CDN before module **`script.js`**.
