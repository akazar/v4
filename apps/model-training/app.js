/**
 * Model training UI — simulated epochs via timeouts; canvas charts only (no backend).
 * Export / save use empty checkpoint files; extension matches model family (see extensionForModelId).
 */

function extensionForModelId(modelId) {
  const id = String(modelId || '');
  if (id.startsWith('vlm-')) return '.safetensors';
  if (id.includes('efficientdet')) return '.tflite';
  return '.pt';
}

function safeModelStem(modelId) {
  const s = String(modelId || 'model')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'model';
}

/** User-defined output name (section 1); strips disallowed chars and optional extension. */
function trainedStemFromInput() {
  const raw = $('trainedModelNameInput').value.trim();
  if (!raw) return null;
  const noExt = raw.replace(/\.(pt|tflite|safetensors)$/i, '');
  const s = noExt.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return s.length ? s : null;
}

function getOutputCheckpointStem() {
  return trainedStemFromInput() || safeModelStem($('modelSelect').value);
}

const MODEL_OPTIONS = [
  { value: 'yolov8n-det', label: 'YOLOv8n (detection)' },
  { value: 'yolov8s-det', label: 'YOLOv8s (detection)' },
  { value: 'yolov8m-det', label: 'YOLOv8m (detection)' },
  { value: 'efficientdet-lite2', label: 'EfficientDet Lite2' },
  { value: 'vlm-llava-7b', label: 'VLM — LLaVA-7B fine-tune' },
  { value: 'vlm-qwen2-vl', label: 'VLM — Qwen2-VL fine-tune' },
  { value: 'vlm-gemma3-v', label: 'VLM — Gemma 3 Vision fine-tune' },
];

/** @type {{ id: string, imageFile: File, annotationFile: File|null, split: 'train'|'val'|'test', objectUrl: string }[]} */
let datasetItems = [];
let trainingRunning = false;
let epochLog = [];

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing element: ' + id);
  return el;
}

function basenameNoExt(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? name : name.slice(0, i);
}

function initModelSelect() {
  const sel = $('modelSelect');
  sel.innerHTML = '';
  for (const m of MODEL_OPTIONS) {
    const o = document.createElement('option');
    o.value = m.value;
    o.textContent = m.label;
    sel.appendChild(o);
  }
}

function revokeDatasetUrls() {
  for (const item of datasetItems) {
    URL.revokeObjectURL(item.objectUrl);
  }
}

function buildDatasetFromFiles(imageFiles, annotationFiles) {
  revokeDatasetUrls();
  datasetItems = [];
  const annByBase = new Map();
  for (const f of annotationFiles) {
    annByBase.set(basenameNoExt(f.name).toLowerCase(), f);
  }
  for (const img of imageFiles) {
    const base = basenameNoExt(img.name).toLowerCase();
    const ann = annByBase.get(base) || null;
    datasetItems.push({
      id: crypto.randomUUID(),
      imageFile: img,
      annotationFile: ann,
      split: 'train',
      objectUrl: URL.createObjectURL(img),
    });
  }
  renderDatasetTable();
  updateStatusCounts();
}

