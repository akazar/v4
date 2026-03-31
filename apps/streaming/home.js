const socket = io();

const sourceNameInput = document.getElementById("sourceNameInput");
const sourceUrlInput = document.getElementById("sourceUrlInput");
const panelSourceCamera = document.getElementById("panel-source-camera");
const panelSourceM3u8 = document.getElementById("panel-source-m3u8");
const panelSourceCapture = document.getElementById("panel-source-capture");
const homeCapturePageUrl = document.getElementById("homeCapturePageUrl");
const homeCaptureSelector = document.getElementById("homeCaptureSelector");
const homeCaptureInterval = document.getElementById("homeCaptureInterval");
const homeSourceTabButtons = document.querySelectorAll("[data-home-source-tab]");
const openStreamerBtn = document.getElementById("openStreamerBtn");
const refreshBtn = document.getElementById("refreshBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const openViewerBtn = document.getElementById("openViewerBtn");
const openViewerDashboardBtn = document.getElementById("openViewerDashboardBtn");
const saveSelectedStreamsBtn = document.getElementById("saveSelectedStreamsBtn");
const streamsContainer = document.getElementById("streamsContainer");
const savedStreamsContainer = document.getElementById("savedStreamsContainer");
const createStatus = document.getElementById("createStatus");
const viewerStatus = document.getElementById("viewerStatus");
const savedStreamsStatus = document.getElementById("savedStreamsStatus");

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

function setCreateStatus(text) {
  createStatus.textContent = text;
}

function setViewerStatus(text) {
  viewerStatus.textContent = text;
}

function setSavedStreamsStatus(text) {
  if (savedStreamsStatus) savedStreamsStatus.textContent = text;
}

/** True when the URL should be opened on the HLS streamer page (m3u8 / Apple HLS). */
function looksLikeM3u8Url(url) {
  const u = String(url || "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes(".m3u8")) return true;
  if (u.includes("format=m3u8") || u.includes("type=m3u8")) return true;
  return false;
}

function streamerPageForSource(source) {
  const s = String(source || "").trim();
  if (!s) return "streamer.html";
  return looksLikeM3u8Url(s) ? "m3u8-streamer.html" : "streamer.html";
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
    return `captured-stream-streamer.html?${q.toString()}`;
  }
  const modeQ =
    mode === "sfu" ? `&streamMode=${encodeURIComponent("sfu")}` : "";
  const source = (streamSourceUrls.get(streamId) || "").trim();
  const page = streamerPageForSource(source);
  const sourceQ = source
    ? `&source=${encodeURIComponent(source)}`
    : "";
  return `${page}?streamId=${encodeURIComponent(streamId)}${modeQ}${sourceQ}`;
}

function renderStreams(streams) {
  streamsContainer.innerHTML = "";

  if (!streams.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No active streams yet.";
    streamsContainer.appendChild(empty);
    return;
  }

  for (const streamId of streams) {
    const item = document.createElement("label");
    item.className = "stream-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = streamId;
    checkbox.className = "stream-checkbox";

    const text = document.createElement("span");
    text.textContent = streamId;

    const modeLabel = document.createElement("span");
    modeLabel.className = "stream-item-mode";
    const st = streamTypes.get(streamId) || "p2p";
    const capture = streamCaptureParams.has(streamId);
    if (capture) {
      modeLabel.textContent =
        st === "sfu"
          ? " · Web capture · WebRTC server streaming"
          : " · Web capture · Peer-to-peer WebRTC";
    } else {
      modeLabel.textContent =
        st === "sfu" ? " · WebRTC server streaming" : " · Peer-to-peer WebRTC";
    }

    const openLinkBtn = document.createElement("button");
    openLinkBtn.type = "button";
    openLinkBtn.textContent = "Open streamer";
    openLinkBtn.addEventListener("click", () => {
      const mode = streamTypes.get(streamId) || "p2p";
      window.open(streamerOpenUrl(streamId, mode), "_blank");
    });

    const qrBtn = document.createElement("button");
    qrBtn.type = "button";
    qrBtn.textContent = "QR";
    qrBtn.title = "Show QR code for mobile";
    qrBtn.className = "qr-btn";
    qrBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const mode = streamTypes.get(streamId) || "p2p";
      const url = new URL(streamerOpenUrl(streamId, mode), location.href).href;
      showQrModal(url, streamId);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.title = "Remove stream from list";
    removeBtn.className = "remove-btn";
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeStream(streamId);
    });

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(modeLabel);
    item.appendChild(openLinkBtn);
    item.appendChild(qrBtn);
    item.appendChild(removeBtn);

    streamsContainer.appendChild(item);
  }
}

