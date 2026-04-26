# Conveyor POC

`/conveyor-poc` is a web UI that generates deployable artifacts from a saved configuration
in `config/public/<id>.js` + its uploaded assets in `config/public/assets/<id>/`.

## What it produces

For every run, the browser downloads a single ZIP named **`<configId>.zip`**. Inside it, all
artifacts live under a top-level **`<configId>/`** folder — unzip once and you have a
self-contained, deployable bundle.

**Node bundles** (non-web edge and/or server pipeline) additionally ship their own `lib/` folder
plus a `package.json`, so they run anywhere with just `npm install && node …` — no `V4_ROOT`
required. The `lib/` contents are collected by walking the import graph of
`lib/edge/webrtc-publisher.node.js` and/or `lib/cloud/pipeline/server-pipeline.js` on every run,
so bundles always reflect the current lib code.

| File | When | What |
| --- | --- | --- |
| `config.js` | always | Copy of the saved configuration as ES module. |
| `sdk.js` | always | Exposes `window.vision` / `globalThis.vision` (getLatestRecognition, getVideoStream, drawBoundingBoxes, manualCapture). |
| `edge-main.js` | always | Entry point with `main(streamId?)`. Browser variant auto-runs on DOMContentLoaded, Node variant takes the stream id from `process.argv`. |
| `ui.html` / `ui.css` / `ui.js` | `edgeType: web` | Uploaded custom UI (via config-creator-adv) or a sensible default overlay showing recognition JSON + "Manual capture" + "Show results" buttons. |
| `localRecognitionActions.js` & friends | when uploaded | ES modules with named exports used for CUSTOM action entries. |
| `server-pipeline.js` | when server* config is used | Standalone `socket.io-client` runner; invoke manually with `node server-pipeline.js <configId> <streamId>` from the v4 repo root. |
| `package-snippet.json` | non-web edge | Minimal `package.json` with `@roamhq/wrtc`, `socket.io-client`, `ffmpeg-static`. |
| `README.md` | always | Per-bundle instructions tailored to the selected config. |

## End-to-end flow

1. Open [config-creator-adv](/config-creator-adv), build a config, optionally upload UI HTML/CSS/JS
   and custom action JS files, then click **Generate and Save**. Files land in
   `config/public/<id>.js` and `config/public/assets/<id>/*`.
2. Open [conveyor-poc](/conveyor-poc), pick the saved config, and click **Run pipeline** to
   download `<configId>.zip`.
3. Unzip the bundle — everything you need lives under `<configId>/`.
4. Create a stream in the [Streaming dashboard](/streaming) (SFU mode).
5. Run the edge:
   - **Web**: open `http://localhost:3001/config/public/assets/<configId>/ui.html?streamId=<id>`
     (the conveyor-poc run publishes `edge-main.js`, `sdk.js`, `config.js` back to that folder).
   - **Node**: `cd <configId> && npm install && node edge-main.js <id>`.
6. Run the server pipeline if the config uses server recognition/actions:
   `cd <configId> && npm install && node server-pipeline.js <configId> <streamId>`.
7. View the stream and recognition overlays in the Streaming dashboard viewer.

## Shared lib modules used

- `lib/edge/recognition-pipeline.js` — recognition loop, bounding boxes, local actions.
- `lib/edge/webrtc-publisher.js` / `.node.js` — browser + Node publishers (SFU / P2P).
- `lib/cloud/pipeline/server-pipeline.js` — server-side orchestrator (also used in-process by
  `lib/cloud/streaming-server/sfu-server-recognition.js`).

## Manual smoke tests

- **Web edge**
  1. Create a config in config-creator-adv with `edgeType: web`, enable `localRecognition`,
     `boundingBoxStyles`, and (optionally) upload a `uiJs` file.
  2. Generate the bundle in conveyor-poc and serve it (or host via the `config/public/assets/<id>/`
     static path).
  3. Open `ui.html?streamId=demo` — the camera should show, recognition should run, bounding
     boxes should render, and the stream should appear in the dashboard viewer.
- **Node edge**
  1. Create a config with `edgeType: raspberry-pi` (or any non-web).
  2. Generate the bundle, run `npm install` using `package-snippet.json`, then
     `node edge-main.js demo` — the dashboard should show the stream.
- **Server pipeline**
  1. Ensure the config has `serverRecognition` + optional CUSTOM server actions.
  2. From the v4 repo root: `node server-pipeline.js <configId> demo` — action logs should
     flow for each detection event.

## ICE (STUN / TURN)

On the v4 server, set the environment variable **`ICE_SERVERS`** to a **JSON string** of an `iceServers` array (the same shape as the `iceServers` option of `RTCPeerConnection`), e.g. Metered, Twilio, or self-hosted TURN. The server exposes `GET /api/ice` (CORS enabled) with that list. The generated web `edge-main.js` fetches ICE from `CONFIG.signalingUrl` (your v4 origin) at runtime so TURN credentials are not baked into the repo. Node entrypoints (`node streamers`, `edge-main.js` for non-web) read **`ICE_SERVERS`** from the environment on the process that runs the publisher.
