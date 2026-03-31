/**
 * Headless Node streamer: local webcam → FFmpeg → WebRTC, same signaling as apps/streaming/streamer.js (P2P or SFU).
 *
 * --- How to run ---
 *
 * 1) Prerequisites
 *    - From repo root: dependencies installed (`npm install`).
 *    - FFmpeg on PATH (e.g. `ffmpeg -version`). On Windows, use a new terminal after installing FFmpeg.
 *    - App server running (Socket.IO): from repo root run `npm start` (default http://localhost:3001).
 *
 * 2) Start streaming (always run from repo root so `node_modules` resolves)
 *
 *        node apps/streaming/node-streamers/node-local-streamer.js <streamId>
 *
 *    Example — stream id `local`:
 *
 *        node apps/streaming/node-streamers/node-local-streamer.js local
 *
 *    Stop: Ctrl+C in that terminal.
 *
 * 3) Watch the stream (same host/port as the server)
 *    - Dashboard (P2P):
 *        http://localhost:3001/apps/streaming/dashboard.html?streams=local&modes=p2p
 *    - Replace `local` with your streamId; use `modes=sfu` if you set STREAM_MODE=sfu below.
 *
 * 4) Optional environment (PowerShell examples)
 *
 *        $env:STREAMING_SERVER_URL = "http://localhost:3001"   # default if omitted
 *        $env:STREAM_MODE = "sfu"                               # default is p2p
 *        $env:FFMPEG_PATH = "C:\path\to\ffmpeg.exe"            # if `ffmpeg` is not on PATH
 *        $env:CAMERA_DSHOW_NAME = "Exact Name From Device List"  # Windows: if auto-detect picks wrong camera
 *        node apps/streaming/node-streamers/node-local-streamer.js local
 *
 *    List Windows camera names:
 *
 *        ffmpeg -f dshow -list_devices true -i dummy
 *
 *    macOS / Linux defaults use CAMERA_AVFOUNDATION_INDEX and CAMERA_V4L2_PATH (see below).
 *
 * 5) Capture modes
 *    Default: FFmpeg + RTCVideoSource (real hardware). If FFmpeg is missing, the script falls back to
 *    wrtc getUserMedia (often no real video on Node).
 *    Force wrtc-only (not recommended): $env:NODE_STREAMER_CAPTURE = "wrtc"
 *
 * --- Environment reference ---
 *    STREAMING_SERVER_URL — Socket.IO base URL (default http://localhost:3001)
 *    STREAM_MODE — p2p | sfu (default p2p)
 *    FFMPEG_PATH — ffmpeg executable if not named `ffmpeg` on PATH
 *    NODE_STREAMER_CAPTURE — wrtc forces getUserMedia-only; omit for FFmpeg capture
 *    CAMERA_DSHOW_NAME — Windows DirectShow video name; omit to auto-pick first (video) device
 *    CAMERA_AVFOUNDATION_INDEX — macOS, default 0 (see -i INDEX:none)
 *    CAMERA_V4L2_PATH — Linux, default /dev/video0
 *
 * Dependencies: @roamhq/wrtc, socket.io-client; FFmpeg required for reliable camera capture.
 */

import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const wrtc = require("@roamhq/wrtc");
const {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  getUserMedia,
  nonstandard,
} = wrtc;
const { RTCVideoSource } = nonstandard;

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const streamIdArg = process.argv[2]?.trim();
if (!streamIdArg) {
  console.error(
    "Usage: node apps/streaming/node-streamers/node-local-streamer.js <streamId>"
  );
  process.exit(1);
}

const streamId = streamIdArg;
const serverUrl =
  process.env.STREAMING_SERVER_URL || "http://localhost:3001";
const modeRaw = (process.env.STREAM_MODE || "p2p").toLowerCase();
const isSfu =
  modeRaw === "sfu" ||
  modeRaw === "server" ||
  modeRaw === "webrtc-server";

let localStream = null;
/** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
let ffmpegChild = null;
const peerConnections = new Map();
let sfuPublisherPc = null;
let socket = null;
let isShuttingDown = false;

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 360;
const I420_FRAME_BYTES = (CAPTURE_WIDTH * CAPTURE_HEIGHT * 3) >> 1;

function ffmpegOnPath() {
  const bin = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    const r = spawnSync(bin, ["-hide_banner", "-version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** First quoted name before "(video)" in ffmpeg dshow list output. */
