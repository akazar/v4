/**
 * Edge-side recognition + bounding-box + actions pipeline.
 *
 * Shared orchestrator used by:
 *   - factory/web/script.js (existing demo)
 *   - apps/conveyor-poc generated edge-main.js (web edge artifact)
 *
 * Responsibilities:
 *   1. Recognition loop: capture video frame -> recognize (YOLO or MEDIAPIPE) -> scale detections -> expose results.
 *   2. Bounding-box rendering (when config.boundingBoxStyles is provided).
 *   3. Config-driven declarative actions (DB/API/NOTIFY) via lib/edge/actions.js.
 *   4. Custom action dispatch: a handle is called with (results, actionValue) for CUSTOM-type action entries.
 *   5. Regular (non-recognition) interval actions.
 *
 * The pipeline is intentionally stateless beyond the returned handle so multiple pipelines can coexist.
 */

import { videoToReusableCanvas, scaleDetectionsToVideo } from './source-to-canvas.js';
import { boundingBoxes, clearBoundingBoxes } from './bounding-boxes.js';
import { localRecognitionActionsFromConfig } from './actions.js';

async function loadRecognizer(model) {
    if (model === 'MEDIAPIPE') {
        const mod = await import('./recognition/mediapipe/recognize-mediapipe.js');
        return mod.recognize;
    }
    const mod = await import('./recognition/yolo/recognize-yolo.js');
    return mod.recognizeWithYolo;
}

/** Normalize an entry to `{ type, value[] }` regardless of the config shape. */
function normalizeActionEntry(item) {
    if (!item || typeof item !== 'object') return null;
    const action = item.action || item;
    const type = action?.type;
    // Accept both canonical `value` (singular) and legacy/form-generator `values` (plural).
    const rawValue = action?.value ?? action?.values;
    const value = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
    if (!type || !value.length) return null;
    const timeout = Number(item.timeout) > 0 ? Number(item.timeout) : 0;
    const interval = Number(item.interval) > 0 ? Number(item.interval) : 0;
    return { type: String(type).toUpperCase(), value, timeout, interval, raw: item };
}

/**
 * Invoke each custom action name found in an action config entry.
 * Example: `{ type: 'CUSTOM', value: ['onAlert', 'onLog'] }` -> calls both on `customModule`.
 *
 * `throttle(name, minMs)` returns false to skip a function call until `minMs` elapsed
 * since its last invocation. Pass entry.interval || entry.timeout as the minMs to
 * implement the configured per-function debounce.
 */
async function invokeCustomActionEntries(entries, customModule, recognitionResults, throttle) {
    if (!customModule || typeof customModule !== 'object') return;
    for (const entry of entries) {
        if (entry.type !== 'CUSTOM') continue;
        const minMs = entry.interval || entry.timeout || 0;
        for (const name of entry.value) {
            if (throttle && !throttle(name, minMs)) continue;
            const fn = customModule[name];
            if (typeof fn !== 'function') {
                console.warn('[recognition-pipeline] CUSTOM action not found in module:', name);
                continue;
            }
            try {
                await Promise.resolve(fn(recognitionResults, entry.raw));
            } catch (error) {
                console.error('[recognition-pipeline] CUSTOM action failed:', name, error);
            }
        }
    }
}

/** Per-entry throttle (index -> last run ms). */
function createThrottle() {
    const map = new Map();
    return (index, minMs) => {
        if (!minMs) return true;
        const now = Date.now();
        const last = map.get(index) ?? 0;
        if (now - last < minMs) return false;
        map.set(index, now);
        return true;
    };
}

/**
 * Start the pipeline. Returns a handle with `stop()`.
 *
 * @param {object} params
 * @param {HTMLVideoElement} params.video - Video element the pipeline reads from.
 * @param {object} params.config - Configuration object (same shape as config/public/*.js).
 * @param {object} [params.sdkNamespace] - Object (e.g. window.vision) updated with latest results for UIs.
 * @param {object} [params.customModules] - Map of custom action modules by bucket name:
 *   { localRecognitionActions, localRegularActionFunctions }
 * @param {boolean} [params.runRegularActions=false] - Enable localRegularActionFunctions interval loop.
 *   Off by default to preserve the existing factory/web behavior; generated artifacts opt in.
 * @returns {{ stop: () => void }}
 */
