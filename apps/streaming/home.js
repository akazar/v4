const socket = io();

const sourceNameInput = document.getElementById("sourceNameInput");
const sourceUrlInput = document.getElementById("sourceUrlInput");
const openStreamerBtn = document.getElementById("openStreamerBtn");
const refreshBtn = document.getElementById("refreshBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const openViewerBtn = document.getElementById("openViewerBtn");
const streamsContainer = document.getElementById("streamsContainer");
const createStatus = document.getElementById("createStatus");
const viewerStatus = document.getElementById("viewerStatus");

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

    const openLinkBtn = document.createElement("button");
    openLinkBtn.type = "button";
    openLinkBtn.textContent = "Open streamer";
    openLinkBtn.addEventListener("click", () => {
      window.open(`streamer.html?streamId=${encodeURIComponent(streamId)}`, "_blank");
    });

    const qrBtn = document.createElement("button");
    qrBtn.type = "button";
    qrBtn.textContent = "QR";
    qrBtn.title = "Show QR code for mobile";
    qrBtn.className = "qr-btn";
    qrBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const url = new URL(`streamer.html?streamId=${encodeURIComponent(streamId)}`, location.href).href;
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

function removeStream(streamId) {
  preGeneratedStreams.delete(streamId);
  stickyStreamIds.delete(streamId);
  hiddenStreamIds.add(streamId);
  renderStreams(getMergedStreams());
}

openStreamerBtn.addEventListener("click", () => {
  const customName = normalizeStreamName(sourceNameInput.value);
  const streamId = customName || generateStreamId();
  preGeneratedStreams.add(streamId);
  renderStreams(getMergedStreams());

  const sourceUrl = (sourceUrlInput.value || "").trim();
  setCreateStatus(
    `Stream "${streamId}" added to list. Use "Open streamer" or QR to start.${sourceUrl ? " (URL source will apply when you open.)" : ""}`
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

sourceNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openStreamerBtn.click();
});
sourceUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openStreamerBtn.click();
});

let qrInstance = null;
let serverStreams = [];
const preGeneratedStreams = new Set();
/** Streams we've seen from the server; keep in list until Remove is clicked (do not remove when streamer tab closes). */
const stickyStreamIds = new Set();
const hiddenStreamIds = new Set();

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

requestStreams();