---
title: .env & .gitignore
---

# Environment file and Git ignore rules

## Main idea

**`.env`** holds **secrets and environment-specific settings** (API keys, ports) for the local or deployed server. **`.gitignore`** tells Git which generated or sensitive paths must **never** be committed, including `.env` and installed dependencies.

## More detail

### `.env`

The repository does not ship a committed `.env` file (it is ignored). At runtime, the server and tooling expect certain variables to exist when features are used—for example keys for OpenAI or Gemini for reasoning endpoints, and optionally `PORT` for the HTTP listener. When keys are missing, the server may still start but specific routes will fail or log warnings.

Typical categories of values:

- **Server listen port** — overrides the default HTTP port when set.
- **Provider API keys** — unlock server-side reasoning or description features.
- **Other integration secrets** — any future webhook, database, or third-party credentials you add to the project.

### `.gitignore`

The ignore file excludes:

- **`node_modules/`** — installed packages; always recreated with `npm install`.
- **`.env`** — prevents accidental commit of secrets.
- **Log files and OS junk** — keeps the repo clean (`*.log`, `.DS_Store`, etc.).

## Functional details

| Artifact | Function |
|----------|----------|
| `.env` | Supplies process environment values so the Node server can authenticate to external APIs and bind to the intended port without hard-coding secrets in source. |
| `.gitignore` | Reduces risk of leaking credentials; keeps large or machine-local trees out of version control; avoids merge noise from logs and OS files. |

**Operational note:** Each developer or deployment target maintains its own `.env`. Document required variable names in runbooks or internal docs; this project’s server logs hint when optional keys (e.g. OpenAI) are absent.

## Code

### `.gitignore` (repository root)

**Contents (functional):**

- **`node_modules/`** — exclude all installed packages at any depth.
- **`.env`** — exclude secrets from Git.
- **`*.log`**, **`.DS_Store`** — noise and local logs.

**Variables / parameters:** none — pattern lines only.

**Used by:** Git; no runtime import.

### `.env` (not in repo)

**Expected pattern:** `KEY=value` per line; comments with `#`.

**Consumers (via `process.env`):**

- **`server/main.js`** — reads **`PORT`** (defaults `3001`); logs presence of **`OPENAI_API_KEY`** (masked preview only).
- **`lib/cloud/reasoning-server.js`** — lazy-reads **`OPENAI_API_KEY`**, **`GEMINI_API_KEY`** when building `OpenAI` / `GoogleGenAI` clients.
- **Other cloud modules** — any feature that calls `process.env.*` after bootstrap.

### Loading logic — `lib/cloud/action-servers/api-server.js`

| Symbol | Role |
|--------|------|
| `loadEnvFile(filePath)` | **Sync** reads a `.env` file, parses `KEY=value`, trims quotes, assigns **`process.env[key]`** only if not already set. |
| `envPathV4` | `…/v4/.env` (repo root next to `config/`). |
| `envPathRoot` | One level above (legacy / monorepo parent). |
| `loadedV4` / `loadedRoot` | Booleans; if either succeeds, logs **`.env file loaded`**. |
| Fallback | Tries **`require('dotenv').config`** on the same paths (inside `try/catch` for resilience in ESM context). |

**Call chain:** `setupApiServer(app)` is invoked from **`server/main.js`** **after** `express()` creation but alongside other setup; env must be loaded before **`setupReasoningServer`** handles requests.

**Cross-dependencies:** **`.gitignore`** ensures `.env` never commits; **`package.json`** lists **`dotenv`** as a dependency used in the fallback path.
