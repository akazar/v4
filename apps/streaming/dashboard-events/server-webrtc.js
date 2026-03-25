/**
 * WebRTC server (SFU) streaming and server-side recognition events for the dashboard viewer.
 * @param {import('socket.io-client').Socket} socket
 */
export function registerServerWebRtcEvents({
  socket,
  streamIds,
  streamModes,
  streamState,
  shouldUseServerRecognitionForStream,
  drawDetectionsOnOverlay,
  ensureStreamCard,
  setStreamStatus,
  onDashboardRemoteStream,
}) {
  socket.on("sfu-server-recognition", (payload) => {
    const { streamId: sid, detections, videoWidth, videoHeight } = payload || {};
    if (!sid) return;
    const state = streamState.get(sid);
    if (!state?.recognitionCheckboxEl?.checked) return;
    const cfg = state.currentConfig;
    if (!shouldUseServerRecognitionForStream(sid, cfg)) return;
    if (!state.serverRecognitionActive) return;
    const size =
      videoWidth && videoHeight
        ? { width: videoWidth, height: videoHeight }
        : null;
    drawDetectionsOnOverlay(
      state.videoEl,
      detections || [],
      state.overlayEl,
      cfg,
      size
    );
  });

  socket.on("sfu-server-recognition-error", ({ streamId: sid, message }) => {
    const state = streamState.get(sid);
    if (!state?.recognitionCheckboxEl?.checked) return;
    console.warn("Server recognition:", sid, message);
    const msg = message != null ? String(message) : "";
    if (msg.includes("not active") && state.videoEl.srcObject) {
      setTimeout(() => {
        if (!state.recognitionCheckboxEl.checked) return;
        void state.syncRecognitionWithStream?.();
      }, 1000);
    }
  });

  socket.on("sfu-viewer-offer", async ({ streamId, offer }) => {
    if (!streamIds.includes(streamId)) return;
    if (streamModes.get(streamId) !== "sfu" || !offer) return;

    const state = ensureStreamCard(streamId);
    if (state.sfuPc) {
      try {
        state.sfuPc.close();
      } catch {
        /* ignore */
      }
      state.sfuPc = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("sfu-ice-from-viewer", {
          streamId,
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
      console.log(`[viewer SFU] ${streamId}:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        setStreamStatus(streamId, "Connected (relay)");
      }
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        state.videoEl.srcObject = null;
        state.stopRecognitionForStream?.();
        if (pc.connectionState !== "closed") {
          setStreamStatus(streamId, "Relay connection lost");
        }
      }
    };

    state.sfuPc = pc;

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("sfu-viewer-answer", {
        streamId,
        answer: pc.localDescription,
      });
      setStreamStatus(streamId, "Answer sent to relay. Waiting for media…");
    } catch (error) {
      console.error(`Error handling SFU offer for ${streamId}:`, error);
      setStreamStatus(streamId, "SFU negotiation error");
    }
  });

  socket.on("sfu-ice-to-viewer", async ({ streamId, candidate }) => {
    const state = streamState.get(streamId);
    if (!state?.sfuPc || !candidate) return;
    try {
      await state.sfuPc.addIceCandidate(candidate);
    } catch (error) {
      console.error(`Error adding SFU ICE for ${streamId}:`, error);
    }
  });

  socket.on("sfu-error", ({ message }) => {
    console.warn("SFU:", message);
  });
}
