/**
 * Recognition API: exposes setupRecognitionServer(app) to register POST /api/recognize on the main app.
 * Accepts image as base64 or data URL and optional config; uses shared image-format normalizer.
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { normalizeBase64Image } from './utils/image-format.js';
import { recognize as recognizeYolo } from './recognition/yolo/detect-yolo.mjs';
import { recognize as recognizeMediapipe } from './recognition/mediapipe/detect-mediapipe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let CONFIG = null;
let recognize = null;

try {
  const configPath = path.join(__dirname, '..', '..', 'config', 'config.js');
  const configModule = await import(pathToFileURL(configPath).href);
  CONFIG = configModule.default ?? configModule.CONFIG;
} catch (err) {
  console.warn('Could not load config.js:', err.message);
  CONFIG = {
    serverRecognition: { threshold: 0.5, maxResults: 10, classes: [], model: 'YOLO' }
  };
}

/**
 * Registers the recognition API on the given Express app.
 * @param {Express.Application} app - Express application instance
 */
export function setupRecognitionServer(app) {
  /**
   * POST /api/recognize
   * Body: { image: string (base64), mime?: string, config?: object }
   * Returns: { success: true, detections: Array } or { success: false, error: string }
   */
  app.post('/api/recognize', async (req, res) => {
    try {
      const { image, mime = 'image/jpeg', config } = req.body ?? {};
      if (!image || typeof image !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid body: "image" (base64 or data URL string) required',
        });
      }

      const imagePayload = image.startsWith('data:') ? image : `data:${mime};base64,${image.replace(/^data:[^;]+;base64,/, '')}`;
      const { dataUrl } = normalizeBase64Image(imagePayload);
      const effectiveConfig = config && typeof config === 'object' ? config : CONFIG;
      recognize = effectiveConfig?.serverRecognition?.model === 'YOLO' ? recognizeYolo : recognizeMediapipe;

      const detections = await recognize(dataUrl, effectiveConfig);

      return res.json({ success: true, detections });
    } catch (err) {
      console.error('[recognition]', err?.stack ?? err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  });
}
