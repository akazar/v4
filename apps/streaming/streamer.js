import { attachWebRtcIceFromServer, getIceServers } from './webrtc-ice-client.js';

const socket = io();
attachWebRtcIceFromServer(socket);

const params = new URLSearchParams(window.location.search);
const streamId = params.get("streamId") || "cam1";
const sourceUrl = params.get("source") || "";
const streamModeParam = (params.get("streamMode") || "p2p").toLowerCase();
const isSfu =
  streamModeParam === "sfu" ||
  streamModeParam === "server" ||
  streamModeParam === "webrtc-server";

const streamIdText = document.getElementById("streamIdText");
const streamModeText = document.getElementById("streamModeText");
const sourceInfo = document.getElementById("sourceInfo");
const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

streamIdText.textContent = streamId;
if (streamModeText) {
  streamModeText.textContent = isSfu
    ? "WebRTC server streaming (via SFU)"
    : "Peer-to-peer WebRTC";
}

if (sourceUrl) {
  sourceInfo.innerHTML = `<strong>Source:</strong> <span style="word-break:break-all">${sourceUrl}</span>`;
  startBtn.textContent = "Start video";
  stopBtn.textContent = "Stop video";
}

let localStream = null;
const peerConnections = new Map();
let sfuPublisherPc = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function createPeerConnection(viewerSocketId) {
  const pc = new RTCPeerConnection({
    iceServers: getIceServers(),
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        streamId,
        targetSocketId: viewerSocketId,
        candidate: event.candidate,
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[${streamId}] connection to viewer ${viewerSocketId}:`, pc.connectionState);
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      cleanupPeer(viewerSocketId);
    }
  };

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  peerConnections.set(viewerSocketId, pc);
  return pc;
}

function cleanupPeer(viewerSocketId) {
  const pc = peerConnections.get(viewerSocketId);
  if (pc) {
    pc.close();
    peerConnections.delete(viewerSocketId);
  }
}

function closeSfuPublisher() {
  if (sfuPublisherPc) {
    try {
      sfuPublisherPc.close();
    } catch {
      /* ignore */
    }
    sfuPublisherPc = null;
  }
}

async function publishSfuOffer() {
  if (!localStream || !isSfu) return;
  closeSfuPublisher();
  sfuPublisherPc = new RTCPeerConnection({
    iceServers: getIceServers(),
  });
  sfuPublisherPc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sfu-publisher-ice", {
        streamId,
        candidate: event.candidate,
      });
    }
  };
  for (const track of localStream.getTracks()) {
    sfuPublisherPc.addTrack(track, localStream);
  }
  const offer = await sfuPublisherPc.createOffer();
  await sfuPublisherPc.setLocalDescription(offer);
  socket.emit("sfu-publisher-offer", {
    streamId,
    offer: sfuPublisherPc.localDescription,
  });
}

if (isSfu) {
  socket.on("sfu-publish-ready", () => {
    void publishSfuOffer().catch((err) => {
      console.error(err);
      setStatus("SFU publish failed: " + (err?.message || err));
    });
  });

  socket.on("sfu-publisher-answer", async ({ streamId: sid, answer }) => {
    if (sid !== streamId || !sfuPublisherPc || !answer) return;
    try {
      await sfuPublisherPc.setRemoteDescription(answer);
      setStatus("Connected to relay server. Waiting for viewers…");
    } catch (err) {
      console.error(err);
      setStatus("Failed to apply SFU answer: " + err.message);
    }
  });

  socket.on("sfu-publisher-ice", async ({ streamId: sid, candidate }) => {
    if (sid !== streamId || !sfuPublisherPc || !candidate) return;
    try {
      await sfuPublisherPc.addIceCandidate(candidate);
    } catch (err) {
      console.warn("SFU publisher ICE", err);
    }
  });

  socket.on("sfu-error", ({ message }) => {
    setStatus("SFU error: " + (message || "unknown"));
  });
}

async function startCamera() {
  if (localStream) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: false,
    });

    localVideo.srcObject = localStream;

    if (isSfu) {
      socket.emit("sfu-register-streamer", { streamId });
      setStatus("Registering with relay server…");
    } else {
      socket.emit("register-streamer", { streamId });
      setStatus("Camera started. Waiting for viewer connections...");
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error(error);
    setStatus("Failed to access camera: " + error.message);
  }
}

async function startUrlSource() {
  if (localStream) return;

  try {
    setStatus("Loading video from URL...");
    localVideo.src = sourceUrl;
    localVideo.crossOrigin = "anonymous";
    localVideo.loop = true;
    localVideo.muted = true;

    await new Promise((resolve, reject) => {
      localVideo.onloadeddata = resolve;
      localVideo.onerror = () => reject(new Error("Failed to load video from URL"));
    });

    await localVideo.play();

    localStream = localVideo.captureStream();

    if (isSfu) {
      socket.emit("sfu-register-streamer", { streamId });
      setStatus("Registering with relay server…");
    } else {
      socket.emit("register-streamer", { streamId });
      setStatus("URL video streaming. Waiting for viewer connections...");
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error(error);
    setStatus("Failed to load video: " + error.message);
  }
}

function stopStream() {
  for (const [viewerSocketId] of peerConnections) {
    cleanupPeer(viewerSocketId);
  }
  closeSfuPublisher();

  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }

  localVideo.srcObject = null;
  localVideo.removeAttribute("src");
  localVideo.load();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus(sourceUrl ? "Video stopped." : "Camera stopped.");
}

if (!isSfu) {
  socket.on("viewer-request-offer", async ({ streamId: requestedStreamId, viewerSocketId }) => {
    if (requestedStreamId !== streamId) return;
    if (!localStream) return;

    try {
      let pc = peerConnections.get(viewerSocketId);
      if (pc) {
        pc.close();
      }

      pc = createPeerConnection(viewerSocketId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", {
        streamId,
        viewerSocketId,
        offer,
      });

      setStatus(`Sending stream to viewer ${viewerSocketId}`);
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  });

  socket.on("answer", async ({ streamId: answerStreamId, viewerSocketId, answer }) => {
    if (answerStreamId !== streamId) return;

    const pc = peerConnections.get(viewerSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(answer);
    } catch (error) {
      console.error("Error applying answer:", error);
    }
  });

  socket.on("ice-candidate", async ({ streamId: candidateStreamId, fromSocketId, candidate }) => {
    if (candidateStreamId !== streamId) return;

    const pc = peerConnections.get(fromSocketId);
    if (!pc || !candidate) return;

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Error adding ICE candidate on streamer:", error);
    }
  });
}

startBtn.addEventListener("click", sourceUrl ? startUrlSource : startCamera);
stopBtn.addEventListener("click", stopStream);

window.addEventListener("beforeunload", stopStream);

setStatus(
  isSfu
    ? sourceUrl
      ? "Press 'Start video' (server relay mode)."
      : "Press 'Start camera' (server relay mode)."
    : sourceUrl
      ? "Press 'Start video' to stream from URL."
      : "Press 'Start camera' to publish stream."
);
