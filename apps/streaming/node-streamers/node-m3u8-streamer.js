/**
 * Headless Node M3U8 → FFmpeg → WebRTC streamer. Same signaling as apps/streaming/m3u8-streamer.js (P2P or SFU).
 *
 * =============================================================================
 * How to run
 * =============================================================================
 *
 * 1) Prerequisites
 *    - Repo root: `npm install`.
 *    - FFmpeg on PATH (`ffmpeg -version`). Use a new terminal after installing on Windows.
 *    - Server running: repo root `npm start` (default http://localhost:3001).
 *
 * 2) Create the stream metadata (needed for default URL lookup)
 *    - Open: http://localhost:3001/apps/streaming/index.html
 *    - Use the “M3U8 URL” tab, paste your playlist URL, set the stream name / id if you want (e.g. `web`).
 *    - Click “Create streamer”. That syncs `streamId` + `sourceUrl` + `mode` to the server for the Node script.
 *
 * 3) Start the headless publisher (run from repo root so `node_modules` resolves)
 *
 *        node apps/streaming/node-streamers/node-m3u8-streamer.js <streamId>
 *
 *    Example — same id you used on the home page:
 *
 *        node apps/streaming/node-streamers/node-m3u8-streamer.js web
 *
 *    Stop: Ctrl+C in that terminal.
 *
 * 4) Open the viewer dashboard (match streamId and mode)
 *    - If the home page stored p2p:
 *        http://localhost:3001/apps/streaming/dashboard.html?streams=web&modes=p2p
 *    - If you used “WebRTC server streaming” (sfu) on the home page:
 *        …?streams=web&modes=sfu
 *    - If you did not set STREAM_MODE when starting the Node script, it reuses the mode from the home page.
 *
 * 5) HLS URL when you do not use server lookup (optional overrides)
 *    Order: 2nd CLI argument → M3U8_URL or SOURCE_URL → M3U8_URL_FILE → GET /api/streaming/home-stream/:id
 *
 *        node apps/streaming/node-streamers/node-m3u8-streamer.js web "https://example.com/live.m3u8"
 *
 *        $env:M3U8_URL = "https://example.com/live.m3u8"
 *        node apps/streaming/node-streamers/node-m3u8-streamer.js web
 *
 *    M3U8_URL_FILE: path to a text file whose first line is the playlist URL.
 *
 * 6) Optional environment (PowerShell)
 *
 *        $env:STREAMING_SERVER_URL = "http://localhost:3001"
 *        $env:STREAM_MODE = "sfu"                    # force SFU; omit to follow home page mode
 *        $env:FFMPEG_PATH = "C:\path\to\ffmpeg.exe"
 *        $env:FFMPEG_HLS_REALTIME = "1"              # FFmpeg -re (often better for live HLS)
 *
 * --- Environment reference ---
 *    STREAMING_SERVER_URL, STREAM_MODE, FFMPEG_PATH, M3U8_URL, SOURCE_URL, M3U8_URL_FILE, FFMPEG_HLS_REALTIME
 *
 * Dependencies: @roamhq/wrtc, socket.io-client, FFmpeg.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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
  nonstandard,
} = wrtc;
const { RTCVideoSource } = nonstandard;

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const streamIdArg = process.argv[2]?.trim();
if (!streamIdArg) {
  console.error(
    "Usage:\n" +
      "  node apps/streaming/node-streamers/node-m3u8-streamer.js <streamId>\n" +
      "    → resolves M3U8 URL from server (open streaming index.html first with that stream id)\n" +
      "  node ... <streamId> \"https://…m3u8\"   — URL override\n" +
      "Example:\n" +
      "  node apps/streaming/node-streamers/node-m3u8-streamer.js web"
  );
  process.exit(1);
}

const streamId = streamIdArg;
const serverUrl =
  process.env.STREAMING_SERVER_URL || "http://localhost:3001";
const explicitStreamMode = process.env.STREAM_MODE?.trim();
let isSfu =
  explicitStreamMode === "sfu" ||
  explicitStreamMode === "server" ||
  explicitStreamMode === "webrtc-server";

let localStream = null;
/** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */
let ffmpegChild = null;
const peerConnections = new Map();
let sfuPublisherPc = null;
let socket = null;
let isShuttingDown = false;

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 360;
const I420_FRAME_BYTES = (CAPTURE_WIDTH * CAPTURE_HEIGHT * 3) >> 1;

