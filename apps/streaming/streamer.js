import { createWebRtcPublisher } from '/lib/edge/webrtc-publisher.js';

const socket = io();

const params = new URLSearchParams(window.location.search);
const streamId = params.get("streamId") || "cam1";
const sourceUrl = params.get("source") || "";
const streamModeParam = (params.get("streamMode") || "p2p").toLowerCase();
const isSfu =
  streamModeParam === "sfu" ||
  streamModeParam === "server" ||
  streamModeParam === "webrtc-server";
const autoStart =
  params.get("autoStart") === "1" ||
  params.get("autostart") === "true";

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
let publisher = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function startPublisher() {
  if (publisher) return;
  publisher = createWebRtcPublisher({
    streamId,
    mediaStream: localStream,
    streamMode: isSfu ? "sfu" : "p2p",
    socket,
    onStatus: setStatus,
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

    startPublisher();
    setStatus(isSfu ? "Registering with relay server…" : "Camera started. Waiting for viewer connections...");

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

    startPublisher();
    setStatus(isSfu ? "Registering with relay server…" : "URL video streaming. Waiting for viewer connections...");

    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error(error);
    setStatus("Failed to load video: " + error.message);
  }
}

function stopStream() {
  if (publisher) {
    try { publisher.stop(); } catch { /* ignore */ }
    publisher = null;
  }

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

startBtn.addEventListener("click", sourceUrl ? startUrlSource : startCamera);
stopBtn.addEventListener("click", stopStream);

window.addEventListener("beforeunload", stopStream);

if (autoStart) {
  void (sourceUrl ? startUrlSource() : startCamera());
} else {
  setStatus(
    isSfu
      ? sourceUrl
        ? "Press 'Start video' (server relay mode)."
        : "Press 'Start camera' (server relay mode)."
      : sourceUrl
        ? "Press 'Start video' to stream from URL."
        : "Press 'Start camera' to publish stream."
  );
}