function getSelectedStreams() {
  const checked = Array.from(
    document.querySelectorAll(".stream-checkbox:checked")
  );

  return checked.map((el) => el.value);
}

function requestStreams() {
  socket.emit("get-available-streams");
}

function getMergedStreams() {
  const combined = [
    ...new Set([...serverStreams, ...preGeneratedStreams, ...stickyStreamIds]),
  ].filter((id) => !hiddenStreamIds.has(id));
  return combined.sort((a, b) => a.localeCompare(b));
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

function getActiveHomeSourceTab() {
  if (!panelSourceCamera.hidden) return "camera";
  if (!panelSourceM3u8.hidden) return "m3u8";
  if (!panelSourceCapture.hidden) return "capture";
  return "camera";
}

function setHomeSourceTab(tab) {
  const t = tab === "m3u8" ? "m3u8" : tab === "capture" ? "capture" : "camera";
  panelSourceCamera.hidden = t !== "camera";
  panelSourceM3u8.hidden = t !== "m3u8";
  panelSourceCapture.hidden = t !== "capture";
  homeSourceTabButtons.forEach((btn) => {
    const on = btn.dataset.homeSourceTab === t;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
}

homeSourceTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setHomeSourceTab(btn.dataset.homeSourceTab || "camera");
  });
});

function removeStream(streamId) {
  if (streamCaptureParams.has(streamId)) {
    socket.emit("captured-stream-stop-broadcast", { streamId });
  }
  preGeneratedStreams.delete(streamId);
  stickyStreamIds.delete(streamId);
  streamTypes.delete(streamId);
  streamSourceUrls.delete(streamId);
  streamCaptureParams.delete(streamId);
  hiddenStreamIds.add(streamId);
  saveHomeStreamsToStorage();
  removeStreamFromAllSavedGroups(streamId);
  renderStreams(getMergedStreams());
}

openStreamerBtn.addEventListener("click", () => {
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
    const customName = normalizeStreamName(sourceNameInput.value);
    const streamId = customName || generateStreamId();
    streamTypes.set(streamId, getSelectedCreationStreamMode());
    streamCaptureParams.set(streamId, { pageUrl, selector, intervalMs });
    preGeneratedStreams.add(streamId);
    saveHomeStreamsToStorage();
    renderStreams(getMergedStreams());
    const modeLabel =
      streamTypes.get(streamId) === "sfu"
        ? "WebRTC server streaming."
        : "Peer-to-peer WebRTC.";
    setCreateStatus(
      `Stream "${streamId}" added (Web capture · ${modeLabel.trim()}) Open streamer to start Puppeteer capture and publish.`
    );
    sourceNameInput.value = "";
    homeCapturePageUrl.value = "";
    homeCaptureSelector.value = "";
    homeCaptureInterval.value = "1000";
    return;
  }

  const customName = normalizeStreamName(sourceNameInput.value);
  const streamId = customName || generateStreamId();
  streamTypes.set(streamId, getSelectedCreationStreamMode());
  preGeneratedStreams.add(streamId);
  saveHomeStreamsToStorage();
  renderStreams(getMergedStreams());

  const sourceUrl =
    tab === "m3u8"
      ? (sourceUrlInput.value || "").trim()
      : "";
  if (sourceUrl) {
    streamSourceUrls.set(streamId, sourceUrl);
    saveHomeStreamsToStorage();
  }
  const modeLabel =
    streamTypes.get(streamId) === "sfu"
      ? " WebRTC server streaming."
      : " Peer-to-peer WebRTC.";
  const urlHint = sourceUrl
    ? looksLikeM3u8Url(sourceUrl)
      ? " M3U8 opens in the HLS streamer; dashboard/viewer use the same WebRTC path."
      : " Video URL opens in the standard streamer (progressive / file URL)."
    : "";
  setCreateStatus(
    `Stream "${streamId}" added (${modeLabel.trim()}) Use "Open streamer" or QR to start.${urlHint}`
  );
  sourceNameInput.value = "";
  sourceUrlInput.value = "";
});

