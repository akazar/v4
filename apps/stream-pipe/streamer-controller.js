function looksLikeM3u8Url(url) {
  const u = String(url || "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes(".m3u8")) return true;
  if (u.includes("format=m3u8") || u.includes("type=m3u8")) return true;
  return false;
}

function clampPollMs(ms) {
  return Math.min(250, Math.max(100, Math.floor(ms / 2)));
}

function streamFpsFromInterval(ms) {
  if (!Number.isFinite(ms) || ms < 200) return 15;
  return Math.min(30, Math.max(1, Math.round(1000 / ms)));
}

/**
 * @typedef {object} StreamMeta
 * @property {string} streamId
 * @property {'p2p'|'sfu'} mode
 * @property {string} [sourceUrl]
 * @property {{ pageUrl: string, selector: string, intervalMs: number }} [capture]
 */

/**
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {Array<RTCIceServer>} params.iceServers
 * @param {HTMLVideoElement} params.previewVideo
 * @param {HTMLCanvasElement} params.captureCanvas
 * @param {(text: string) => void} [params.onStatus]
 */
export function createStreamerController({
  socket,
  iceServers,
  previewVideo,
  captureCanvas,
  onStatus,
}) {
  /** @type {StreamMeta | null} */
  let activeMeta = null;
  let localStream = null;
  let hlsInstance = null;
  let captureSessionId = null;
  let pollTimer = null;
  let lastSeq = -1;
  let starting = false;
  let stopping = false;

  const ctx = captureCanvas.getContext("2d");

  function setStatus(text) {
    onStatus?.(text);
  }

  function isRunning() {
    return Boolean(localStream || starting);
  }

  function getActiveStreamId() {
    return activeMeta?.streamId ?? null;
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
        await fetch(`/api/captured-stream/stop/${id}`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }
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
          void stop();
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
          await drawDataUrlToCanvas(j.image);
          setStatus(`Streaming · frame ${j.seq}`);
        }
      } catch (e) {
        setStatus(`Network error: ${e.message}`);
      }
    }, pollEvery);
  }

  function teardownPublisher() {
    publishCtx.stopped = true;
    for (const [viewerSocketId] of peerConnections) {
      cleanupPeer(viewerSocketId);
    }
    closeSfuPublisherPc();
    if (activeMeta) {
      const isSfu = activeMeta.mode === "sfu";
      if (isSfu) {
        socket.emit("sfu-unregister-streamer", { streamId: activeMeta.streamId });
      } else {
        socket.emit("unregister-streamer", { streamId: activeMeta.streamId });
      }
    }
    publishCtx.streamId = null;
    publishCtx.mediaStream = null;
  }

  function stopMediaTracks() {
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
      localStream = null;
    }
    destroyHls();
    previewVideo.srcObject = null;
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }

  async function startHlsSource(sourceUrl) {
    previewVideo.crossOrigin = "anonymous";
    previewVideo.muted = true;
    previewVideo.playsInline = true;

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
          previewVideo
            .play()
            .then(() => finish(null))
            .catch((e) => finish(e));
        });
        hlsInstance.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (data?.fatal) {
            finish(
              new Error(`${data.type || "HLS"}: ${data.details || "fatal error"}`)
            );
          }
        });
        hlsInstance.loadSource(sourceUrl);
        hlsInstance.attachMedia(previewVideo);
      } else if (
        previewVideo.canPlayType("application/vnd.apple.mpegurl") ||
        previewVideo.canPlayType("application/x-mpegURL")
      ) {
        previewVideo.src = sourceUrl;
        previewVideo.addEventListener(
          "loadedmetadata",
          () => {
            previewVideo
              .play()
              .then(() => finish(null))
              .catch((e) => finish(e));
          },
          { once: true }
        );
        previewVideo.addEventListener(
          "error",
          () => finish(new Error("Failed to load m3u8 (native)")),
          { once: true }
        );
      } else {
        finish(new Error("HLS is not supported in this browser"));
      }
    });

    return previewVideo.captureStream();
  }

  async function startUrlSource(sourceUrl) {
    if (looksLikeM3u8Url(sourceUrl)) {
      return startHlsSource(sourceUrl);
    }

    previewVideo.src = sourceUrl;
    previewVideo.crossOrigin = "anonymous";
    previewVideo.loop = true;
    previewVideo.muted = true;

    await new Promise((resolve, reject) => {
      previewVideo.onloadeddata = resolve;
      previewVideo.onerror = () =>
        reject(new Error("Failed to load video from URL"));
    });
    await previewVideo.play();
    return previewVideo.captureStream();
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: false,
    });
    previewVideo.srcObject = stream;
    return stream;
  }

  async function startWebCapture(capture) {
    const { pageUrl, selector, intervalMs } = capture;
    setStatus("Starting Puppeteer capture on server…");

    const r = await fetch("/api/captured-stream/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl, selector, intervalMs }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(j.error || r.statusText);
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

    startFramePolling(usedInterval);
    const fps = streamFpsFromInterval(usedInterval);
    return captureCanvas.captureStream(fps);
  }

  function attachPublisher(streamId, mode, mediaStream) {
    bindPublisherHandlersOnce();
    publishCtx.streamId = streamId;
    publishCtx.mode = mode;
    publishCtx.mediaStream = mediaStream;
    publishCtx.stopped = false;
    publishCtx.isSfu = mode === "sfu";

    if (mode === "sfu") {
      socket.emit("sfu-register-streamer", { streamId });
      setStatus("Registering with relay server…");
    } else {
      socket.emit("register-streamer", { streamId });
      setStatus("Registered. Waiting for viewer connections…");
    }
  }

  const peerConnections = new Map();
  let sfuPublisherPc = null;
  const publishCtx = {
    streamId: null,
    mode: null,
    mediaStream: null,
    stopped: true,
    isSfu: false,
  };
  let handlersBound = false;

  function closeSfuPublisherPc() {
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
    const { streamId, mediaStream } = publishCtx;
    const pc = new RTCPeerConnection({ iceServers });
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
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        cleanupPeer(viewerSocketId);
      }
    };
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        pc.addTrack(track, mediaStream);
      }
    }
    peerConnections.set(viewerSocketId, pc);
    return pc;
  }

  async function publishSfuOffer() {
    const { streamId, mediaStream, stopped, isSfu } = publishCtx;
    if (stopped || !isSfu || !mediaStream) return;
    closeSfuPublisherPc();
    sfuPublisherPc = new RTCPeerConnection({ iceServers });
    sfuPublisherPc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("sfu-publisher-ice", { streamId, candidate: event.candidate });
      }
    };
    for (const track of mediaStream.getTracks()) {
      sfuPublisherPc.addTrack(track, mediaStream);
    }
    const offer = await sfuPublisherPc.createOffer();
    await sfuPublisherPc.setLocalDescription(offer);
    socket.emit("sfu-publisher-offer", { streamId, offer: sfuPublisherPc.localDescription });
  }

  function bindPublisherHandlersOnce() {
    if (handlersBound) return;
    handlersBound = true;

    socket.on("sfu-publish-ready", () => {
      void publishSfuOffer().catch((err) => {
        console.error(err);
        setStatus("SFU publish failed: " + (err?.message || err));
      });
    });

    socket.on("sfu-publisher-answer", async ({ streamId: sid, answer }) => {
      if (sid !== publishCtx.streamId || !sfuPublisherPc || !answer) return;
      try {
        await sfuPublisherPc.setRemoteDescription(answer);
        setStatus("Connected to relay server. Waiting for viewers…");
      } catch (err) {
        setStatus("Failed to apply SFU answer: " + err.message);
      }
    });

    socket.on("sfu-publisher-ice", async ({ streamId: sid, candidate }) => {
      if (sid !== publishCtx.streamId || !sfuPublisherPc || !candidate) return;
      try {
        await sfuPublisherPc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("SFU publisher ICE", err);
      }
    });

    socket.on("sfu-error", ({ message }) => {
      setStatus("SFU error: " + (message || "unknown"));
    });

    socket.on("viewer-request-offer", async ({ streamId: sid, viewerSocketId }) => {
      if (sid !== publishCtx.streamId || publishCtx.stopped || !publishCtx.mediaStream) {
        return;
      }
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
        socket.emit("offer", { streamId: publishCtx.streamId, viewerSocketId, offer });
        setStatus(`Sending stream to viewer ${viewerSocketId}`);
      } catch (error) {
        console.error("Create offer failed:", error);
      }
    });

    socket.on("answer", async ({ streamId: sid, viewerSocketId, answer }) => {
      if (sid !== publishCtx.streamId) return;
      const pc = peerConnections.get(viewerSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
      } catch (err) {
        console.error("Apply answer failed:", err);
      }
    });

    socket.on("ice-candidate", async ({ streamId: sid, fromSocketId, candidate }) => {
      if (sid !== publishCtx.streamId) return;
      const pc = peerConnections.get(fromSocketId);
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });
  }

  /**
   * @param {StreamMeta} meta
   * @returns {Promise<MediaStream>}
   */
  async function start(meta) {
    if (starting || stopping) {
      throw new Error("Streamer busy");
    }
    if (localStream && activeMeta?.streamId === meta.streamId) {
      return localStream;
    }

    await stop();

    starting = true;
    activeMeta = meta;

    try {
      setStatus("Starting stream…");

      if (meta.capture?.pageUrl && meta.capture?.selector) {
        localStream = await startWebCapture(meta.capture);
      } else if (meta.sourceUrl?.trim()) {
        localStream = await startUrlSource(meta.sourceUrl.trim());
      } else {
        localStream = await startCamera();
      }

      attachPublisher(meta.streamId, meta.mode, localStream);
      setStatus(
        meta.mode === "sfu"
          ? "Live · relay registered"
          : "Live · waiting for external viewers"
      );
      return localStream;
    } catch (err) {
      await stop();
      throw err;
    } finally {
      starting = false;
    }
  }

  async function stop() {
    if (stopping) return;
    stopping = true;
    try {
      teardownPublisher();
      await stopPuppeteerSession();
      stopMediaTracks();
      if (ctx) {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
      }
      activeMeta = null;
      setStatus("Stream stopped.");
    } finally {
      stopping = false;
    }
  }

  socket.on("captured-stream-stop-request", ({ streamId: sid }) => {
    if (sid !== activeMeta?.streamId) return;
    void stop();
  });

  return {
    start,
    stop,
    isRunning,
    getActiveStreamId,
  };
}
