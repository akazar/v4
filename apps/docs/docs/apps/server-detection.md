---
title: Server detection
---

# Server detection (`/server-detection`)

## Main idea

**Server detection** mirrors the **image upload** UX but sends imagery to the **server recognition API** instead of running a model in the browser. Results return as detections the client draws on a canvas; you can download a JPEG overlay.

## More detail

There is **no ONNX script tag** here—the heavy work happens server-side (headless/browser-assisted pipeline per server configuration).

## Visual elements

- **Title & description** — States that recognition runs on the server.
- **Model selector** — Chooses the server-side model flavor (YOLO vs MediaPipe) to request.
- **File input** — Local image upload.
- **URL input** — Remote image URL.
- **Recognize button** — POSTs the image (or reference) to the API and awaits boxes.
- **Download button** — Hidden until a result exists; exports annotated JPG.
- **Preview canvas** — Shows returned boxes.
- **Placeholder** — Prompts the user until the first successful run.

## User workflows

1. **Ensure server** — Start the main Vision v4 server so `/api/recognize` (or equivalent mounted path) is live.
2. **Choose model** — Select desired server model option.
3. **Load image** — File or URL as in the local uploader.
4. **Recognize** — Trigger server inference; handle errors surfaced in UI/status if the server is down.
5. **Download** — Save annotated output for sharing.

**Outcome:** Clients with **low-powered devices** can still preview detections, and engineers can **validate** server parity against local results.

## Code

### `apps/server-detection/script.js`

| Constant / var | Meaning |
|------------------|---------|
| **`RECOGNITION_SERVER_URL`** | `CONFIG.recognitionServerUrl ?? ''` — base origin for **`/api/recognize`** (empty = same host). |
| **DOM refs** | `#fileInput`, `#urlInput`, `#modelSelect`, `#recognizeBtn`, `#downloadBtn`, `#previewCanvas`, `#placeholder`. |
| **`currentImageSource`** | **Blob** or **HTMLImageElement** before **`dataUrl`** conversion. |
| **`resultCanvas`** | Final composite for display/download. |

**`runRecognition(dataUrl, model)`** — performs **`fetch`** to **`RECOGNITION_SERVER_URL + '/api/recognize'`** with **`POST`**, **`Content-Type: application/json`**, and a JSON body where **`image`** is the data URL string and **`config`** spreads **`CONFIG`** while overriding **`serverRecognition.model`** with the selected **`model`**. Parses **`success`** and **`detections`** from the JSON response, builds a canvas via **`dataUrlToCanvas`**, and **`drawBoundingBoxes`** using each detection’s **`coordinates`**, **`size`**, **`class`**, and **`confidence`**.

**Server counterpart:** **`lib/cloud/recognition-server.js`** **`setupRecognitionServer`** — **`POST /api/recognize`** body **`image`**, optional **`mime`**, **`config`**.

**Uses:** **`lib/edge/image-format.js`**, **`bounding-boxes.js`**, **`actions.js`** (if wired for post-detect hooks).
