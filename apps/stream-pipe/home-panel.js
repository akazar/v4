/**
 * Left panel: stream creation, selection, play/stop, saved groups.
 * Reuses streaming home localStorage keys for cross-app sync.
 */

const HOME_STREAMS_STORAGE_KEY = "streaming-home-streams-v1";
const HOME_SAVED_GROUPS_KEY = "streaming-home-saved-groups-v1";

/**
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {(streamId: string) => void} params.onActiveChange
 * @param {(streamId: string) => void | Promise<void>} params.onPlay
 * @param {() => void | Promise<void>} params.onStop
 * @param {(streamId: string) => boolean} params.isLocallyPublishing
 * @param {() => string | null} params.getPublishingStreamId
 */
export function createHomePanel({
  socket,
  onActiveChange,
  onPlay,
  onStop,
  isLocallyPublishing,
  getPublishingStreamId,
}) {
  const sourceNameInput = document.getElementById("sourceNameInput");
  const sourceUrlInput = document.getElementById("sourceUrlInput");
  const panelSourceCamera = document.getElementById("panel-source-camera");
  const panelSourceM3u8 = document.getElementById("panel-source-m3u8");
  const panelSourceCapture = document.getElementById("panel-source-capture");
  const panelSourceQr = document.getElementById("panel-source-qr");
  const homeCapturePageUrl = document.getElementById("homeCapturePageUrl");
  const homeCaptureSelector = document.getElementById("homeCaptureSelector");
  const homeCaptureInterval = document.getElementById("homeCaptureInterval");
  const homeSourceTabButtons = document.querySelectorAll("[data-home-source-tab]");
  const openStreamerBtn = document.getElementById("openStreamerBtn");
  const saveSelectedStreamsBtn = document.getElementById("saveSelectedStreamsBtn");
  const streamsContainer = document.getElementById("streamsContainer");
  const savedStreamsContainer = document.getElementById("savedStreamsContainer");
  const createStatus = document.getElementById("createStatus");
  const viewerStatus = document.getElementById("viewerStatus");
  const savedStreamsStatus = document.getElementById("savedStreamsStatus");

  let serverStreams = [];
  const preGeneratedStreams = new Set();
  /** @type {Map<string, 'p2p'|'sfu'>} */
  const streamTypes = new Map();
  /** @type {Map<string, string>} */
  const streamSourceUrls = new Map();
  /** @type {Map<string, { pageUrl: string, selector: string, intervalMs: number }>} */
  const streamCaptureParams = new Map();
  /** streamId -> created via QR tab (mobile camera streamer) */
  const qrStreamIds = new Set();
  /** Streams seen from the server; kept until Remove is clicked */
  const stickyStreamIds = new Set();
  const hiddenStreamIds = new Set();

  /** @type {{ id: string, streamIds: string[] }[]} */
  let savedStreamGroups = [];

  let activeStreamId = null;
  let qrInstance = null;

  function normalizeStreamName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40);
  }

  function generateStreamId() {
    const segment = () =>
      Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, "");
    return `stream-${segment()}${segment()}`.slice(0, 20);
  }

  function generateSavedGroupId() {
    return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function setCreateStatus(text) {
    if (createStatus) createStatus.textContent = text;
  }

  function setViewerStatus(text) {
    if (viewerStatus) viewerStatus.textContent = text;
  }

  function setSavedStreamsStatus(text) {
    if (savedStreamsStatus) savedStreamsStatus.textContent = text;
  }

  function looksLikeM3u8Url(url) {
    const u = String(url || "").trim().toLowerCase();
    if (!u) return false;
    if (u.includes(".m3u8")) return true;
    if (u.includes("format=m3u8") || u.includes("type=m3u8")) return true;
    return false;
  }

  function getMergedStreams() {
    return [
      ...new Set([...serverStreams, ...preGeneratedStreams, ...stickyStreamIds]),
    ]
      .filter((id) => !hiddenStreamIds.has(id))
      .sort((a, b) => a.localeCompare(b));
  }

  function getActiveHomeSourceTab() {
    if (!panelSourceCamera?.hidden) return "camera";
    if (!panelSourceM3u8?.hidden) return "m3u8";
    if (!panelSourceCapture?.hidden) return "capture";
    if (!panelSourceQr?.hidden) return "qr";
    return "camera";
  }

  function setHomeSourceTab(tab) {
    const t =
      tab === "m3u8"
        ? "m3u8"
        : tab === "capture"
          ? "capture"
          : tab === "qr"
            ? "qr"
            : "camera";
    if (panelSourceCamera) panelSourceCamera.hidden = t !== "camera";
    if (panelSourceM3u8) panelSourceM3u8.hidden = t !== "m3u8";
    if (panelSourceCapture) panelSourceCapture.hidden = t !== "capture";
    if (panelSourceQr) panelSourceQr.hidden = t !== "qr";
    homeSourceTabButtons.forEach((btn) => {
      const on = btn.dataset.homeSourceTab === t;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function getSelectedCreationStreamMode() {
    if (getActiveHomeSourceTab() === "capture") {
      const el = document.querySelector(
        'input[name="streamModeChoiceCapture"]:checked'
      );
      return el?.value === "sfu" ? "sfu" : "p2p";
    }
    const el = document.querySelector('input[name="streamModeChoice"]:checked');
    return el?.value === "sfu" ? "sfu" : "p2p";
  }

  function availableStreamListModeSuffix(streamId) {
    const st = streamTypes.get(streamId) === "sfu" ? "sfu" : "p2p";
    if (streamCaptureParams.has(streamId)) {
      return st === "sfu"
        ? " · Web capture · WebRTC server streaming"
        : " · Web capture";
    }
    const sourceUrl = (streamSourceUrls.get(streamId) || "").trim();
    if (sourceUrl) {
      return st === "sfu"
        ? " · M3U8 URL · WebRTC server streaming"
        : " · M3U8 URL";
    }
    return st === "sfu"
      ? " · WebRTC server streaming"
      : " · Peer-to-peer WebRTC";
  }

  function streamerOpenUrl(streamId, mode) {
    const capture = streamCaptureParams.get(streamId);
    if (capture) {
      const q = new URLSearchParams();
      q.set("streamId", streamId);
      if (mode === "sfu") q.set("streamMode", "sfu");
      q.set("pageUrl", capture.pageUrl);
      q.set("selector", capture.selector);
      q.set("intervalMs", String(capture.intervalMs));
      return `/streaming/captured-stream-streamer.html?${q.toString()}`;
    }
    const source = (streamSourceUrls.get(streamId) || "").trim();
    if (source && looksLikeM3u8Url(source)) {
      const modeQ = mode === "sfu" ? `&streamMode=${encodeURIComponent("sfu")}` : "";
      const sourceQ = `&source=${encodeURIComponent(source)}`;
      return `/streaming/m3u8-streamer.html?streamId=${encodeURIComponent(streamId)}${modeQ}${sourceQ}`;
    }
    const modeQ = mode === "sfu" ? `&streamMode=${encodeURIComponent("sfu")}` : "";
    const sourceQ = source ? `&source=${encodeURIComponent(source)}` : "";
    return `/stream-pipe/streamer.html?streamId=${encodeURIComponent(streamId)}${modeQ}${sourceQ}`;
  }

  function buildStreamMeta(streamId) {
    const mode = streamTypes.get(streamId) === "sfu" ? "sfu" : "p2p";
    /** @type {{ streamId: string, mode: 'p2p'|'sfu', sourceUrl?: string, capture?: object }} */
    const meta = { streamId, mode };
    const sourceUrl = (streamSourceUrls.get(streamId) || "").trim();
    if (sourceUrl) meta.sourceUrl = sourceUrl;
    const capture = streamCaptureParams.get(streamId);
    if (capture) meta.capture = capture;
    return meta;
  }

  function setActiveStream(streamId) {
    activeStreamId = streamId;
    renderStreams(getMergedStreams());
    onActiveChange(streamId);
  }

  function renderStreams(streams) {
    if (!streamsContainer) return;
    streamsContainer.innerHTML = "";

    if (!streams.length) {
      const empty = document.createElement("div");
      empty.className = "status";
      empty.textContent = "No active streams yet.";
      streamsContainer.appendChild(empty);
      return;
    }

    const publishingId = getPublishingStreamId();

    for (const streamId of streams) {
      const item = document.createElement("label");
      item.className = "stream-item";
      if (streamId === activeStreamId) {
        item.classList.add("stream-item-active");
      }

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "activeStream";
      radio.value = streamId;
      radio.checked = streamId === activeStreamId;
      radio.addEventListener("change", () => {
        if (radio.checked) setActiveStream(streamId);
      });

      const text = document.createElement("span");
      text.textContent = streamId;

      const modeLabel = document.createElement("span");
      modeLabel.className = "stream-item-mode";
      modeLabel.textContent = availableStreamListModeSuffix(streamId);

      const actions = document.createElement("div");
      actions.className = "stream-item-actions";

      const isLive = publishingId === streamId;
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = isLive ? "play-btn play-btn--live" : "play-btn";
      playBtn.textContent = "▶";
      playBtn.title = isLive ? "Streaming (local)" : "Start stream";
      playBtn.disabled = isLive;
      playBtn.setAttribute("aria-pressed", isLive ? "true" : "false");
      playBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveStream(streamId);
        void onPlay(streamId);
      });

      const stopBtn = document.createElement("button");
      stopBtn.type = "button";
      stopBtn.className = isLive ? "stop-btn stop-btn--live" : "stop-btn";
      stopBtn.textContent = "■";
      stopBtn.title = isLive ? "Stop stream" : "Stop stream (not running)";
      stopBtn.disabled = !isLive;
      stopBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void onStop();
      });

      const qrBtn = document.createElement("button");
      qrBtn.type = "button";
      qrBtn.textContent = "QR";
      qrBtn.title = "Show QR code for mobile streamer";
      qrBtn.className = "qr-btn";
      qrBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = streamTypes.get(streamId) || "p2p";
        const url = new URL(streamerOpenUrl(streamId, mode), location.href).href;
        showQrModal(url, streamId);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "remove-btn";
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeStream(streamId);
      });

      if (!qrStreamIds.has(streamId)) {
        actions.appendChild(playBtn);
        actions.appendChild(stopBtn);
      } else {
        actions.appendChild(qrBtn);
      }
      actions.appendChild(removeBtn);

      item.appendChild(radio);
      item.appendChild(text);
      item.appendChild(modeLabel);
      item.appendChild(actions);
      streamsContainer.appendChild(item);
    }
  }

  function removeStream(streamId) {
    if (isLocallyPublishing() && getPublishingStreamId() === streamId) {
      void onStop();
    }
    if (streamCaptureParams.has(streamId)) {
      socket.emit("captured-stream-stop-broadcast", { streamId });
    }
    preGeneratedStreams.delete(streamId);
    stickyStreamIds.delete(streamId);
    streamTypes.delete(streamId);
    streamSourceUrls.delete(streamId);
    streamCaptureParams.delete(streamId);
    qrStreamIds.delete(streamId);
    hiddenStreamIds.add(streamId);
    if (activeStreamId === streamId) {
      activeStreamId = null;
      onActiveChange(null);
    }
    saveHomeStreamsToStorage();
    removeStreamFromAllSavedGroups(streamId);
    renderStreams(getMergedStreams());
  }

  function buildHomeStreamsPayload() {
    const entries = [];
    for (const sid of preGeneratedStreams) {
      const mode = streamTypes.get(sid) === "sfu" ? "sfu" : "p2p";
      const sourceUrl = (streamSourceUrls.get(sid) || "").trim();
      const capture = streamCaptureParams.get(sid);
      const row = { streamId: sid, mode };
      if (sourceUrl) row.sourceUrl = sourceUrl;
      if (capture?.pageUrl && capture?.selector) {
        row.capture = {
          pageUrl: capture.pageUrl,
          selector: capture.selector,
          intervalMs: capture.intervalMs,
        };
      }
      if (qrStreamIds.has(sid)) {
        row.creationSource = "qr";
      }
      entries.push(row);
    }
    return { v: 1, entries, hidden: [...hiddenStreamIds] };
  }

  function syncHomeStreamsPayloadToServer(payload) {
    void fetch("/api/streaming/home-streams-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function saveHomeStreamsToStorage() {
    try {
      const payload = buildHomeStreamsPayload();
      localStorage.setItem(HOME_STREAMS_STORAGE_KEY, JSON.stringify(payload));
      syncHomeStreamsPayloadToServer(payload);
    } catch {
      /* quota */
    }
  }

  function loadHomeStreamsFromStorage() {
    try {
      const raw = localStorage.getItem(HOME_STREAMS_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.entries)) return;

      for (const id of Array.isArray(data.hidden) ? data.hidden : []) {
        if (typeof id === "string" && id) hiddenStreamIds.add(id);
      }

      for (const e of data.entries) {
        const streamId = e.streamId;
        if (typeof streamId !== "string" || !streamId || hiddenStreamIds.has(streamId)) {
          continue;
        }
        streamTypes.set(streamId, e.mode === "sfu" ? "sfu" : "p2p");
        if (typeof e.sourceUrl === "string" && e.sourceUrl.trim()) {
          streamSourceUrls.set(streamId, e.sourceUrl.trim());
        }
        if (
          e.capture &&
          typeof e.capture.pageUrl === "string" &&
          typeof e.capture.selector === "string"
        ) {
          const intervalMs = Number(e.capture.intervalMs);
          streamCaptureParams.set(streamId, {
            pageUrl: e.capture.pageUrl.trim(),
            selector: e.capture.selector.trim(),
            intervalMs:
              Number.isFinite(intervalMs) && intervalMs >= 200 && intervalMs <= 60000
                ? intervalMs
                : 1000,
          });
        }
        if (e.creationSource === "qr") {
          qrStreamIds.add(streamId);
        }
        preGeneratedStreams.add(streamId);
      }
    } catch {
      /* corrupt */
    }
  }

  function saveSavedStreamGroupsToStorage() {
    try {
      localStorage.setItem(
        HOME_SAVED_GROUPS_KEY,
        JSON.stringify({ v: 1, groups: savedStreamGroups })
      );
    } catch {
      /* quota */
    }
  }

  function loadSavedStreamGroupsFromStorage() {
    try {
      const raw = localStorage.getItem(HOME_SAVED_GROUPS_KEY);
      if (!raw) {
        savedStreamGroups = [];
        return;
      }
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.groups)) {
        savedStreamGroups = [];
        return;
      }
      savedStreamGroups = data.groups
        .filter(
          (g) =>
            g &&
            typeof g.id === "string" &&
            Array.isArray(g.streamIds) &&
            g.streamIds.length > 0
        )
        .map((g) => ({
          id: g.id,
          streamIds: [
            ...new Set(
              g.streamIds.filter(
                (sid) =>
                  typeof sid === "string" && sid.trim() && !hiddenStreamIds.has(sid)
              )
            ),
          ],
        }))
        .filter((g) => g.streamIds.length > 0);
    } catch {
      savedStreamGroups = [];
    }
  }

  function removeStreamFromAllSavedGroups(streamId) {
    const prev = JSON.stringify(savedStreamGroups);
    savedStreamGroups = savedStreamGroups
      .map((g) => ({
        id: g.id,
        streamIds: g.streamIds.filter((id) => id !== streamId),
      }))
      .filter((g) => g.streamIds.length > 0);
    if (JSON.stringify(savedStreamGroups) === prev) return;
    saveSavedStreamGroupsToStorage();
    renderSavedStreamsPanel();
  }

  function renderSavedStreamsPanel() {
    if (!savedStreamsContainer) return;
    savedStreamsContainer.innerHTML = "";

    if (!savedStreamGroups.length) {
      const empty = document.createElement("div");
      empty.className = "status";
      empty.textContent = 'No saved stream sets yet. Select a stream and click "Save active stream".';
      savedStreamsContainer.appendChild(empty);
      return;
    }

    for (const group of savedStreamGroups) {
      const row = document.createElement("div");
      row.className = "stream-item saved-stream-group";

      const summary = document.createElement("div");
      summary.className = "saved-stream-group-summary";
      summary.textContent = group.streamIds.join(", ");

      const actions = document.createElement("div");
      actions.className = "saved-stream-group-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", () => openSavedStreamGroup(group));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "remove-btn";
      removeBtn.addEventListener("click", () => removeSavedStreamGroup(group.id));

      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);
      row.appendChild(summary);
      row.appendChild(actions);
      savedStreamsContainer.appendChild(row);
    }
  }

  function openSavedStreamGroup(group) {
    const firstId = group.streamIds[0];
    if (!firstId) return;
    setActiveStream(firstId);
    void onPlay(firstId);
    setSavedStreamsStatus(`Opened saved set; active: ${firstId}`);
  }

  function removeSavedStreamGroup(groupId) {
    savedStreamGroups = savedStreamGroups.filter((g) => g.id !== groupId);
    saveSavedStreamGroupsToStorage();
    renderSavedStreamsPanel();
    setSavedStreamsStatus("Removed saved stream set.");
  }

  function showQrModal(url, streamId) {
    const modal = document.getElementById("qrModal");
    const canvas = document.getElementById("qrModalCanvas");
    const label = document.getElementById("qrModalLabel");
    const urlEl = document.getElementById("qrModalUrl");
    if (!modal || !canvas || !label) return;

    canvas.innerHTML = "";
    if (qrInstance) {
      qrInstance.clear();
      qrInstance = null;
    }

    label.textContent = streamId;
    if (urlEl) {
      urlEl.href = url;
      urlEl.textContent = url;
      urlEl.title = url;
    }

    qrInstance = new QRCode(canvas, {
      text: url,
      width: 220,
      height: 220,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    modal.classList.remove("hidden");
  }

  async function copyQrModalUrl() {
    const urlEl = document.getElementById("qrModalUrl");
    const copyBtn = document.getElementById("qrModalCopyBtn");
    const url = urlEl?.href;
    if (!url || url === "#") return;

    const showCopied = () => {
      if (!copyBtn) return;
      const prevTitle = copyBtn.title;
      copyBtn.title = "Copied!";
      copyBtn.classList.add("qr-modal-copy--done");
      setTimeout(() => {
        copyBtn.title = prevTitle || "Copy link";
        copyBtn.classList.remove("qr-modal-copy--done");
      }, 1500);
    };

    try {
      await navigator.clipboard.writeText(url);
      showCopied();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showCopied();
      } catch (err) {
        console.warn("Copy failed", err);
      }
    }
  }

  function hideQrModal() {
    document.getElementById("qrModal")?.classList.add("hidden");
  }

  homeSourceTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setHomeSourceTab(btn.dataset.homeSourceTab || "camera");
    });
  });

  openStreamerBtn?.addEventListener("click", () => {
    const tab = getActiveHomeSourceTab();

    if (tab === "capture") {
      const pageUrl = (homeCapturePageUrl?.value || "").trim();
      const selector = (homeCaptureSelector?.value || "").trim();
      const intervalMs = Number(homeCaptureInterval?.value);
      if (!pageUrl || !selector) {
        setCreateStatus("Web capture: enter page URL and CSS selector.");
        return;
      }
      if (!Number.isFinite(intervalMs) || intervalMs < 200 || intervalMs > 60000) {
        setCreateStatus("Web capture: interval must be between 200 and 60000 ms.");
        return;
      }
      const customName = normalizeStreamName(sourceNameInput?.value);
      const streamId = customName || generateStreamId();
      streamTypes.set(streamId, getSelectedCreationStreamMode());
      streamCaptureParams.set(streamId, { pageUrl, selector, intervalMs });
      preGeneratedStreams.add(streamId);
      saveHomeStreamsToStorage();
      renderStreams(getMergedStreams());
      setCreateStatus(`Stream "${streamId}" added (Web capture). Press Play to start.`);
      if (sourceNameInput) sourceNameInput.value = "";
      if (homeCapturePageUrl) homeCapturePageUrl.value = "";
      if (homeCaptureSelector) homeCaptureSelector.value = "";
      if (homeCaptureInterval) homeCaptureInterval.value = "1000";
      setActiveStream(streamId);
      return;
    }

    const customName = normalizeStreamName(sourceNameInput?.value);
    const streamId = customName || generateStreamId();
    streamTypes.set(streamId, getSelectedCreationStreamMode());
    preGeneratedStreams.add(streamId);

    const sourceUrl = tab === "m3u8" ? (sourceUrlInput?.value || "").trim() : "";
    if (sourceUrl) {
      streamSourceUrls.set(streamId, sourceUrl);
    }
    if (tab === "qr") {
      qrStreamIds.add(streamId);
    }
    saveHomeStreamsToStorage();
    renderStreams(getMergedStreams());
    if (sourceNameInput) sourceNameInput.value = "";
    if (sourceUrlInput) sourceUrlInput.value = "";
    setActiveStream(streamId);

    if (tab === "qr") {
      const mode = streamTypes.get(streamId) || "p2p";
      const url = new URL(streamerOpenUrl(streamId, mode), location.href).href;
      showQrModal(url, streamId);
      setCreateStatus(
        `Stream "${streamId}" added. Scan QR to open the camera streamer on mobile.`
      );
    } else {
      setCreateStatus(`Stream "${streamId}" added. Press Play to start.`);
    }
  });

  saveSelectedStreamsBtn?.addEventListener("click", () => {
    if (!activeStreamId) {
      setViewerStatus("Select a stream to save.");
      return;
    }
    savedStreamGroups.push({
      id: generateSavedGroupId(),
      streamIds: [activeStreamId],
    });
    saveSavedStreamGroupsToStorage();
    renderSavedStreamsPanel();
    setViewerStatus(`Saved stream: ${activeStreamId}`);
  });

  document.getElementById("qrModalClose")?.addEventListener("click", hideQrModal);
  document.getElementById("qrModalCopyBtn")?.addEventListener("click", () => {
    void copyQrModalUrl();
  });
  document.querySelector(".qr-modal-backdrop")?.addEventListener("click", hideQrModal);

  sourceNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") openStreamerBtn?.click();
  });
  sourceUrlInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") openStreamerBtn?.click();
  });

  socket.on("available-streams", ({ streams }) => {
    serverStreams = Array.isArray(streams) ? streams : [];
    serverStreams.forEach((id) => stickyStreamIds.add(id));
    renderStreams(getMergedStreams());
  });

  function requestStreams() {
    socket.emit("get-available-streams");
  }

  function refreshStreamList() {
    renderStreams(getMergedStreams());
  }

  function isStreamOnServer(streamId) {
    return serverStreams.includes(streamId) || stickyStreamIds.has(streamId);
  }

  loadHomeStreamsFromStorage();
  syncHomeStreamsPayloadToServer(buildHomeStreamsPayload());
  loadSavedStreamGroupsFromStorage();
  renderStreams(getMergedStreams());
  renderSavedStreamsPanel();
  requestStreams();

  return {
    getActiveStreamId: () => activeStreamId,
    getStreamMode: (streamId) => (streamTypes.get(streamId) === "sfu" ? "sfu" : "p2p"),
    buildStreamMeta,
    setActiveStream,
    refreshStreamList,
    isStreamOnServer,
  };
}
