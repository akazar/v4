import { DEFAULT_ICE_SERVERS } from '/lib/ice-servers.js';

/**
 * Peer-to-peer WebRTC signaling and PeerConnection setup for the dashboard viewer.
 * @param {import('socket.io-client').Socket} socket
 * @param {Array<RTCIceServer>} [params.iceServers]
 */
export function registerP2pWebRtcEvents({
  socket,
  streamIds,
  streamModes,
  streamState,
  ensureStreamCard,
  setStreamStatus,
  onDashboardRemoteStream,
  iceServers = DEFAULT_ICE_SERVERS,
}) {
  function createPeerConnection(streamId, streamerSocketId) {
    const state = ensureStreamCard(streamId);

    if (state.pc) {
      state.pc.close();
    }

    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          streamId,
          targetSocketId: streamerSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        onDashboardRemoteStream(streamId, state, remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[viewer] ${streamId}:`, pc.connectionState);

      if (pc.connectionState === "connected") {
        setStreamStatus(streamId, "Connected");
      }

      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        state.videoEl.srcObject = null;
        state.stopRecognitionForStream?.();
        if (pc.connectionState !== "closed") {
          setStreamStatus(streamId, "Connection lost");
        }
      }
    };

    state.pc = pc;
    state.streamerSocketId = streamerSocketId;

    return pc;
  }

  socket.on("streamer-available", ({ streamId }) => {
    if (!streamIds.includes(streamId)) return;

    setStreamStatus(streamId, "Streamer is available. Requesting connection...");
    if (streamModes.get(streamId) === "sfu") return;
    socket.emit("viewer-request-offer", { streamId });
  });

  socket.on("offer", async ({ streamId, streamerSocketId, offer }) => {
    if (!streamIds.includes(streamId)) return;
    if (streamModes.get(streamId) === "sfu") return;

    try {
      const pc = createPeerConnection(streamId, streamerSocketId);

      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", {
        streamId,
        streamerSocketId,
        answer,
      });

      setStreamStatus(streamId, "Answer sent. Waiting for media...");
    } catch (error) {
      console.error(`Error handling offer for ${streamId}:`, error);
      setStreamStatus(streamId, "Error during negotiation");
    }
  });

  socket.on("ice-candidate", async ({ streamId, fromSocketId, candidate }) => {
    const state = streamState.get(streamId);
    if (!state || !state.pc || !candidate) return;

    if (state.streamerSocketId && state.streamerSocketId !== fromSocketId) {
      return;
    }

    try {
      await state.pc.addIceCandidate(candidate);
    } catch (error) {
      console.error(`Error adding ICE candidate for ${streamId}:`, error);
    }
  });
}
