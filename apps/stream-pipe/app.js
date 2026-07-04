import { fetchIceServersForPage } from "/lib/ice-servers.js";
import { createHomePanel } from "./home-panel.js";
import { createStreamerController } from "./streamer-controller.js";
import { createViewerPanel } from "./viewer-panel.js";
import { createHistoryPanel } from "./history-panel.js";

const socket = io();
const iceServers = await fetchIceServersForPage();

const streamerStatusEl = document.getElementById("streamerStatus");
const previewVideo = document.getElementById("streamerPreview");
const captureCanvas = document.getElementById("captureCanvas");

const historyPanel = createHistoryPanel();

const viewerPanel = await createViewerPanel({
  socket,
  onDetections: (detections, config, useServerPath) => {
    historyPanel.appendDetections(detections, config, useServerPath);
  },
  onConfigChange: () => {
    historyPanel.clear();
  },
});

const streamerController = createStreamerController({
  socket,
  iceServers,
  previewVideo,
  captureCanvas,
  onStatus: (text) => {
    if (streamerStatusEl) streamerStatusEl.textContent = text;
  },
});

function isLocallyPublishing() {
  return streamerController.isRunning();
}

function getPublishingStreamId() {
  return streamerController.getActiveStreamId();
}

async function handlePlay(streamId) {
  try {
    const meta = homePanel.buildStreamMeta(streamId);
    const mediaStream = await streamerController.start(meta);
    viewerPanel.setLocalStream(streamId, meta.mode, mediaStream);
    homePanel.refreshStreamList();
  } catch (err) {
    const msg = err?.message || String(err);
    if (streamerStatusEl) streamerStatusEl.textContent = `Failed: ${msg}`;
    console.error(err);
  }
}

async function handleStop() {
  await streamerController.stop();
  viewerPanel.clearLocalSourceFlag();
  viewerPanel.teardown();

  const activeId = homePanel.getActiveStreamId();
  if (activeId && homePanel.isStreamOnServer(activeId)) {
    viewerPanel.connectRemote(activeId, homePanel.getStreamMode(activeId));
  }
  homePanel.refreshStreamList();
}

function handleActiveChange(streamId) {
  historyPanel.clear();

  if (!streamId) {
    viewerPanel.teardown();
    return;
  }

  if (isLocallyPublishing() && getPublishingStreamId() === streamId) {
    return;
  }

  if (isLocallyPublishing()) {
    void handleStop().then(() => {
      if (homePanel.isStreamOnServer(streamId)) {
        viewerPanel.connectRemote(streamId, homePanel.getStreamMode(streamId));
      } else {
        viewerPanel.switchStream(streamId, homePanel.getStreamMode(streamId));
      }
    });
    return;
  }

  if (homePanel.isStreamOnServer(streamId)) {
    viewerPanel.connectRemote(streamId, homePanel.getStreamMode(streamId));
  } else {
    viewerPanel.switchStream(streamId, homePanel.getStreamMode(streamId));
  }
}

const homePanel = createHomePanel({
  socket,
  onActiveChange: handleActiveChange,
  onPlay: handlePlay,
  onStop: handleStop,
  isLocallyPublishing,
  getPublishingStreamId,
});

window.addEventListener("beforeunload", () => {
  void streamerController.stop();
});
