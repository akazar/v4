---
title: node_modules
---

# `node_modules`

## Main idea

**`node_modules/`** is the directory where **npm installs all packages** declared in `package.json`, including transitive dependencies. It is the on-disk realization of the dependency graph locked by `package-lock.json`.

## More detail

Nothing in `node_modules` is authored by this project. It contains third-party libraries that provide:

- HTTP server and middleware behavior
- WebSocket / realtime transport
- Image processing and model runtimes
- HTTP clients for AI providers
- Utilities used by streaming, configuration, and tooling

The folder can be **large** and is **regenerated** by running `npm install` at the repository root. It is excluded from Git via `.gitignore`.

## Functional details

| Aspect | Role |
|--------|------|
| **Install** | Populated by `npm install` using the lockfile for deterministic versions. |
| **Runtime** | Node resolves `import` / `require` from these packages when the server or scripts run. |
| **Docs app** | The Docusaurus site under `apps/docs` has its **own** `node_modules` after you install there; it is independent of the root tree. |
| **Clean slate** | Deleting `node_modules` and reinstalling fixes many corruption or version drift issues. |

**Why document it:** New contributors should treat `node_modules` as a **binary artifact**: never edit it manually, never commit it, and expect it to differ between machines only by npm version or lockfile changes.

## Code

### Resolution algorithm (Node + npm)

| Step | Behavior |
|------|----------|
| `import 'express'` | Node walks **directory upward** from the importing file, looking for `node_modules/express` **or** uses paths from **`package.json` `imports`** / hoisted layout. |
| **Hoisting** | npm may place transitive deps under top-level `node_modules` or nested **`node_modules`** inside a package. |
| **Lockfile** | `package-lock.json` **`packages`** map tells npm exactly **which version** and **where** each package lands. |

### Relationship to project source

**No project file** imports `node_modules` by path string — always **bare specifiers** (`express`, `openai`, …).

**Used by:**

- **`server/main.js`** — `express`, `http`.
- **`lib/cloud/**`** — `openai`, `@google/genai`, `socket.io`, `puppeteer`, `sharp`, `onnxruntime-node`, `node-fetch`, etc., depending on module.
- **`apps/docs`** — separate tree: **`@docusaurus/*`**, **`react`**, resolved from **`apps/docs/node_modules`**.

### Variables and artifacts

| Name | Meaning |
|------|---------|
| **Per-package folder** | e.g. `node_modules/express/package.json` defines **main**, **exports**, **dependencies**. |
| **.bin** | CLI shims (`node_modules/.bin/...`) for dev tooling (less relevant to production server). |

**General logic:** after **`npm install`**, running **`node server/main.js`** can **synchronously** resolve all `import` statements to files under **`node_modules`** per Node ESM rules.
