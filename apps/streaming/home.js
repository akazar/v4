const socket = io();

const streamIdInput = document.getElementById("streamIdInput");
const sourceUrlInput = document.getElementById("sourceUrlInput");
const openStreamerBtn = document.getElementById("openStreamerBtn");
const refreshBtn = document.getElementById("refreshBtn");
const openViewerBtn = document.getElementById("openViewerBtn");
const streamsContainer = document.getElementById("streamsContainer");
const createStatus = document.getElementById("createStatus");
const viewerStatus = document.getElementById("viewerStatus");

function normalizeStreamId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
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

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(openLinkBtn);
    item.appendChild(qrBtn);

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

openStreamerBtn.addEventListener("click", () => {
  const streamId = normalizeStreamId(streamIdInput.value);

  if (!streamId) {
    setCreateStatus("Please enter a valid stream ID.");
    return;
  }

  let url = `streamer.html?streamId=${encodeURIComponent(streamId)}`;
  const sourceUrl = (sourceUrlInput.value || "").trim();
  if (sourceUrl) {
    url += `&source=${encodeURIComponent(sourceUrl)}`;
  }
  window.open(url, "_blank");

  setCreateStatus(`Opened streamer page for "${streamId}"${sourceUrl ? " (URL source)" : ""}.`);
  streamIdInput.value = "";
  sourceUrlInput.value = "";
});

refreshBtn.addEventListener("click", () => {
  requestStreams();
  setViewerStatus("Stream list refreshed.");
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

streamIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    openStreamerBtn.click();
  }
});

let qrInstance = null;

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
  renderStreams(Array.isArray(streams) ? streams : []);
});

requestStreams();