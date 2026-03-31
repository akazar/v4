/**
 * Headless Web capture → server Puppeteer → JPEG polls → I420 → WebRTC (same signaling as captured-stream-streamer.js).
 *
 * =============================================================================
 * How to run
 * =============================================================================
 *
 * 1) Prerequisites: `npm install` at repo root, `npm start` (server :3001). Puppeteer runs on the server for /api/captured-stream/*.
 *
 * 2) On http://localhost:3001/apps/streaming/index.html use the “Web capture” tab: page URL, CSS selector,
 *    interval, stream name. Click “Create streamer” so metadata syncs to the server (same as M3U8 flow).
 *
 * 3) From repo root:
 *
 *        node apps/streaming/node-streamers/node-captured-streamer.js <streamId>
 *
 *    Example: `node apps/streaming/node-streamers/node-captured-streamer.js cap1`
 *
 *    Stop: Ctrl+C
 *
 * 4) Dashboard: http://localhost:3001/apps/streaming/dashboard.html?streams=cap1&modes=p2p (or modes=sfu)
 *
 * 5) Overrides (optional): env CAPTURE_PAGE_URL + CAPTURE_SELECTOR + CAPTURE_INTERVAL_MS (200–60000) skip server lookup.
 *    STREAM_MODE / STREAMING_SERVER_URL same as other node streamers.
 *
 * Dependencies: @roamhq/wrtc, socket.io-client, sharp (for JPEG → I420).
 */

import process from "node:process";
import { createRequire } from "node:module";
import sharp from "sharp";
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
const { RTCVideoSource, rgbaToI420 } = nonstandard;

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 360;
const I420_FRAME_BYTES = (CAPTURE_WIDTH * CAPTURE_HEIGHT * 3) >> 1;
const RGBA_BYTES = CAPTURE_WIDTH * CAPTURE_HEIGHT * 4;

const streamIdArg = process.argv[2]?.trim();
if (!streamIdArg) {
  console.error(
    "Usage: node apps/streaming/node-streamers/node-captured-streamer.js <streamId>\n" +
      "Create the stream on streaming index.html (Web capture tab) first, or set CAPTURE_PAGE_URL + CAPTURE_SELECTOR."
  );
  process.exit(1);
}

const streamId = streamIdArg;
const serverUrl =
  process.env.STREAMING_SERVER_URL || "http://localhost:3001";
const baseUrl = serverUrl.replace(/\/$/, "");
const explicitStreamMode = process.env.STREAM_MODE?.trim();
let isSfu =
  explicitStreamMode === "sfu" ||
  explicitStreamMode === "server" ||
  explicitStreamMode === "webrtc-server";

let localStream = null;
let videoSource = null;
/** @type {import('socket.io-client').Socket | null} */
let socket = null;
const peerConnections = new Map();
let sfuPublisherPc = null;
let captureSessionId = null;
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;
let lastSeq = -1;
let isShuttingDown = false;

const rgbaScratch = new Uint8ClampedArray(RGBA_BYTES);
const i420Scratch = new Uint8ClampedArray(I420_FRAME_BYTES);

function log(...args) {
  console.log(`[node-captured-streamer:${streamId}]`, ...args);
}

function clampIntervalMs(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1000;
  return Math.min(60_000, Math.max(200, Math.round(x)));
}

function clampPollMs(ms) {
  return Math.min(250, Math.max(100, Math.floor(ms / 2)));
}

function dataUrlToBuffer(dataUrl) {
  const m = /^data:image\/\w+;base64,(.+)$/i.exec(String(dataUrl));
  if (!m) throw new Error("Frame payload is not a data:…;base64, image");
  return Buffer.from(m[1], "base64");
}

async function jpegDataUrlToI420Frame(dataUrl) {
  const jpegBuf = dataUrlToBuffer(dataUrl);
  const { data } = await sharp(jpegBuf)
    .resize(CAPTURE_WIDTH, CAPTURE_HEIGHT, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  rgbaScratch.set(data);
  rgbaToI420(
    {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      data: rgbaScratch,
    },
    {
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      data: i420Scratch,
    }
  );
  return new Uint8ClampedArray(i420Scratch);
}

function pushI420ToVideo(copy) {
  if (!videoSource) return;
  videoSource.onFrame({
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    data: copy,
  });
}

/**
 * @returns {Promise<{ pageUrl: string, selector: string, intervalMs: number, modeFromServer: string | null }>}
 */
async function resolveCaptureParamsAndMode() {
  const pageUrlEnv = process.env.CAPTURE_PAGE_URL?.trim();
  const selectorEnv = process.env.CAPTURE_SELECTOR?.trim();
  const intervalEnv = process.env.CAPTURE_INTERVAL_MS;
  if (pageUrlEnv && selectorEnv) {
    return {
      pageUrl: pageUrlEnv,
      selector: selectorEnv,
      intervalMs: clampIntervalMs(intervalEnv || 1000),
      modeFromServer: null,
    };
  }

  const api = `${baseUrl}/api/streaming/home-stream/${encodeURIComponent(streamId)}`;
  const res = await fetch(api);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ||
        `GET home-stream failed (${res.status}). Open streaming index.html and create a Web capture stream with this id.`
    );
  }
  const cap = data.capture;
  if (
    !cap ||
    typeof cap.pageUrl !== "string" ||
    typeof cap.selector !== "string"
  ) {
    throw new Error(
      `Stream "${streamId}" has no Web capture metadata (pageUrl/selector). Use the home page “Web capture” tab for this id, or set CAPTURE_PAGE_URL and CAPTURE_SELECTOR.`
    );
  }
  const modeFromServer =
    data.mode === "sfu" || data.mode === "p2p" ? data.mode : null;
  return {
    pageUrl: cap.pageUrl.trim(),
    selector: cap.selector.trim(),
    intervalMs: clampIntervalMs(cap.intervalMs ?? 1000),
    modeFromServer,
  };
}