refreshBtn.addEventListener("click", () => {
  requestStreams();
  setViewerStatus("Selections cleared.");
});

selectAllBtn.addEventListener("click", () => {
  document.querySelectorAll(".stream-checkbox").forEach((cb) => {
    cb.checked = true;
  });
  setViewerStatus("All streams selected.");
});

openViewerBtn.addEventListener("click", () => {
  const selectedStreams = getSelectedStreams();

  if (!selectedStreams.length) {
    setViewerStatus("Select at least one stream.");
    return;
  }

  const url = `viewer.html?streams=${encodeURIComponent(selectedStreams.join(","))}`;
  window.open(url, "_blank");
  setViewerStatus(`Opened viewer for: ${selectedStreams.join(", ")}`);
});

openViewerDashboardBtn.addEventListener("click", () => {
  const selectedStreams = getSelectedStreams();

  if (!selectedStreams.length) {
    setViewerStatus("Select at least one stream.");
    return;
  }

  const modes = selectedStreams
    .map((id) => (streamTypes.get(id) === "sfu" ? "sfu" : "p2p"))
    .join(",");
  const url = `dashboard.html?streams=${encodeURIComponent(selectedStreams.join(","))}&modes=${encodeURIComponent(modes)}`;
  window.open(url, "_blank");
  setViewerStatus(`Opened viewer dashboard for: ${selectedStreams.join(", ")}`);
});

saveSelectedStreamsBtn.addEventListener("click", () => {
  const selectedStreams = getSelectedStreams();

  if (!selectedStreams.length) {
    setViewerStatus("Select at least one stream to save.");
    return;
  }

  const streamIds = [...new Set(selectedStreams)];
  savedStreamGroups.push({ id: generateSavedGroupId(), streamIds });
  saveSavedStreamGroupsToStorage();
  renderSavedStreamsPanel();
  setViewerStatus(`Saved ${streamIds.length} stream(s) as a new set.`);
  setSavedStreamsStatus(`Added saved set: ${streamIds.join(", ")}`);
});

sourceNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openStreamerBtn.click();
});
sourceUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openStreamerBtn.click();
});
for (const el of [homeCapturePageUrl, homeCaptureSelector, homeCaptureInterval]) {
  if (el) {
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openStreamerBtn.click();
    });
  }
}

let qrInstance = null;
let serverStreams = [];
const preGeneratedStreams = new Set();
/** streamId -> 'p2p' | 'sfu' for streams created on this page */
const streamTypes = new Map();
/** streamId -> source URL from the create form (m3u8 or other); used by Open streamer / QR */
const streamSourceUrls = new Map();
/** streamId -> { pageUrl, selector, intervalMs } for Web capture streams */
const streamCaptureParams = new Map();
/** Streams we've seen from the server; keep in list until Remove is clicked (do not remove when streamer tab closes). */
const stickyStreamIds = new Set();
const hiddenStreamIds = new Set();

/** @type {{ id: string, streamIds: string[] }[]} */
let savedStreamGroups = [];

const HOME_STREAMS_STORAGE_KEY = "streaming-home-streams-v1";
const HOME_SAVED_GROUPS_KEY = "streaming-home-saved-groups-v1";

