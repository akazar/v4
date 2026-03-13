import CONFIG from '/config/public/config-default.js';
import { drawBoundingBoxes } from '/lib/edge/bounding-boxes.js';
import { recognizeWithYolo } from '/lib/edge/recognition/yolo/recognize-yolo.js';
import { recognize as recognizeMediapipe } from '/lib/edge/recognition/mediapipe/recognize-mediapipe.js';

let recognitionPromise = Promise.resolve();

export function captureFrame(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
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
  const boxes = projectDetectionsToCanvas(detections, img, canvas);
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

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load captured frame'));
    img.src = dataUrl;
  });
}

export async function captureAndRecognize(videoEl, model, resultCanvas, summaryEl) {
  if (videoEl.readyState < 2) {
    if (summaryEl) summaryEl.textContent = 'Video not ready yet.';
    return;
  }

  const previous = recognitionPromise;
  let resolveCurrent;
  recognitionPromise = new Promise((r) => { resolveCurrent = r; });
  await previous;

  const dataUrl = captureFrame(videoEl);
  const img = await loadImage(dataUrl);

  const container = resultCanvas.parentElement;
  const maxWidth = container?.clientWidth || img.naturalWidth || 640;
  const ratio = img.naturalWidth / img.naturalHeight;
  resultCanvas.width = maxWidth;
  resultCanvas.height = Math.round(maxWidth / ratio);

  const ctx = resultCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, resultCanvas.width, resultCanvas.height);

  if (summaryEl) summaryEl.textContent = 'Recognizing…';

  try {
    let detections;
    if (model === 'YOLO') {
      detections = await recognizeWithYolo(dataUrl, CONFIG);
    } else {
      detections = await recognizeMediapipe(dataUrl, CONFIG);
    }
    renderDetections(resultCanvas, detections, summaryEl, img);
  } catch (err) {
    console.error('Recognition error:', err);
    if (summaryEl) summaryEl.textContent = `Recognition failed: ${err.message || err}`;
  } finally {
    resolveCurrent();
  }
}
