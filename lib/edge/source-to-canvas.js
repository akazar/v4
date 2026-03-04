/**
 * Draw a video frame into a canvas (reused if provided). Resizes canvas only when dimensions change.
 * Use this in loops to avoid allocating a new canvas every frame (saves memory on mobile).
 * @param {HTMLVideoElement} video
 * @param {{ maxWidth?: number, maxHeight?: number }} [options]
 * @param {HTMLCanvasElement|null} [reusableCanvas]
 * @returns {HTMLCanvasElement}
 */
export function videoToReusableCanvas(video, options = {}, reusableCanvas = null) {
  if (video.readyState < 2) {
    throw new Error('Video element is not ready');
  }
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (!w || !h) {
    throw new Error('Video dimensions not available');
  }
  const maxW = options.maxWidth;
  const maxH = options.maxHeight;
  if (typeof maxW === 'number' || typeof maxH === 'number') {
    const limitW = typeof maxW === 'number' ? maxW : Infinity;
    const limitH = typeof maxH === 'number' ? maxH : Infinity;
    const r = Math.min(limitW / w, limitH / h, 1);
    if (r < 1) {
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
  }
  if (!reusableCanvas) {
    reusableCanvas = document.createElement('canvas');
  }
  if (reusableCanvas.width !== w || reusableCanvas.height !== h) {
    reusableCanvas.width = w;
    reusableCanvas.height = h;
  }
  const ctx = reusableCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, w, h);
  return reusableCanvas;
}

/**
 * Convert image source to canvas.
 * @param {HTMLVideoElement|HTMLCanvasElement|Blob|HTMLImageElement} image - Image source
 * @param {{ maxWidth?: number, maxHeight?: number }} [options] - Optional max dimensions (fit within box); reduces memory on mobile
 * @returns {Promise<HTMLCanvasElement>} Canvas containing the image
 */
export async function imageToCanvas(image, options = {}) {
  if (image instanceof HTMLVideoElement) {
    return Promise.resolve(videoToReusableCanvas(image, options, null));
  }
  if (image instanceof HTMLCanvasElement) {
    return image;
  }
  if (image instanceof HTMLImageElement) {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.width;
    sourceCanvas.height = image.height;
    const ctx = sourceCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return sourceCanvas;
  }
  if (image instanceof Blob) {
    const img = new Image();
    const url = URL.createObjectURL(image);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    const ctx = sourceCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return sourceCanvas;
  }
  throw new Error('Invalid image type. Expected HTMLVideoElement, HTMLCanvasElement, HTMLImageElement, or Blob');
}
