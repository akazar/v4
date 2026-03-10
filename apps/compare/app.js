import CONFIG from '../../config/public/config-default.js';
import { drawBoundingBoxes } from '../../lib/edge/bounding-boxes.js';
import { recognizeWithYolo } from '../../lib/edge/recognition/yolo/recognize-yolo.js';
import { recognize as recognizeMediapipe } from '../../lib/edge/recognition/mediapipe/recognize-mediapipe.js';

const imageInput = document.getElementById('image-input');
const uploadStatus = document.getElementById('upload-status');
const originalImage = document.getElementById('original-image');

const localLeftCanvas = document.getElementById('local-left-canvas');
const localRightCanvas = document.getElementById('local-right-canvas');
const serverLeftCanvas = document.getElementById('server-left-canvas');
const serverRightCanvas = document.getElementById('server-right-canvas');

const localLeftSummary = document.getElementById('local-left-summary');
const localRightSummary = document.getElementById('local-right-summary');
const serverLeftSummary = document.getElementById('server-left-summary');
const serverRightSummary = document.getElementById('server-right-summary');

const reasoningLeft = document.getElementById('reasoning-left');
const reasoningRight = document.getElementById('reasoning-right');

const modelSelects = document.querySelectorAll('.model-select');
const reasoningSelects = document.querySelectorAll('.reasoning-select');

let currentDataUrl = null;
/** Current file (Blob) from upload – passed to YOLO like image-upload. */
let currentFile = null;
/** Serialize local recognition so MediaPipe and YOLO never run concurrently (shared singletons). */
let localRecognitionPromise = Promise.resolve();

function setStatus(message, isError = false) {
  if (!uploadStatus) return;
  uploadStatus.textContent = message || '';
  uploadStatus.classList.toggle('error', Boolean(isError));
}

function ensureImageLoaded() {
  return new Promise((resolve, reject) => {
    if (!originalImage || !currentDataUrl) {
      reject(new Error('No image uploaded yet.'));
      return;
    }
    if (originalImage.complete && originalImage.naturalWidth > 0) {
      resolve(originalImage);
      return;
    }
    originalImage.onload = () => resolve(originalImage);
    originalImage.onerror = () => reject(new Error('Failed to load image.'));
  });
}

function resizeCanvasToImage(canvas, img) {
  if (!canvas || !img) return;
  const container = canvas.parentElement;
  const maxWidth = container?.clientWidth || img.naturalWidth || img.width || 640;
  const ratio = img.naturalWidth && img.naturalHeight
    ? img.naturalWidth / img.naturalHeight
    : 4 / 3;
  const width = maxWidth;
  const height = Math.round(width / ratio);
  canvas.width = width;
  canvas.height = height;
}

function projectDetectionsToCanvas(detections, img, canvas) {
  if (!detections || !canvas || !img) return [];
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return [];
  const sx = canvas.width / iw;
  const sy = canvas.height / ih;
  return detections.map((det) => ({
    x: det.coordinates.x * sx,
    y: det.coordinates.y * sy,
    width: det.size.width * sx,
    height: det.size.height * sy,
    label: `${det.class} ${(det.confidence * 100).toFixed(0)}%`,
  }));
}

function renderDetections(canvas, detections, summaryEl, img) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (img && (img.naturalWidth || img.width)) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  if (!detections || detections.length === 0) {
    if (summaryEl) summaryEl.textContent = 'No objects detected.';
    return;
  }
  const boxes = projectDetectionsToCanvas(detections, img || originalImage, canvas);
  drawBoundingBoxes(ctx, boxes, CONFIG.boundingBoxStyles);
  if (summaryEl) {
    const top = detections
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((d) => `${d.class} ${(d.confidence * 100).toFixed(0)}%`)
      .join(', ');
    summaryEl.textContent = `${detections.length} detections` + (top ? ` – top: ${top}` : '');
  }
}

async function runLocalRecognition(target) {
  if (!currentDataUrl) {
    setStatus('Upload an image first.', true);
    return;
  }
  const previous = localRecognitionPromise;
  let resolveCurrent;
  localRecognitionPromise = new Promise((r) => { resolveCurrent = r; });
  await previous;

  const img = await ensureImageLoaded();
  const { scope, panel, value: model } = target.dataset
    ? { scope: target.dataset.scope, panel: target.dataset.panel, value: target.value }
    : target;

  const canvas =
    scope === 'local' && panel === 'left'
      ? localLeftCanvas
      : scope === 'local' && panel === 'right'
      ? localRightCanvas
      : null;
  const summaryEl =
    scope === 'local' && panel === 'left'
      ? localLeftSummary
      : scope === 'local' && panel === 'right'
      ? localRightSummary
      : null;

  if (!canvas) {
    resolveCurrent();
    return;
  }
  resizeCanvasToImage(canvas, img);
  if (summaryEl) summaryEl.textContent = 'Loading…';

  try {
    let detections;
    if (model === 'YOLO') {
      // Same as image-upload: pass Blob (from file) as source for YOLO; fallback to data URL.
      const sourceForYolo = currentFile != null ? currentFile : currentDataUrl;
      detections = await recognizeWithYolo(sourceForYolo, CONFIG);
    } else {
      detections = await recognizeMediapipe(currentDataUrl, CONFIG);
    }
    renderDetections(canvas, detections, summaryEl, img);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = typeof err === 'number' ? ' (ONNX/MediaPipe error code – try reloading or use the other model)' : '';
    console.error('Local recognition error:', err);
    if (summaryEl) summaryEl.textContent = `Recognition failed: ${msg}${hint}`;
  } finally {
    resolveCurrent();
  }
}

