---
sidebar_position: 1
slug: /intro
title: Introduction
---

# Vision v4 — project documentation

**Vision v4** is an object recognition and reasoning platform. It combines browser-side detection (YOLO and MediaPipe), optional server-side recognition and vision–language reasoning (OpenAI and Google Gemini), multi-stream WebRTC viewing, configuration tooling, annotation export, and a simulated model-training workspace.

This site describes **what each part of the repository does** and how the **user-facing applications** behave. Each deep-dive page ends with a **Code** section (and nested **###** topics) for implementation references: entrypoints, key symbols, parameters, and cross-links between folders.

## How the pieces fit together

- A **Node server** (`server/`) hosts static web apps under `apps/`, serves REST endpoints for recognition, reasoning, configuration, notifications, database helpers, streaming metadata, annotation export, and model-training file operations, and runs **Socket.IO** for WebRTC signaling and streaming features.
- **`lib/`** holds shared logic: **edge** (browser-oriented capture, detection overlays, actions) and **cloud** (server pipelines, streaming, orchestration).
- **`db/configs/`** holds JavaScript configuration objects that drive recognition models, intervals, styling, and declarative or scripted actions for local and server pipelines.
- **`apps/factory/`** is the **production-style demo** mounted at `/factory`, driven by factory-oriented config.
- **`apps/`** contains every browser UI: landing pages, streaming home/viewer/streamer/dashboard, annotator, training UI, compare tool, and more.

## Where to read next

| Area | Doc |
|------|-----|
| npm manifests | [Package manifests](./project/package-manifests) |
| Secrets & ignores | [Environment & `.gitignore`](./project/env-and-git) |
| Dependencies on disk | [`node_modules`](./project/node-modules) |
| HTTP entry & hosting | [Server](./project/server) |
| Shared libraries | [lib](./project/lib) |
| Configuration files | [config](./project/config) |
| Factory demo bundle | [factory](./project/factory) |
| All browser apps | [Applications overview](./apps/overview) |

## Code

### Process entry

| Path | Role |
|------|------|
| **`server/main.js`** | **`npm start`** — wires Express + HTTP server + all **`setup*Server(app|server)`** calls from **`lib/cloud/**`**. |
| **`package.json` `main`** | Points at **`server/main.js`** for tools that read **`main`**. |

### Browser module resolution

Static **`express.static(v4Root)`** in **`server/services/hosting-service.js`** exposes **`/lib/…`** and **`/config/…`** so every **`import '/lib/edge/…'`** **and** relative **`../../config/…`** resolves in the browser without bundling.

### Doc layout

Category docs under **[Repository roots](./project/package-manifests)**, **[Backend & shared assets](./project/server)**, and **[Applications](./apps/overview)** each add **## Code** after the narrative sections—use the sidebar to jump to the file you are changing.

### Docs site only

**`apps/docs/`** (this documentation site) is **not** imported at runtime; it has its own **`package.json`** / lockfile. After **`npm run docs:build`** at the repo root, the Vision server serves the static build at **`/documentation/`** on the same host and port as **`npm start`**. For authoring with hot reload, use **`npm run docs:dev`**.
