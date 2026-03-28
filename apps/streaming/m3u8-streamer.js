const socket = io();

const params = new URLSearchParams(window.location.search);
const streamId = params.get("streamId") || "cam1";
const sourceUrl = (params.get("source") || "").trim();
const streamModeParam = (params.get("streamMode") || "p2p").toLowerCase();
const isSfu =
  streamModeParam === "sfu" ||
  streamModeParam === "server" ||
  streamModeParam === "webrtc-server";

const streamIdText = document.getElementById("streamIdText");
const streamModeText = document.getElementById("streamModeText");
const sourceInfo = document.getElementById("sourceInfo");
const statusEl = document.getElementById("status");
const urlVideo = document.getElementById("urlVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

streamIdText.textContent = streamId;
if (streamModeText) {
  streamModeText.textContent = isSfu
    ? "WebRTC server streaming (via SFU)"
    : "Peer-to-peer WebRTC";
}

if (sourceUrl) {
  sourceInfo.innerHTML = `<strong>M3U8 URL:</strong> <span style="word-break:break-all">${sourceUrl}</span>`;
}

let localStream = null;
const peerConnections = new Map();
let sfuPublisherPc = null;
let hlsInstance = null;

function setStatus(text) {
  statusEl.textContent = text;
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

function destroyHls() {
  if (hlsInstance) {
    try {
      hlsInstance.destroy();
    } catch {
      /* ignore */
    }
    hlsInstance = null;
  }
}

async function startHlsSource() {
  if (localStream) return;

  if (!sourceUrl) {
    setStatus("No m3u8 URL. Create the stream from the home page with a URL, or add ?source=… to this page.");
    return;
  }

  try {
    setStatus("Loading HLS…");
    urlVideo.crossOrigin = "anonymous";
    urlVideo.muted = true;
    urlVideo.playsInline = true;

    await new Promise((resolve, reject) => {
      const timeoutMs = 90000;
      const timeout = setTimeout(
        () => reject(new Error("HLS load timeout")),
        timeoutMs
      );
      const finish = (err) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      };

      const HlsCtor = typeof Hls !== "undefined" ? Hls : null;

      if (HlsCtor?.isSupported?.()) {
        destroyHls();
        hlsInstance = new HlsCtor({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          urlVideo
            .play()
            .then(() => finish(null))
            .catch((e) => finish(e));
        });
        hlsInstance.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (data?.fatal) {
            finish(
              new Error(
                `${data.type || "HLS"}: ${data.details || "fatal error"}`
              )
            );
          }
        });
        hlsInstance.loadSource(sourceUrl);
        hlsInstance.attachMedia(urlVideo);
      } else if (
        urlVideo.canPlayType("application/vnd.apple.mpegurl") ||
        urlVideo.canPlayType("application/x-mpegURL")
      ) {
        urlVideo.src = sourceUrl;
        urlVideo.addEventListener(
          "loadedmetadata",
          () => {
            urlVideo
              .play()
              .then(() => finish(null))
              .catch((e) => finish(e));
          },
          { once: true }
        );
        urlVideo.addEventListener(
          "error",
          () => finish(new Error("Failed to load m3u8 (native)")),
          { once: true }
        );
      } else {
        finish(new Error("HLS is not supported in this browser"));
      }
    });

    localStream = urlVideo.captureStream();

    if (isSfu) {
      socket.emit("sfu-register-streamer", { streamId });
      setStatus("Registering with relay server…");
    } else {
      socket.emit("register-streamer", { streamId });
      setStatus("HLS streaming. Waiting for viewer connections…");
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    console.error(error);
    destroyHls();
    urlVideo.removeAttribute("src");
    urlVideo.load();
    setStatus("Failed to load HLS: " + (error?.message || error));
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

  destroyHls();
  urlVideo.srcObject = null;
  urlVideo.removeAttribute("src");
  urlVideo.load();

  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("Stream stopped.");
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

startBtn.addEventListener("click", () => void startHlsSource());
stopBtn.addEventListener("click", stopStream);

window.addEventListener("beforeunload", stopStream);

setStatus(
  !sourceUrl
    ? "Add an m3u8 URL via the home page or ?source=… then press Start HLS stream."
    : isSfu
      ? "Press Start HLS stream (server relay mode)."
      : "Press Start HLS stream to publish to viewers / dashboard."
);
