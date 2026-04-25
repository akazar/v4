/**
 * Shared server-side pipeline orchestrator.
 *
 * Consumers:
 *   - lib/cloud/streaming-server/sfu-server-recognition.js (in-process: registers scheduled actions when a
 *     dashboard subscriber joins).
 *   - apps/conveyor-poc generated server-pipeline.js (standalone: connects to a running v4 server as a
 *     socket.io client, subscribes to server recognition, runs serverRecognitionActions /
 *     serverRegularActionFunctions / serverStartupAction against the received detection events).
 *
 * This module is Node-only (uses node:url, socket.io-client via dynamic import) but importable without
 * side effects so the in-process path can cherry-pick helpers without pulling the socket client.
 */

import { createScheduledActionsManager } from '../../scheduled-actions-manager.js';

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

/** Per-key throttle factory: returns (key, minMs) => boolean (true = run, false = skip). */
function createPerKeyThrottle() {
    const last = new Map();
    return (key, minMs) => {
        if (!minMs) return true;
        const now = Date.now();
        const prev = last.get(key) ?? 0;
        if (now - prev < minMs) return false;
        last.set(key, now);
        return true;
    };
}

/**
 * Build a scheduled-actions manager for `serverRecognitionActions`.
 * Used by both the in-process SFU recognition and the standalone runner so behavior stays consistent.
 * @param {object} [options]
 * @returns {import('../../scheduled-actions-manager.js').createScheduledActionsManager extends (...a:any)=>infer R ? R : never}
 */
export function createServerRecognitionActionsManager(options = {}) {
    return createScheduledActionsManager({
        actionsProperty: 'serverRecognitionActions',
        fallbackActionProperties: ['serverRecognitionActionFunctions'],
        ...options,
    });
}

/**
 * Invoke the server startup action once, if the config has `serverStartupAction` defined.
 *
 * @param {object} config - Config object (with optional `serverStartupAction` method name).
 * @param {object} [customModule] - Module with named exports (ESM) providing startup functions.
 * @returns {Promise<void>}
 */
export async function runServerStartupAction(config, customModule = null) {
    const name = config?.serverStartupAction;
    if (!name) return;
    if (!customModule || typeof customModule[name] !== 'function') {
        console.warn('[server-pipeline] serverStartupAction not found in custom module:', name);
        return;
    }
    try {
        await Promise.resolve(customModule[name](config));
    } catch (error) {
        console.error('[server-pipeline] serverStartupAction failed:', name, error);
    }
}

/**
 * Start a per-stream loop that invokes `serverRegularActionFunctions` entries on their own interval.
 * DB/API/NOTIFY entries are simply logged here (the existing server apps convert them to real side-effects
 * via their scheduled actions orchestrator; standalone runners can extend this easily).
 *
 * @param {object} params
 * @param {string} params.streamId
 * @param {object} params.config
 * @param {object} [params.customModule] - Module exposing named custom-action functions.
 * @param {(streamId: string, eventData: any) => void} [params.onRegularTick] - Optional external tick hook.
 * @returns {{ stop: () => void }}
 */
export function startServerRegularActions({ streamId, config, customModule = null, onRegularTick = null } = {}) {
    const regular = Array.isArray(config?.serverRegularActionFunctions) ? config.serverRegularActionFunctions : [];
    const normalized = regular.map(normalizeActionEntry).filter(Boolean);
    const timers = [];

    for (const entry of normalized) {
        const intervalMs = entry.interval || entry.timeout || 1000;
        const id = setInterval(async () => {
            if (typeof onRegularTick === 'function') {
                try { onRegularTick(streamId, entry); } catch { /* ignore */ }
            }
            if (entry.type === 'CUSTOM') {
                if (!customModule) return;
                for (const name of entry.value) {
                    const fn = customModule[name];
                    if (typeof fn !== 'function') continue;
                    try {
                        await Promise.resolve(fn({ streamId }, entry.raw));
                    } catch (error) {
                        console.error('[server-pipeline] regular CUSTOM action failed:', name, error);
                    }
                }
                return;
            }
            console.log('[server-pipeline] regular action', entry.type, entry.value);
        }, Math.max(50, intervalMs));
        timers.push(id);
    }

    return {
        stop() {
            for (const id of timers) clearInterval(id);
        },
    };
}

