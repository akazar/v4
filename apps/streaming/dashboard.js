import { recognizeOnVideoOverlay } from './process.js';

const socket = io();

const params = new URLSearchParams(window.location.search);
const streamIds = (params.get("streams") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const modesList = (params.get("modes") || "")
  .split(",")
  .map((s) => s.trim().toLowerCase());

/** @type {Map<string, 'p2p' | 'sfu'>} */
const streamModes = new Map();
streamIds.forEach((id, i) => {
  const m = modesList[i] || "p2p";
  streamModes.set(
    id,
    m === "sfu" || m === "server" || m === "webrtc-server" ? "sfu" : "p2p"
  );
});

const streamsText = document.getElementById("streamsText");
const videoGrid = document.getElementById("videoGrid");

streamsText.textContent = streamIds.length ? streamIds.join(", ") : "(none)";

const streamState = new Map();

// Default config and dynamic config list handling.
const DEFAULT_CONFIG_PATH = '/config/public/config-default.js';

const configCache = new Map();
let discoveredConfigPaths = null;

async function loadConfig(path) {
  if (configCache.has(path)) {
    return configCache.get(path);
  }
  const mod = await import(path);
  const cfg = mod.default || mod.CONFIG;
  configCache.set(path, cfg);
  return cfg;
}

function labelForConfigPath(path) {
  const parts = path.split('/');
  const file = parts[parts.length - 1] || path;
  return file.replace('config-', '').replace('.js', '') || file;
}

async function getConfigPaths() {
  if (discoveredConfigPaths) {
    return discoveredConfigPaths;
  }

  // Try to get dynamic list from optional index file first.
  try {
    const res = await fetch('/config/public/config-index.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        discoveredConfigPaths = data.map((name) =>
          name.startsWith('/config/public/')
            ? name
            : `/config/public/${name}`
        );
        // Ensure default is present.
        if (!discoveredConfigPaths.includes(DEFAULT_CONFIG_PATH)) {
          discoveredConfigPaths.unshift(DEFAULT_CONFIG_PATH);
        }
        return discoveredConfigPaths;
      }
    }
  } catch (err) {
    console.warn('Failed to load config index (/config/public/config-index.json).', err);
  }

  // When no index is available, use only the default config.
  discoveredConfigPaths = [DEFAULT_CONFIG_PATH];
  return discoveredConfigPaths;
}

function createVideoCard(streamId) {
  const wrapper = document.createElement("div");
  wrapper.className = "video-card";
  wrapper.dataset.streamId = streamId;

  const title = document.createElement("h3");
  title.textContent = `Stream: ${streamId}`;

  const modeBadge = document.createElement("div");
  modeBadge.className = "video-card-stream-mode";
  const mode = streamModes.get(streamId) || "p2p";
  modeBadge.textContent =
    mode === "sfu"
      ? "WebRTC server streaming"
      : "Peer-to-peer WebRTC";

  const videoWrapper = document.createElement("div");
  videoWrapper.className = "video-wrapper";

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.controls = true;

  const overlay = document.createElement("canvas");
  overlay.className = "video-overlay";

  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "Waiting for streamer...";

  const recognitionCheckbox = document.createElement("input");
  recognitionCheckbox.type = "checkbox";
  recognitionCheckbox.className = "video-card-recognition-checkbox";
  recognitionCheckbox.id = `recognition-${streamId}`;
  recognitionCheckbox.title = "Enable object recognition for this stream";
  recognitionCheckbox.checked = false;

  const configTrigger = document.createElement("button");
  configTrigger.type = "button";
  configTrigger.className = "video-card-config-trigger";
  configTrigger.setAttribute("aria-label", "Config");
  configTrigger.title = "Config";
  configTrigger.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;

  const configDropdown = document.createElement("div");
  configDropdown.className = "video-card-config-dropdown";
  configDropdown.hidden = true;
  configDropdown.innerHTML = "<span class=\"video-card-config-loading\">Loading…</span>";

  configTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    configDropdown.hidden = !configDropdown.hidden;
    if (!configDropdown.hidden) {
      const closeOnOutside = (e2) => {
        if (!wrapper.contains(e2.target)) {
          configDropdown.hidden = true;
          document.removeEventListener("click", closeOnOutside);
        }
      };
      setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
    }
  });
  configDropdown.addEventListener("click", (e) => e.stopPropagation());

  videoWrapper.appendChild(video);
  videoWrapper.appendChild(overlay);

  const cardToolbar = document.createElement("div");
  cardToolbar.className = "video-card-toolbar";
  cardToolbar.appendChild(recognitionCheckbox);
  cardToolbar.appendChild(configTrigger);

  wrapper.appendChild(title);
  wrapper.appendChild(modeBadge);
  wrapper.appendChild(videoWrapper);
  wrapper.appendChild(cardToolbar);
  wrapper.appendChild(configDropdown);
  wrapper.appendChild(status);
  videoGrid.appendChild(wrapper);

  void (async () => {
    try {
      const paths = await getConfigPaths();
      configDropdown.innerHTML = "";
      for (const path of paths) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "video-card-config-item";
        item.dataset.configPath = path;
        item.textContent = labelForConfigPath(path);
        configDropdown.appendChild(item);
      }
      configTrigger.title = `Selected config: ${labelForConfigPath(DEFAULT_CONFIG_PATH)}`;
    } catch (err) {
      console.error("Failed to populate config list", err);
      configDropdown.innerHTML = "";
      const item = document.createElement("button");
      item.type = "button";
      item.className = "video-card-config-item";
      item.dataset.configPath = DEFAULT_CONFIG_PATH;
      item.textContent = labelForConfigPath(DEFAULT_CONFIG_PATH);
      configDropdown.appendChild(item);
      configTrigger.title = `Selected config: ${labelForConfigPath(DEFAULT_CONFIG_PATH)}`;
    }
  })();

  return { wrapper, video, status, overlay, recognitionCheckbox, configTrigger, configDropdown };
}

