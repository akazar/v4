/**
 * Browser WebRTC publisher — shared between:
 *   - apps/streaming/streamer.js (dashboard streamer page)
 *   - apps/conveyor-poc generated edge-main.js (web edge artifact)
 *
 * Modes:
 *   - P2P: one PeerConnection per viewer, signaling via `viewer-request-offer` / `offer` / `answer` / `ice-candidate`.
 *   - SFU: one `sfu-publisher-offer`; the server relays to viewers.
 *
 * Signaling handshake matches lib/cloud/streaming-server/streaming-server.js exactly,
 * so this publisher is a drop-in replacement for the logic originally in streamer.js.
 */

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function isSfuMode(mode) {
    if (!mode) return false;
    const m = String(mode).toLowerCase();
    return m === 'sfu' || m === 'server' || m === 'webrtc-server';
}

function attachSocket(socket) {
    if (socket) return { socket, ownsSocket: false };
    if (typeof window === 'undefined' || typeof window.io !== 'function') {
        throw new Error('createWebRtcPublisher: expected a socket.io client `socket` or window.io()');
    }
    return { socket: window.io(), ownsSocket: true };
}

/**
 * Create a publisher that streams `mediaStream` under `streamId`.
 *
 * @param {object} params
 * @param {string} params.streamId - Stream identifier (must be unique per publisher).
 * @param {MediaStream} params.mediaStream - Already-captured stream (from getUserMedia or canvas.captureStream()).
 * @param {'p2p'|'sfu'} [params.streamMode='sfu'] - Transport mode.
 * @param {object} [params.socket] - Existing socket.io-client socket. If omitted, one is created via `window.io()`.
 * @param {Array} [params.iceServers] - Override ICE servers.
 * @param {(message: string) => void} [params.onStatus] - Optional status callback for UI.
 * @returns {{ stop: () => void, registerStreamer: () => void }}
 */
export function createWebRtcPublisher({
    streamId,
    mediaStream,
    streamMode = 'sfu',
    socket: providedSocket = null,
    iceServers = DEFAULT_ICE_SERVERS,
    onStatus = null,
} = {}) {
    if (!streamId) throw new Error('createWebRtcPublisher: streamId is required');
    if (!mediaStream) throw new Error('createWebRtcPublisher: mediaStream is required');

    const { socket, ownsSocket } = attachSocket(providedSocket);
    const sfu = isSfuMode(streamMode);

    const peerConnections = new Map();
    let sfuPublisherPc = null;
    let stopped = false;

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
        const pc = new RTCPeerConnection({ iceServers });
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
        sfuPublisherPc = new RTCPeerConnection({ iceServers });
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
                console.error('[webrtc-publisher] SFU publish failed:', err);
                setStatus('SFU publish failed: ' + (err?.message || err));
            });
        });
        socket.on('sfu-publisher-answer', async ({ streamId: sid, answer }) => {
            if (sid !== streamId || !sfuPublisherPc || !answer) return;
            try {
                await sfuPublisherPc.setRemoteDescription(answer);
                setStatus('Connected to relay server. Waiting for viewers…');
            } catch (err) {
                console.error('[webrtc-publisher] apply SFU answer failed:', err);
                setStatus('Failed to apply SFU answer: ' + err.message);
            }
        });
        socket.on('sfu-publisher-ice', async ({ streamId: sid, candidate }) => {
            if (sid !== streamId || !sfuPublisherPc || !candidate) return;
            try { await sfuPublisherPc.addIceCandidate(candidate); } catch (err) {
                console.warn('[webrtc-publisher] SFU publisher ICE', err);
            }
        });
        socket.on('sfu-error', ({ message }) => {
            setStatus('SFU error: ' + (message || 'unknown'));
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
                socket.emit('offer', { streamId, viewerSocketId, offer });
                setStatus(`Sending stream to viewer ${viewerSocketId}`);
            } catch (error) {
                console.error('[webrtc-publisher] create offer failed:', error);
            }
        });
        socket.on('answer', async ({ streamId: sid, viewerSocketId, answer }) => {
            if (sid !== streamId) return;
            const pc = peerConnections.get(viewerSocketId);
            if (!pc) return;
            try { await pc.setRemoteDescription(answer); } catch (err) {
                console.error('[webrtc-publisher] apply answer failed:', err);
            }
        });
        socket.on('ice-candidate', async ({ streamId: sid, fromSocketId, candidate }) => {
            if (sid !== streamId) return;
            const pc = peerConnections.get(fromSocketId);
            if (!pc || !candidate) return;
            try { await pc.addIceCandidate(candidate); } catch (err) {
                console.error('[webrtc-publisher] ICE candidate error:', err);
            }
        });
    }

    if (sfu) registerSfuHandlers();
    else registerP2pHandlers();

    function registerStreamer() {
        if (sfu) {
            socket.emit('sfu-register-streamer', { streamId });
            setStatus('Registering with relay server…');
        } else {
            socket.emit('register-streamer', { streamId });
            setStatus('Registered. Waiting for viewer connections…');
        }
    }

    registerStreamer();

    function stop() {
        stopped = true;
        for (const [id] of peerConnections) cleanupPeer(id);
        closeSfuPublisher();
        if (ownsSocket && socket) {
            try { socket.disconnect(); } catch { /* ignore */ }
        }
    }

    return { stop, registerStreamer };
}
