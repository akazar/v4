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
const flipCameraBtn = document.getElementById("flipCameraBtn");

streamIdText.textContent = streamId;
streamModeText.textContent = isSfu
  ? "WebRTC server streaming"
  : "Peer-to-peer WebRTC";

const videoConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24, max: 30 },
};

let localStream = null;
let publisher = null;
let facingMode = "environment";

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

async function hasMultipleCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput").length >= 2;
}

async function updateFlipButtonVisibility() {
  if (sourceUrl || !localStream) {
    flipCameraBtn.hidden = true;
    return;
  }
  flipCameraBtn.hidden = !(await hasMultipleCameras());
}

async function acquireCameraStream(preferredFacing) {
  const video = preferredFacing
    ? { ...videoConstraints, facingMode: preferredFacing }
    : videoConstraints;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    if (preferredFacing) facingMode = preferredFacing;
    return stream;
  } catch (error) {
    if (!preferredFacing) throw error;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    const settings = stream.getVideoTracks()[0]?.getSettings?.();
    if (settings?.facingMode === "user" || settings?.facingMode === "environment") {
      facingMode = settings.facingMode;
    }
    return stream;
  }
}

async function startCamera() {
  if (localStream) return;

  try {
    localStream = await acquireCameraStream(facingMode);
    localVideo.srcObject = localStream;
    startPublisher();
    setStreamingUi(true);
    await updateFlipButtonVisibility();
  } catch (error) {
    console.error(error);
    alert("Failed to access camera: " + (error.message || error));
  }
}

async function switchCamera() {
  if (!localStream || sourceUrl || flipCameraBtn.disabled) return;

  const nextFacing = facingMode === "user" ? "environment" : "user";
  flipCameraBtn.disabled = true;

  try {
    const tempStream = await navigator.mediaDevices.getUserMedia({
      video: { ...videoConstraints, facingMode: nextFacing },
      audio: false,
    });
    const newVideoTrack = tempStream.getVideoTracks()[0];
    if (!newVideoTrack) throw new Error("No video track");

    facingMode = nextFacing;

    if (publisher?.replaceVideoTrack) {
      publisher.replaceVideoTrack(newVideoTrack);
    } else {
      const oldVideo = localStream.getVideoTracks()[0];
      if (oldVideo) {
        localStream.removeTrack(oldVideo);
        oldVideo.stop();
      }
      localStream.addTrack(newVideoTrack);
    }

    for (const track of tempStream.getTracks()) {
      if (track !== newVideoTrack) track.stop();
    }
  } catch (error) {
    console.error(error);
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      flipCameraBtn.hidden = true;
    }
  } finally {
    flipCameraBtn.disabled = false;
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
  flipCameraBtn.hidden = true;
  setStreamingUi(false);
}

startBtn.addEventListener("click", () => {
  void (sourceUrl ? startUrlSource() : startCamera());
});
stopBtn.addEventListener("click", stopStream);
flipCameraBtn.addEventListener("click", () => {
  void switchCamera();
});
window.addEventListener("beforeunload", stopStream);

setStreamingUi(false);
