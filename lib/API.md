# lib/edge API Reference

Documentation for the client-side (edge) modules used by the v4 apps. All paths below are relative to `lib/edge/`.

---

## capture.js

### getCameraStream

**Description:** Requests access to the device camera and returns a media stream. Use this to start a live camera feed for real-time recognition (e.g. camera-stream app).

**Input parameters:**

| Parameter     | Type   | Default | Description                                                                 |
|--------------|--------|---------|-----------------------------------------------------------------------------|
| `constraints`| `Object` | `{ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }` | Optional MediaStreamConstraints (video resolution, audio on/off). |

**Output:** `Promise<MediaStream>` — Resolves to the camera `MediaStream`, or throws if the browser does not support `getUserMedia` or the user denies access.

---

### attachCameraStreamToVideo

**Description:** Creates or reuses a full-screen video element, attaches the camera stream to it, and returns the element. Stops any previous stream on that element. Use after `getCameraStream()` to show the camera in the page.

**Input parameters:**

| Parameter       | Type          | Description                                      |
|----------------|---------------|--------------------------------------------------|
| `doc`          | `Document`    | Document instance (e.g. `document`).              |
| `cameraStream` | `MediaStream` | Camera stream from `getCameraStream()`.          |

**Output:** `HTMLVideoElement` — The video element (id `camera-background`) with the stream attached, styled full-screen with `object-fit: cover`.

---

### waitForVideoAndPlay

**Description:** Waits for the video element to have loaded metadata and then starts playback. Use after attaching the stream so the video actually plays (required before capturing frames).

**Input parameters:**

| Parameter     | Type               | Description                |
|--------------|--------------------|----------------------------|
| `videoElement` | `HTMLVideoElement` | Video element to play.    |

**Output:** `Promise<void>` — Resolves when the video is playing, or rejects if the element is missing or playback fails (e.g. timeout after 1s).

---

## image-format.js

### toDataUrl

**Description:** Converts any supported image source (video, canvas, image, Blob/File) into a JPEG data URL string. Use for sending frames to recognition APIs or for storage/canonical format.

**Input parameters:**

| Parameter | Type | Description |
|----------|------|-------------|
| `source` | `HTMLVideoElement` \| `HTMLCanvasElement` \| `HTMLImageElement` \| `Blob` \| `File` | The image source to convert. |

**Output:** `Promise<string>` — A data URL string (e.g. `data:image/jpeg;base64,...`) at 0.95 JPEG quality. Throws if the source type is not supported.

---

### dataUrlToCanvas

**Description:** Loads a data URL into an image and draws it on a new canvas. Use to get a canvas from a data URL (e.g. after `toDataUrl()` or from an API) for drawing or for recognition that expects a canvas.

**Input parameters:**

| Parameter | Type     | Description                    |
|----------|----------|--------------------------------|
| `dataUrl`| `string` | Data URL (e.g. `data:image/jpeg;base64,...`). |

**Output:** `Promise<HTMLCanvasElement>` — A canvas with the image drawn at natural dimensions. Rejects if the image fails to load.

---

## source-to-canvas.js

### imageToCanvas

**Description:** Converts a single image source (video, canvas, image, or Blob) into an `HTMLCanvasElement` with the same pixel content. Use to normalize different sources to canvas for recognition or further drawing.

**Input parameters:**

| Parameter | Type | Description |
|----------|------|-------------|
| `image`  | `HTMLVideoElement` \| `HTMLCanvasElement` \| `HTMLImageElement` \| `Blob` | The image source. For video, must be in a ready state (`readyState >= 2`). |

**Output:** `Promise<HTMLCanvasElement>` — Canvas containing the image (video frame or image). Returns the same canvas if input is already a canvas. Throws if the type is invalid or video is not ready.

---

## recognition/mediapipe/recognize-mediapipe.js

### recognize

**Description:** Runs MediaPipe Object Detector (EfficientDet Lite2) in the browser on a canvas or data URL. Use for client-side object detection without a server; loads the model from CDN on first call.

**Input parameters:**

