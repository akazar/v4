import {
  recognizeOnVideoOverlay,
  drawDetectionsOnOverlay,
  configHasLocalRecognition,
  configHasServerRecognition,
} from "/streaming/process.js";
import { createScheduledActionsManager } from "/lib/scheduled-actions-manager.js";
import { fetchIceServersForPage } from "/lib/ice-servers.js";
import { registerP2pWebRtcEvents } from "/streaming/dashboard-events/p2p-webrtc.js";
import { registerServerWebRtcEvents } from "/streaming/dashboard-events/server-webrtc.js";

const DEFAULT_CONFIG_PATH = "/db/configs/public/config-default.js";

/**
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {(detections: object[], config: object, useServerPath: boolean) => void} params.onDetections
 * @param {() => void} params.onConfigChange
 */
export async function createViewerPanel({ socket, onDetections, onConfigChange }) {
  const iceServers = await fetchIceServersForPage();
  const mount = document.getElementById("viewerMount");

  /** @type {string | null} */
  let activeStreamId = null;
  /** @type {'p2p' | 'sfu'} */
  let activeMode = "p2p";
  let isLocalSource = false;

  const configCache = new Map();
  let discoveredConfigPaths = null;

  const localScheduledActionsManager = createScheduledActionsManager({
    actionsProperty: "localRecognitionActions",
    fallbackActionProperties: [],
    loadConfig: async (configName) => {
      const cfgPath = `/db/configs/public/${configName}.js`;
      return loadConfig(cfgPath);
    },
  });

  /** @type {Map<string, object>} */
  const streamState = new Map();

  /** @type {Map<string, 'p2p'|'sfu'>} */
  const streamModesMap = new Map();

  /** Dynamic list proxy so dashboard event modules filter by active remote stream. */
  const dynamicStreamIds = {
    includes(streamId) {
      return (
        !isLocalSource &&
        typeof streamId === "string" &&
        streamId === activeStreamId
      );
    },
  };

  async function loadConfig(path) {
    if (configCache.has(path)) return configCache.get(path);
    const mod = await import(path);
    const cfg = mod.default || mod.CONFIG;
    configCache.set(path, cfg);
    return cfg;
  }

  function labelForConfigPath(path) {
    const parts = path.split("/");
    const file = parts[parts.length - 1] || path;
    return file.replace("config-", "").replace(".js", "") || file;
  }

  function configNameFromPath(path) {
    const parts = String(path || "").split("/");
    const file = parts[parts.length - 1] || "";
    return file.replace(/\.(js|json)$/i, "");
  }

  async function getConfigPaths() {
    if (discoveredConfigPaths) return discoveredConfigPaths;
    try {
      const res = await fetch("/api/configurations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          discoveredConfigPaths = data
            .filter((name) => typeof name === "string" && name.endsWith(".js"))
            .map((name) => `/db/configs/public/${name}`);
          if (!discoveredConfigPaths.includes(DEFAULT_CONFIG_PATH)) {
            discoveredConfigPaths.unshift(DEFAULT_CONFIG_PATH);
          }
          return discoveredConfigPaths;
        }
      }
    } catch (err) {
      console.warn("Failed to list configs", err);
    }
    discoveredConfigPaths = [DEFAULT_CONFIG_PATH];
    return discoveredConfigPaths;
  }

  function shouldUseServerRecognitionForStream(streamId, cfg) {
    if (configHasLocalRecognition(cfg)) return false;
    if (!configHasServerRecognition(cfg)) return false;
    return streamModesMap.get(streamId) === "sfu";
  }

  function getActiveRecognitionContext(cfg, streamId) {
    if (!cfg || typeof cfg !== "object") return null;
    const mode = streamId ? streamModesMap.get(streamId) || "p2p" : "p2p";
    const useServer =
      mode === "sfu" &&
      configHasServerRecognition(cfg) &&
      !configHasLocalRecognition(cfg);

    if (useServer && cfg.serverRecognition) {
      return { path: "Server", block: cfg.serverRecognition };
    }
    if (cfg.localRecognition) {
      return { path: "Local", block: cfg.localRecognition };
    }
    if (cfg.serverRecognition) {
      return { path: "Server", block: cfg.serverRecognition };
    }
    return null;
  }

  function hasParamOverrides(overrides) {
    return (
      overrides &&
      (overrides.threshold != null || overrides.interval != null)
    );
  }

  function buildEffectiveConfig(cfg, streamId, overrides) {
    if (!cfg || !hasParamOverrides(overrides)) return cfg;
    const ctx = getActiveRecognitionContext(cfg, streamId);
    if (!ctx) return cfg;

    const blockKey = ctx.path === "Server" ? "serverRecognition" : "localRecognition";
    const block = { ...ctx.block };
    if (overrides.threshold != null) block.threshold = overrides.threshold;
    if (overrides.interval != null) block.interval = overrides.interval;
    return { ...cfg, [blockKey]: block };
  }

  function parseThresholdInput(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return null;
    return n;
  }

  function parseIntervalInput(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 200 || n > 60000) return null;
    return n;
  }

  /** @returns {{ label: string, displayValue: string, paramKey?: string, editable?: boolean, rawValue?: number, overridden?: boolean }[]} */
  function buildConfigParamItems(cfg, streamId, overrides = {}) {
    const ctx = getActiveRecognitionContext(cfg, streamId);
    if (!ctx) {
      return [{ label: "Recognition", displayValue: "Not configured" }];
    }

    const { path, block } = ctx;
    /** @type {ReturnType<typeof buildConfigParamItems>} */
    const items = [{ label: "Path", displayValue: path }];

    if (block.model) {
      items.push({ label: "Model", displayValue: String(block.model) });
    }

    if (block.threshold != null) {
      const overridden = overrides.threshold != null;
      const value = overridden ? overrides.threshold : block.threshold;
      items.push({
        label: "Threshold",
        displayValue: String(value),
        paramKey: "threshold",
        editable: true,
        rawValue: value,
        overridden,
      });
    }

    if (block.interval != null) {
      const overridden = overrides.interval != null;
      const value = overridden ? overrides.interval : block.interval;
      items.push({
        label: "Interval",
        displayValue: `${value} ms`,
        paramKey: "interval",
        editable: true,
        rawValue: value,
        overridden,
      });
    }

    if (block.iouThreshold != null) {
      items.push({ label: "IoU", displayValue: String(block.iouThreshold) });
    }
    if (Array.isArray(block.classes)) {
      items.push({ label: "Classes", displayValue: String(block.classes.length) });
    }
    if (block.maxResults != null) {
      items.push({ label: "Max results", displayValue: String(block.maxResults) });
    }

    return items;
  }

  function renderConfigParamCards(container, cfg, streamId, paramEditCtx) {
    if (!container) return;

    paramEditCtx?.cancelActiveEdit?.();

    container.innerHTML = "";
    const overrides = paramEditCtx?.getOverrides?.() || {};

    for (const item of buildConfigParamItems(cfg, streamId, overrides)) {
      const card = document.createElement("div");
      card.className = "viewer-config-param-card";

      const labelEl = document.createElement("span");
      labelEl.className = "viewer-config-param-label";
      labelEl.textContent = item.label;

      const valueRow = document.createElement("div");
      valueRow.className = "viewer-config-param-value-row";

      const valueEl = document.createElement("span");
      valueEl.className = "viewer-config-param-value";
      if (item.overridden) {
        valueEl.classList.add("viewer-config-param-value--override");
      }
      valueEl.textContent = item.displayValue;

      valueRow.appendChild(valueEl);

      if (item.editable && item.paramKey && paramEditCtx) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "viewer-config-param-edit";
        editBtn.title = `Edit ${item.label.toLowerCase()}`;
        editBtn.setAttribute("aria-label", `Edit ${item.label.toLowerCase()}`);
        editBtn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          paramEditCtx.cancelActiveEdit?.();

          const input = document.createElement("input");
          input.type = "number";
          input.className = "viewer-config-param-input";
          input.value = String(item.rawValue ?? "");
          if (item.paramKey === "threshold") {
            input.min = "0";
            input.max = "1";
            input.step = "0.01";
          } else {
            input.min = "200";
            input.max = "60000";
            input.step = "1";
          }

          const finishEdit = (apply) => {
            paramEditCtx.cancelActiveEdit = null;
            editBtn.hidden = false;
            if (!apply) {
              valueRow.replaceChild(valueEl, input);
              return;
            }

            const parsed =
              item.paramKey === "threshold"
                ? parseThresholdInput(input.value)
                : parseIntervalInput(input.value);

            if (parsed == null) {
              valueRow.replaceChild(valueEl, input);
              valueEl.classList.add("viewer-config-param-value--invalid");
              setTimeout(() => valueEl.classList.remove("viewer-config-param-value--invalid"), 600);
              return;
            }

            paramEditCtx.onOverrideApplied?.(item.paramKey, parsed, cfg);
          };

          paramEditCtx.cancelActiveEdit = () => finishEdit(false);

          valueEl.replaceWith(input);
          editBtn.hidden = true;
          input.focus();
          input.select();

          input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              input.blur();
            } else if (ev.key === "Escape") {
              ev.preventDefault();
              finishEdit(false);
            }
          });
          input.addEventListener("blur", () => finishEdit(true));
        });

        valueRow.appendChild(editBtn);
      }

      card.appendChild(labelEl);
      card.appendChild(valueRow);
      container.appendChild(card);
    }
  }

  function showPlaceholder(text) {
    if (!mount) return;
    mount.innerHTML = "";
    const el = document.createElement("div");
    el.className = "viewer-placeholder";
    el.textContent = text;
    mount.appendChild(el);
  }

  function createVideoCard(streamId) {
    if (!mount) return null;

    mount.innerHTML = "";
    const stack = document.createElement("div");
    stack.className = "viewer-stack";
    stack.dataset.streamId = streamId;

    const wrapper = document.createElement("div");
    wrapper.className = "viewer-card";
    wrapper.dataset.streamId = streamId;

    const title = document.createElement("h3");
    title.className = "viewer-card-title";
    title.textContent = `Stream: ${streamId}`;

    const modeBadge = document.createElement("div");
    modeBadge.className = "viewer-card-mode";
    const mode = streamModesMap.get(streamId) || "p2p";
    modeBadge.textContent =
      mode === "sfu" ? "WebRTC server streaming" : "Peer-to-peer WebRTC";

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
    status.textContent = "Waiting for stream…";

    const recognitionCheckbox = document.createElement("input");
    recognitionCheckbox.type = "checkbox";
    recognitionCheckbox.className = "viewer-card-recognition-checkbox";
    recognitionCheckbox.id = `recognition-${streamId}`;
    recognitionCheckbox.title = "Enable object recognition";

    const configTrigger = document.createElement("button");
    configTrigger.type = "button";
    configTrigger.className = "viewer-card-config-trigger";
    configTrigger.title = "Config";
    configTrigger.setAttribute("aria-label", "Recognition config");
    configTrigger.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;

    const configDropdown = document.createElement("div");
    configDropdown.className = "viewer-card-config-dropdown";
    configDropdown.hidden = true;

    const configNameEl = document.createElement("span");
    configNameEl.className = "viewer-config-name";
    configNameEl.textContent = labelForConfigPath(DEFAULT_CONFIG_PATH);

    const paramEditCtx = {
      getOverrides: () => ({}),
      onOverrideApplied: null,
      onConfigReset: null,
      cancelActiveEdit: null,
    };

    const configParamsEl = document.createElement("div");
    configParamsEl.className = "viewer-config-params";
    renderConfigParamCards(configParamsEl, null, streamId, paramEditCtx);

    async function refreshConfigSummary(path, { resetOverrides = true } = {}) {
      const cfgPath = path || DEFAULT_CONFIG_PATH;
      const label = labelForConfigPath(cfgPath);
      configNameEl.textContent = label;
      configTrigger.title = `Selected config: ${label}`;
      if (resetOverrides) {
        paramEditCtx.onConfigReset?.();
      }
      try {
        const cfg = await loadConfig(cfgPath);
        renderConfigParamCards(configParamsEl, cfg, streamId, paramEditCtx);
        return cfg;
      } catch {
        paramEditCtx.cancelActiveEdit?.();
        configParamsEl.innerHTML = "";
        const card = document.createElement("div");
        card.className = "viewer-config-param-card viewer-config-param-card--error";
        card.innerHTML =
          '<span class="viewer-config-param-label">Config</span><span class="viewer-config-param-value">Load failed</span>';
        configParamsEl.appendChild(card);
        return null;
      }
    }

    const recognitionBar = document.createElement("div");
    recognitionBar.className = "viewer-recognition-bar";

    const recognitionBarTop = document.createElement("div");
    recognitionBarTop.className = "viewer-recognition-bar-top";

    const recognitionLabel = document.createElement("label");
    recognitionLabel.className = "viewer-recognition-label";
    recognitionLabel.htmlFor = recognitionCheckbox.id;
    recognitionLabel.appendChild(recognitionCheckbox);
    recognitionLabel.append(" Object recognition");

    const configWrap = document.createElement("div");
    configWrap.className = "viewer-config-wrap";
    configWrap.appendChild(configNameEl);
    configWrap.appendChild(configTrigger);
    configWrap.appendChild(configDropdown);

    recognitionBarTop.appendChild(recognitionLabel);
    recognitionBarTop.appendChild(configWrap);
    recognitionBar.appendChild(recognitionBarTop);
    recognitionBar.appendChild(configParamsEl);

    configTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      configDropdown.hidden = !configDropdown.hidden;
      if (!configDropdown.hidden) {
        const closeOnOutside = (e2) => {
          if (!recognitionBar.contains(e2.target)) {
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

    function syncVideoWrapperAspect() {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        videoWrapper.style.aspectRatio = `${vw} / ${vh}`;
      } else {
        videoWrapper.style.aspectRatio = "16 / 9";
      }
      videoWrapper.style.width = "";
      videoWrapper.style.height = "";
      videoWrapper.style.margin = "";
    }

    video.addEventListener("loadedmetadata", syncVideoWrapperAspect);
    video.addEventListener("resize", syncVideoWrapperAspect);
    video.addEventListener("emptied", syncVideoWrapperAspect);

    wrapper.appendChild(videoWrapper);
    wrapper.appendChild(title);
    wrapper.appendChild(modeBadge);
    wrapper.appendChild(status);

    stack.appendChild(wrapper);
    stack.appendChild(recognitionBar);
    mount.appendChild(stack);

    void (async () => {
      try {
        const paths = await getConfigPaths();
        configDropdown.innerHTML = "";
        for (const path of paths) {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "viewer-card-config-item";
          item.dataset.configPath = path;
          item.textContent = labelForConfigPath(path);
          configDropdown.appendChild(item);
        }
        configTrigger.title = `Selected config: ${labelForConfigPath(DEFAULT_CONFIG_PATH)}`;
        void refreshConfigSummary(DEFAULT_CONFIG_PATH);
      } catch {
        configDropdown.innerHTML = "";
        const item = document.createElement("button");
        item.type = "button";
        item.className = "viewer-card-config-item";
        item.dataset.configPath = DEFAULT_CONFIG_PATH;
        item.textContent = labelForConfigPath(DEFAULT_CONFIG_PATH);
        configDropdown.appendChild(item);
        void refreshConfigSummary(DEFAULT_CONFIG_PATH);
      }
    })();

    return {
      stack,
      wrapper,
      video,
      videoWrapper,
      status,
      overlay,
      recognitionCheckbox,
      configTrigger,
      configDropdown,
      configNameEl,
      configParamsEl,
      paramEditCtx,
      refreshConfigSummary,
      syncVideoWrapperAspect,
    };
  }

  function ensureStreamCard(streamId) {
    let state = streamState.get(streamId);
    if (state) return state;

    const card = createVideoCard(streamId);
    if (!card) return null;

    const {
      wrapper,
      video,
      videoWrapper,
      status,
      overlay,
      recognitionCheckbox,
      configTrigger,
      configDropdown,
      configParamsEl,
      paramEditCtx,
      refreshConfigSummary,
      syncVideoWrapperAspect,
    } = card;

    state = {
      streamId,
      pc: null,
      sfuPc: null,
      streamerSocketId: null,
      wrapperEl: wrapper,
      videoEl: video,
      videoWrapperEl: videoWrapper,
      syncVideoWrapperAspect,
      statusEl: status,
      overlayEl: overlay,
      recognitionIntervalId: null,
      recognitionCheckboxEl: recognitionCheckbox,
      configTriggerEl: configTrigger,
      configDropdownEl: configDropdown,
      configParamsEl,
      configPath: DEFAULT_CONFIG_PATH,
      currentConfig: null,
      paramOverrides: {},
      refreshConfigSummary,
      serverRecognitionActive: false,
      lastServerVideoSize: null,
    };

    paramEditCtx.getOverrides = () => state.paramOverrides;
    paramEditCtx.onConfigReset = () => {
      state.paramOverrides = {};
    };
    paramEditCtx.onOverrideApplied = (key, value, baseCfg) => {
      const ctx = getActiveRecognitionContext(baseCfg, streamId);
      const baseBlock = ctx?.block;
      if (baseBlock && baseBlock[key] === value) {
        delete state.paramOverrides[key];
      } else {
        state.paramOverrides[key] = value;
      }
      const cfg = state.currentConfig || baseCfg;
      renderConfigParamCards(state.configParamsEl, cfg, streamId, paramEditCtx);
      if (state.recognitionCheckboxEl.checked && state.videoEl.srcObject) {
        void syncRecognitionWithStream();
      }
    };

    function stopLocalRecognitionInterval() {
      if (state.recognitionIntervalId) {
        clearInterval(state.recognitionIntervalId);
        state.recognitionIntervalId = null;
      }
    }

    function clearOverlay() {
      const ctx = state.overlayEl.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, state.overlayEl.width, state.overlayEl.height);
    }

    function stopServerRecognitionSubscription() {
      if (state.serverRecognitionActive) {
        socket.emit("sfu-server-recognition-unsubscribe", {
          streamId: state.streamId,
        });
        state.serverRecognitionActive = false;
      }
      state.lastServerVideoSize = null;
    }

    function trySubscribeServerRecognition(cfg) {
      const sid = state.streamId;
      if (!shouldUseServerRecognitionForStream(sid, cfg)) return false;
      stopLocalRecognitionInterval();
      const effectiveCfg = buildEffectiveConfig(cfg, sid, state.paramOverrides);
      const payload = {
        streamId: sid,
        configPath: state.configPath || DEFAULT_CONFIG_PATH,
        configName: configNameFromPath(state.configPath || DEFAULT_CONFIG_PATH),
      };
      if (hasParamOverrides(state.paramOverrides)) {
        payload.config = effectiveCfg;
      }
      socket.emit("sfu-server-recognition-subscribe", payload);
      state.serverRecognitionActive = true;
      return true;
    }

    async function syncRecognitionWithStream() {
      if (!state.recognitionCheckboxEl.checked || !state.videoEl.srcObject) return;
      try {
        const baseCfg =
          state.currentConfig ||
          (await loadConfig(state.configPath || DEFAULT_CONFIG_PATH));
        state.currentConfig = baseCfg;
        const cfg = buildEffectiveConfig(
          baseCfg,
          state.streamId,
          state.paramOverrides
        );
        stopLocalRecognitionInterval();
        stopServerRecognitionSubscription();
        clearOverlay();

        if (trySubscribeServerRecognition(baseCfg)) {
          return;
        }

        if (!configHasLocalRecognition(baseCfg)) {
          return;
        }

        const intervalMs = cfg.localRecognition?.interval ?? 1000;
        const configName = configNameFromPath(state.configPath || DEFAULT_CONFIG_PATH);
        await localScheduledActionsManager.register(state.streamId, configName);

        const runLocalRecognitionTick = async () => {
          const detections = await recognizeOnVideoOverlay(
            state.videoEl,
            cfg,
            state.overlayEl
          );
          if (state.recognitionCheckboxEl.checked && detections?.length) {
            onDetections(detections, cfg, false);
          }
          await localScheduledActionsManager.process(state.streamId, detections || []);
        };
        void runLocalRecognitionTick();
        state.recognitionIntervalId = setInterval(() => {
          void runLocalRecognitionTick();
        }, intervalMs);
      } catch (err) {
        console.error("Recognition failed", streamId, err);
      }
    }

    function stopRecognitionForStream() {
      stopLocalRecognitionInterval();
      stopServerRecognitionSubscription();
      localScheduledActionsManager.unregister(state.streamId);
      clearOverlay();
    }

    recognitionCheckbox.addEventListener("change", () => {
      if (recognitionCheckbox.checked) {
        void syncRecognitionWithStream();
      } else {
        stopRecognitionForStream();
      }
    });

    configDropdown.addEventListener("click", async (e) => {
      const item = e.target.closest(".viewer-card-config-item");
      if (!item?.dataset.configPath) return;
      const path = item.dataset.configPath;
      state.configPath = path;
      configDropdown.hidden = true;
      onConfigChange();
      try {
        const cfg = await refreshConfigSummary(path, { resetOverrides: true });
        state.currentConfig = cfg ?? (await loadConfig(path));
        if (state.recognitionIntervalId) {
          clearInterval(state.recognitionIntervalId);
          state.recognitionIntervalId = null;
        }
        if (recognitionCheckbox.checked && state.videoEl.srcObject) {
          void syncRecognitionWithStream();
        }
      } catch (err) {
        console.error("Config load failed", path, err);
      }
    });

    void refreshConfigSummary(DEFAULT_CONFIG_PATH).then((cfg) => {
      if (cfg) state.currentConfig = cfg;
    });

    state.syncRecognitionWithStream = syncRecognitionWithStream;
    state.stopRecognitionForStream = stopRecognitionForStream;

    streamState.set(streamId, state);
    return state;
  }

  function setStreamStatus(streamId, text) {
    const state = ensureStreamCard(streamId);
    if (state) state.statusEl.textContent = text;
  }

  function tryStartVideoPlayback(videoEl) {
    const tryPlay = () => {
      void videoEl.play().catch(() => {
        if (!videoEl.muted) {
          videoEl.muted = true;
          void videoEl.play().catch(() => {});
        }
      });
    };
    tryPlay();
    videoEl.addEventListener("loadedmetadata", tryPlay, { once: true });
    videoEl.addEventListener("canplay", tryPlay, { once: true });
  }

  function onDashboardRemoteStream(streamId, state, remoteStream) {
    state.videoEl.srcObject = remoteStream;
    const isSfu = streamModesMap.get(streamId) === "sfu";
    setStreamStatus(streamId, isSfu ? "Live (server relay)" : "Live");
    tryStartVideoPlayback(state.videoEl);
    state.videoEl.addEventListener(
      "loadedmetadata",
      () => state.syncVideoWrapperAspect?.(),
      { once: true }
    );
    if (state.recognitionCheckboxEl.checked) {
      void state.syncRecognitionWithStream();
    }
  }

  function ensureStreamCardWrapper(streamId) {
    return ensureStreamCard(streamId);
  }

  registerP2pWebRtcEvents({
    socket,
    streamIds: dynamicStreamIds,
    streamModes: streamModesMap,
    streamState,
    ensureStreamCard: ensureStreamCardWrapper,
    setStreamStatus,
    onDashboardRemoteStream,
    iceServers,
  });

  registerServerWebRtcEvents({
    socket,
    streamIds: dynamicStreamIds,
    streamModes: streamModesMap,
    streamState,
    shouldUseServerRecognitionForStream,
    drawDetectionsOnOverlay: (videoEl, detections, overlayEl, cfg, size) => {
      const state = activeStreamId ? streamState.get(activeStreamId) : null;
      const effectiveCfg =
        state && cfg
          ? buildEffectiveConfig(cfg, activeStreamId, state.paramOverrides)
          : cfg;
      drawDetectionsOnOverlay(
        videoEl,
        detections,
        overlayEl,
        effectiveCfg,
        size
      );
      if (
        state?.recognitionCheckboxEl?.checked &&
        detections?.length &&
        effectiveCfg
      ) {
        onDetections(detections, effectiveCfg, true);
      }
    },
    ensureStreamCard: ensureStreamCardWrapper,
    setStreamStatus,
    onDashboardRemoteStream,
    iceServers,
  });

  function teardownStreamState(streamId) {
    const state = streamState.get(streamId);
    if (!state) return;
    state.stopRecognitionForStream?.();
    if (state.pc) {
      state.pc.close();
      state.pc = null;
    }
    if (state.sfuPc) {
      state.sfuPc.close();
      state.sfuPc = null;
    }
    state.videoEl.srcObject = null;
    streamState.delete(streamId);
  }

  function unregisterRemoteViewer(streamId) {
    if (!streamId || isLocalSource) return;
    // Re-register with empty to avoid stale PCs; server keeps old subscriptions harmlessly.
    socket.emit("register-viewer", { streamIds: [] });
  }

  function registerRemoteViewer(streamId) {
    if (!streamId || isLocalSource) return;
    socket.emit("register-viewer", { streamIds: [streamId] });
    if (streamModesMap.get(streamId) === "sfu") {
      socket.emit("sfu-register-viewer", { streamIds: [streamId] });
    }
    socket.emit("viewer-request-offer", { streamId });
  }

  function setLocalStream(streamId, mode, mediaStream) {
    activeStreamId = streamId;
    activeMode = mode;
    isLocalSource = true;
    streamModesMap.set(streamId, mode);

    unregisterRemoteViewer(streamId);
    teardownStreamState(streamId);

    const state = ensureStreamCard(streamId);
    if (!state) return;

    void state.refreshConfigSummary?.(state.configPath || DEFAULT_CONFIG_PATH);

    state.videoEl.srcObject = mediaStream;
    setStreamStatus(streamId, "Live (local publisher)");
    tryStartVideoPlayback(state.videoEl);
    state.syncVideoWrapperAspect?.();
    state.videoEl.addEventListener(
      "loadedmetadata",
      () => state.syncVideoWrapperAspect?.(),
      { once: true }
    );
    if (state.recognitionCheckboxEl.checked) {
      void state.syncRecognitionWithStream();
    }
  }

  function connectRemote(streamId, mode) {
    if (isLocalSource && activeStreamId === streamId) return;

    if (activeStreamId && activeStreamId !== streamId) {
      teardownStreamState(activeStreamId);
    }

    activeStreamId = streamId;
    activeMode = mode;
    isLocalSource = false;
    streamModesMap.set(streamId, mode);

    const state = ensureStreamCard(streamId);
    void state?.refreshConfigSummary?.(state.configPath || DEFAULT_CONFIG_PATH);
    setStreamStatus(streamId, "Connecting to remote streamer…");
    registerRemoteViewer(streamId);
  }

  function teardown() {
    if (activeStreamId) {
      teardownStreamState(activeStreamId);
      unregisterRemoteViewer(activeStreamId);
    }
    activeStreamId = null;
    isLocalSource = false;
    showPlaceholder("Select a stream and press Play, or connect to a remote stream.");
  }

  function switchStream(streamId, mode) {
    if (!streamId) {
      teardown();
      return;
    }
    activeStreamId = streamId;
    activeMode = mode;
    streamModesMap.set(streamId, mode);

    if (isLocalSource) {
      showPlaceholder("Press Play to start the selected stream.");
      return;
    }

    connectRemote(streamId, mode);
  }

  socket.on("streamer-unavailable", ({ streamId }) => {
    if (streamId !== activeStreamId) return;
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
    state.stopRecognitionForStream?.();
    setStreamStatus(streamId, "Streamer offline");
  });

  showPlaceholder("Select a stream and press Play, or connect to a remote stream.");

  window.addEventListener("resize", () => {
    if (!activeStreamId) return;
    const state = streamState.get(activeStreamId);
    state?.syncVideoWrapperAspect?.();
  });

  return {
    setLocalStream,
    connectRemote,
    teardown,
    switchStream,
    clearLocalSourceFlag() {
      isLocalSource = false;
    },
  };
}
