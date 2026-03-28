const socket = io();

const params = new URLSearchParams(window.location.search);
const streamId = params.get("streamId") || "cam1";
const pageUrl = (params.get("pageUrl") || "").trim();
const selector = (params.get("selector") || "").trim();
const intervalMs = Number(params.get("intervalMs")) || 1000;
const streamModeParam = (params.get("streamMode") || "p2p").toLowerCase();
const isSfu =
  streamModeParam === "sfu" ||
  streamModeParam === "server" ||
  streamModeParam === "webrtc-server";

const streamIdText = document.getElementById("streamIdText");
const streamModeText = document.getElementById("streamModeText");
const sourceInfo = document.getElementById("sourceInfo");
const statusEl = document.getElementById("status");
const captureCanvas = document.getElementById("captureCanvas");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const ctx = captureCanvas.getContext("2d");

streamIdText.textContent = streamId;
if (streamModeText) {
  streamModeText.textContent = isSfu
    ? "WebRTC server streaming (via SFU)"
    : "Peer-to-peer WebRTC";
}

if (pageUrl || selector) {
  sourceInfo.innerHTML = `
    <div><strong>Page URL:</strong> <span style="word-break:break-all">${pageUrl || "—"}</span></div>
    <div><strong>Selector:</strong> <code style="word-break:break-all">${selector || "—"}</code></div>
    <div><strong>Interval:</strong> ${Number.isFinite(intervalMs) ? intervalMs : "—"} ms</div>
  `;
}

let localStream = null;
const peerConnections = new Map();
let sfuPublisherPc = null;
let captureSessionId = null;
let pollTimer = null;
let lastSeq = -1;
let starting = false;
let stopping = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function clampPollMs(ms) {
  return Math.min(250, Math.max(100, Math.floor(ms / 2)));
}

function streamFpsFromInterval(ms) {
  if (!Number.isFinite(ms) || ms < 200) return 15;
  return Math.min(30, Math.max(1, Math.round(1000 / ms)));
}

function drawDataUrlToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      if (
        captureCanvas.width !== im.naturalWidth ||
        captureCanvas.height !== im.naturalHeight
      ) {
        captureCanvas.width = im.naturalWidth;
        captureCanvas.height = im.naturalHeight;
      }
      ctx.drawImage(im, 0, 0);
      resolve();
    };
    im.onerror = () => reject(new Error("Invalid frame image"));
    im.src = dataUrl;
  });
}

