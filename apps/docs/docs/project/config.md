---
title: config/
---

# Configuration (`db/configs/`)

## Main idea

**`db/configs/`** stores **JavaScript configuration objects** that describe how recognition should behave (models, thresholds, classes), how boxes should look, and what **actions** should run when objects are detected or when reasoning produces text. Presets live under **`db/configs/public/`** for discovery via the configuration API and tools like the Config Manager.

## More detail

### Core files

- A **primary config module** defines the default shape used by apps (local vs server recognition blocks, reasoning defaults, action lists, UI flags).
- **`config-factory.js`** ties to the **factory** demo: a single bundle that showcases “fully configurable” behavior in the browser.
- **`config-default.js`** and **`config-old.js`** represent baseline or legacy snapshots for comparison or migration.

### Public presets (`db/configs/public/`)

Many files (e.g. color-themed or scenario-themed names) are **ready-made profiles**: different class subsets, action presets, mobile-oriented settings, dashboard-oriented settings, YOLO- or MediaPipe-forward choices, etc. The **Config Manager** lists these for open/delete actions, and the **Config Generator** aligns its output with the “full” schema.

## Functional details

| Capability | Effect |
|------------|--------|
| **Classes & thresholds** | Restrict what objects count as detections and how confident they must be before showing or acting. |
| **Model choice** | Switch conceptual pipelines between YOLO and MediaPipe for local and/or server blocks. |
| **Intervals** | Control how often recognition runs, how often boxes refresh, and how often periodic actions fire. |
| **Bounding box styling** | Colors, fonts, padding, and shadow for labels so demos match brand or accessibility needs. |
| **Action hooks** | Declarative actions (notify, HTTP, DB) or embedded functions for custom logging and integrations—wired differently on client vs server per section. |
| **UI flag** | Some demos respect a boolean to show or hide on-screen controls for headless vs interactive use. |
| **Discoverability** | Files in `db/configs/public/` participate in server listing so operators can pick a profile without editing the filesystem on the host. |

**Operational pattern:** Authors use **Config Generator** to draft a file, optionally save into `db/configs/public`, then open **Factory** or **Config Manager** to run or audit that profile.

## Code

### `db/configs/config.js`

| Symbol | Role |
|--------|------|
| **`CONFIG`** | Plain object: **`id`**, **`name`**, **`description`**, **`ui`**, **`localRecognition`** (classes, thresholds, **model**, **`interval`**, sizes), **`boundingBoxStyles`**, **`localRegularActionFunctions`**, **`manualRecognitionActionFunctions`**, **`serverRecognition`**, **`serverReasoning`**, **`serverReasoningActionFunctions`**, **`serverRegularActionFunctions`**, etc. |
| **`export default CONFIG`**, **`export { CONFIG }`** | ESM dual export so **`import CONFIG`** or **`import { CONFIG }`** both work. |

**Used by:**

- **`apps/camera-stream/script.js`**, **`apps/image-upload/script.js`**, **`apps/server-detection/script.js`**, **`apps/server-reasoning/script.js`** — static import of default config.
- **`server/services/recognition-service.js`**, **`server/services/action-services/api-service.js`** — server-side **`import`** of **`db/configs/config.js`** for defaults and action function lists.

### `db/configs/config-factory.js`

Same **`CONFIG`** shape as **`config.js`** but tuned for **`apps/factory`** (e.g. **`name: 'config-factory'`**). **Used by** **`apps/factory/script.js`** when not loading remotely.

### `db/configs/config-default.js` / `config-old.js`

Snapshots for **compare** (`apps/compare/app.js` imports **`db/configs/public/config-default.js`**) or historical reference.

### `db/configs/public/*.js` (presets)

Each file typically **`export default CONFIG`** (or **`export { CONFIG }`**) with themed values. **Naming:** filesystem name **without `.js`** becomes **`id`** for API routes.

**Consumed by:**

- **`server/services/configuration-service.js`** — **`getConfiguration(id)`** builds a module URL under **`db/configs/public`** from **`id`** (with **`.js`** appended server-side) and **`import()`**s it; falls back to **`db/configs/config.js`**.
- **Browser** — static fetch **`/db/configs/public/<file>.js`** as text (Config Manager **View**).

### `server/services/configuration-service.js` (API wiring)

| Symbol | Parameters | Logic |
|--------|------------|--------|
| **`CONFIG_PUBLIC_DIR`** | — | Absolute path to **`db/configs/public`**. |
| **`isSafeConfigName(name)`** | string | Allows **alphanumeric, `_`, `-`**, rejects dotfiles. |
| **`getConfiguration(id)`** | route param **without `.js`** | Tries public import; else **`config.js`**. |
| **`configObjectToJsSource(config)`** | plain object | **`JSON.stringify`** + wraps as **`const CONFIG = …; export default CONFIG`**. |
| **`setupConfigurationService(app)`** | Express **`app`** | Registers **GET list**, **GET one**, **POST save**, **DELETE** (see file for exact paths / validation). |

**Cross-dependencies:** **`apps/config-manager/app.js`**, **`apps/debug/script.js`** (`fetch /api/configurations/:id`), **`apps/config-creator/app.js`** (**POST** save).
