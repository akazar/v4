/**
 * String-templates for conveyor-poc-generated artifacts.
 *
 * Each function returns a complete text file; the orchestrator in app.js wires them into a
 * sequential download list. Templates only interpolate values they need from the loaded config
 * + asset manifest so generated bundles stay minimal and obvious.
 */

function quote(str) {
    return JSON.stringify(String(str ?? ''));
}

function configToJsSource(config) {
    return `export const CONFIG = ${JSON.stringify(config, null, 4)};\nexport default CONFIG;\n`;
}

function inferEdgeType(config) {
    return config?.edgeType === 'web' ? 'web' : 'node';
}

export function configFileContents(config, { signalingUrl } = {}) {
    // Inject the v4 signaling URL into the bundled config so the generated edge can find
    // the SFU server when hosted somewhere other than the v4 origin (e.g. `npx serve` on :8080).
    // If the source config already has signalingUrl set, respect it.
    const merged = signalingUrl && !config?.signalingUrl
        ? { ...config, signalingUrl }
        : config;
    return configToJsSource(merged);
}

export function readmeContents(config, { edgeType, configId, hasServerPipeline, selfContainedLib }) {
    const isWeb = edgeType === 'web';
    const runEdge = isWeb
        ? `The bundle is fully self-contained — \`lib/\` ships next to \`ui.html\`, and all imports are relative.
Host the extracted folder behind any static server, then open \`ui.html\` in a browser.

Pass \`?streamId=<your-stream-id>\` in the URL to publish a WebRTC stream.

Examples:
  - Hosted by the v4 server:  http://localhost:3001/config/public/assets/${configId}/ui.html?streamId=demo
  - Hosted by any static server (e.g. \`npx serve\`, \`python -m http.server\`):
      cd ${configId}
      npx serve -p 8081
      # then http://<host>:8081/ui.html?streamId=demo

Notes when hosting outside v4:
  - WebRTC publishing falls back to loading socket.io-client from \`/socket.io/socket.io.js\`,
    which only exists on the v4 server. Either include socket.io-client in your custom UI
    or pre-load it from a CDN before \`edge-main.js\`.
  - Local recognition runs entirely in-browser; no v4 backend needed.
  - Server recognition / actions still require a reachable v4 server.`
        : `From inside the extracted folder:

    npm install
    node edge-main.js <streamId>

The bundle ships its own \`lib/\` folder and a \`package.json\` — it is fully self-contained and
does NOT require \`V4_ROOT\`. Move the folder anywhere.

Escape hatches (optional):
  - \`V4_ROOT=<path-to-v4>\`    — point at a different lib/ root (e.g. during development).
  - Run from v4 repo root after dropping the folder inside — \`lib/\` is auto-detected one level up.
  - Windows camera override: run \`ffmpeg -f dshow -list_devices true -i dummy\`, then set
    \`$env:CAMERA_DSHOW_NAME = "Exact Camera Name"\` before \`node edge-main.js <streamId>\`.`;
    const runServer = hasServerPipeline
        ? `\n\n### Server pipeline\n\nFrom inside the extracted folder:

    npm install                                # once, installs socket.io-client
    node server-pipeline.js ${configId} <streamId>

Self-contained — no \`V4_ROOT\` required. \`./config.js\` and custom action modules are
resolved next to the script; the bundle's own \`lib/\` folder supplies the orchestrator.

Connects to the running v4 server (default http://localhost:3001, override with \`V4_URL=...\`)
and runs server* actions for the subscribed stream.`
        : '';
    const libNote = selfContainedLib
        ? `\n- \`lib/\` — bundled copy of the shared modules the script needs at runtime.\n- \`package.json\` — minimal npm dependencies (run \`npm install\` inside the folder).`
        : '';

    return `# Conveyor POC bundle — ${config?.name || configId}

Generated from the config \`${configId}\` (${config?.description || 'no description'}).
Edge type: **${config?.edgeType || 'web'}**.

## Files

- \`config.js\` — the saved configuration (also available at \`config/public/${configId}.js\`).
- \`edge-main.js\` — entry point with \`main()\` for the edge device.
- \`sdk.js\` — exposes \`window.vision\` (browser) / \`globalThis.vision\` (node) global with recognition helpers.
${isWeb ? '- `ui.html`, `ui.css`, `ui.js` — UI for the browser edge (default bundled if not uploaded in config-creator-adv).\n- `lib/` — bundled copy of the shared edge modules (recognition pipeline, capture, webrtc-publisher, bounding-boxes, etc.).\n- `lib/edge/recognition/yolo/models/yolo11n.onnx` — ~10 MB model, included when local YOLO recognition is configured.\n' : ''}- \`localRecognitionActions.js\` (and friends) — ES modules with named exports used for CUSTOM actions, if configured.
${hasServerPipeline ? '- `server-pipeline.js` — run manually (see below).\n' : ''}${libNote}

## Run

### Edge

${runEdge}${runServer}

## Notes

- The SDK namespace is always called \`vision\` for parity with in-process demos.
- \`manualCapture()\` is a no-op (\`console.log\`); wire it to your own capture code if needed.
- Bounding boxes are drawn when \`config.boundingBoxStyles\` is set.
- Local recognition runs on the edge runtime: browser for web bundles, Node.js for node bundles.
- Server recognition is handled by the running v4 server + \`server-pipeline.js\`.
`;
}

