/* Multi-stream WebRTC viewer dashboard: P2P or SFU playback, optional local or server-driven recognition. */
import {
  recognizeOnVideoOverlay,
  drawDetectionsOnOverlay,
  configHasLocalRecognition,
} from './process.js';
import { registerP2pWebRtcEvents } from './dashboard-events/p2p-webrtc.js';
import { registerServerWebRtcEvents } from './dashboard-events/server-webrtc.js';

// Socket.IO client for signaling, SFU negotiation, and server recognition events.
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
// Parse modes query in stream order so each id maps to p2p or sfu (server relay).
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

// Per-stream UI and WebRTC state keyed by streamId from the URL.
const streamState = new Map();

// Returns whether the loaded config defines a server-side recognition block.
function configHasServerRecognition(cfg) {
  return (
    cfg &&
    typeof cfg === 'object' &&
    cfg.serverRecognition != null &&
    typeof cfg.serverRecognition === 'object'
  );
}

// True when this stream uses SFU and the config relies on server recognition (no localRecognition object).
function shouldUseServerRecognitionForStream(streamId, cfg) {
  if (configHasLocalRecognition(cfg)) return false;
  if (!configHasServerRecognition(cfg)) return false;
  return streamModes.get(streamId) === 'sfu';
}

// Default config and dynamic config list handling.
const DEFAULT_CONFIG_PATH = '/config/public/config-default.js';

const configCache = new Map();
let discoveredConfigPaths = null;

// Dynamically imports a public config module once and caches the exported CONFIG object.
async function loadConfig(path) {
  if (configCache.has(path)) {
    return configCache.get(path);
  }
  const mod = await import(path);
  const cfg = mod.default || mod.CONFIG;
  configCache.set(path, cfg);
  return cfg;
}

// Turns a config file path into a short label for the dropdown (e.g. config-default.js → default).
function labelForConfigPath(path) {
  const parts = path.split('/');
  const file = parts[parts.length - 1] || path;
  return file.replace('config-', '').replace('.js', '') || file;
}

function configNameFromPath(path) {
  const parts = String(path || '').split('/');
  const file = parts[parts.length - 1] || '';
  return file.replace(/\.(js|json)$/i, '');
}

// Loads selectable config URLs by querying server-side directory listing for config/public.
async function getConfigPaths() {
  if (discoveredConfigPaths) {
    return discoveredConfigPaths;
  }

  // Ask the server for actual files present in config/public.
  try {
    const res = await fetch('/api/configurations', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        discoveredConfigPaths = data
          .filter((name) => typeof name === 'string' && name.endsWith('.js'))
          .map((name) => `/config/public/${name}`);
        // Ensure default is present.
        if (!discoveredConfigPaths.includes(DEFAULT_CONFIG_PATH)) {
          discoveredConfigPaths.unshift(DEFAULT_CONFIG_PATH);
        }
        return discoveredConfigPaths;
      }
    }
  } catch (err) {
    console.warn('Failed to list configs from /api/configurations.', err);
  }

  // When no index is available, use only the default config.
  discoveredConfigPaths = [DEFAULT_CONFIG_PATH];
  return discoveredConfigPaths;
}

// Builds the DOM for one stream card: video, overlay canvas, recognition toggle, and config menu shell.
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

  // Populate config choices asynchronously once the index (or fallback list) is loaded.
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