function createPeerConnection(viewerSocketId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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
    console.log(
      `[${streamId}] connection to viewer ${viewerSocketId}:`,
      pc.connectionState
    );
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
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

function stopPollingOnly() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Stops WebRTC and removes this tab from P2P/SFU streamer maps (socket stays open for restart). */
function teardownWebRtcAndSignaling() {
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
  if (isSfu) {
    socket.emit("sfu-unregister-streamer", { streamId });
  } else {
    socket.emit("unregister-streamer", { streamId });
  }
}

/** Ends Puppeteer session and frame polling on the server. */
async function stopPuppeteerSession() {
  const id = captureSessionId;
  captureSessionId = null;
  lastSeq = -1;
  stopPollingOnly();
  if (id) {
    try {
      await fetch(`/api/captured-stream/stop/${id}`, { method: "POST" });
    } catch {
      /* ignore */
    }
  }
}

function startFramePolling(interval) {
  stopPollingOnly();
  const pollEvery = clampPollMs(interval);
  pollTimer = setInterval(async () => {
    if (!captureSessionId) return;
    try {
      const r = await fetch(
        `/api/captured-stream/frame/${captureSessionId}`,
        { cache: "no-store" }
      );
      if (r.status === 404) {
        setStatus("Capture session ended on the server.");
        void stopStream();
        return;
      }
      if (!r.ok) {
        setStatus(`Frame request failed (${r.status}).`);
        return;
      }
      const j = await r.json();
      if (j.error) {
        setStatus(`Capture: ${j.error}`);
        return;
      }
      if (j.image && j.seq !== lastSeq) {
        lastSeq = j.seq;
        try {
          await drawDataUrlToCanvas(j.image);
          setStatus(`Streaming · frame ${j.seq}`);
        } catch (e) {
          console.warn(e);
        }
      }
    } catch (e) {
      setStatus(`Network error: ${e.message}`);
    }
  }, pollEvery);
}

async function startWebCapture() {
  if (localStream || starting || stopping) return;

  if (!pageUrl || !selector) {
    setStatus(
      "Missing page URL or selector. Create this stream from the home page (Web capture tab)."
    );
    return;
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 200 || intervalMs > 60000) {
    setStatus("Invalid intervalMs in URL (use 200–60000).");
    return;
  }

  starting = true;
  setStatus("Starting Puppeteer capture on server…");
  startBtn.disabled = true;

  try {
    const r = await fetch("/api/captured-stream/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl, selector, intervalMs }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setStatus(`Start failed: ${j.error || r.statusText}`);
      startBtn.disabled = false;
      starting = false;
      return;
    }

    captureSessionId = j.sessionId;
    const usedInterval = j.intervalMs ?? intervalMs;
    lastSeq = -1;

    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 90_000;
      const tick = async () => {
        if (!captureSessionId) {
          reject(new Error("Session cleared"));
          return;
        }
        try {
          const fr = await fetch(
            `/api/captured-stream/frame/${captureSessionId}`,
            { cache: "no-store" }
          );
          const fj = await fr.json();
          if (fj.image && fj.seq > 0) {
            await drawDataUrlToCanvas(fj.image);
            resolve();
            return;
          }
        } catch {
          /* continue */
        }
        if (Date.now() > deadline) {
          reject(new Error("Timeout waiting for first frame"));
          return;
        }
        setTimeout(tick, clampPollMs(usedInterval));
      };
      void tick();
    });

    const fps = streamFpsFromInterval(usedInterval);
    localStream = captureCanvas.captureStream(fps);

    startFramePolling(usedInterval);

    if (isSfu) {
      socket.emit("sfu-register-streamer", { streamId });
      setStatus("Registering with relay server…");
    } else {
      socket.emit("register-streamer", { streamId });
      setStatus("Web capture running. Waiting for viewer connections…");
    }

    stopBtn.disabled = false;
  } catch (error) {
    console.error(error);
    await stopPuppeteerSession();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
    setStatus("Failed: " + (error?.message || error));
    startBtn.disabled = false;
  } finally {
    starting = false;
  }
}

async function stopStream() {
  if (stopping) return;
  stopping = true;
  startBtn.disabled = true;
  stopBtn.disabled = true;
  try {
    teardownWebRtcAndSignaling();
    await stopPuppeteerSession();
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
    setStatus("Stream stopped. Press Start to capture again.");
  } finally {
    stopping = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

function stopStreamSyncForUnload() {
  const id = captureSessionId;
  if (id) {
    fetch(`/api/captured-stream/stop/${id}`, {
      method: "POST",
      keepalive: true,
    });
  }
  captureSessionId = null;
  lastSeq = -1;
  stopPollingOnly();
  teardownWebRtcAndSignaling();
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
}

if (!isSfu) {
  socket.on(
    "viewer-request-offer",
    async ({ streamId: requestedStreamId, viewerSocketId }) => {
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
    }
  );

  socket.on(
    "answer",
    async ({ streamId: answerStreamId, viewerSocketId, answer }) => {
      if (answerStreamId !== streamId) return;

      const pc = peerConnections.get(viewerSocketId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error("Error applying answer:", error);
      }
    }
  );

  socket.on(
    "ice-candidate",
    async ({ streamId: candidateStreamId, fromSocketId, candidate }) => {
      if (candidateStreamId !== streamId) return;

      const pc = peerConnections.get(fromSocketId);
      if (!pc || !candidate) return;

      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error adding ICE candidate on streamer:", error);
      }
    }
  );
}

startBtn.addEventListener("click", () => void startWebCapture());
stopBtn.addEventListener("click", () => void stopStream());

socket.on("captured-stream-stop-request", ({ streamId: sid }) => {
  if (sid !== streamId) return;
  void stopStream();
});

window.addEventListener("beforeunload", stopStreamSyncForUnload);

setStatus(
  !pageUrl || !selector
    ? "Open this page from the home Web capture tab (or add pageUrl, selector, intervalMs query params) then press Start."
    : isSfu
      ? "Press Start web capture (server relay mode)."
      : "Press Start web capture to publish to viewers / dashboard."
);