function log(...args) {
  console.log(`[node-m3u8-streamer:${streamId}]`, ...args);
}

/**
 * @returns {Promise<{ url: string, modeFromServer: string | null }>}
 */
async function resolveM3u8UrlAndMode() {
  const fromArgv = process.argv[3]?.trim();
  if (fromArgv) {
    return { url: fromArgv, modeFromServer: null };
  }
  const fromEnv = (process.env.M3U8_URL || process.env.SOURCE_URL || "")
    .trim();
  if (fromEnv) {
    return { url: fromEnv, modeFromServer: null };
  }
  const filePath = process.env.M3U8_URL_FILE?.trim();
  if (filePath) {
    try {
      const line = readFileSync(filePath, "utf8").split(/\r?\n/)[0]?.trim();
      if (line && !line.startsWith("#")) {
        return { url: line, modeFromServer: null };
      }
    } catch (e) {
      log("M3U8_URL_FILE read failed:", e?.message || e);
    }
  }

  const api = `${serverUrl.replace(/\/$/, "")}/api/streaming/home-stream/${encodeURIComponent(streamId)}`;
  const res = await fetch(api);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ||
        `GET home-stream failed (${res.status}). Start the server, open apps/streaming/index.html, create the stream with an M3U8 URL, or pass the URL as the second argument.`
    );
  }
  const url = (data.sourceUrl || "").trim();
  if (!url) {
    throw new Error(
      `Stream "${streamId}" has no sourceUrl in home metadata. On the home page, create this stream under the M3U8 URL tab with a playlist URL, or pass the URL as argv[2].`
    );
  }
  const modeFromServer =
    data.mode === "sfu" || data.mode === "p2p" ? data.mode : null;
  return { url, modeFromServer };
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
    socket.on(
      "viewer-request-offer",
      async ({ streamId: sid, viewerSocketId }) => {
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
      }
    );

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

function startFfmpegHlsPipeline(url) {
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const preInput = [];
  if (process.env.FFMPEG_HLS_REALTIME === "1") {
    preInput.push("-re");
  }
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    ...preInput,
    "-i",
    url,
    "-vf",
    `scale=${CAPTURE_WIDTH}:${CAPTURE_HEIGHT}:flags=fast_bilinear`,
    "-pix_fmt",
    "yuv420p",
    "-f",
    "rawvideo",
    "-an",
    "pipe:1",
  ];

  log("ffmpeg:", ffmpegBin, "(HLS → I420 → WebRTC)");
  log("source:", url.length > 120 ? `${url.slice(0, 120)}…` : url);

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
    if (t) log("ffmpeg:", t);
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
      log("Check M3U8_URL (reachable, valid HLS), TLS, and FFmpeg network options.");
      void shutdown(1);
    }
  });

  return stream;
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
  let playlistUrl;
  try {
    const resolved = await resolveM3u8UrlAndMode();
    playlistUrl = resolved.url;
    if (!explicitStreamMode) {
      if (resolved.modeFromServer === "sfu") isSfu = true;
      if (resolved.modeFromServer === "p2p") isSfu = false;
    }
    log(
      "HLS playlist:",
      playlistUrl.length > 96 ? `${playlistUrl.slice(0, 96)}…` : playlistUrl
    );
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  }

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
  localStream = startFfmpegHlsPipeline(playlistUrl);

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