function ensureStreamCard(streamId) {
  let state = streamState.get(streamId);
  if (state) return state;

  const { wrapper, video, status, overlay, recognitionCheckbox, configTrigger, configDropdown } = createVideoCard(streamId);

  state = {
    pc: null,
    sfuPc: null,
    streamerSocketId: null,
    wrapperEl: wrapper,
    videoEl: video,
    statusEl: status,
    overlayEl: overlay,
    recognitionIntervalId: null,
    recognitionCheckboxEl: recognitionCheckbox,
    configTriggerEl: configTrigger,
    configDropdownEl: configDropdown,
    configPath: DEFAULT_CONFIG_PATH,
    currentConfig: null,
  };

  function startRecognitionForStream() {
    if (!state.videoEl.srcObject) return;
    (async () => {
      try {
        const cfg = state.currentConfig || await loadConfig(state.configPath || DEFAULT_CONFIG_PATH);
        state.currentConfig = cfg;
        if (state.recognitionIntervalId) {
          clearInterval(state.recognitionIntervalId);
          state.recognitionIntervalId = null;
        }
        const intervalMs = cfg.localRecognition?.interval ?? 1000;
        void recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        state.recognitionIntervalId = setInterval(() => {
          recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        }, intervalMs);
      } catch (err) {
        console.error("Failed to start recognition for stream", streamId, err);
      }
    })();
  }

  function stopRecognitionForStream() {
    if (state.recognitionIntervalId) {
      clearInterval(state.recognitionIntervalId);
      state.recognitionIntervalId = null;
    }
    const ctx = state.overlayEl.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, state.overlayEl.width, state.overlayEl.height);
  }

  recognitionCheckbox.addEventListener("change", () => {
    if (recognitionCheckbox.checked) {
      startRecognitionForStream();
    } else {
      stopRecognitionForStream();
    }
  });

  configDropdown.addEventListener("click", async (e) => {
    const item = e.target.closest(".video-card-config-item");
    if (!item || !item.dataset.configPath) return;
    const path = item.dataset.configPath;
    state.configPath = path;
    configDropdown.hidden = true;
    state.configTriggerEl.title = `Selected config: ${labelForConfigPath(path)}`;
    try {
      const cfg = await loadConfig(state.configPath);
      state.currentConfig = cfg;

      if (state.recognitionIntervalId) {
        clearInterval(state.recognitionIntervalId);
        state.recognitionIntervalId = null;
      }

      if (recognitionCheckbox.checked && state.videoEl.srcObject) {
        const intervalMs = cfg.localRecognition?.interval ?? 1000;
        void recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        state.recognitionIntervalId = setInterval(() => {
          recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        }, intervalMs);
      }
    } catch (err) {
      console.error("Failed to load config", state.configPath, err);
    }
  });

  streamState.set(streamId, state);
  return state;
}

function setStreamStatus(streamId, text) {
  const state = ensureStreamCard(streamId);
  state.statusEl.textContent = text;
}

function onDashboardRemoteStream(streamId, state, remoteStream) {
  state.videoEl.srcObject = remoteStream;
  const isSfu = streamModes.get(streamId) === "sfu";
  setStreamStatus(streamId, isSfu ? "Live (server relay)" : "Live");
  if (state.recognitionCheckboxEl.checked) {
    const startRecognition = async () => {
      try {
        const cfg = state.currentConfig || await loadConfig(state.configPath || DEFAULT_CONFIG_PATH);
        state.currentConfig = cfg;
        if (state.recognitionIntervalId) clearInterval(state.recognitionIntervalId);
        const intervalMs = cfg.localRecognition?.interval ?? 1000;
        void recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        state.recognitionIntervalId = setInterval(() => {
          recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
        }, intervalMs);
      } catch (err) {
        console.error("Failed to start recognition for stream", streamId, err);
      }
    };
    void startRecognition();
  }
}

