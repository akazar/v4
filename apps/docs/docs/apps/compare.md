---
title: Compare
---

# Compare (`/compare`)

## Main idea

**Compare** lets you **upload one image** and see **four local detection panels**, **two server detection panels**, and **two reasoning outputs** side by side—so you can contrast engines and providers on identical pixels without re-uploading.

## More detail

The page loads ONNX runtime for local YOLO paths. Each panel owns a **model selector** or **reasoning selector** independent of the others.

## Visual elements

- **Header** — Title + explanation of single-upload multi-panel design.
- **Upload block** — File input with helper label “Upload image from your device”; status text for errors or confirmations.
- **Original image block** — Shows the uploaded bitmap for reference.
- **Local recognition section** — Two columns:
  - **Panel A** — Header label, model dropdown, **canvas**, footer **summary** line (counts or timing).
  - **Panel B** — Same structure with independent model choice.
- **Server recognition section** — Another two-column grid with server model dropdowns and canvases.
- **Reasoning section** — Two columns with ChatGPT/Gemini selects and **read-only textareas** for responses.

## User workflows

1. **Upload once** — Choose a PNG/JPEG; confirm preview appears in block 2.
2. **Local compare** — Set left/right models (e.g. MediaPipe vs YOLO) and observe differences in boxes and summary text.
3. **Server compare** — Trigger server runs per panel (workflow implied: interactions in app refresh canvases when server returns).
4. **Reasoning compare** — Run both providers on the same image (sequential or parallel depending on implementation) and read both answers.
5. **Decide** — Use the combined view to pick a default model or provider for production.

**Outcome:** **A/B decisions** become evidence-based because every panel shares the **same** source frame.

## Code

### `apps/compare/app.js`

**Imports:** **`CONFIG`** from **`../../config/public/config-default.js`** (not `config/config.js`); **`drawBoundingBoxes`**; **`recognizeWithYolo`**; **`recognize`** as **`recognizeMediapipe`**.

**Globals / state:** **`currentDataUrl`**, **`currentFile`** (Blob for YOLO), **`localRecognitionPromise`** — serialization mutex so **MediaPipe**/**YOLO** never overlap in browser.

**DOM collections:** **`modelSelects`** — `.model-select` with **`data-scope`** (`local`|`server`) and **`data-panel`** (`left`|`right`); **`reasoningSelects`** — `.reasoning-select`.

**Geometry helpers:** **`resizeCanvasToImage`**, **`projectDetectionsToCanvas`** — map detection **natural size** to **display canvas** scale.

**Local path:** `runLocalRecognition(panel, model)` — switches on **`MEDIAPIPE`/`YOLO`**, uses **`currentFile`** or image element, draws on **`local-*-canvas`**, summary in **`local-*-summary`**.

**Server path:** **`fetch('/api/recognize', …)`** analogous to server-detection, targets **`server-*-canvas`**.

**Reasoning path:** **`fetch('/api/reasoning', …)`** with **`chatgpt`/`gemini`** selectors → fills **`#reasoning-left`** / **`#reasoning-right`** textareas.

**Used by:** `index.html` + **`ort.min.js`** CDN.

**Cross-use:** **`lib/cloud/recognition-server.js`**, **`reasoning-server.js`**; **edge** recognizers for local panels.
