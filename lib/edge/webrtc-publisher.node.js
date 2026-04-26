/**
 * Node.js WebRTC publisher — shared between:
 *   - apps/streaming/node-streamers/node-local-streamer.js (hand-run CLI streamer)
 *   - apps/conveyor-poc generated edge-main.js (non-web edge artifact)
 *
 * Accepts an already-prepared `localStream` (e.g. MediaStream backed by @roamhq/wrtc RTCVideoSource fed by FFmpeg)
 * and handles the signaling handshake with the v4 server (same events as the browser publisher).
 *
 * See apps/streaming/node-streamers/node-local-streamer.js for the FFmpeg pipeline that produces `localStream`.
 */

import { createRequire } from 'node:module';
import { io } from 'socket.io-client';

import { getIceServersForNode, DEFAULT_ICE_SERVERS } from '../ice-servers.js';

const require = createRequire(import.meta.url);
const wrtc = require('@roamhq/wrtc');
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = wrtc;

function isSfuMode(mode) {
    if (!mode) return false;
    const m = String(mode).toLowerCase();
    return m === 'sfu' || m === 'server' || m === 'webrtc-server';
}

/**
 * Create a Node.js publisher for `mediaStream` under `streamId`.
 *
 * @param {object} params
 * @param {string} params.streamId - Stream identifier.
 * @param {object} params.mediaStream - @roamhq/wrtc MediaStream (or equivalent).
 * @param {string} [params.serverUrl] - Socket.IO server URL; defaults to STREAMING_SERVER_URL env or http://localhost:3000.
 * @param {'p2p'|'sfu'} [params.streamMode] - Transport mode; defaults to STREAM_MODE env or 'p2p'.
 * @param {Array} [params.iceServers] - Override ICE servers (default: ICE_SERVERS env or public STUN).
 * @param {(message: string) => void} [params.onStatus] - Optional status callback.
 * @returns {Promise<{ stop: () => Promise<void>, socket: object }>}
 */
export async function createWebRtcPublisherNode({
    streamId,
    mediaStream,
    serverUrl = process.env.STREAMING_SERVER_URL || 'http://localhost:3000',
    streamMode = process.env.STREAM_MODE || 'p2p',
    iceServers = getIceServersForNode(),
    onStatus = null,
} = {}) {
    if (!streamId) throw new Error('createWebRtcPublisherNode: streamId is required');
    if (!mediaStream) throw new Error('createWebRtcPublisherNode: mediaStream is required');

    const sfu = isSfuMode(streamMode);
    const peerConnections = new Map();
    let sfuPublisherPc = null;
    let stopped = false;

    const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 2000,
    });

    function setStatus(text) {
        if (typeof onStatus === 'function') onStatus(text);
    }

    function closeSfuPublisher() {
        if (sfuPublisherPc) {
            try { sfuPublisherPc.close(); } catch { /* ignore */ }
            sfuPublisherPc = null;
        }
    }

    function cleanupPeer(viewerSocketId) {
        const pc = peerConnections.get(viewerSocketId);
        if (pc) {
            try { pc.close(); } catch { /* ignore */ }
            peerConnections.delete(viewerSocketId);
        }
    }

    function createPeerConnection(viewerSocketId) {
        const pc = new RTCPeerConnection({ iceServers, sdpSemantics: 'unified-plan' });
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    streamId,
                    targetSocketId: viewerSocketId,
                    candidate: event.candidate,
                });
            }
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
                cleanupPeer(viewerSocketId);
            }
        };
        for (const track of mediaStream.getTracks()) {
            pc.addTrack(track, mediaStream);
        }
        peerConnections.set(viewerSocketId, pc);
        return pc;
    }

    async function publishSfuOffer() {
        if (stopped || !sfu) return;
        closeSfuPublisher();
        sfuPublisherPc = new RTCPeerConnection({ iceServers, sdpSemantics: 'unified-plan' });
        sfuPublisherPc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('sfu-publisher-ice', { streamId, candidate: event.candidate });
            }
        };
        for (const track of mediaStream.getTracks()) {
            sfuPublisherPc.addTrack(track, mediaStream);
        }
        const offer = await sfuPublisherPc.createOffer();
        await sfuPublisherPc.setLocalDescription(offer);
        socket.emit('sfu-publisher-offer', { streamId, offer: sfuPublisherPc.localDescription });
    }

    function registerSfuHandlers() {
        socket.on('sfu-publish-ready', () => {
            void publishSfuOffer().catch((err) => {
                console.error('[webrtc-publisher-node] SFU publish failed:', err?.message || err);
                setStatus('SFU publish failed');
            });
        });
        socket.on('sfu-publisher-answer', async ({ streamId: sid, answer }) => {
            if (sid !== streamId || !sfuPublisherPc || !answer) return;
            try {
                await sfuPublisherPc.setRemoteDescription(new RTCSessionDescription(answer));
                setStatus('SFU publisher connected; waiting for viewers');
            } catch (err) {
                console.error('[webrtc-publisher-node] apply SFU answer failed:', err);
            }
        });
        socket.on('sfu-publisher-ice', async ({ streamId: sid, candidate }) => {
            if (sid !== streamId || !sfuPublisherPc || !candidate) return;
            try { await sfuPublisherPc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {
                console.warn('[webrtc-publisher-node] SFU publisher ICE', err);
            }
        });
        socket.on('sfu-error', ({ message }) => {
            console.warn('[webrtc-publisher-node] SFU error:', message || 'unknown');
        });
    }

    function registerP2pHandlers() {
        socket.on('viewer-request-offer', async ({ streamId: sid, viewerSocketId }) => {
            if (sid !== streamId || stopped) return;
            try {
                const existing = peerConnections.get(viewerSocketId);
                if (existing) {
                    try { existing.close(); } catch { /* ignore */ }
                    peerConnections.delete(viewerSocketId);
                }
                const pc = createPeerConnection(viewerSocketId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { streamId, viewerSocketId, offer: pc.localDescription });
            } catch (error) {
                console.error('[webrtc-publisher-node] create offer failed:', error);
            }
        });
        socket.on('answer', async ({ streamId: sid, viewerSocketId, answer }) => {
            if (sid !== streamId) return;
            const pc = peerConnections.get(viewerSocketId);
            if (!pc) return;
            try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch (err) {
                console.error('[webrtc-publisher-node] apply answer failed:', err);
            }
        });
        socket.on('ice-candidate', async ({ streamId: sid, fromSocketId, candidate }) => {
            if (sid !== streamId) return;
            const pc = peerConnections.get(fromSocketId);
            if (!pc || !candidate) return;
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {
                console.error('[webrtc-publisher-node] ICE candidate error:', err);
            }
        });
    }

    if (sfu) registerSfuHandlers();
    else registerP2pHandlers();

    await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
    });

    if (sfu) {
        socket.emit('sfu-register-streamer', { streamId });
    } else {
        socket.emit('register-streamer', { streamId });
    }
    setStatus('registered streamer');

    async function stop() {
        stopped = true;
        for (const id of [...peerConnections.keys()]) cleanupPeer(id);
        closeSfuPublisher();
        if (socket) {
            socket.removeAllListeners();
            try { socket.disconnect(); } catch { /* ignore */ }
        }
    }

    return { stop, socket };
}
