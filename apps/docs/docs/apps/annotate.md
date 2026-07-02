---
title: Image annotator (VIA)
---

# VIA image annotator (`/annotate`)

## Main idea

**`/annotate`** serves the **VGG Image Annotator (VIA)** bundle: a **self-contained** manual labeling tool for **images, audio, and video** in the browser. It targets datasets that later feed detection training, evaluation, or documentation—not automated inference.

## More detail

The page embeds the full VIA control surface (toolbar, canvas, attribute panes, import/export dialogs). Keyboard shortcuts (e.g. play/pause, next/previous image) are documented inside the app.

## Visual elements (functional grouping)

- **Top control panel** — File/project operations, mode switches, view options.
- **Canvas / media stage** — Where spatial regions (e.g. boxes on images or video frames) are drawn.
- **Attribute editor** — Defines labels and metadata attached to regions or temporal segments.
- **Import / export UI** — Formats include **VIA CSV**, **temporal-only CSV**, **COCO**, imports for shared projects or legacy VIA2 JSON.
- **Status / help regions** — In-app guidance for shortcuts and tool modes.

## User workflows

### Still images

1. **Load media** — Add local files or remote URIs (bulk paste supported).
2. **Draw regions** — Click-drag to create bounding boxes or other supported shapes.
3. **Annotate** — Fill attributes per region.
4. **Export** — Download COCO or VIA formats for training pipelines.

### Video

1. Load a clip; **pause** on salient frames.
2. Draw regions on specific frames; navigate with shortcuts.
3. Export structured labels.

### Audio

1. Load audio; define **temporal segments** (start/end times).
2. Tag segments with attributes.
3. Export segment CSV if needed.

**Integration note:** The main server may expose an **export endpoint** so COCO files land directly in a repository folder—useful when annotators work on the same host as Vision v4.

## Code

### `apps/annotate/index.html`

**Monolithic VIA bundle** — inline **`<style>`** (VIA upstream CSS), large inline **`<script>`** blocks implementing **VIA** (`via_*` globals, file annotator state machine, import/export). **Not** modular ESM except add-ons below.

**Late scripts (project-specific):**

- **`annotate-sidecar-image.js`** — classic script defining **`window.annotateCollectSidecarImage(via)`** to read current image as **base64** using VIA internals **`via.va.file_annotator`**, **MIME→extension** helpers.
- **`annotate-file-panel.js`** — **ES module**; left rail listing **`GET /api/annotate/annotation-list`**, **delete** **`DELETE /api/annotate/annotation-list/:name`**.

### `apps/annotate/annotate-file-panel.js`

| Symbol | Role |
|--------|------|
| **`LIST_URL`** | **`/api/annotate/annotation-list`**. |
| **`deleteUrl(name)`** | Encodes path segment for **DELETE**. |
| **`displayFileName(name)`** | Strips **`.json`** for UI labels only. |
| **`fetchList` / `deleteFile`** | JSON APIs; throws with **`data.error`**. |
| **`el(tag, className, text)`** | tiny DOM factory. |

Renders list UI beside VIA; **used by** **`index.html`** layout comment **“annotate-file-panel.js + VIA”**.

### `apps/annotate/annotate-sidecar-image.js`

IIFE; **`window.annotateCollectSidecarImage`** returns a **Promise** that resolves to an object with **`base64`**, **`mime`**, and **`extension`** fields for **server sidecar** pairing — **depends on** VIA globals **`_VIA_FILE_TYPE`**, **`_VIA_FILE_LOC`**.

### Server

**`server/services/annotate-export-service.js`** — accepts export uploads, writes **`apps/annotate/annotation-list`**; serves list/delete for panel.