/**
 * Standalone runner: connect to the v4 server as a socket.io client, subscribe to server recognition for
 * `streamId`, and apply `serverRecognitionActions` / `serverRegularActionFunctions` / `serverStartupAction`
 * locally using the provided `customModule` (ESM namespace imported by the generated server-pipeline.js).
 *
 * The server does the heavy lifting (RTCVideoSink + JPEG + YOLO/MediaPipe); this runner consumes the
 * `sfu-server-recognition` events it emits, so no wrtc / model files are needed in the runner process.
 *
 * @param {object} params
 * @param {string} params.streamId
 * @param {string} params.configId - Used for the scheduledActionsManager register() binding.
 * @param {string} params.configPath - URL path on the server (e.g. `/config/public/<configId>.js`).
 * @param {object} params.config - The loaded config object (with server* properties).
 * @param {string} [params.serverUrl] - Default http://localhost:3001 (v4 default port).
 * @param {object} [params.customModule] - ESM module with named exports for CUSTOM server actions / startup / regular.
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function runServerPipelineForStream({
    streamId,
    configId,
    configPath,
    config,
    serverUrl = process.env.V4_URL || 'http://localhost:3001',
    customModule = null,
} = {}) {
    if (!streamId) throw new Error('runServerPipelineForStream: streamId is required');
    if (!config) throw new Error('runServerPipelineForStream: config is required');

    const { io } = await import('socket.io-client');

    const scheduledActionsManager = createServerRecognitionActionsManager({
        loadConfig: async () => config,
    });
    const regularHandle = startServerRegularActions({ streamId, config, customModule });
    // Per-function debounce for CUSTOM serverRecognitionActions. The configured
    // `interval`/`timeout` is the minimum gap between successive calls of the same function,
    // independent of how often the server emits recognition events.
    const customRecognitionThrottle = createPerKeyThrottle();

    await runServerStartupAction(config, customModule);

    const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 2000,
    });

    await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
    });

    if (configId) {
        try { await scheduledActionsManager.register(streamId, configId); } catch (error) {
            console.warn('[server-pipeline] register scheduled actions failed:', error?.message || error);
        }
    }

    socket.on('sfu-server-recognition', async ({ streamId: sid, detections }) => {
        if (sid !== streamId) return;
        // Recognition actions are only meaningful when there's something to act on. Skip the
        // whole event when the server emits an empty detections list (e.g. nothing in frame).
        // scheduledActionsManager.process() applies the same gate internally for DB/API/NOTIFY.
        const hasDetections = Array.isArray(detections) && detections.length > 0;
        if (!hasDetections) return;
        try {
            await scheduledActionsManager.process(streamId, detections);
            // Fire CUSTOM serverRecognitionActions locally, using the loaded custom module.
            // Each function name is debounced by entry.interval || entry.timeout so the same
            // function isn't called more often than the config asks for, regardless of how
            // frequently the server emits recognition events.
            if (customModule) {
                const configured = Array.isArray(config.serverRecognitionActions)
                    ? config.serverRecognitionActions
                    : [];
                for (const item of configured) {
                    const entry = normalizeActionEntry(item);
                    if (!entry || entry.type !== 'CUSTOM') continue;
                    const minMs = entry.interval || entry.timeout || 0;
                    for (const name of entry.value) {
                        if (!customRecognitionThrottle(name, minMs)) continue;
                        const fn = customModule[name];
                        if (typeof fn !== 'function') continue;
                        try {
                            await Promise.resolve(fn(detections, entry.raw));
                        } catch (error) {
                            console.error('[server-pipeline] CUSTOM action failed:', name, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[server-pipeline] process recognition failed:', error?.message || error);
        }
    });

    // Self-healing subscribe: server replies with `sfu-server-recognition-error` when the
    // stream isn't being published yet. Back off and retry until either we hear `ready` or
    // the runner is stopped — so users can start the pipeline before the streamer.
    let stopped = false;
    let retryTimer = null;
    let retryDelayMs = 2000;
    const MAX_RETRY_DELAY_MS = 10000;
    let warnedNoStreamYet = false;

    function scheduleResubscribe(reason) {
        if (stopped || retryTimer) return;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (stopped || !socket.connected) return;
            console.log(`[server-pipeline] re-subscribing for stream "${streamId}" (${reason})…`);
            socket.emit('sfu-server-recognition-subscribe', {
                streamId,
                configPath,
                configName: configId,
                config,
            });
            retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
        }, retryDelayMs);
    }

    socket.on('sfu-server-recognition-error', ({ streamId: sid, message }) => {
        if (sid !== streamId) return;
        const isNotActive = typeof message === 'string' && /not active|no.*publisher|not.*found/i.test(message);
        if (isNotActive) {
            if (!warnedNoStreamYet) {
                console.warn(
                    `[server-pipeline] server has no active publisher for stream "${streamId}" yet. ` +
                    `Open the web edge URL with ?streamId=${streamId} (or start the node streamer) — ` +
                    `the pipeline will auto-subscribe as soon as the publisher comes online.`
                );
                warnedNoStreamYet = true;
            }
            scheduleResubscribe('stream not active yet');
        } else {
            console.warn('[server-pipeline] server recognition error:', message);
        }
    });

    socket.on('sfu-server-recognition-ready', ({ streamId: sid }) => {
        if (sid !== streamId) return;
        retryDelayMs = 2000; // reset backoff for the next reconnect
        if (warnedNoStreamYet) {
            console.log(`[server-pipeline] subscribed to server recognition for "${streamId}".`);
            warnedNoStreamYet = false;
        }
    });

    // After a reconnect, the server forgets our subscription — re-establish it.
    socket.on('connect', () => {
        if (stopped) return;
        socket.emit('sfu-server-recognition-subscribe', {
            streamId,
            configPath,
            configName: configId,
            config,
        });
    });

    socket.emit('sfu-server-recognition-subscribe', {
        streamId,
        configPath,
        configName: configId,
        config,
    });

    async function stop() {
        stopped = true;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        try { regularHandle.stop(); } catch { /* ignore */ }
        try {
            socket.emit('sfu-server-recognition-unsubscribe', { streamId });
            socket.removeAllListeners();
            socket.disconnect();
        } catch { /* ignore */ }
    }

    return { stop };
}