async function runServerRecognition(target) {
  if (!currentDataUrl) {
    setStatus('Upload an image first.', true);
    return;
  }
  const img = await ensureImageLoaded();
  const { scope, panel, value: model } = target.dataset
    ? { scope: target.dataset.scope, panel: target.dataset.panel, value: target.value }
    : target;

  const canvas =
    scope === 'server' && panel === 'left'
      ? serverLeftCanvas
      : scope === 'server' && panel === 'right'
      ? serverRightCanvas
      : null;
  const summaryEl =
    scope === 'server' && panel === 'left'
      ? serverLeftSummary
      : scope === 'server' && panel === 'right'
      ? serverRightSummary
      : null;

  if (!canvas) return;
  resizeCanvasToImage(canvas, img);

  const effectiveConfig = {
    ...CONFIG,
    serverRecognition: {
      ...CONFIG.serverRecognition,
      model,
    },
  };

  try {
    const res = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: currentDataUrl,
        mime: 'image/jpeg',
        config: effectiveConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Server recognition failed');
    }
    const detections = data.detections || [];
    renderDetections(canvas, detections, summaryEl, img);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Server recognition error:', err);
    if (summaryEl) summaryEl.textContent = `Server recognition failed: ${msg}`;
  }
}

async function runReasoning(target) {
  if (!currentDataUrl) {
    setStatus('Upload an image first.', true);
    return;
  }
  const panel = target.dataset?.panel || target.panel;
  const model = target.value || target.model;

  const textarea = panel === 'left' ? reasoningLeft : reasoningRight;
  if (!textarea) return;

  textarea.classList.add('loading');
  textarea.value = 'Thinking...';

  const prompt = CONFIG.serverReasoning?.prompt ?? 'Describe this image in detail.';

  let selectedModel = model;
  if (model === 'chatgpt' || model === 'ChatGPT') selectedModel = 'chatgpt';
  if (model === 'gemini' || model === 'Gemini') selectedModel = 'gemini';

  try {
    const res = await fetch('/api/reasoning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        imageBase64: currentDataUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Reasoning failed');
    }
    textarea.value = data.reasoning || '';
  } catch (err) {
    console.error('Reasoning error:', err);
    textarea.value = 'Reasoning failed. See console for details.';
  } finally {
    textarea.classList.remove('loading');
  }
}

imageInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setStatus('Please select an image file.', true);
    return;
  }

  setStatus('Loading image...');

  currentFile = file;
  const reader = new FileReader();
  reader.onload = async () => {
    currentDataUrl = reader.result;
    if (originalImage) {
      originalImage.src = currentDataUrl;
      originalImage.style.display = 'block';
    }
    setStatus('Image loaded. Running recognition & reasoning…');

    await ensureImageLoaded();

    const localLeft = document.querySelector('.model-select[data-scope="local"][data-panel="left"]');
    const localRight = document.querySelector('.model-select[data-scope="local"][data-panel="right"]');
    const serverLeft = document.querySelector('.model-select[data-scope="server"][data-panel="left"]');
    const serverRight = document.querySelector('.model-select[data-scope="server"][data-panel="right"]');
    const reasonLeftSelect = document.querySelector('.reasoning-select[data-panel="left"]');
    const reasonRightSelect = document.querySelector('.reasoning-select[data-panel="right"]');

    if (localLeft) await runLocalRecognition(localLeft);
    if (localRight) await runLocalRecognition(localRight);
    if (serverLeft) runServerRecognition(serverLeft);
    if (serverRight) runServerRecognition(serverRight);
    if (reasonLeftSelect) runReasoning(reasonLeftSelect);
    if (reasonRightSelect) runReasoning(reasonRightSelect);
  };
  reader.onerror = () => {
    setStatus('Failed to read image file.', true);
  };
  reader.readAsDataURL(file);
});

modelSelects.forEach((select) => {
  select.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset.scope === 'local') {
      runLocalRecognition(target);
    } else if (target.dataset.scope === 'server') {
      runServerRecognition(target);
    }
  });
});

reasoningSelects.forEach((select) => {
  select.addEventListener('change', (e) => {
    runReasoning(e.target);
  });
});