// Returns existing card state or creates a new card, wiring recognition and config handlers.
function ensureStreamCard(streamId) {
  let state = streamState.get(streamId);
  if (state) return state;

  const { wrapper, video, status, overlay, recognitionCheckbox, configTrigger, configDropdown } = createVideoCard(streamId);

  state = {
    streamId,
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
    serverRecognitionActive: false,
    lastServerVideoSize: null,
  };

  // Clears the repeating timer that runs in-browser recognition on the video overlay.
  function stopLocalRecognitionInterval() {
    if (state.recognitionIntervalId) {
      clearInterval(state.recognitionIntervalId);
      state.recognitionIntervalId = null;
    }
  }

  // Erases drawn bounding boxes from the stream’s overlay canvas.
  function clearOverlay() {
    const ctx = state.overlayEl.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, state.overlayEl.width, state.overlayEl.height);
  }

  // Tells the server to drop this viewer from SFU recognition and clears local subscription flags.
  function stopServerRecognitionSubscription() {
    if (state.serverRecognitionActive) {
      // Server: leave the sfu-srvrec room and decrement recognition refcount for this stream.
      socket.emit("sfu-server-recognition-unsubscribe", {
        streamId: state.streamId,
      });
      state.serverRecognitionActive = false;
    }
    state.lastServerVideoSize = null;
  }

  // If allowed for this stream and config, stops local loops and asks the server to stream detection results.
  function trySubscribeServerRecognition(cfg) {
    const sid = state.streamId;
    if (!shouldUseServerRecognitionForStream(sid, cfg)) return false;
    stopLocalRecognitionInterval();
    // Server: join recognition room, load configPath, start I420→recognize loop at serverRecognition.interval.
    socket.emit("sfu-server-recognition-subscribe", {
      streamId: sid,
      configPath: state.configPath || DEFAULT_CONFIG_PATH,
      configName: configNameFromPath(state.configPath || DEFAULT_CONFIG_PATH),
    });
    state.serverRecognitionActive = true;
    return true;
  }

  // Restarts recognition for the current checkbox, config, and media (either SFU subscribe or local interval).
  async function syncRecognitionWithStream() {
    if (!state.recognitionCheckboxEl.checked || !state.videoEl.srcObject) return;
    try {
      const cfg =
        state.currentConfig ||
        (await loadConfig(state.configPath || DEFAULT_CONFIG_PATH));
      state.currentConfig = cfg;
      stopLocalRecognitionInterval();
      stopServerRecognitionSubscription();
      clearOverlay();

      if (trySubscribeServerRecognition(cfg)) {
        return;
      }

      const intervalMs = cfg.localRecognition?.interval ?? 1000;
      void recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
      state.recognitionIntervalId = setInterval(() => {
        recognizeOnVideoOverlay(state.videoEl, cfg, state.overlayEl);
      }, intervalMs);
    } catch (err) {
      console.error("Failed to start recognition for stream", streamId, err);
    }
  }

  // Entry point when the user enables the recognition checkbox on this card.
  function startRecognitionForStream() {
    void syncRecognitionWithStream();
  }

  // Stops local timers, unsubscribes from server recognition, and clears the overlay.
  function stopRecognitionForStream() {
    stopLocalRecognitionInterval();
    stopServerRecognitionSubscription();
    clearOverlay();
  }

  // Toggle recognition on or off for this card (starts or stops local/SFU recognition).
  recognitionCheckbox.addEventListener("change", () => {
    if (recognitionCheckbox.checked) {
      startRecognitionForStream();
    } else {
      stopRecognitionForStream();
    }
  });

  // Pick a config file path from the dropdown and reload recognition if it is running.
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
        void syncRecognitionWithStream();
      }
    } catch (err) {
      console.error("Failed to load config", state.configPath, err);
    }
  });

  state.syncRecognitionWithStream = syncRecognitionWithStream;
  state.stopRecognitionForStream = stopRecognitionForStream;

  streamState.set(streamId, state);
  return state;
}

// Updates the status line under a stream card, creating the card if it does not exist yet.
function setStreamStatus(streamId, text) {
  const state = ensureStreamCard(streamId);
  state.statusEl.textContent = text;
}

// Attaches the remote MediaStream to the video element and refreshes recognition if it is enabled.
function onDashboardRemoteStream(streamId, state, remoteStream) {
  state.videoEl.srcObject = remoteStream;
  const isSfu = streamModes.get(streamId) === "sfu";
  setStreamStatus(streamId, isSfu ? "Live (server relay)" : "Live");
  if (state.recognitionCheckboxEl.checked) {
    void state.syncRecognitionWithStream();
  }
}

for (const streamId of streamIds) {
  ensureStreamCard(streamId);
}

registerP2pWebRtcEvents({
  socket,
  streamIds,
  streamModes,
  streamState,
  ensureStreamCard,
  setStreamStatus,
  onDashboardRemoteStream,
});

registerServerWebRtcEvents({
  socket,
  streamIds,
  streamModes,
  streamState,
  shouldUseServerRecognitionForStream,
  drawDetectionsOnOverlay,
  ensureStreamCard,
  setStreamStatus,
  onDashboardRemoteStream,
});

// Server: register this tab as a viewer for the requested stream ids (P2P signaling book-keeping).
socket.emit("register-viewer", { streamIds });
const sfuStreamIds = streamIds.filter((id) => streamModes.get(id) === "sfu");
if (sfuStreamIds.length) {
  socket.emit("sfu-register-viewer", { streamIds: sfuStreamIds });
}

// Server → viewer: streamer left; tear down PCs, clear video, and stop any recognition for that stream.
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
  state.stopRecognitionForStream?.();
  setStreamStatus(streamId, "Streamer offline");
});