function detectFirstDshowVideoDevice(ffmpegBin) {
  const r = spawnSync(
    ffmpegBin,
    ["-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 }
  );
  const text = `${r.stderr || ""}\n${r.stdout || ""}`;
  const re = /"([^"]+)"\s*\(video\)/g;
  const found = re.exec(text);
  return found ? found[1] : null;
}

/** Windows DirectShow input; `deviceName` is the friendly name from list_devices. */
function ffmpegCameraInputArgsWin32(deviceName) {
  return [
    "-f",
    "dshow",
    "-rtbufsize",
    "100M",
    "-video_size",
    `${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`,
    "-framerate",
    "20",
    "-i",
    `video=${deviceName}`,
  ];
}

/** Input args only (before output filters). Non-Windows platforms. */
function ffmpegCameraInputArgs() {
  const plat = process.platform;
  if (plat === "win32") {
    throw new Error("use ffmpegCameraInputArgsWin32(deviceName) on win32");
  }
  if (plat === "darwin") {
    const idx = process.env.CAMERA_AVFOUNDATION_INDEX ?? "0";
    return [
      "-f",
      "avfoundation",
      "-framerate",
      "20",
      "-video_size",
      `${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`,
      "-i",
      `${idx}:none`,
    ];
  }
  const dev = process.env.CAMERA_V4L2_PATH || "/dev/video0";
  return [
    "-f",
    "v4l2",
    "-framerate",
    "20",
    "-video_size",
    `${CAPTURE_WIDTH}x${CAPTURE_HEIGHT}`,
    "-i",
    dev,
  ];
}

