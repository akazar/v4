---
title: Image upload
---

# Image upload (`/image-upload`)

## Main idea

**Image upload** analyzes **still images** with **local** YOLO or MediaPipe: load from disk or URL, run recognition on demand, visualize boxes on a canvas, and **download** a JPEG with annotations.

## More detail

ONNX runtime is included for YOLO. The preview area shows either a placeholder hint or the annotated canvas.

## Visual elements

- **Title & instructions** — Explains file/URL + Recognize flow.
- **Model selector** — YOLO vs MediaPipe.
- **File input** — Accepts common image types (JPG/PNG).
- **URL input** — Fetches remote imagery (subject to browser CORS rules for canvas use).
- **Recognize button** — Triggers a single detection pass.
- **Download button** — Appears after a successful run; saves annotated JPG.
- **Preview canvas** — Displays the image with overlaid detections.
- **Placeholder text** — Visible until the user runs recognition.

## User workflows

1. **Pick a model** — Select YOLO or MediaPipe.
2. **Provide imagery** — Either choose a local file **or** paste a direct image URL.
3. **Run detection** — Click **Recognize**; wait for boxes and labels.
4. **Review** — Inspect confidence via labels on the canvas.
5. **Export** — Click **Download** to keep an annotated copy for reports or tickets.

**Outcome:** Static QA, content moderation sampling, and **side-by-side** comparisons with server detection (via the Compare app) become straightforward.

## Code

### `apps/image-upload/script.js`

**Imports:** **`CONFIG`** from **`config/config.js`**; **`imageToCanvas`** from **`lib/edge/source-to-canvas.js`**; **`recognize`**, **`recognizeWithYolo`**, **`getImageFromSource`**; **`drawBoundingBoxes`**; **`action`**.

**DOM refs:** `#fileInput`, `#urlInput`, `#modelSelect`, `#recognizeBtn`, `#downloadBtn`, `#previewCanvas`, `#placeholder`.

**State:** `currentImageSource` (**Blob** or **HTMLImageElement**), `resultCanvas` (annotated output).

**`runRecognition(source, model)`** — dispatches MediaPipe vs YOLO; maps each **`results`** entry to box fields **`x`**, **`y`**, **`width`**, **`height`**, and a **`label`** string for **`drawBoundingBoxes`**.

**Download path:** converts **`resultCanvas`** to **blob URL** / **`toDataURL`** for **JPG** save.

**Event wiring:** file **`change`**, URL blur/button flow, recognize click, download click.

**Used by:** static **`index.html`** + **`ort.min.js`**.

**Uses:** purely **`lib/edge`** + static **`CONFIG`**.
