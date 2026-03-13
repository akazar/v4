import { captureAndRecognize } from './process.js';

const socket = io();

const params = new URLSearchParams(window.location.search);
const streamIds = (params.get("streams") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const streamsText = document.getElementById("streamsText");
const videoGrid = document.getElementById("videoGrid");

const captureCanvas = document.getElementById("captureCanvas");
const captureSummary = document.getElementById("captureSummary");
const captureModelSelect = document.getElementById("captureModelSelect");
const captureSourceLabel = document.getElementById("captureSource");

let lastCapturedVideo = null;

captureModelSelect.addEventListener("change", () => {
  if (lastCapturedVideo && captureCanvas.width > 0 && captureCanvas.height > 0) {
    captureAndRecognize(lastCapturedVideo, captureModelSelect.value, captureCanvas, captureSummary);
  }
});

streamsText.textContent = streamIds.length ? streamIds.join(", ") : "(none)";

const streamState = new Map();

function createVideoCard(streamId) {
  const wrapper = document.createElement("div");
  wrapper.className = "video-card";
  wrapper.dataset.streamId = streamId;

  const title = document.createElement("h3");
  title.textContent = `Stream: ${streamId}`;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.controls = true;

  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "Waiting for streamer...";

  const captureBtn = document.createElement("button");
  captureBtn.className = "capture-btn";
  captureBtn.textContent = "Capture";

  captureBtn.addEventListener("click", () => {
    lastCapturedVideo = video;
    captureSourceLabel.textContent = `Source: ${streamId}`;
    captureAndRecognize(video, captureModelSelect.value, captureCanvas, captureSummary);
  });

  wrapper.appendChild(title);
  wrapper.appendChild(video);
  wrapper.appendChild(status);
  wrapper.appendChild(captureBtn);
  videoGrid.appendChild(wrapper);

  return { wrapper, video, status };
}

function ensureStreamCard(streamId) {
  let state = streamState.get(streamId);
  if (state) return state;

  const { wrapper, video, status } = createVideoCard(streamId);

  state = {
    pc: null,
    streamerSocketId: null,
    wrapperEl: wrapper,
    videoEl: video,
    statusEl: status,
  };

  streamState.set(streamId, state);
  return state;
}

function setStreamStatus(streamId, text) {
  const state = ensureStreamCard(streamId);
  state.statusEl.textContent = text;
}

function createPeerConnection(streamId, streamerSocketId) {
  const state = ensureStreamCard(streamId);

  if (state.pc) {
    state.pc.close();
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

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
      state.videoEl.srcObject = remoteStream;
      setStreamStatus(streamId, "Live");
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[viewer] ${streamId}:`, pc.connectionState);

    if (pc.connectionState === "connected") {
      setStreamStatus(streamId, "Connected");
    }

    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      state.videoEl.srcObject = null;
      if (pc.connectionState !== "closed") {
        setStreamStatus(streamId, "Connection lost");
      }
    }
  };

  state.pc = pc;
  state.streamerSocketId = streamerSocketId;

  return pc;
}

for (const streamId of streamIds) {
  ensureStreamCard(streamId);
}

socket.emit("register-viewer", { streamIds });

socket.on("streamer-available", ({ streamId }) => {
  if (!streamIds.includes(streamId)) return;

  setStreamStatus(streamId, "Streamer is available. Requesting connection...");
  socket.emit("viewer-request-offer", { streamId });
});

socket.on("streamer-unavailable", ({ streamId }) => {
  const state = streamState.get(streamId);
  if (!state) return;

  if (state.pc) {
    state.pc.close();
    state.pc = null;
  }

  state.videoEl.srcObject = null;
  state.streamerSocketId = null;
  setStreamStatus(streamId, "Streamer offline");
});

socket.on("offer", async ({ streamId, streamerSocketId, offer }) => {
  if (!streamIds.includes(streamId)) return;

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
