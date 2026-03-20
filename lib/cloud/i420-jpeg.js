/**
 * Convert an I420 video frame (from node-webrtc RTCVideoSink) to a JPEG data URL.
 * Optional maxWidth / maxHeight mirror {@link ../edge/source-to-canvas.js} videoToReusableCanvas
 * “fit within box” scaling to limit decode/recognition cost on the server.
 */

import sharp from 'sharp';

/**
 * @param {{ width: number, height: number, data: Uint8Array|Uint8ClampedArray }} i420Frame
 * @param {(src: { width: number, height: number, data: Uint8Array|Uint8ClampedArray }, dst: { width: number, height: number, data: Uint8Array }) => void} i420ToRgba
 * @param {{ maxWidth?: number, maxHeight?: number, jpegQuality?: number }} [options]
 * @returns {Promise<{ dataUrl: string, jpegWidth: number, jpegHeight: number, frameWidth: number, frameHeight: number }>}
 */
export async function i420FrameToJpegDataUrl(i420Frame, i420ToRgba, options = {}) {
  const { width, height, data } = i420Frame;
  if (!width || !height || !data?.length) {
    throw new Error('Invalid I420 frame');
  }

  const rgba = new Uint8Array(width * height * 4);
  i420ToRgba(
    { width, height, data },
    { width, height, data: rgba }
  );

  let w = width;
  let h = height;
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

  const q = typeof options.jpegQuality === 'number' ? options.jpegQuality : 85;
  const buf = await sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  })
    .resize(w, h)
    .jpeg({ quality: q })
    .toBuffer();

  return {
    dataUrl: `data:image/jpeg;base64,${buf.toString('base64')}`,
    jpegWidth: w,
    jpegHeight: h,
    frameWidth: width,
    frameHeight: height,
  };
}
