/**
 * Generated edge entry point for config "conveyor-smoke2" (edgeType: web).
 * Autoruns main() on DOMContentLoaded. Pass ?streamId=<id> to publish a WebRTC stream.
 */

import { startRecognitionPipeline } from '/lib/edge/recognition-pipeline.js';
import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from '/lib/edge/capture.js';
import { createWebRtcPublisher } from '/lib/edge/webrtc-publisher.js';
import { initSdk } from './sdk.js';
import CONFIG from './config.js';
import * as localRecognitionActions from './localRecognitionActions.js';
import * as localRecognitionActionFunctions from './localRecognitionActionFunctions.js';
import * as localRegularActionFunctions from './localRegularActionFunctions.js';
import * as localStartupAction from './localStartupAction.js';

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

/**
 * Ensure `window.io` (socket.io-client) is available. The v4 server serves the client at
 * /socket.io/socket.io.js, so this "just works" when the bundle is hosted by v4. If the page
 * already loaded socket.io via a <script> tag, this is a no-op.
 */
async function ensureSocketIoLoaded() {
    if (typeof window === 'undefined') return;
    if (typeof window.io === 'function') return;
    await loadScriptOnce('/socket.io/socket.io.js');
    if (typeof window.io !== 'function') {
        throw new Error('socket.io client loaded but window.io is not a function');
    }
}

/**
 * Ensure `window.ort` (ONNX Runtime Web) is available. Required for local YOLO recognition.
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

    const customModules = {
        localRecognitionActions,
        localRecognitionActionFunctions,
        localRegularActionFunctions,
    };

    if (config.localStartupAction && typeof localStartupAction[config.localStartupAction] === 'function') {
        try { await Promise.resolve(localStartupAction[config.localStartupAction](config)); }
        catch (err) { console.error('[edge-main] localStartupAction failed:', err); }
    }

    if (streamId) {
        await ensureSocketIoLoaded();
        createWebRtcPublisher({ streamId, mediaStream, streamMode: 'sfu' });
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
