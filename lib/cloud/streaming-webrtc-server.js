/**
 * WebRTC server-relay (SFU-lite): receives media from streamer via RTCPeerConnection on Node,
 * forwards to viewers via separate RTCPeerConnections.
 *
 * Requires native WebRTC for Node. This project depends on `@roamhq/wrtc`
 * (try `npm install @roamhq/wrtc` if missing). Fallback: `wrtc`.
 * If neither loads, SFU handlers respond with `sfu-error` and P2P mode still works.
 */

import { createRequire } from 'module';
import { registerSfuStreamKeysGetter } from './streaming-registry.js';

const require = createRequire(import.meta.url);

function loadWrtc() {
  const tryPkg = (name) => {
    try {
      const m = require(name);
      const api = m?.RTCPeerConnection ? m : m?.default;
      return api?.RTCPeerConnection ? api : null;
    } catch {
      return null;
    }
  };
  return tryPkg('@roamhq/wrtc') || tryPkg('wrtc');
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const SFU_INSTALL_HINT =
  'Install server WebRTC: npm install @roamhq/wrtc (and restart the Node server). On Windows, @roamhq/wrtc usually provides prebuilt binaries.';

/**
 * @param {import('socket.io').Server} io
 * @param {{ getViewerSet: (streamId: string) => Set<string>|undefined, emitAvailableStreams: () => void }} deps
 */
export function setupStreamingWebRTCServer(io, deps) {
  const { getViewerSet, emitAvailableStreams } = deps;

  const wrtc = loadWrtc();
  const RTCPeerConnection = wrtc?.RTCPeerConnection;
  const RTCSessionDescription = wrtc?.RTCSessionDescription;
  const RTCIceCandidate = wrtc?.RTCIceCandidate;

  if (!RTCPeerConnection) {
    console.warn(`[SFU] WebRTC server streaming disabled. ${SFU_INSTALL_HINT}`);
    io.on('connection', (socket) => {
      socket.on('sfu-register-streamer', () => {
        socket.emit('sfu-error', {
          message: SFU_INSTALL_HINT,
        });
      });
      socket.on('sfu-register-viewer', () => {
        socket.emit('sfu-error', {
          message: SFU_INSTALL_HINT,
        });
      });
    });
    registerSfuStreamKeysGetter(() => []);
    return;
  }

  /** @type {Map<string, {
   *   publisherSocketId: string,
   *   publisherPc: import('wrtc').RTCPeerConnection | null,
   *   publisherStream: import('wrtc').MediaStream | null,
   *   viewers: Map<string, import('wrtc').RTCPeerConnection>,
   *   pendingViewers: Set<string>,
   * }>} */
  const sessions = new Map();

  /** Viewers who registered before the SFU publisher existed */
  const prePublishPending = new Map();

  registerSfuStreamKeysGetter(() => Array.from(sessions.keys()));

  function cleanupSession(streamId) {
    const s = sessions.get(streamId);
    if (!s) return;
    for (const [, pc] of s.viewers) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    s.viewers.clear();
    if (s.publisherPc) {
      try {
        s.publisherPc.close();
      } catch {
        /* ignore */
      }
    }
    sessions.delete(streamId);
    emitAvailableStreams();
  }

  async function attachViewer(streamId, viewerSocketId) {
    const s = sessions.get(streamId);
    if (!s) return;
    if (!s.publisherStream) {
      s.pendingViewers.add(viewerSocketId);
      return;
    }

    if (s.viewers.has(viewerSocketId)) {
      try {
        s.viewers.get(viewerSocketId)?.close();
      } catch {
        /* ignore */
      }
      s.viewers.delete(viewerSocketId);
    }

    const viewerPc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      sdpSemantics: 'unified-plan',
    });

    viewerPc.onicecandidate = (event) => {
      if (event.candidate) {
        io.to(viewerSocketId).emit('sfu-ice-to-viewer', {
          streamId,
          candidate: event.candidate,
        });
      }
    };

    for (const track of s.publisherStream.getTracks()) {
      viewerPc.addTrack(track, s.publisherStream);
    }

    try {
      const offer = await viewerPc.createOffer();
      await viewerPc.setLocalDescription(offer);
      s.viewers.set(viewerSocketId, viewerPc);
      io.to(viewerSocketId).emit('sfu-viewer-offer', {
        streamId,
        offer: viewerPc.localDescription,
      });
    } catch (err) {
      console.error('[SFU] attachViewer failed', err);
      s.viewers.delete(viewerSocketId);
      io.to(viewerSocketId).emit('sfu-error', { message: String(err?.message || err) });
    }
  }

  function flushPendingViewers(streamId) {
    const s = sessions.get(streamId);
    if (!s?.publisherStream) return;
    for (const vid of s.pendingViewers) {
      void attachViewer(streamId, vid);
    }
    s.pendingViewers.clear();
  }

  io.on('connection', (socket) => {
    socket.on('sfu-register-streamer', ({ streamId }) => {
      if (!streamId) return;

      if (sessions.has(streamId)) {
        cleanupSession(streamId);
      }

      sessions.set(streamId, {
        publisherSocketId: socket.id,
        publisherPc: null,
        publisherStream: null,
        viewers: new Map(),
        pendingViewers: new Set(),
      });
      const sess = sessions.get(streamId);
      const early = prePublishPending.get(streamId);
      if (early) {
        for (const vid of early) sess.pendingViewers.add(vid);
        prePublishPending.delete(streamId);
      }
      socket.data.sfuRole = 'publisher';
      socket.data.sfuStreamId = streamId;

      console.log(`[SFU] Publisher registered: ${streamId} -> ${socket.id}`);
      emitAvailableStreams();

      const viewers = getViewerSet(streamId);
      if (viewers) {
        for (const viewerSocketId of viewers) {
          io.to(viewerSocketId).emit('streamer-available', { streamId });
        }
      }

      socket.emit('sfu-publish-ready', { streamId });
    });

    socket.on('sfu-publisher-offer', async ({ streamId, offer }) => {
      const s = sessions.get(streamId);
      if (!s || s.publisherSocketId !== socket.id || !offer) return;

      if (s.publisherPc) {
        try {
          s.publisherPc.close();
        } catch {
          /* ignore */
        }
        s.publisherPc = null;
        s.publisherStream = null;
      }

      const publisherPc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        sdpSemantics: 'unified-plan',
      });

      publisherPc.onicecandidate = (event) => {
        if (event.candidate) {
          io.to(s.publisherSocketId).emit('sfu-publisher-ice', {
            streamId,
            candidate: event.candidate,
          });
        }
      };

      publisherPc.ontrack = (event) => {
        const [ms] = event.streams;
        if (ms) {
          s.publisherStream = ms;
          flushPendingViewers(streamId);
        }
      };

      try {
        await publisherPc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await publisherPc.createAnswer();
        await publisherPc.setLocalDescription(answer);
        s.publisherPc = publisherPc;
        socket.emit('sfu-publisher-answer', {
          streamId,
          answer: publisherPc.localDescription,
        });
      } catch (err) {
        console.error('[SFU] publisher offer failed', err);
        socket.emit('sfu-error', { message: String(err?.message || err) });
        try {
          publisherPc.close();
        } catch {
          /* ignore */
        }
      }
    });

    socket.on('sfu-publisher-ice', async ({ streamId, candidate }) => {
      const s = sessions.get(streamId);
      if (!s?.publisherPc || !candidate || s.publisherSocketId !== socket.id) return;
      try {
        await s.publisherPc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[SFU] publisher ICE', err?.message || err);
      }
    });

    socket.on('sfu-register-viewer', ({ streamIds }) => {
      if (!Array.isArray(streamIds)) return;
      socket.data.sfuViewerStreams = streamIds;

      for (const streamId of streamIds) {
        if (!sessions.has(streamId)) {
          if (!prePublishPending.has(streamId)) {
            prePublishPending.set(streamId, new Set());
          }
          prePublishPending.get(streamId).add(socket.id);
          continue;
        }
        const s = sessions.get(streamId);
        if (s.publisherStream) {
          void attachViewer(streamId, socket.id);
        } else {
          s.pendingViewers.add(socket.id);
        }
      }
    });

    socket.on('sfu-viewer-answer', async ({ streamId, answer }) => {
      const s = sessions.get(streamId);
      const viewerPc = s?.viewers.get(socket.id);
      if (!viewerPc || !answer) return;
      try {
        await viewerPc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[SFU] viewer answer failed', err);
      }
    });

    socket.on('sfu-ice-from-viewer', async ({ streamId, candidate }) => {
      const s = sessions.get(streamId);
      const viewerPc = s?.viewers.get(socket.id);
      if (!viewerPc || !candidate) return;
      try {
        await viewerPc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[SFU] viewer ICE', err?.message || err);
      }
    });

    socket.on('disconnect', () => {
      if (socket.data.sfuRole === 'publisher' && socket.data.sfuStreamId) {
        const streamId = socket.data.sfuStreamId;
        const viewers = getViewerSet(streamId);
        if (viewers) {
          for (const viewerSocketId of viewers) {
            io.to(viewerSocketId).emit('streamer-unavailable', { streamId });
          }
        }
        cleanupSession(streamId);
        console.log(`[SFU] Publisher disconnected: ${streamId}`);
      }

      if (Array.isArray(socket.data.sfuViewerStreams)) {
        for (const streamId of socket.data.sfuViewerStreams) {
          const s = sessions.get(streamId);
          if (s) {
            const pc = s.viewers.get(socket.id);
            if (pc) {
              try {
                pc.close();
              } catch {
                /* ignore */
              }
              s.viewers.delete(socket.id);
            }
            s.pendingViewers.delete(socket.id);
          }
          const early = prePublishPending.get(streamId);
          if (early) {
            early.delete(socket.id);
            if (early.size === 0) prePublishPending.delete(streamId);
          }
        }
      }
    });
  });
}