function stopPollingOnly() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function stopPuppeteerSession() {
  const id = captureSessionId;
  captureSessionId = null;
  lastSeq = -1;
  stopPollingOnly();
  if (id) {
    try {
      await fetch(`${baseUrl}/api/captured-stream/stop/${id}`, {
        method: "POST",
      });
    } catch {
      /* ignore */
    }
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

  socket.on("captured-stream-stop-request", ({ streamId: sid }) => {
    if (sid !== streamId) return;
    log("server requested capture stop for this stream");
    void shutdown(0);
  });
}

async function waitForFirstFrame(sessionId, usedInterval) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const fr = await fetch(
      `${baseUrl}/api/captured-stream/frame/${sessionId}`,
      { cache: "no-store" }
    );
    if (fr.status === 404) throw new Error("Capture session missing");
    const fj = await fr.json().catch(() => ({}));
    if (fj.image && fj.seq > 0) {
      return fj;
    }
    await new Promise((r) => setTimeout(r, clampPollMs(usedInterval)));
  }
  throw new Error("Timeout waiting for first capture frame");
}

function startFramePolling(usedInterval) {
  stopPollingOnly();
  const pollEvery = clampPollMs(usedInterval);
  pollTimer = setInterval(async () => {
    if (!captureSessionId) return;
    try {
      const r = await fetch(
        `${baseUrl}/api/captured-stream/frame/${captureSessionId}`,
        { cache: "no-store" }
      );
      if (r.status === 404) {
        log("capture session ended on server");
        void shutdown(1);
        return;
      }
      if (!r.ok) return;
      const j = await r.json();
      if (j.error) {
        log("frame error:", j.error);
        return;
      }
      if (j.image && j.seq !== lastSeq) {
        lastSeq = j.seq;
        try {
          const i420copy = await jpegDataUrlToI420Frame(j.image);
          pushI420ToVideo(i420copy);
        } catch (e) {
          console.warn("frame decode", e);
        }
      }
    } catch (e) {
      log("poll:", e?.message || e);
    }
  }, pollEvery);
}

async function startWebCapturePipeline(pageUrl, selector, intervalMs) {
  log("starting Puppeteer session on server…");
  const r = await fetch(`${baseUrl}/api/captured-stream/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageUrl, selector, intervalMs }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(j.error || `start failed ${r.status}`);
  }

  captureSessionId = j.sessionId;
  const usedInterval = j.intervalMs ?? intervalMs;
  lastSeq = -1;

  videoSource = new RTCVideoSource();
  const track = videoSource.createTrack();
  localStream = new MediaStream([track]);

  const first = await waitForFirstFrame(captureSessionId, usedInterval);
  lastSeq = first.seq;
  const firstI420 = await jpegDataUrlToI420Frame(first.image);
  pushI420ToVideo(firstI420);

  startFramePolling(usedInterval);
  log("capture running; interval ~", usedInterval, "ms");
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log("shutting down");
  stopPollingOnly();
  await stopPuppeteerSession();
  for (const id of [...peerConnections.keys()]) {
    cleanupPeer(id);
  }
  closeSfuPublisher();
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }
  videoSource = null;
  if (socket) {
    try {
      if (socket.connected) {
        if (isSfu) {
          socket.emit("sfu-unregister-streamer", { streamId });
        } else {
          socket.emit("unregister-streamer", { streamId });
        }
      }
    } catch {
      /* ignore */
    }
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  process.exit(exitCode);
}

async function main() {
  let pageUrl, selector, intervalMs;
  try {
    const resolved = await resolveCaptureParamsAndMode();
    pageUrl = resolved.pageUrl;
    selector = resolved.selector;
    intervalMs = resolved.intervalMs;
    if (!explicitStreamMode) {
      if (resolved.modeFromServer === "sfu") isSfu = true;
      if (resolved.modeFromServer === "p2p") isSfu = false;
    }
    log("pageUrl:", pageUrl);
    log("selector:", selector);
    log("intervalMs:", intervalMs);
  } catch (e) {
    console.error(e?.message || e);
    process.exit(1);
  }

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
    await startWebCapturePipeline(pageUrl, selector, intervalMs);
  } catch (e) {
    console.error(e);
    log("capture pipeline failed:", e?.message || e);
    await stopPuppeteerSession();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    process.exit(1);
  }

  log(
    "publishing;",
    localStream?.getVideoTracks()?.length ?? 0,
    "video track(s)"
  );

  if (isSfu) {
    socket.emit("sfu-register-streamer", { streamId });
  } else {
    socket.emit("register-streamer", { streamId });
  }

  log("registered streamer; Ctrl+C to stop");

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
}

main().catch((err) => {
  console.error(err);
  void shutdown(1);
});
