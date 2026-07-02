/**
 * Generated edge entry point for config "config" (edgeType: web).
 * Autoruns main() on DOMContentLoaded. Pass ?streamId=<id> to publish a WebRTC stream.
 */

import { startRecognitionPipeline } from './lib/edge/recognition-pipeline.js';
import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from './lib/edge/capture.js';
import { createWebRtcPublisher } from './lib/edge/webrtc-publisher.js';
import { fetchIceServersFromBaseUrl, DEFAULT_ICE_SERVERS } from './lib/ice-servers.js';
import { initSdk } from './sdk.js';
import CONFIG from './config.js';
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
 * Ensure `window.io` (socket.io-client) is available. No-op if the page already
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

    const customModules = {};

    if (config.localStartupAction && typeof localStartupAction[config.localStartupAction] === 'function') {
        try { await Promise.resolve(localStartupAction[config.localStartupAction](config)); }
        catch (err) { console.error('[edge-main] localStartupAction failed:', err); }
    }

    if (streamId) {
        await ensureSocketIoLoaded();
        // CONFIG.signalingUrl is injected at bundle-generation time (= the v4 origin where
        // conveyor-poc was opened). It is the source of truth: it makes the bundle portable
        // across hosts (`npx serve` on :8081, file://, another LAN machine, etc.).
        // The "localhost:3001" fallback is only for hand-edited bundles where the field
        // is missing — never fall back to `location.origin` because when the bundle is
        // hosted off-v4, the page origin is the static-file host, not the SFU server.
        const signalingUrl = CONFIG.signalingUrl || 'http://localhost:3001';
        // ICE (STUN/TURN) from the v4 host — GET {signalingUrl}/api/ice (CORS) so TURN creds are not in the repo.
        let iceServers = DEFAULT_ICE_SERVERS;
        try {
            iceServers = await fetchIceServersFromBaseUrl(signalingUrl);
        } catch (e) {
            console.warn('[edge-main] fetch ICE from signaling host failed, using default STUN', e);
        }
        createWebRtcPublisher({
            streamId,
            mediaStream,
            streamMode: 'sfu',
            serverUrl: signalingUrl,
            iceServers,
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