function log(...args) {
  console.log(`[node-local-streamer:${streamId}]`, ...args);
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

function cleanupPeer(viewerSocketId) {
  const pc = peerConnections.get(viewerSocketId);
  if (pc) {
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    peerConnections.delete(viewerSocketId);
  }
}

function createPeerConnection(viewerSocketId) {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    sdpSemantics: "unified-plan",
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
    log("p2p pc state", viewerSocketId, pc.connectionState);
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

async function publishSfuOffer() {
  if (!localStream || !isSfu) return;
  closeSfuPublisher();
  sfuPublisherPc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    sdpSemantics: "unified-plan",
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

function registerSignalingHandlers() {
  if (isSfu) {
    socket.on("sfu-publish-ready", () => {
      void publishSfuOffer().catch((err) => {
        console.error(err);
        log("SFU publish failed:", err?.message || err);
      });
    });

    socket.on("sfu-publisher-answer", async ({ streamId: sid, answer }) => {
      if (sid !== streamId || !sfuPublisherPc || !answer) return;
      try {
        await sfuPublisherPc.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        log("SFU publisher connected; waiting for viewers");
      } catch (err) {
        console.error(err);
        log("Failed to apply SFU answer:", err.message);
      }
    });

    socket.on("sfu-publisher-ice", async ({ streamId: sid, candidate }) => {
      if (sid !== streamId || !sfuPublisherPc || !candidate) return;
      try {
        await sfuPublisherPc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("SFU publisher ICE", err);
      }
    });

    socket.on("sfu-error", ({ message }) => {
      log("SFU error:", message || "unknown");
    });
  } else {
    socket.on("viewer-request-offer", async ({ streamId: sid, viewerSocketId }) => {
      if (sid !== streamId) return;
      if (!localStream) return;

      try {
        const existing = peerConnections.get(viewerSocketId);
        if (existing) {
          try {
            existing.close();
          } catch {
            /* ignore */
          }
          peerConnections.delete(viewerSocketId);
        }

        const pc = createPeerConnection(viewerSocketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("offer", {
          streamId,
          viewerSocketId,
          offer: pc.localDescription,
        });

        log("sent offer to viewer", viewerSocketId);
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    });

    socket.on("answer", async ({ streamId: aid, viewerSocketId, answer }) => {
      if (aid !== streamId) return;
      const pc = peerConnections.get(viewerSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error("Error applying answer:", error);
      }
    });

    socket.on(
      "ice-candidate",
      async ({ streamId: cid, fromSocketId, candidate }) => {
        if (cid !== streamId) return;
        const pc = peerConnections.get(fromSocketId);
        if (!pc || !candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("ICE candidate error:", error);
        }
      }
    );
  }
}

function resolveWindowsDshowDeviceName(ffmpegBin) {
  const fromEnv = process.env.CAMERA_DSHOW_NAME?.trim();
  if (fromEnv) {
    log("DirectShow device (CAMERA_DSHOW_NAME):", fromEnv);
    return fromEnv;
  }
  const first = detectFirstDshowVideoDevice(ffmpegBin);
  if (first) {
    log("DirectShow device (auto-detected):", first);
    return first;
  }
  log(
    "Could not auto-detect a video device. Run: ffmpeg -f dshow -list_devices true -i dummy"
  );
  log('Then set CAMERA_DSHOW_NAME to the name in quotes before "(video)".');
  return "Integrated Camera";
}

function startFfmpegCameraPipeline() {
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const inputArgs =
    process.platform === "win32"
      ? ffmpegCameraInputArgsWin32(resolveWindowsDshowDeviceName(ffmpegBin))
      : ffmpegCameraInputArgs();
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    ...inputArgs,
    "-vf",
    `scale=${CAPTURE_WIDTH}:${CAPTURE_HEIGHT}:flags=fast_bilinear`,
    "-pix_fmt",
    "yuv420p",
    "-f",
    "rawvideo",
    "-an",
    "pipe:1",
  ];

  log("ffmpeg:", ffmpegBin, "(camera → I420 → WebRTC)");

  const videoSource = new RTCVideoSource();
  const track = videoSource.createTrack();
  const stream = new MediaStream([track]);

  const proc = spawn(ffmpegBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  ffmpegChild = proc;

  let buffered = Buffer.alloc(0);
  proc.stdout.on("data", (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= I420_FRAME_BYTES) {
      const slice = buffered.subarray(0, I420_FRAME_BYTES);
      buffered = buffered.subarray(I420_FRAME_BYTES);
      const data = new Uint8ClampedArray(I420_FRAME_BYTES);
      data.set(slice);
      videoSource.onFrame({
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
        data,
      });
    }
  });

  proc.stderr.on("data", (d) => {
    const t = d.toString().trim();
    if (t) {
      log("ffmpeg:", t);
    }
  });

  proc.on("error", (err) => {
    log("ffmpeg spawn error:", err.message);
  });

  proc.on("exit", (code, signal) => {
    if (signal) {
      log("ffmpeg stopped (signal:", signal + ")");
      return;
    }
    if (code !== null && code !== 0) {
      log("ffmpeg exited with error code", code);
      log("Fix the camera name (CAMERA_DSHOW_NAME), or check privacy settings / other apps using the camera.");
      void shutdown(1);
    }
  });

  return stream;
}

async function acquireLocalVideoStream() {
  const useWrtcOnly = process.env.NODE_STREAMER_CAPTURE === "wrtc";
  if (useWrtcOnly) {
    log(
      "NODE_STREAMER_CAPTURE=wrtc: getUserMedia may not drive the real camera on Node.js."
    );
    return getUserMedia({
      video: {
        width: { ideal: CAPTURE_WIDTH },
        height: { ideal: CAPTURE_HEIGHT },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: false,
    });
  }

  if (!ffmpegOnPath()) {
    log("FFmpeg not found. Install FFmpeg and ensure it is on PATH, or set FFMPEG_PATH.");
    log("Without FFmpeg, trying getUserMedia (often no hardware video on Node)…");
    return getUserMedia({
      video: {
        width: { ideal: CAPTURE_WIDTH },
        height: { ideal: CAPTURE_HEIGHT },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: false,
    });
  }

  return startFfmpegCameraPipeline();
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("shutting down");
  for (const id of [...peerConnections.keys()]) {
    cleanupPeer(id);
  }
  closeSfuPublisher();
  if (ffmpegChild) {
    try {
      ffmpegChild.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    ffmpegChild = null;
  }
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  process.exit(exitCode);
}

async function main() {
  log(
    "connecting to",
    serverUrl,
    isSfu ? "(SFU / server relay)" : "(peer-to-peer)"
  );

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 2000,
  });

  registerSignalingHandlers();

  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  log("socket connected");

  try {
    localStream = await acquireLocalVideoStream();
  } catch (err) {
    console.error(err);
    log("Failed to open camera:", err?.message || err);
    log("Install FFmpeg for reliable capture, or fix CAMERA_* device settings.");
    await shutdown(1);
    return;
  }

  log(
    "video source ready;",
    localStream.getVideoTracks().length,
    "video track(s)"
  );

  if (isSfu) {
    socket.emit("sfu-register-streamer", { streamId });
  } else {
    socket.emit("register-streamer", { streamId });
  }

  log("registered streamer; streaming until SIGINT/SIGTERM");

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
}

main().catch((err) => {
  console.error(err);
  void shutdown(1);
});
