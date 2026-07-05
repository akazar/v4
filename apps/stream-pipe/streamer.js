import { createWebRtcPublisher } from "/lib/edge/webrtc-publisher.js";
import { fetchIceServersForPage } from "/lib/ice-servers.js";

const iceServers = await fetchIceServersForPage();
const socket = io();

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
const localVideo = document.getElementById("localVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

streamIdText.textContent = streamId;
streamModeText.textContent = isSfu
  ? "WebRTC server streaming"
  : "Peer-to-peer WebRTC";

let localStream = null;
let publisher = null;

function setStreamingUi(isStreaming) {
  startBtn.disabled = isStreaming;
  stopBtn.disabled = !isStreaming;
  startBtn.classList.toggle("streamer-btn--active", !isStreaming);
  stopBtn.classList.toggle("streamer-btn--active", isStreaming);
}

function startPublisher() {
  if (publisher) return;
  publisher = createWebRtcPublisher({
    streamId,
    mediaStream: localStream,
    streamMode: isSfu ? "sfu" : "p2p",
    socket,
    iceServers,
    onStatus: (text) => console.log("[streamer]", text),
  });
}

async function startCamera() {
  if (localStream) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });

    localVideo.srcObject = localStream;
    startPublisher();
    setStreamingUi(true);
  } catch (error) {
    console.error(error);
    alert("Failed to access camera: " + (error.message || error));
  }
}

async function startUrlSource() {
  if (localStream) return;

  try {
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
    setStreamingUi(true);
  } catch (error) {
    console.error(error);
    alert("Failed to load video: " + (error.message || error));
  }
}

function stopStream() {
  if (publisher) {
    try {
      publisher.stop();
    } catch {
      /* ignore */
    }
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
  setStreamingUi(false);
}

startBtn.addEventListener("click", () => {
  void (sourceUrl ? startUrlSource() : startCamera());
});
stopBtn.addEventListener("click", stopStream);
window.addEventListener("beforeunload", stopStream);

setStreamingUi(false);
