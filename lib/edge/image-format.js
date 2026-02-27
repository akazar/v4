/**
 * Unified image format helpers for client-side recognition and reasoning.
 * All paths use data URL (e.g. data:image/jpeg;base64,...) as the canonical image payload.
 */

import { imageToCanvas } from './source-to-canvas.js';

const DEFAULT_JPEG_QUALITY = 0.95;

/**
 * Convert any image source to a data URL string (canonical format for APIs and recognizers).
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement|Blob|File} source
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
export async function toDataUrl(source) {
  if (source instanceof HTMLCanvasElement) {
    return Promise.resolve(source.toDataURL('image/jpeg', DEFAULT_JPEG_QUALITY));
  }
  if (
    source instanceof HTMLVideoElement ||
    source instanceof HTMLImageElement ||
    source instanceof Blob
  ) {
    const canvas = await imageToCanvas(source);
    return canvas.toDataURL('image/jpeg', DEFAULT_JPEG_QUALITY);
  }
  throw new Error(
    'Invalid image source: expected HTMLVideoElement, HTMLCanvasElement, HTMLImageElement, or Blob/File'
  );
}

/**
 * Create a canvas from a data URL (e.g. for drawing bounding boxes after recognition).
 * @param {string} dataUrl
 * @returns {Promise<HTMLCanvasElement>}
 */
export function dataUrlToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image from data URL'));
    img.src = dataUrl;
  });
}
