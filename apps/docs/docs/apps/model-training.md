---
title: Model training & dashboard
---

# Model training (`/model-training` & `/model-training/dashboard`)

## Main idea

The **model training** app is a **browser control room** for preparing (simulated) **detection or vision–language fine-tuning** jobs: name checkpoints, pick a base model, upload paired images/annotations, assign **train/val/test** splits, tune hyperparameters, run a **fake** epoch loop with live charts, then **export** or **save** placeholder weights. The **saved models dashboard** lists files dropped into `db/models` and supports deletion via API.

## More detail

**Simulation disclaimer:** Training metrics are **synthetic**—the UI proves workflows until a real trainer backend is connected.

## Visual elements — Training page (`/model-training`)

- **Back links** — Return to Vision home and to the models dashboard.
- **Header** — Title with “UI preview” badge; subtitle explains scope.
- **Section 1: Trained model name** — Validated text field; explains filename rules and extensions.
- **Section 2: Base model** — Dropdown populated with placeholder architectures/checkpoint families.
- **Section 3: Images & annotations** — Two multi-file inputs; explains **stem matching** between image and label files.
- **Section 4: Splits** — Auto-split buttons (**70/15/15**, **80/20/10**); **split summary** line; scrollable **dataset table** with columns: thumbnail, image name, annotation name, split selector per row.
- **Section 5: Training settings** — Numeric/text inputs for epochs, batch size, learning rate, weight decay, seed.
- **Section 6: Run (simulated)** — **Start training** / **Stop** buttons; **progress bar**; **status** line; **metrics log** preformatted text; **chart grid** (loss, mAP, precision/recall, learning rate, timing) each with canvas + legend.
- **Section 7: Export & save** — **Export model** (download) and **Save model** (server writes into `db/models`); export status text.
- **Success toast** — Ephemeral confirmation overlay.

## Visual elements — Saved models dashboard (`/model-training/dashboard`)

- **Back links** — Home + training page.
- **Header** — Explains allowed extensions and delete behavior.
- **Status region** — API success/failure messages.
- **File list** — One row per checkpoint with metadata and a **trash** control.
- **Refresh list** button — Re-queries the server.

## User workflows

### Training operator

1. Name the output checkpoint.
2. Choose a base model stand-in.
3. Upload imagery + sidecars; verify pairings in the table.
4. Assign or auto-assign splits.
5. Set hyperparameters.
6. Start simulated training; watch charts for storytelling or UX testing.
7. Export locally **or** save to server models folder.

### Model curator

1. Open dashboard.
2. Refresh to see new `.pt` / `.tflite` / `.safetensors` files.
3. Delete stale placeholders.

**Outcome:** Product and ML teams align on **forms, charts, and asset lifecycle** before investing in GPU jobs.

## Code

### `apps/model-training/app.js`

| Symbol | Role |
|--------|------|
| **`extensionForModelId(modelId)`** | Returns **`.safetensors`** for `vlm-*`, **`.tflite`** if **`efficientdet`** in id, else **`.pt`**. |
| **`trainedStemFromInput()`** | Reads **`#trainedModelNameInput`**, strips illegal chars / redundant extension. |
| **`getOutputCheckpointStem()`** | User stem or fallback from **`#modelSelect`**. |
| **`MODEL_OPTIONS`** | Array of small option objects (each has **`value`** and **`label`**) for **`#modelSelect`** population. |
| **`datasetItems`** | Array of row objects (fields: `id`, `imageFile`, optional `annotationFile`, `split`, `objectUrl`). |
| **`$(id)`** | strict **`getElementById`** (throws if missing). |
| **Pairing** | **`basenameNoExt`** matches image + annotation **stems**. |
| **Charts** | Canvas 2D drawing for loss/mAP/PR/LR/time — driven by **fake** epoch metrics in **`epochLog`**. |
| **Training loop** | **`setTimeout`** / **`requestAnimationFrame`**-style simulation; **`trainingRunning`** guard. |
| **Export** | Empty blob with correct **extension** download; **Save** → **`POST`** to model-training API (see server module). |

### `apps/model-training/dashboard.js`

**`loadModelsDashboard`** — **`GET /api/model-training/models-list`** → **`data.files`** → **`<li>`** + trash button **`data-filename`**. **Delete** — **`DELETE`** same API with filename.

**Helpers:** **`escapeHtml`**, **`escapeAttr`**, **`TRASH_ICON_SVG`**, **`setModelsDashboardStatus`**.

### `apps/model-training/index.html` / `dashboard.html`

Declarative sections with **ids** consumed by scripts above; **`app.js`** is classic script, **`dashboard.js`** classic script.

### Server

**`lib/cloud/model-training-server.js`** — persists under **`db/models`**; lists allowed extensions.