function generateSavedGroupId() {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function saveSavedStreamGroupsToStorage() {
  try {
    localStorage.setItem(
      HOME_SAVED_GROUPS_KEY,
      JSON.stringify({ v: 1, groups: savedStreamGroups })
    );
  } catch {
    /* quota / private mode */
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
    let needsSave = false;
    const next = [];
    for (const g of data.groups) {
      if (!g || typeof g.id !== "string" || !Array.isArray(g.streamIds)) continue;
      const streamIds = [
        ...new Set(
          g.streamIds.filter(
            (sid) => typeof sid === "string" && sid.trim() && !hiddenStreamIds.has(sid)
          )
        ),
      ];
      if (streamIds.length !== g.streamIds.length) needsSave = true;
      if (streamIds.length > 0) next.push({ id: g.id, streamIds });
    }
    savedStreamGroups = next;
    if (needsSave) saveSavedStreamGroupsToStorage();
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
  setSavedStreamsStatus(`Removed "${streamId}" from saved sets.`);
}

function openSavedStreamGroup(group) {
  const ids = group.streamIds;
  const gapMs = 220;
  ids.forEach((streamId, i) => {
    const mode = streamTypes.get(streamId) === "sfu" ? "sfu" : "p2p";
    setTimeout(() => {
      window.open(streamerOpenUrl(streamId, mode), "_blank");
    }, i * gapMs);
  });
  const modes = ids
    .map((id) => (streamTypes.get(id) === "sfu" ? "sfu" : "p2p"))
    .join(",");
  setTimeout(() => {
    window.open(
      `dashboard.html?streams=${encodeURIComponent(ids.join(","))}&modes=${encodeURIComponent(modes)}`,
      "_blank"
    );
  }, ids.length * gapMs);
  setSavedStreamsStatus(`Opened streamers and dashboard for: ${ids.join(", ")}`);
}

function removeSavedStreamGroup(groupId) {
  savedStreamGroups = savedStreamGroups.filter((g) => g.id !== groupId);
  saveSavedStreamGroupsToStorage();
  renderSavedStreamsPanel();
  setSavedStreamsStatus("Removed saved stream set.");
}

function renderSavedStreamsPanel() {
  if (!savedStreamsContainer) return;
  savedStreamsContainer.innerHTML = "";

  if (!savedStreamGroups.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent =
      'No saved stream sets yet. Select streams above and click "Save selected streams".';
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
    openBtn.title = "Open each streamer tab and the dashboard for this set";
    openBtn.addEventListener("click", () => openSavedStreamGroup(group));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove-btn";
    removeBtn.title = "Remove this saved set";
    removeBtn.addEventListener("click", () => removeSavedStreamGroup(group.id));

    actions.appendChild(openBtn);
    actions.appendChild(removeBtn);
    row.appendChild(summary);
    row.appendChild(actions);
    savedStreamsContainer.appendChild(row);
  }
}

function saveHomeStreamsToStorage() {
  try {
    const entries = [];
    for (const streamId of preGeneratedStreams) {
      const mode = streamTypes.get(streamId) === "sfu" ? "sfu" : "p2p";
      const sourceUrl = (streamSourceUrls.get(streamId) || "").trim();
      const capture = streamCaptureParams.get(streamId);
      const row = { streamId, mode };
      if (sourceUrl) row.sourceUrl = sourceUrl;
      if (capture && capture.pageUrl && capture.selector) {
        row.capture = {
          pageUrl: capture.pageUrl,
          selector: capture.selector,
          intervalMs: capture.intervalMs,
        };
      }
      entries.push(row);
    }
    localStorage.setItem(
      HOME_STREAMS_STORAGE_KEY,
      JSON.stringify({ v: 1, entries, hidden: [...hiddenStreamIds] })
    );
  } catch {
    /* quota / private mode */
  }
}

function loadHomeStreamsFromStorage() {
  try {
    const raw = localStorage.getItem(HOME_STREAMS_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !Array.isArray(data.entries)) return;

    const hidden = Array.isArray(data.hidden) ? data.hidden : [];
    for (const id of hidden) {
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
      preGeneratedStreams.add(streamId);
    }
  } catch {
    /* corrupt or unreadable */
  }
}

function showQrModal(url, streamId) {
  const modal = document.getElementById("qrModal");
  const canvas = document.getElementById("qrModalCanvas");
  const label = document.getElementById("qrModalLabel");

  canvas.innerHTML = "";
  if (qrInstance) {
    qrInstance.clear();
    qrInstance = null;
  }

  label.textContent = streamId;
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

function hideQrModal() {
  document.getElementById("qrModal").classList.add("hidden");
}

document.getElementById("qrModalClose").addEventListener("click", hideQrModal);
document.querySelector(".qr-modal-backdrop").addEventListener("click", hideQrModal);

socket.on("available-streams", ({ streams }) => {
  serverStreams = Array.isArray(streams) ? streams : [];
  serverStreams.forEach((id) => stickyStreamIds.add(id));
  renderStreams(getMergedStreams());
});

loadHomeStreamsFromStorage();
loadSavedStreamGroupsFromStorage();
renderStreams(getMergedStreams());
renderSavedStreamsPanel();
requestStreams();