export function sdkContents() {
    return `/**
 * conveyor-poc SDK: exposes \`window.vision\` (browser) / \`globalThis.vision\` (node) so UIs and
 * external scripts can read latest recognition results and toggle overlays without knowing the
 * internals of the recognition pipeline.
 *
 * Internal state (\`_latestRecognition\`, \`_video\`, \`_config\`) is set by
 * lib/edge/recognition-pipeline.js when it is given \`sdkNamespace: window.vision\`.
 */

const namespace =
    typeof window !== 'undefined'
        ? (window.vision = window.vision || {})
        : (globalThis.vision = globalThis.vision || {});

namespace._latestRecognition = [];
namespace._video = null;
namespace._config = null;

namespace.getLatestRecognition = function getLatestRecognition() {
    return namespace._latestRecognition || [];
};

namespace.getVideoStream = function getVideoStream() {
    const v = namespace._video;
    if (!v) return null;
    return v.srcObject || null;
};

namespace.drawBoundingBoxes = async function drawBoundingBoxes(styles) {
    if (typeof document === 'undefined') return;
    const { boundingBoxes } = await import('./lib/edge/bounding-boxes.js');
    const v = namespace._video;
    if (!v) return;
    boundingBoxes(namespace._latestRecognition || [], v, styles || namespace._config?.boundingBoxStyles || {});
};

namespace.manualCapture = function manualCapture() {
    console.log('[sdk] manualCapture fired');
};

export function initSdk({ video, config } = {}) {
    if (video) namespace._video = video;
    if (config) namespace._config = config;
    return namespace;
}

export default namespace;
`;
}

