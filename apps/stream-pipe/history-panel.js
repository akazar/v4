const MAX_ENTRIES = 500;

/**
 * @param {{ onConfigChange?: () => void }} [options]
 */
export function createHistoryPanel(options = {}) {
  const historyBody = document.getElementById("historyBody");
  const historyTable = document.getElementById("historyTable");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyNoResults = document.getElementById("historyNoResults");
  const filterFromEl = document.getElementById("historyFilterFrom");
  const filterToEl = document.getElementById("historyFilterTo");
  const filterMinConfEl = document.getElementById("historyFilterMinConf");
  const filterClassesEl = document.getElementById("historyFilterClasses");
  const filterResetBtn = document.getElementById("historyFilterReset");

  /** @type {{ time: string, timestamp: number, className: string, confidence: number }[]} */
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

  function getSelectedClasses() {
    if (!filterClassesEl) return [];
    return [...filterClassesEl.querySelectorAll('input[type="checkbox"]:checked')].map(
      (el) => el.value
    );
  }

  function getViewFilters() {
    const fromMs = filterFromEl?.value
      ? new Date(filterFromEl.value).getTime()
      : null;
    const toMs = filterToEl?.value ? new Date(filterToEl.value).getTime() : null;
    const minConfRaw = filterMinConfEl?.value?.trim();
    const minConfidence =
      minConfRaw !== "" && minConfRaw != null
        ? Math.max(0, Math.min(100, Number(minConfRaw))) / 100
        : null;
    const selectedClasses = getSelectedClasses();

    return {
      fromMs: Number.isFinite(fromMs) ? fromMs : null,
      toMs: Number.isFinite(toMs) ? toMs : null,
      minConfidence:
        minConfidence != null && Number.isFinite(minConfidence)
          ? minConfidence
          : null,
      selectedClasses,
    };
  }

  function passesViewFilters(entry, filters) {
    if (filters.fromMs != null && entry.timestamp < filters.fromMs) return false;
    if (filters.toMs != null && entry.timestamp > filters.toMs) return false;
    if (
      filters.minConfidence != null &&
      entry.confidence < filters.minConfidence
    ) {
      return false;
    }
    if (
      filters.selectedClasses.length > 0 &&
      !filters.selectedClasses.includes(entry.className)
    ) {
      return false;
    }
    return true;
  }

  function getObservedClasses() {
    const classes = new Set();
    for (const entry of entries) {
      if (typeof entry.className === "string" && entry.className) {
        classes.add(entry.className);
      }
    }
    return [...classes].sort((a, b) => a.localeCompare(b));
  }

  function refreshClassFilterList() {
    if (!filterClassesEl) return;

    const previouslySelected = new Set(getSelectedClasses());
    const sorted = getObservedClasses();

    filterClassesEl.innerHTML = "";
    if (!sorted.length) {
      const empty = document.createElement("span");
      empty.className = "history-filter-classes-empty";
      empty.textContent = "No classes yet";
      filterClassesEl.appendChild(empty);
      return;
    }

    for (const cls of sorted) {
      const label = document.createElement("label");
      label.className = "history-filter-class-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = cls;
      checkbox.checked = previouslySelected.has(cls);

      label.appendChild(checkbox);
      label.append(` ${cls}`);
      filterClassesEl.appendChild(label);
    }
  }

  function resetViewFilters() {
    if (filterFromEl) filterFromEl.value = "";
    if (filterToEl) filterToEl.value = "";
    if (filterMinConfEl) filterMinConfEl.value = "";
    if (filterClassesEl) {
      for (const cb of filterClassesEl.querySelectorAll('input[type="checkbox"]')) {
        cb.checked = false;
      }
    }
    render();
  }

  function render() {
    if (!historyBody || !historyTable || !historyEmpty) return;

    historyBody.innerHTML = "";

    if (!entries.length) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = "No detections yet.";
      if (historyNoResults) historyNoResults.hidden = true;
      historyTable.hidden = true;
      return;
    }

    const filters = getViewFilters();
    const visible = entries.filter((entry) => passesViewFilters(entry, filters));

    if (!visible.length) {
      historyEmpty.hidden = true;
      if (historyNoResults) {
        historyNoResults.hidden = false;
        historyNoResults.textContent = "No results match the filters.";
      }
      historyTable.hidden = true;
      return;
    }

    historyEmpty.hidden = true;
    if (historyNoResults) historyNoResults.hidden = true;
    historyTable.hidden = false;

    for (const row of visible) {
      const tr = document.createElement("tr");
      const tdTime = document.createElement("td");
      tdTime.textContent = row.time;
      const tdClass = document.createElement("td");
      tdClass.textContent = row.className;
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
    refreshClassFilterList();
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

    const now = new Date();
    const timeStr = formatTime(now);
    const timestamp = now.getTime();
    const classesBefore = new Set(getObservedClasses());

    for (const det of filtered) {
      entries.unshift({
        time: timeStr,
        timestamp,
        className: det.class,
        confidence: Number(det.confidence),
      });
    }

    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }

    const classesAfter = getObservedClasses();
    if (
      classesAfter.length !== classesBefore.size ||
      classesAfter.some((cls) => !classesBefore.has(cls))
    ) {
      refreshClassFilterList();
    }
    render();
  }

  function notifyConfigChange() {
    clear();
    options.onConfigChange?.();
  }

  const historyFiltersEl = document.getElementById("historyFilters");

  filterFromEl?.addEventListener("change", render);
  filterToEl?.addEventListener("change", render);
  filterMinConfEl?.addEventListener("input", render);
  historyFiltersEl?.addEventListener("change", (e) => {
    if (e.target.matches('#historyFilterClasses input[type="checkbox"]')) render();
  });
  filterResetBtn?.addEventListener("click", resetViewFilters);

  refreshClassFilterList();

  return {
    appendDetections,
    clear,
    filterDetections,
    notifyConfigChange,
  };
}
