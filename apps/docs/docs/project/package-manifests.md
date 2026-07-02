---
title: package.json & package-lock.json
---

# Package manifests

## Main idea

The root **`package.json`** and **`package-lock.json`** define the **Node.js application** for Vision v4: runtime dependencies, the main server entry point, and reproducible installs. Together they turn the repository into an installable unit that can start the HTTP server and run auxiliary CLI-style recognition scripts.

## More detail

- **`package.json`** names the project, declares ECMAScript modules, lists engines (Node 18+), and pins **direct** dependencies such as Express, Socket.IO, Sharp, ONNX Runtime, Puppeteer, OpenAI and Google GenAI clients, dotenv, and WebRTC-related packages used by streaming features.
- **`package-lock.json`** records the **exact dependency tree** (including transitive packages) so that `npm install` yields consistent versions across machines and CI.

The **`apps/docs/package.json`** (under this documentation site) is **separate**: it only builds the static documentation site and does not affect the main Vision v4 server at the repository root.

## Functional details

**`package.json` scripts (root)**

- **Start the main server** — runs the primary HTTP/Socket.IO process that hosts `apps/` and cloud APIs.
- **YOLO recognition (CLI)** — optional path to run cloud/edge YOLO recognition from the command line for batch or debugging use.
- **MediaPipe recognition (CLI)** — optional path to run MediaPipe-based recognition similarly.

**Dependency roles (behavioral)**

- **Web framework & realtime** — serve static assets and APIs; establish realtime channels for streaming signaling.
- **Image & model I/O** — resize or convert imagery; run ONNX models where applicable.
- **Browser automation** — drive headless browser contexts for server-side capture or recognition flows that mirror a browser environment.
- **AI provider clients** — send images and prompts to hosted models when reasoning or description features are enabled.
- **Environment loading** — read secrets and ports from `.env` at process start when configured.

**Lockfile**

- Ensures the same dependency versions after clone or deploy.
- Should be committed so production and development stay aligned.

## Code

### Root `package.json`

| Field | Meaning |
|-------|--------|
| `name` / `version` / `description` | npm metadata; `description` summarizes the Vision v4 stack (YOLO, MediaPipe, OpenAI, Gemini). |
| `"type": "module"` | Node treats `.js` in this package as **ES modules** (`import` / `export`). |
| `main` | Points at **`server/main.js`**, the default entry if another tool expects `main`. |
| `scripts.start` | Runs **`node server/main.js`** — the production entry for HTTP + Socket.IO. |
| `scripts.recognize:yolo` | Runs **`lib/cloud/recognition/yolo/recognize-yolo.mjs`** directly for CLI/server-side YOLO experiments. |
| `scripts.recognize:mediapipe` | Runs **`lib/cloud/recognition/mediapipe/recognize-mediapipe.js`** for CLI MediaPipe. |
| `scripts.docs:*` | Delegate to **`apps/docs`** (`npm run … --prefix apps/docs`) for the documentation site. |
| `engines.node` | Declares **>= 18** for the main app (docs app separately requires Node 20 in its own `package.json`). |
| `dependencies` | **Direct** packages only; versions use semver ranges (`^`). Consumers of these APIs: **`server/main.js`**, **`lib/cloud/**`**, **`server/hosting-server.js`**, streaming modules, etc. |

**How other parts use it:** Anything started via `npm start` or toolchains that read the root manifest resolves **imports** against `node_modules` entries declared here.

### Root `package-lock.json`

| Concept | Role |
|---------|------|
| **`lockfileVersion`** | Format 3 (npm 7+). |
| **Top-level `packages[""]`** | Mirrors root `package.json` name/version and **direct** dependency list. |
| **`packages["node_modules/…"]`** | Each key is a resolved package; fields include **`version`**, **`resolved`** URL, **`integrity`**, nested **`dependencies`**. |

**General logic:** npm uses the lockfile to install **identical trees** without re-resolving ranges. **`npm install`** updates both `package.json` (if you add a dep) and the lockfile.

**Used by:** developers and CI; **not** imported by application code.

### `apps/docs/package.json`

| Field | Role |
|-------|------|
| `private: true` | Prevents accidental publish of the docs site as an npm package. |
| `scripts` | **`npm start` / `build` / `serve`** etc. for local dev and static output. |
| `dependencies` | **React 19**, MDX, prism, and other docs-site packages. |

**Cross-use:** Isolated from Vision v4 runtime; only the **`docs:*`** scripts in the **root** `package.json` bridge to this tree.

### `apps/docs/package-lock.json`

Same structural role as the root lockfile but for **docs-site-only** dependencies. Keep both lockfiles committed if you want reproducible doc builds.