export function edgeMainWebContents(config, { assets, configId }) {
    const hasUiAssets = Boolean(assets?.uiHtml || assets?.uiCss || assets?.uiJs);
    const customImports = [];
    const customMap = [];

    const customActionKeys = [
        'localRecognitionActions',
        'localRegularActionFunctions',
    ];
    for (const key of customActionKeys) {
        if (assets?.[key]) {
            customImports.push(`import * as ${key} from './${key}.js';`);
            customMap.push(`        ${key},`);
        }
    }
    if (assets?.localStartupAction) {
        customImports.push(`import * as localStartupAction from './localStartupAction.js';`);
    }

    const customModulesBlock = customMap.length
        ? `    const customModules = {\n${customMap.join('\n')}\n    };`
        : `    const customModules = {};`;

    const startupInvocation = assets?.localStartupAction
        ? `    if (config.localStartupAction && typeof localStartupAction[config.localStartupAction] === 'function') {
        try { await Promise.resolve(localStartupAction[config.localStartupAction](config)); }
        catch (err) { console.error('[edge-main] localStartupAction failed:', err); }
    }`
        : '';

    return `/**
 * Generated edge entry point for config "${configId}" (edgeType: web).
 * Autoruns main() on DOMContentLoaded. Pass ?streamId=<id> to publish a WebRTC stream.
 */

import { startRecognitionPipeline } from './lib/edge/recognition-pipeline.js';
import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from './lib/edge/capture.js';
import { createWebRtcPublisher } from './lib/edge/webrtc-publisher.js';
import { initSdk } from './sdk.js';
import CONFIG from './config.js';
${customImports.join('\n')}

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(\`script[src="\${src}"]\`);
        if (existing) {
            if (existing.dataset.loaded === 'true') return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(\`Failed to load \${src}\`)));
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
        s.onerror = () => reject(new Error(\`Failed to load \${src}\`));
        document.head.appendChild(s);
    });
}

/**
 * Ensure \`window.io\` (socket.io-client) is available. No-op if the page already
 * loaded it via a <script> tag. Loads from the public CDN so the bundle works
 * regardless of where it's hosted (v4 server, plain static server, file://).
 */
async function ensureSocketIoLoaded() {
    if (typeof window === 'undefined') return;
    if (typeof window.io === 'function') return;
    try {
        await loadScriptOnce('https://cdn.socket.io/4.8.3/socket.io.min.js');
    } catch (cdnErr) {
        // CDN unreachable — fall back to the v4-hosted client (same-origin path).
        try {
            await loadScriptOnce('/socket.io/socket.io.js');
        } catch (originErr) {
            throw new Error(
                'Could not load socket.io-client from CDN or /socket.io/socket.io.js. ' +
                'Add a <script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script> tag ' +
                'to your ui.html, or pre-bundle socket.io-client.'
            );
        }
    }
    if (typeof window.io !== 'function') {
        throw new Error('socket.io client loaded but window.io is not a function');
    }
}

/**
 * Ensure \`window.ort\` (ONNX Runtime Web) is available. Required for local YOLO recognition.
 * No-op if the page already included ort.min.js via a <script> tag.
 */
async function ensureOrtLoaded() {
    if (typeof window === 'undefined') return;
    if (typeof window.ort !== 'undefined') return;
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');
    if (typeof window.ort === 'undefined') {
        throw new Error('ort.min.js loaded but window.ort is undefined');
    }
}

export async function main(streamId) {
    const config = CONFIG;
    const mediaStream = await getCameraStream();
    const video = attachCameraStreamToVideo(document, mediaStream);
    await waitForVideoAndPlay(video);

    initSdk({ video, config });

${customModulesBlock}

${startupInvocation}

    if (streamId) {
        await ensureSocketIoLoaded();
        // CONFIG.signalingUrl is injected at bundle-generation time (= the v4 origin where
        // conveyor-poc was opened). It is the source of truth: it makes the bundle portable
        // across hosts (\`npx serve\` on :8081, file://, another LAN machine, etc.).
        // The "localhost:3001" fallback is only for hand-edited bundles where the field
        // is missing — never fall back to \`location.origin\` because when the bundle is
        // hosted off-v4, the page origin is the static-file host, not the SFU server.
        const signalingUrl = CONFIG.signalingUrl || 'http://localhost:3001';
        createWebRtcPublisher({
            streamId,
            mediaStream,
            streamMode: 'sfu',
            serverUrl: signalingUrl,
        });
    }

    if (config.localRecognition) {
        const lrModel = String(config.localRecognition.model || 'YOLO').toUpperCase();
        if (lrModel === '' || lrModel === 'YOLO' || lrModel.startsWith('YOLO')) {
            await ensureOrtLoaded();
        }
        startRecognitionPipeline({
            video,
            config,
            sdkNamespace: window.vision,
            customModules,
            runRegularActions: true,
        });
    }
}

if (typeof window !== 'undefined') {
    const streamId = new URLSearchParams(location.search).get('streamId') || undefined;
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => main(streamId));
    } else {
        void main(streamId);
    }
}
`;
}

export function defaultUiHtmlContents(config, { configId }) {
    const showLocalRecognitionButton = Boolean(config?.localRecognition);
    const needsOrt = isYoloLocalRecognition(config?.localRecognition);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config?.name || configId} — edge UI</title>
    <link rel="stylesheet" href="./ui.css">
</head>
<body>
    <div id="ui-overlay" class="ui-overlay" hidden>
        <div class="ui-overlay-content">
            <button type="button" class="ui-close" id="btnCloseOverlay" aria-label="Close">×</button>
            <pre id="recognitionDump">{}</pre>
        </div>
    </div>

    <div class="ui-controls">
        <button type="button" id="btnManualCapture">Manual capture</button>
        ${showLocalRecognitionButton ? '<button type="button" id="btnShowResults">Show results</button>' : ''}
    </div>

    <!-- socket.io-client (window.io) — required by edge-main.js when ?streamId=... is set.
         CDN is used so the bundle works on any host; for fully offline/air-gapped use,
         swap to a vendored copy or to /socket.io/socket.io.js (v4-hosted only). -->
    <script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>${needsOrt ? `
    <!-- ONNX Runtime Web (window.ort) — required by lib/edge/recognition/yolo for local YOLO. -->
    <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>` : ''}
    <script type="module" src="./sdk.js"></script>
    <script type="module" src="./edge-main.js"></script>
    <script type="module" src="./ui.js"></script>
</body>
</html>
`;
}

function isYoloLocalRecognition(localRecognition) {
    if (!localRecognition) return false;
    const model = String(localRecognition.model || '').toUpperCase();
    return model === '' || model === 'YOLO' || model.startsWith('YOLO');
}

export function defaultUiCssContents() {
    return `html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #000;
    color: #fff;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
}