export function startRecognitionPipeline({
    video,
    config,
    sdkNamespace = null,
    customModules = {},
    runRegularActions = false,
} = {}) {
    if (!video) throw new Error('startRecognitionPipeline: video is required');
    if (!config) throw new Error('startRecognitionPipeline: config is required');

    const {
        boundingBoxStyles,
        localRecognition,
        localRecognitionActions = [],
        localRegularActionFunctions = [],
    } = config;

    const normalizedPrimary = (Array.isArray(localRecognitionActions) ? localRecognitionActions : [])
        .map(normalizeActionEntry)
        .filter(Boolean);
    const normalizedRegular = localRegularActionFunctions.map(normalizeActionEntry).filter(Boolean);

    const regularThrottle = createThrottle();
    // Per-function throttle for CUSTOM localRecognitionActions. Keyed by function name so the
    // configured `interval`/`timeout` is the *minimum* gap between successive calls of the
    // same function, even when the recognition tick runs faster than that.
    const customRecognitionThrottle = createThrottle();

    let recognitionResults = [];
    let recognitionRunning = false;
    let recognitionCanvas = null;
    let recognitionInterval = null;
    let boundingBoxInterval = null;
    let regularActionIntervalIds = [];
    let recognizer = null;
    let stopped = false;

    if (sdkNamespace) {
        sdkNamespace._video = video;
        sdkNamespace._config = config;
        sdkNamespace._latestRecognition = recognitionResults;
    }

    async function ensureRecognizer() {
        if (recognizer) return recognizer;
        const model = localRecognition?.model ?? 'YOLO';
        recognizer = await loadRecognizer(model);
        return recognizer;
    }

    async function recognitionTick() {
        if (stopped || recognitionRunning || !video || video.readyState < 2) return;
        recognitionRunning = true;
        try {
            const captureSize = localRecognition?.maxCaptureSize ?? 640;
            recognitionCanvas = videoToReusableCanvas(
                video,
                { maxWidth: captureSize, maxHeight: captureSize },
                recognitionCanvas
            );

            const recognize = await ensureRecognizer();
            const rawResults = await recognize(recognitionCanvas, config);
            recognitionResults = scaleDetectionsToVideo(rawResults, recognitionCanvas, video);

            if (sdkNamespace) sdkNamespace._latestRecognition = recognitionResults;

            if (normalizedPrimary.length && recognitionResults.length) {
                // Built-in DB/API/NOTIFY dispatch.
                localRecognitionActionsFromConfig(
                    recognitionResults,
                    normalizedPrimary
                        .filter((e) => e.type !== 'CUSTOM')
                        .map((e) => ({ action: { type: e.type, value: e.value }, timeout: e.timeout }))
                );
                await invokeCustomActionEntries(
                    normalizedPrimary,
                    customModules.localRecognitionActions,
                    recognitionResults,
                    customRecognitionThrottle
                );
            }
        } catch (error) {
            console.error('[recognition-pipeline] tick failed:', error);
        } finally {
            recognitionRunning = false;
        }
    }

    function startRecognitionIntervalLoop() {
        if (!localRecognition) return;
        const intervalMs = Math.max(50, Number(localRecognition.interval) || 1000);
        recognitionInterval = setInterval(() => {
            void recognitionTick();
        }, intervalMs);
    }

    function startBoundingBoxLoop() {
        if (!boundingBoxStyles) return;
        const intervalMs = Math.max(50, Number(boundingBoxStyles.interval) || 1000);
        boundingBoxInterval = setInterval(() => {
            if (stopped || !video || video.readyState < 2) return;
            boundingBoxes(recognitionResults, video, boundingBoxStyles);
        }, intervalMs);
    }

    function startRegularActionsLoop() {
        if (!runRegularActions || !normalizedRegular.length) return;
        normalizedRegular.forEach((entry, idx) => {
            const intervalMs = entry.interval || entry.timeout || 1000;
            const id = setInterval(async () => {
                if (stopped) return;
                if (!regularThrottle(idx, intervalMs)) return;
                if (entry.type === 'CUSTOM') {
                    const mod = customModules.localRegularActionFunctions;
                    if (!mod) return;
                    for (const name of entry.value) {
                        const fn = mod[name];
                        if (typeof fn !== 'function') continue;
                        try {
                            await Promise.resolve(fn(recognitionResults, entry.raw));
                        } catch (error) {
                            console.error('[recognition-pipeline] regular CUSTOM action failed:', name, error);
                        }
                    }
                    return;
                }
                // Non-CUSTOM regular actions reuse the same DB/API/NOTIFY dispatcher.
                localRecognitionActionsFromConfig(
                    recognitionResults.length ? recognitionResults : [{}],
                    [{ action: { type: entry.type, value: entry.value }, timeout: 0 }]
                );
            }, Math.max(50, intervalMs));
            regularActionIntervalIds.push(id);
        });
    }

    startRecognitionIntervalLoop();
    startBoundingBoxLoop();
    startRegularActionsLoop();

    function stop() {
        stopped = true;
        if (recognitionInterval) {
            clearInterval(recognitionInterval);
            recognitionInterval = null;
        }
        if (boundingBoxInterval) {
            clearInterval(boundingBoxInterval);
            boundingBoxInterval = null;
        }
        for (const id of regularActionIntervalIds) clearInterval(id);
        regularActionIntervalIds = [];
        clearBoundingBoxes();
    }

    return {
        stop,
        getLatestResults: () => recognitionResults,
    };
}
