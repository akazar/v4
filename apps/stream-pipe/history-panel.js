const MAX_ENTRIES = 500;

/**
 * @param {{ onConfigChange?: () => void }} [options]
 */
export function createHistoryPanel(options = {}) {
  const historyBody = document.getElementById("historyBody");
  const historyTable = document.getElementById("historyTable");
  const historyEmpty = document.getElementById("historyEmpty");

  /** @type {{ time: string, class: string, confidence: number }[]} */
  let entries = [];

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getRecognitionBlock(config, useServerPath) {
    if (!config || typeof config !== "object") return null;
    return useServerPath ? config.serverRecognition : config.localRecognition;
  }

  function filterDetections(detections, config, useServerPath) {
    if (!Array.isArray(detections) || !detections.length) return [];
    const block = getRecognitionBlock(config, useServerPath);
    const classes = Array.isArray(block?.classes) ? block.classes : null;
    const threshold =
      typeof block?.threshold === "number" ? block.threshold : 0;

    return detections.filter((det) => {
      if (!det || typeof det.class !== "string") return false;
      const conf = Number(det.confidence);
      if (!Number.isFinite(conf) || conf < threshold) return false;
      if (classes && classes.length && !classes.includes(det.class)) return false;
      return true;
    });
  }

  function render() {
    if (!historyBody || !historyTable || !historyEmpty) return;

    historyBody.innerHTML = "";
    if (!entries.length) {
      historyEmpty.hidden = false;
      historyTable.hidden = true;
      return;
    }

    historyEmpty.hidden = true;
    historyTable.hidden = false;

    for (const row of entries) {
      const tr = document.createElement("tr");
      const tdTime = document.createElement("td");
      tdTime.textContent = row.time;
      const tdClass = document.createElement("td");
      tdClass.textContent = row.class;
      const tdConf = document.createElement("td");
      tdConf.textContent = `${(row.confidence * 100).toFixed(0)}%`;
      tr.appendChild(tdTime);
      tr.appendChild(tdClass);
      tr.appendChild(tdConf);
      historyBody.appendChild(tr);
    }
  }

  function clear() {
    entries = [];
    render();
  }

  /**
   * @param {Array<{ class: string, confidence: number }>} detections
   * @param {object} config
   * @param {boolean} useServerPath
   */
  function appendDetections(detections, config, useServerPath) {
    const filtered = filterDetections(detections, config, useServerPath);
    if (!filtered.length) return;

    const timeStr = formatTime();
    for (const det of filtered) {
      entries.unshift({
        time: timeStr,
        class: det.class,
        confidence: Number(det.confidence),
      });
    }

    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
    render();
  }

  function notifyConfigChange() {
    clear();
    options.onConfigChange?.();
  }

  return {
    appendDetections,
    clear,
    filterDetections,
    notifyConfigChange,
  };
}