.ui-controls {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    gap: 8px;
    z-index: 10000;
}

.ui-controls button {
    padding: 10px 14px;
    background: rgba(37, 99, 235, 0.9);
    color: #fff;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
}

.ui-controls button:hover {
    background: rgba(29, 78, 216, 1);
}

.ui-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ui-overlay[hidden] {
    display: none;
}

.ui-overlay-content {
    position: relative;
    max-width: 85vw;
    max-height: 80vh;
    overflow: auto;
    padding: 24px;
    background: rgba(15, 23, 42, 0.95);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.ui-overlay-content pre {
    margin: 0;
    padding: 0;
    color: #e2e8f0;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-all;
}

.ui-close {
    position: absolute;
    top: 6px;
    right: 10px;
    width: 32px;
    height: 32px;
    font-size: 22px;
    background: transparent;
    color: #fff;
    border: 0;
    cursor: pointer;
}
`;
}

export function defaultUiJsContents() {
    return `/**
 * Default UI wiring for conveyor-poc web edge artifacts.
 * Toggles the recognition-results overlay and forwards the "Manual capture" button to the SDK.
 */

const overlay = document.getElementById('ui-overlay');
const dump = document.getElementById('recognitionDump');
const btnShowResults = document.getElementById('btnShowResults');
const btnManualCapture = document.getElementById('btnManualCapture');
const btnCloseOverlay = document.getElementById('btnCloseOverlay');

if (btnShowResults && overlay) {
    btnShowResults.addEventListener('click', () => {
        const results = (window.vision && window.vision.getLatestRecognition && window.vision.getLatestRecognition()) || [];
        if (dump) dump.textContent = JSON.stringify(results, null, 2);
        overlay.hidden = false;
    });
}

if (btnCloseOverlay && overlay) {
    btnCloseOverlay.addEventListener('click', () => {
        overlay.hidden = true;
    });
}

if (btnManualCapture) {
    btnManualCapture.addEventListener('click', () => {
        if (window.vision && typeof window.vision.manualCapture === 'function') {
            window.vision.manualCapture();
        }
    });
}
`;
}

export function edgeMainNodeContents(config, { configId, assets }) {
    const edgeTypeName = config?.edgeType || 'node';
    const hasLocalStartup = Boolean(assets?.localStartupAction);
    const hasLocalRecognition = Boolean(config?.localRecognition);
    const localModel = String(config?.localRecognition?.model || 'YOLO').toUpperCase();
    const localRecognizerPath = localModel === 'MEDIAPIPE'
        ? 'lib/cloud/recognition/mediapipe/recognize-mediapipe.js'
        : 'lib/cloud/recognition/yolo/recognize-yolo.mjs';
    const startupImport = hasLocalStartup
        ? `const localStartupAction = await import(new URL('./localStartupAction.js', import.meta.url).href);`
        : `const localStartupAction = null;`;
    const localRecognitionImports = hasLocalRecognition
        ? `const { i420FrameToJpegDataUrl } = await import(libUrl('lib/cloud/streaming-server/i420-jpeg.js'));
const { recognize: localRecognize } = await import(libUrl('${localRecognizerPath}'));`
        : `const i420FrameToJpegDataUrl = null;
const localRecognize = null;`;
    const localRecognitionActionsImport = assets?.localRecognitionActions
        ? `const localRecognitionActions = await import(new URL('./localRecognitionActions.js', import.meta.url).href);`
        : `const localRecognitionActions = null;`;
    const localRegularActionFunctionsImport = assets?.localRegularActionFunctions
        ? `const localRegularActionFunctions = await import(new URL('./localRegularActionFunctions.js', import.meta.url).href);`
        : `const localRegularActionFunctions = null;`;
    const startupInvocation = hasLocalStartup
        ? `    if (CONFIG.localStartupAction && typeof localStartupAction?.[CONFIG.localStartupAction] === 'function') {
        try { await Promise.resolve(localStartupAction[CONFIG.localStartupAction](CONFIG)); }
        catch (err) { log('localStartupAction failed:', err?.message || err); }
    }`
        : '';
    return `/**
 * Generated Node.js edge entry for config "${configId}" (edgeType: ${edgeTypeName}).
 *
 * Usage:
 *     V4_ROOT=/path/to/v4 node edge-main.js <streamId>
 *
 * (Or drop this file inside the v4 repo root so './lib/...' resolves directly.)
 *
 * Requires: Node >= 18, @roamhq/wrtc, socket.io-client, and FFmpeg available via ffmpeg-static or PATH.
 * For microcontrollers (esp32/arduino): see README.md — you will likely need a native firmware
 * instead; this file provides a Node-based reference runtime that mirrors the web edge behavior.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import process from 'node:process';
import CONFIG from './config.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// v4Root resolution — in order of preference:
//   1. V4_ROOT env var (explicit override)
//   2. Self-contained bundle: lib/ sits next to this script
//   3. Bundle dropped inside the v4 repo: lib/ sits one level up
//   4. Fall back to process.cwd()
function detectV4Root() {
    if (process.env.V4_ROOT) return process.env.V4_ROOT;
    const sentinel = path.join('lib', 'edge', 'webrtc-publisher.node.js');
    if (fs.existsSync(path.join(SCRIPT_DIR, sentinel))) return SCRIPT_DIR;
    const parent = path.resolve(SCRIPT_DIR, '..');
    if (fs.existsSync(path.join(parent, sentinel))) return parent;
    return process.cwd();
}
const v4Root = detectV4Root();
const libUrl = (rel) => pathToFileURL(path.resolve(v4Root, rel)).href;
const { createWebRtcPublisherNode } = await import(libUrl('lib/edge/webrtc-publisher.node.js'));
${localRecognitionImports}
${startupImport}
${localRecognitionActionsImport}
${localRegularActionFunctionsImport}

const require = createRequire(import.meta.url);
const wrtc = require('@roamhq/wrtc');
const { MediaStream, nonstandard } = wrtc;
const { RTCVideoSource, i420ToRgba } = nonstandard;

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 360;
const I420_FRAME_BYTES = (CAPTURE_WIDTH * CAPTURE_HEIGHT * 3) >> 1;
let latestFrame = null;
let latestRecognitionResults = [];

function log(...args) { console.log('[edge-main]', ...args); }

function resolveFfmpegPath() {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
    try {
        const mod = require('ffmpeg-static');
        if (typeof mod === 'string') return mod;
        if (mod?.path) return mod.path;
    } catch { /* ignore */ }
    return 'ffmpeg';
}