function renderDatasetTable() {
  const tbody = $('datasetTbody');
  tbody.innerHTML = '';
  if (datasetItems.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td colspan="4" style="color:var(--text-muted);padding:1rem">No images loaded yet.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const item of datasetItems) {
    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    const annLabel = item.annotationFile ? item.annotationFile.name : '—';
    tr.innerHTML = `
      <td class="thumb-cell"><img class="thumb" alt="" src="${item.objectUrl}"></td>
      <td>${escapeHtml(item.imageFile.name)}</td>
      <td>${escapeHtml(annLabel)}</td>
      <td></td>
    `;
    const tdSplit = tr.querySelector('td:last-child');
    const sel = document.createElement('select');
    sel.className = 'split-select';
    sel.setAttribute('aria-label', 'Split for ' + item.imageFile.name);
    for (const s of ['train', 'val', 'test']) {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      if (item.split === s) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      item.split = /** @type {'train'|'val'|'test'} */ (sel.value);
      updateStatusCounts();
    });
    tdSplit.appendChild(sel);
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function updateStatusCounts() {
  const el = $('splitSummary');
  if (datasetItems.length === 0) {
    el.textContent = '';
    return;
  }
  let t = 0,
    v = 0,
    te = 0;
  for (const i of datasetItems) {
    if (i.split === 'train') t++;
    else if (i.split === 'val') v++;
    else te++;
  }
  el.textContent = `Train: ${t} · Validation: ${v} · Test: ${te}`;
}

function autoSplit(ratios) {
  const [rt, rv, rtest] = ratios;
  const total = rt + rv + rtest;
  let i = 0;
  for (const item of datasetItems) {
    const p = i / Math.max(datasetItems.length, 1);
    if (p < rt / total) item.split = 'train';
    else if (p < (rt + rv) / total) item.split = 'val';
    else item.split = 'test';
    i++;
  }
  renderDatasetTable();
  updateStatusCounts();
}

const CHART = {
  train: '#6b9bd1',
  val: '#c97b6b',
  map50: '#7bc96b',
  map5095: '#b8a06b',
  lr: '#a67bc9',
  epochSec: '#6bc9b8',
  cumSec: '#9b8ad4',
};

function drawDualAxisTimeChart(canvas, epochSecs, cumSecs, xLabels) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 280);
  const h = 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const pad = { l: 44, r: 44, t: 14, b: 28 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, w, h);

  let min1 = Math.min(...epochSecs, 0);
  let max1 = Math.max(...epochSecs, 1);
  if (max1 - min1 < 1e-6) max1 = min1 + 1;
  let min2 = Math.min(...cumSecs, 0);
  let max2 = Math.max(...cumSecs, 1);
  if (max2 - min2 < 1e-6) max2 = min2 + 1;

  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (ch * g) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + cw, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#888';
  ctx.font = '10px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (ch * g) / 4;
    const v = max1 - ((max1 - min1) * g) / 4;
    ctx.fillText(v.toFixed(0) + 's', pad.l - 4, y);
  }
  ctx.textAlign = 'left';
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (ch * g) / 4;
    const v = max2 - ((max2 - min2) * g) / 4;
    ctx.fillText(v.toFixed(0) + 's', pad.l + cw + 6, y);
  }

  const n = Math.max(xLabels.length, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#666';
  const step = Math.ceil(n / 6);
  for (let i = 0; i < n; i += step) {
    const x = pad.l + (cw * i) / Math.max(n - 1, 1);
    ctx.fillText(String(xLabels[i]), x, h - pad.b + 4);
  }

  const y1 = (v) => pad.t + ch * (1 - (v - min1) / (max1 - min1));
  const y2 = (v) => pad.t + ch * (1 - (v - min2) / (max2 - min2));

  ctx.strokeStyle = CHART.epochSec;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < epochSecs.length; i++) {
    const x = pad.l + (cw * i) / Math.max(n - 1, 1);
    const y = y1(epochSecs[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = CHART.cumSec;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  for (let i = 0; i < cumSecs.length; i++) {
    const x = pad.l + (cw * i) / Math.max(n - 1, 1);
    const y = y2(cumSecs[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLineChart(canvas, seriesList, xLabels) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 280);
  const h = 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const pad = { l: 44, r: 12, t: 14, b: 28 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, w, h);

  const allVals = seriesList.flatMap((s) => s.values);
  let minY = Math.min(...allVals, 0);
  let maxY = Math.max(...allVals, 1);
  if (maxY - minY < 1e-6) maxY = minY + 1;

  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (ch * g) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + cw, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#666';
  ctx.font = '10px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (ch * g) / 4;
    const v = maxY - ((maxY - minY) * g) / 4;
    ctx.fillText(v.toFixed(3), pad.l - 6, y);
  }

  const n = Math.max(xLabels.length, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.ceil(n / 6);
  for (let i = 0; i < n; i += step) {
    const x = pad.l + (cw * i) / Math.max(n - 1, 1);
    ctx.fillText(String(xLabels[i]), x, h - pad.b + 4);
  }

  for (const s of seriesList) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < s.values.length; i++) {
      const x = pad.l + (cw * i) / Math.max(n - 1, 1);
      const yv = s.values[i];
      const y = pad.t + ch * (1 - (yv - minY) / (maxY - minY));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function clearChartCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 280);
  const h = 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#555';
  ctx.font = '12px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No data yet', w / 2, h / 2);
}

function redrawAllCharts(history) {
  if (history.length === 0) {
    ['chartLoss', 'chartMap', 'chartPr', 'chartLr', 'chartTime'].forEach((id) =>
      clearChartCanvas($(id))
    );
    return;
  }
  const epochs = history.map((_, i) => i + 1);
  const trainLoss = history.map((h) => h.trainLoss);
  const valLoss = history.map((h) => h.valLoss);
  drawLineChart($('chartLoss'), [
    { color: CHART.train, values: trainLoss },
    { color: CHART.val, values: valLoss },
  ], epochs);

  drawLineChart($('chartMap'), [
    { color: CHART.map50, values: history.map((h) => h.map50) },
    { color: CHART.map5095, values: history.map((h) => h.map5095) },
  ], epochs);

  drawLineChart($('chartPr'), [
    { color: CHART.train, values: history.map((h) => h.precision) },
    { color: CHART.val, values: history.map((h) => h.recall) },
  ], epochs);

  drawLineChart($('chartLr'), [{ color: CHART.lr, values: history.map((h) => h.lr) }], epochs);

  drawDualAxisTimeChart(
    $('chartTime'),
    history.map((h) => h.epochSec),
    history.map((h) => h.cumSec),
    epochs
  );
}

function simulateEpochMetrics(epoch, totalEpochs, baseLr) {
  const t = epoch / totalEpochs;
  const noise = () => (Math.random() - 0.5) * 0.08;
  const trainLoss = Math.max(0.05, 2.4 * Math.exp(-t * 3.2) + noise());
  const valLoss = trainLoss + 0.12 + Math.abs(noise());
  const map50 = Math.min(0.93, 0.28 + t * 0.62 + noise() * 0.02);
  const map5095 = Math.min(0.78, map50 * 0.82 + noise() * 0.02);
  const precision = Math.min(0.95, 0.75 + t * 0.18 + noise() * 0.03);
  const recall = Math.min(0.92, 0.72 + t * 0.17 + noise() * 0.03);
  const lr = baseLr * (0.5 * (1 + Math.cos(Math.PI * t)));
  const epochSec = 38 + Math.random() * 42;
  return { trainLoss, valLoss, map50, map5095, precision, recall, lr, epochSec };
}

async function runSimulatedTraining() {
  if (trainingRunning) return;
  const epochs = Math.max(1, Math.min(500, parseInt($('epochsInput').value, 10) || 10));
  const baseLr = Math.max(1e-6, parseFloat($('lrInput').value) || 0.001);
  trainingRunning = true;
  $('runTrainingBtn').disabled = true;
  $('stopTrainingBtn').disabled = false;
  $('trainingStatus').className = 'status running';
  $('trainingStatus').textContent = 'Simulated training…';
  $('progressFill').style.width = '0%';
  $('metricsLog').textContent = '';
  epochLog = [];
  redrawAllCharts([]);

  const cum = { sum: 0 };

  for (let e = 1; e <= epochs; e++) {
    if (!trainingRunning) break;
    await new Promise((r) => setTimeout(r, 500 + Math.floor(Math.random() * 500)));
    if (!trainingRunning) break;
    const m = simulateEpochMetrics(e, epochs, baseLr);
    cum.sum += m.epochSec;
    epochLog.push({
      epoch: e,
      trainLoss: m.trainLoss,
      valLoss: m.valLoss,
      map50: m.map50,
      map5095: m.map5095,
      precision: m.precision,
      recall: m.recall,
      lr: m.lr,
      epochSec: m.epochSec,
      cumSec: cum.sum,
    });
    redrawAllCharts(epochLog);
    $('progressFill').style.width = `${(e / epochs) * 100}%`;
    $('metricsLog').textContent =
      `Epoch ${e}/${epochs}  train_loss=${m.trainLoss.toFixed(4)}  val_loss=${m.valLoss.toFixed(4)}  mAP50=${m.map50.toFixed(4)}  lr=${m.lr.toExponential(2)}`;
  }

  trainingRunning = false;
  $('runTrainingBtn').disabled = false;
  $('stopTrainingBtn').disabled = true;
  if (epochLog.length === epochs) {
    $('trainingStatus').className = 'status done';
    $('trainingStatus').textContent = 'Simulation finished. You can export or save the model.';
    $('exportModelBtn').disabled = false;
    $('saveModelBtn').disabled = false;
  } else {
    $('trainingStatus').className = 'status';
    $('trainingStatus').textContent = 'Stopped by user.';
  }
}

function stopTraining() {
  trainingRunning = false;
}

let successToastTimer = null;

function showSuccessToast(message) {
  const el = document.getElementById('successToast');
  if (!el) return;
  clearTimeout(successToastTimer);
  el.textContent = message;
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('success-toast--visible');
  successToastTimer = setTimeout(() => {
    el.classList.remove('success-toast--visible');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
  }, 3000);
}

function exportModelToDisk() {
  const modelId = $('modelSelect').value;
  const ext = extensionForModelId(modelId);
  const name = `${getOutputCheckpointStem()}${ext}`;
  const blob = new Blob([], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  $('exportStatus').textContent = `Exported empty ${ext} file: ${name}`;
  showSuccessToast(`Exported: ${name}`);
}

async function saveModelOnServer() {
  const modelId = $('modelSelect').value;
  const outputStem = getOutputCheckpointStem();
  $('exportStatus').textContent = 'Saving…';
  try {
    const res = await fetch('/api/model-training/save-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, outputStem }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      $('exportStatus').textContent = data.error || `Save failed (${res.status}).`;
      return;
    }
    const savedPath = data.path || data.file || 'ok';
    $('exportStatus').textContent = `Saved empty file on server: ${savedPath}`;
    showSuccessToast(`Saved: ${data.file || savedPath}`);
  } catch (e) {
    $('exportStatus').textContent =
      e instanceof Error ? e.message : 'Save failed (is the v4 server running on this origin?)';
  }
}

function onResizeCharts() {
  if (epochLog.length) redrawAllCharts(epochLog);
}

function wireEvents() {
  $('imageInput').addEventListener('change', () => {
    const imgs = Array.from($('imageInput').files || []).filter((f) => f.type.startsWith('image/'));
    const anns = Array.from($('annotationInput').files || []);
    if (imgs.length === 0) {
      revokeDatasetUrls();
      datasetItems = [];
      renderDatasetTable();
      updateStatusCounts();
      return;
    }
    buildDatasetFromFiles(imgs, anns);
  });

  $('annotationInput').addEventListener('change', () => {
    const imgs = Array.from($('imageInput').files || []).filter((f) => f.type.startsWith('image/'));
    const anns = Array.from($('annotationInput').files || []);
    if (imgs.length) buildDatasetFromFiles(imgs, anns);
  });

  $('split703015').addEventListener('click', () => autoSplit([0.7, 0.15, 0.15]));
  $('split802010').addEventListener('click', () => autoSplit([0.8, 0.2, 0.1]));
  $('runTrainingBtn').addEventListener('click', () => runSimulatedTraining());
  $('stopTrainingBtn').addEventListener('click', () => stopTraining());
  $('exportModelBtn').addEventListener('click', () => exportModelToDisk());
  $('saveModelBtn').addEventListener('click', () => saveModelOnServer());

  window.addEventListener('resize', () => {
    clearTimeout(window._mtResizeT);
    window._mtResizeT = setTimeout(onResizeCharts, 150);
  });
}

initModelSelect();
wireEvents();
renderDatasetTable();
$('stopTrainingBtn').disabled = true;
$('exportModelBtn').disabled = true;
$('saveModelBtn').disabled = true;
redrawAllCharts([]);