function createPeerConnection(streamId, streamerSocketId) {
  const state = ensureStreamCard(streamId);

  if (state.pc) {
    state.pc.close();
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        streamId,
        targetSocketId: streamerSocketId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream) {
      onDashboardRemoteStream(streamId, state, remoteStream);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[viewer] ${streamId}:`, pc.connectionState);

    if (pc.connectionState === "connected") {
      setStreamStatus(streamId, "Connected");
    }

    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      state.videoEl.srcObject = null;
      if (state.recognitionIntervalId) {
        clearInterval(state.recognitionIntervalId);
        state.recognitionIntervalId = null;
      }
      if (pc.connectionState !== "closed") {
        setStreamStatus(streamId, "Connection lost");
      }
    }
  };

  state.pc = pc;
  state.streamerSocketId = streamerSocketId;

  return pc;
}

for (const streamId of streamIds) {
  ensureStreamCard(streamId);
}

socket.emit("register-viewer", { streamIds });
const sfuStreamIds = streamIds.filter((id) => streamModes.get(id) === "sfu");
if (sfuStreamIds.length) {
  socket.emit("sfu-register-viewer", { streamIds: sfuStreamIds });
}

socket.on("streamer-available", ({ streamId }) => {
  if (!streamIds.includes(streamId)) return;

  setStreamStatus(streamId, "Streamer is available. Requesting connection...");
  if (streamModes.get(streamId) === "sfu") return;
  socket.emit("viewer-request-offer", { streamId });
});

socket.on("streamer-unavailable", ({ streamId }) => {
  const state = streamState.get(streamId);
  if (!state) return;

  if (state.pc) {
    state.pc.close();
    state.pc = null;
  }
  if (state.sfuPc) {
    state.sfuPc.close();
    state.sfuPc = null;
  }

  state.videoEl.srcObject = null;
  state.streamerSocketId = null;
  if (state.recognitionIntervalId) {
    clearInterval(state.recognitionIntervalId);
    state.recognitionIntervalId = null;
  }
  setStreamStatus(streamId, "Streamer offline");
});

socket.on("offer", async ({ streamId, streamerSocketId, offer }) => {
  if (!streamIds.includes(streamId)) return;
  if (streamModes.get(streamId) === "sfu") return;

  try {
    const pc = createPeerConnection(streamId, streamerSocketId);

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
      streamId,
      streamerSocketId,
      answer,
    });

    setStreamStatus(streamId, "Answer sent. Waiting for media...");
  } catch (error) {
    console.error(`Error handling offer for ${streamId}:`, error);
    setStreamStatus(streamId, "Error during negotiation");
  }
});

socket.on("ice-candidate", async ({ streamId, fromSocketId, candidate }) => {
  const state = streamState.get(streamId);
  if (!state || !state.pc || !candidate) return;

  if (state.streamerSocketId && state.streamerSocketId !== fromSocketId) {
    return;
  }

  try {
    await state.pc.addIceCandidate(candidate);
  } catch (error) {
    console.error(`Error adding ICE candidate for ${streamId}:`, error);
  }
});

socket.on("sfu-viewer-offer", async ({ streamId, offer }) => {
  if (!streamIds.includes(streamId)) return;
  if (streamModes.get(streamId) !== "sfu" || !offer) return;

  const state = ensureStreamCard(streamId);
  if (state.sfuPc) {
    try {
      state.sfuPc.close();
    } catch {
      /* ignore */
    }
    state.sfuPc = null;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sfu-ice-from-viewer", {
        streamId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream) {
      onDashboardRemoteStream(streamId, state, remoteStream);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[viewer SFU] ${streamId}:`, pc.connectionState);
    if (pc.connectionState === "connected") {
      setStreamStatus(streamId, "Connected (relay)");
    }
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      state.videoEl.srcObject = null;
      if (state.recognitionIntervalId) {
        clearInterval(state.recognitionIntervalId);
        state.recognitionIntervalId = null;
      }
      if (pc.connectionState !== "closed") {
        setStreamStatus(streamId, "Relay connection lost");
      }
    }
  };

  state.sfuPc = pc;

  try {
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("sfu-viewer-answer", {
      streamId,
      answer: pc.localDescription,
    });
    setStreamStatus(streamId, "Answer sent to relay. Waiting for media…");
  } catch (error) {
    console.error(`Error handling SFU offer for ${streamId}:`, error);
    setStreamStatus(streamId, "SFU negotiation error");
  }
});

socket.on("sfu-ice-to-viewer", async ({ streamId, candidate }) => {
  const state = streamState.get(streamId);
  if (!state?.sfuPc || !candidate) return;
  try {
    await state.sfuPc.addIceCandidate(candidate);
  } catch (error) {
    console.error(`Error adding SFU ICE for ${streamId}:`, error);
  }
});

socket.on("sfu-error", ({ message }) => {
  console.warn("SFU:", message);
});