function detectFirstDshowVideoDevice(ffmpegBin) {
    const r = spawnSync(
        ffmpegBin,
        ['-hide_banner', '-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'],
        { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    const text = \`\${r.stderr || ''}\\n\${r.stdout || ''}\`;
    const re = /"([^"]+)"\\s*\\(video\\)/g;
    const found = re.exec(text);
    return found ? found[1] : null;
}

function resolveWindowsDshowDeviceName(ffmpegBin) {
    const fromEnv = process.env.CAMERA_DSHOW_NAME?.trim();
    if (fromEnv) {
        log('DirectShow device (CAMERA_DSHOW_NAME):', fromEnv);
        return fromEnv;
    }

    const first = detectFirstDshowVideoDevice(ffmpegBin);
    if (first) {
        log('DirectShow device (auto-detected):', first);
        return first;
    }

    throw new Error(
        'Could not auto-detect a DirectShow video device. Run "ffmpeg -f dshow -list_devices true -i dummy", ' +
        'then set CAMERA_DSHOW_NAME to the exact quoted video device name.'
    );
}

function ffmpegInputArgs(ffmpegBin) {
    const plat = process.platform;
    if (plat === 'win32') {
        const name = resolveWindowsDshowDeviceName(ffmpegBin);
        return ['-f', 'dshow', '-rtbufsize', '100M', '-video_size', \`\${CAPTURE_WIDTH}x\${CAPTURE_HEIGHT}\`, '-framerate', '20', '-i', \`video=\${name}\`];
    }
    if (plat === 'darwin') {
        const idx = process.env.CAMERA_AVFOUNDATION_INDEX || '0';
        return ['-f', 'avfoundation', '-framerate', '20', '-video_size', \`\${CAPTURE_WIDTH}x\${CAPTURE_HEIGHT}\`, '-i', \`\${idx}:none\`];
    }
    const dev = process.env.CAMERA_V4L2_PATH || '/dev/video0';
    return ['-f', 'v4l2', '-framerate', '20', '-video_size', \`\${CAPTURE_WIDTH}x\${CAPTURE_HEIGHT}\`, '-i', dev];
}

function startFfmpegPipeline() {
    const bin = resolveFfmpegPath();
    const args = [
        '-hide_banner', '-loglevel', 'warning',
        ...ffmpegInputArgs(bin),
        '-vf', \`scale=\${CAPTURE_WIDTH}:\${CAPTURE_HEIGHT}:flags=fast_bilinear\`,
        '-pix_fmt', 'yuv420p',
        '-f', 'rawvideo', '-an', 'pipe:1',
    ];
    log('ffmpeg:', bin);
    const videoSource = new RTCVideoSource();
    const track = videoSource.createTrack();
    const stream = new MediaStream([track]);
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let buf = Buffer.alloc(0);
    proc.stdout.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= I420_FRAME_BYTES) {
            const slice = buf.subarray(0, I420_FRAME_BYTES);
            buf = buf.subarray(I420_FRAME_BYTES);
            const data = new Uint8ClampedArray(I420_FRAME_BYTES);
            data.set(slice);
            latestFrame = { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT, data: new Uint8Array(data) };
            videoSource.onFrame({ width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT, data });
        }
    });
    proc.stderr.on('data', (d) => log('ffmpeg:', d.toString().trim()));
    proc.on('error', (err) => log('ffmpeg error:', err.message));
    proc.on('exit', (code, signal) => {
        if (signal) {
            log('ffmpeg stopped (signal:', signal + ')');
            return;
        }
        if (code !== null && code !== 0) {
            log('ffmpeg exited with error code', code);
            log('On Windows, run: ffmpeg -f dshow -list_devices true -i dummy');
            log('Then set: $env:CAMERA_DSHOW_NAME = "Exact Camera Name"');
            process.exit(code);
        }
    });
    return { stream, proc };
}

function normalizeActionEntry(item) {
    if (!item || typeof item !== 'object') return null;
    const action = item.action || item;
    const type = action?.type;
    const rawValue = action?.value ?? action?.values ?? item.value ?? item.values;
    const value = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
    const timeout = Number(item.timeout) > 0 ? Number(item.timeout) : 0;
    const interval = Number(item.interval) > 0 ? Number(item.interval) : 0;
    if (!type || !value.length) return null;
    return { type: String(type).toUpperCase(), value, timeout, interval, raw: item };
}

function createPerKeyThrottle() {
    const lastRuns = new Map();
    return (key, minMs) => {
        if (!minMs) return true;
        const now = Date.now();
        const last = lastRuns.get(key) ?? 0;
        if (now - last < minMs) return false;
        lastRuns.set(key, now);
        return true;
    };
}

function filterLocalDetections(detections) {
    if (!Array.isArray(detections)) return [];
    const lr = CONFIG.localRecognition || {};
    let out = detections;
    if (Array.isArray(lr.classes) && lr.classes.length) {
        const classes = new Set(lr.classes.map((name) => String(name).toLowerCase()));
        out = out.filter((item) => classes.has(String(item.class || item.name || item.categoryName || '').toLowerCase()));
    }
    const maxResults = Number(lr.maxResults) > 0 ? Number(lr.maxResults) : 10;
    return out
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, maxResults);
}

function buildLocalRecognitionConfig() {
    return {
        ...CONFIG,
        // Node recognizers live under lib/cloud and read serverRecognition options.
        serverRecognition: CONFIG.localRecognition || {},
    };
}

function getActionRequest(action, recognitionResults) {
    const type = action?.type;
    const value = Array.isArray(action?.value) ? action.value : [];
    const idOrUrl = value[0];
    const base = (process.env.V4_URL || CONFIG.signalingUrl || 'http://localhost:3001').replace(/\\/$/, '');
    const payload = { streamId: process.argv[2]?.trim() || null, recognitionResults };

    if (type === 'DB' && idOrUrl != null) {
        return { url: base + '/api/db/' + encodeURIComponent(String(idOrUrl)), body: payload };
    }
    if (type === 'NOTIFY' && idOrUrl != null) {
        return { url: base + '/api/notify/' + encodeURIComponent(String(idOrUrl)), body: payload };
    }
    if (type === 'API' && idOrUrl != null) {
        return { url: String(idOrUrl), body: payload };
    }
    return { url: '', body: payload };
}

async function runActionEntries(entries, customModule, recognitionResults, throttle, label) {
    for (const entry of entries) {
        const minMs = entry.interval || entry.timeout || 0;
        if (entry.type === 'CUSTOM') {
            if (!customModule) continue;
            for (const name of entry.value) {
                if (!throttle(label + ':custom:' + name, minMs)) continue;
                const fn = customModule[name];
                if (typeof fn !== 'function') {
                    log(label, 'custom action not found:', name);
                    continue;
                }
                try { await Promise.resolve(fn(recognitionResults, entry.raw)); }
                catch (err) { log(label, 'custom action failed:', name, err?.message || err); }
            }
            continue;
        }

        const key = label + ':' + entry.type + ':' + entry.value.join(',');
        if (!throttle(key, minMs)) continue;
        const { url, body } = getActionRequest({ type: entry.type, value: entry.value }, recognitionResults);
        if (!url) {
            log(label, 'unknown action type:', entry.type);
            continue;
        }
        try {
            log(label, 'requesting:', url);
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (err) {
            log(label, 'request failed:', err?.message || err);
        }
    }
}

function startLocalActionLoops() {
    const timers = [];
    const throttle = createPerKeyThrottle();
    const recognitionActions = (Array.isArray(CONFIG.localRecognitionActions) ? CONFIG.localRecognitionActions : [])
        .map(normalizeActionEntry)
        .filter(Boolean);
    const regularActions = (Array.isArray(CONFIG.localRegularActionFunctions) ? CONFIG.localRegularActionFunctions : [])
        .map(normalizeActionEntry)
        .filter(Boolean);

    for (const entry of regularActions) {
        const intervalMs = Math.max(50, entry.interval || entry.timeout || 1000);
        const id = setInterval(() => {
            const payload = latestRecognitionResults.length ? latestRecognitionResults : [{}];
            void runActionEntries([entry], localRegularActionFunctions, payload, throttle, 'localRegularActionFunctions');
        }, intervalMs);
        timers.push(id);
    }

    let recognitionBusy = false;
    if (CONFIG.localRecognition && localRecognize && i420FrameToJpegDataUrl) {
        const intervalMs = Math.max(50, Number(CONFIG.localRecognition.interval) || 1000);
        const id = setInterval(async () => {
            if (recognitionBusy || !latestFrame) return;
            recognitionBusy = true;
            try {
                const captureSize = CONFIG.localRecognition.maxCaptureSize || CONFIG.localRecognition.inputSize || 640;
                const { dataUrl } = await i420FrameToJpegDataUrl(latestFrame, i420ToRgba, {
                    maxWidth: captureSize,
                    maxHeight: captureSize,
                    jpegQuality: 85,
                });
                const raw = await localRecognize(dataUrl, buildLocalRecognitionConfig());
                latestRecognitionResults = filterLocalDetections(raw);
                if (latestRecognitionResults.length && recognitionActions.length) {
                    await runActionEntries(
                        recognitionActions,
                        localRecognitionActions,
                        latestRecognitionResults,
                        throttle,
                        'localRecognitionActions'
                    );
                }
            } catch (err) {
                log('local recognition failed:', err?.message || err);
            } finally {
                recognitionBusy = false;
            }
        }, intervalMs);
        timers.push(id);
    }

    return {
        stop() {
            for (const id of timers) clearInterval(id);
        },
    };
}

export async function main() {
    const streamId = process.argv[2]?.trim();
    if (!streamId) {
        console.error('Usage: node edge-main.js <streamId>');
        process.exit(1);
    }

${startupInvocation}

    const { stream, proc } = startFfmpegPipeline();
    const localActionsHandle = startLocalActionLoops();
    const publisher = await createWebRtcPublisherNode({
        streamId,
        mediaStream: stream,
        serverUrl: process.env.V4_URL || CONFIG.signalingUrl || 'http://localhost:3001',
        streamMode: 'sfu',
        onStatus: (msg) => log(msg),
    });

    process.once('SIGINT', async () => {
        await publisher.stop().catch(() => { /* ignore */ });
        try { localActionsHandle.stop(); } catch { /* ignore */ }
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
        process.exit(0);
    });
}

main().catch((err) => { console.error(err); process.exit(1); });
`;
}

/**
 * Self-contained package.json for Node bundles. Dependencies are tuned to what the
 * shared `lib/` modules actually import at runtime:
 *   - @roamhq/wrtc — only when a Node edge-main.js is included
 *   - ffmpeg-static — ditto (FFmpeg-based camera capture)
 *   - socket.io-client — always (both edge-main.js and server-pipeline.js dynamic-import it)
 */
export function nodePackageSnippetContents({ configId, hasNodeEdge, hasServerPipeline, hasLocalRecognition, localRecognitionModel } = {}) {
    const dependencies = { 'socket.io-client': '^4.8.3' };
    if (hasNodeEdge) {
        dependencies['@roamhq/wrtc'] = '^0.10.0';
        dependencies['ffmpeg-static'] = '^5.2.0';
    }
    if (hasNodeEdge && hasLocalRecognition) {
        dependencies.sharp = '^0.33.5';
        const model = String(localRecognitionModel || 'YOLO').toUpperCase();
        if (model === 'MEDIAPIPE') {
            dependencies.puppeteer = '^23.0.0';
        } else {
            dependencies['onnxruntime-node'] = '^1.20.0';
        }
    }
    const scripts = {};
    if (hasNodeEdge) scripts.edge = 'node edge-main.js';
    if (hasServerPipeline) scripts.server = `node server-pipeline.js ${configId || ''}`.trim();
    if (!Object.keys(scripts).length) scripts.start = 'node edge-main.js';

    return JSON.stringify(
        {
            name: `conveyor-poc-${(configId || 'bundle').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
            version: '0.1.0',
            type: 'module',
            private: true,
            dependencies,
            scripts,
        },
        null,
        2
    ) + '\n';
}

export function serverPipelineContents(config, { configId }) {
    return `/**
 * Generated server-pipeline.js for config "${configId}".
 *
 * Typical usage:
 *
 *     # Option A — extract the bundle into the v4 repo root, then from anywhere:
 *     node <path-to-v4>/${configId}/server-pipeline.js ${configId} <streamId>
 *
 *     # Option B — bundle lives elsewhere:
 *     V4_ROOT=<path-to-v4> node <path-to-bundle>/server-pipeline.js ${configId} <streamId>
 *
 * Connects to the running v4 server via socket.io-client, subscribes to server-side recognition for
 * <streamId>, and invokes server* actions locally using the modules in this folder.
 */

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// v4Root resolution — in order of preference:
//   1. V4_ROOT env var (explicit override)
//   2. Self-contained bundle: lib/ sits next to this script
//   3. Bundle dropped inside the v4 repo: lib/ sits one level up
//   4. Fall back to process.cwd()
function detectV4Root() {
    if (process.env.V4_ROOT) return process.env.V4_ROOT;
    const sentinel = path.join('lib', 'cloud', 'pipeline', 'server-pipeline.js');
    if (fs.existsSync(path.join(SCRIPT_DIR, sentinel))) return SCRIPT_DIR;
    const parent = path.resolve(SCRIPT_DIR, '..');
    if (fs.existsSync(path.join(parent, sentinel))) return parent;
    return process.cwd();
}
const v4Root = detectV4Root();
const libUrl = (rel) => pathToFileURL(path.resolve(v4Root, rel)).href;
const { runServerPipelineForStream } = await import(libUrl('lib/cloud/pipeline/server-pipeline.js'));

async function tryImport(file) {
    try {
        const abs = path.resolve(SCRIPT_DIR, file);
        if (!fs.existsSync(abs)) return null;
        const mod = await import(pathToFileURL(abs).href);
        return mod;
    } catch (err) {
        if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
            console.warn('[server-pipeline] could not load', file, err?.message || err);
        }
        return null;
    }
}

async function main() {
    const [, , cliConfigId, streamId] = process.argv;
    const configId = cliConfigId || ${quote(configId)};
    if (!streamId) {
        console.error('Usage: node server-pipeline.js <configId> <streamId>');
        process.exit(1);
    }

    const configMod = await tryImport('./config.js');
    if (!configMod) {
        console.error('[server-pipeline] missing ./config.js next to this script.');
        process.exit(1);
    }
    const config = configMod.default ?? configMod.CONFIG;

    const serverRecognitionActions = await tryImport('./serverRecognitionActions.js');
    const serverRegularActionFunctions = await tryImport('./serverRegularActionFunctions.js');
    const serverStartupAction = await tryImport('./serverStartupAction.js');

    const customModule = {
        ...(serverRecognitionActions || {}),
        ...(serverRegularActionFunctions || {}),
        ...(serverStartupAction || {}),
    };

    const configPath = \`/config/public/\${configId}.js\`;
    await runServerPipelineForStream({
        streamId,
        configId,
        configPath,
        config,
        serverUrl: process.env.V4_URL || 'http://localhost:3001',
        customModule,
    });

    console.log('[server-pipeline] running; Ctrl+C to stop');
}

main().catch((err) => { console.error(err); process.exit(1); });
`;
}

export function customActionStubContents(assetKey) {
    return `/**
 * Stub for ${assetKey}. Custom action handlers are ES modules with named exports:
 *
 *   export function myAction(recognitionResults, entry) {
 *       // ...
 *   }
 *
 * Exports here are looked up by name from the \`value\` array of a CUSTOM action entry in the config.
 */

export function example(recognitionResults, entry) {
    console.log('[${assetKey}] example action fired', { count: recognitionResults?.length, entry });
}
`;
}

export { inferEdgeType };