| Parameter | Type                  | Description |
|----------|-----------------------|-------------|
| `source` | `HTMLCanvasElement` \| `string` | Canvas with the image, or a data URL. |
| `config` | `Object`              | Optional. `config.localRecognition.threshold`, `config.localRecognition.maxResults`, `config.localRecognition.classes` (filter by class names). |

**Output:** `Promise<Array>` — Array of detections in unified format: `{ id, class, confidence, coordinates: { x, y }, size: { width, height }, image? }`. Optional `image` is a cropped data URL when available.

---

## recognition/yolo/recognize-yolo.js

### recognizeWithYolo

**Description:** Runs YOLOv11n object detection in the browser via ONNX Runtime Web. Use for client-side detection with a COCO-trained model. Requires global `ort` (onnxruntime-web) to be loaded on the page.

**Input parameters:**

| Parameter | Type | Description |
|----------|------|-------------|
| `source` | `Blob` \| `HTMLImageElement` \| `HTMLCanvasElement` \| `string` | Image source (Blob, image element, canvas, or data URL). |
| `config` | `Object` | Must include `config.localRecognition.classes` (array of 80 COCO class names) for mapping class IDs to labels. |

**Output:** `Promise<Array<{ class, confidence, coordinates: { x, y }, size: { width, height } }>>` — Detections in unified shape; `class` comes from `config.localRecognition.classes[classId]`.

---

### getImageFromSource

**Description:** Converts a Blob, data URL, or canvas into an `HTMLImageElement` for use as YOLO input. Use when you have a non-image source that YOLO’s pipeline expects as an image.

**Input parameters:**

| Parameter | Type | Description |
|----------|------|-------------|
| `source` | `Blob` \| `HTMLImageElement` \| `HTMLCanvasElement` \| `string` | Data URL string or one of the listed types. |

**Output:** `Promise<HTMLImageElement>` — Loaded image element. Rejects if the source type is unsupported or loading fails.

---

## bounding-boxes.js

### boundingBoxes

**Description:** Draws bounding boxes for recognition results on top of a video element using an overlay canvas. Maps coordinates from video pixel space to display space (accounts for `object-fit: cover`). Use for live camera views.

**Input parameters:**

| Parameter           | Type               | Description |
|--------------------|--------------------|-------------|
| `recognitionResults` | `Array`            | Results from `recognize()` or `recognizeWithYolo()` (objects with `class`, `confidence`, `coordinates`, `size`). |
| `video`            | `HTMLVideoElement` | Video element (e.g. camera stream). |
| `styles`           | `Object`           | Optional. Merged with `CONFIG.boundingBoxStyles` (stroke, font, label colors, etc.). |

**Output:** `void`. If results are empty or video is missing, clears the overlay.

---

### clearBoundingBoxes

**Description:** Clears the bounding-box overlay canvas. Use when stopping recognition or clearing the current frame’s boxes.

**Input parameters:** None.

**Output:** `void`.

---

### drawBoundingBoxes

**Description:** Low-level helper that draws an array of boxes onto a canvas 2D context. Each box has position, size, and label. Use when you already have boxes in the context’s coordinate system (e.g. for static images or custom overlays).

**Input parameters:**

| Parameter | Type     | Description |
|----------|----------|-------------|
| `ctx`    | `CanvasRenderingContext2D` | Context to draw on. |
| `boxes`  | `Array<{ x, y, width, height, label }>` | Boxes in context coordinates. |
| `styles` | `Object` | Optional. Merged with `CONFIG.boundingBoxStyles`. |

**Output:** `void`. No-op if `boxes` is empty.

---

## actions.js

### action

**Description:** Runs a list of action functions with the same recognition results (e.g. logging, analytics, or custom side effects). Each function receives the full results array; errors in one do not stop the others.

**Input parameters:**

| Parameter          | Type            | Description |
|-------------------|-----------------|-------------|
| `recognitionResults` | `Array`         | Recognition results from `recognize()` or `recognizeWithYolo()`. |
| `actionFunctions` | `Array<Function>` | Functions to run; each is called with `(recognitionResults)` and can return a value or Promise. |

**Output:** `Promise<Array>` — Array of return values from each action (or `{ error: message }` when one throws). Empty array if `actionFunctions` is empty or invalid.
