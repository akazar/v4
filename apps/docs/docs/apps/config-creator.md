---
title: Config generator
---

# Config generator (`/config-creator`)

## Main idea

The **Config Generator** is a **form-based editor** that builds a complete **`config.js`**-shaped object for Vision v4. It covers metadata, UI flags, local and server recognition, bounding-box styling, declarative actions, function-based actions, server reasoning defaults, and export actions.

## More detail

The form is organized into **cards** (sections). Each section can be **included or omitted** from the final export via “Include in config” checkboxes, so you can generate partial configs when experimenting.

## Visual elements

- **Header** — Title and subtitle explaining alignment with the “full” public config schema.
- **Name & description card** — Fields for config **id**, **display name**, and **description** (used when configs are listed or labeled elsewhere).
- **UI card** — Master include toggle; **Enable UI** checkbox for demos that show or hide chrome.
- **Local recognition card** — Class list (with COCO picker helper), max results, thresholds, IOU, model select (YOLO/MediaPipe), input and capture sizes, interval in milliseconds.
- **Bounding box styles card** — Stroke, width, shadow, font, label colors, padding, corner radius, redraw interval.
- **Local recognition actions (declarative)** — Dynamic list of action rows; buttons to add entries or apply DB/API/Notify presets.
- **Local recognition action functions** — Mixed declarative and freeform function rows with intervals; preset buttons for common patterns.
- **Local regular action functions** — Periodic declarative actions (again with DB/API/Notify presets).
- **Server recognition card** — Parallel controls to local recognition for server-side blocks.
- **Server reasoning card** — Provider select (OpenAI vs Google family) and default **prompt** textarea.
- **Server recognition actions** — Declarative list with presets.
- **Server recognition action functions** — Function bodies with intervals; notification/DB quick inserts.
- **Server reasoning action functions** — Function bodies with optional counters.
- **Server regular action functions** — Functions keyed off the last reasoning description, with intervals.
- **Footer actions** — **Generate & Download** (submit) and **Generate and Save** (persist via API when server supports it).

## User workflows

1. **Fill baseline metadata** — Set id/name/description so the config is recognizable in the manager.
2. **Tune recognition** — Choose classes and thresholds for local and/or server blocks.
3. **Style overlays** — Adjust colors and typography for demo recordings or accessibility.
4. **Add actions** — Use declarative presets or paste small function bodies for custom logging and integrations.
5. **Export** — Download `config.js` for manual placement, or save through the server to `db/configs/public` if configured.
6. **Validate in factory** — Open the factory demo or camera stream with the new id.

**Outcome:** Non-developers and developers alike can produce **consistent** configuration files without hand-editing large JavaScript objects.

## Code

### `apps/config-creator/app.js`

**IIFE** `'use strict'` — no ESM exports; attaches listeners on **`DOMContentLoaded`**.

**Helper functions**

| Name | Arguments | Returns | Purpose |
|------|-----------|---------|---------|
| `indentBlock(text, spaces)` | string, number | indented string | Pretty-print nested generated JS. |
| `escapeForSingleQuotedJs(str)` | string | escaped string | Safe embedding in generated **single-quoted** function bodies. |
| `slugId(raw)` | string | slug | Sanitize **`configId`** for filenames. |
| `formatClassesArray(arr)` | string[] | JS array literal | Emit **`classes: [ 'person', … ]`**. |
| `isSectionEnabled(id)` | checkbox `id` | boolean | Reads **“Include in config”** toggles. |
| `num(el, def)` / `float(el, def)` | input, default | number | Parse numeric fields with fallback. |
| `parseClasses(val)` | comma string | string[] | Split **local/server classes** inputs. |
| `COCO_CLASSES_80` | — | const array | Full COCO label list for picker UI. |

**Generation pipeline:** reads dozens of **`getElementById`** fields → builds a plain **`CONFIG`** object in memory → either **Blob download** as **`config-<id>.js`** or **`fetch('/api/configurations', …)`** with **`POST`** and a JSON body that includes a **`name`** string and a **`config`** object (see script for exact keys).

**DOM:** builds dynamic rows for action lists (`#localRecognitionActionsList`, etc.); **preset buttons** append template objects.

**Used by:** `apps/config-creator/index.html` (**`<script src="app.js">`**).

**Uses:** **`configuration-service`** **`POST /api/configurations`**; browser **Blob**/**URL.createObjectURL** for download.

### `apps/config-creator/index.html`

- Large **`<form id="configForm">`** with **`<section class="card">`** per feature; inputs map 1:1 to **config keys** documented in the visible labels.
