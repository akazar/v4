/**
 * Recognition API: exposes setupRecognitionServer(app) to register POST /api/recognize on the main app.
 * Accepts image as base64 or data URL and optional config; uses shared image-format normalizer.
 */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { normalizeBase64Image } from './utils/image-format.js';
import { recognize as recognizeYolo } from './recognition/yolo/recognize-yolo.mjs';
import { recognize as recognizeMediapipe } from './recognition/mediapipe/recognize-mediapipe.js';
import { orchestrateServerActions } from './action-servers/server-actions-orchestrator.js';
import { serverRecognitionActions } from './action-servers/actions-runner.js';
import { setLastRecognitionResults } from './shared-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let CONFIG = null;
let recognize = null;
const serverRecognitionActionLastRun = new Map();

try {
  const configPath = path.join(__dirname, '..', '..', 'db', 'configs', 'config.js');
  const configModule = await import(pathToFileURL(configPath).href);
  CONFIG = configModule.default ?? configModule.CONFIG;
} catch (err) {
  console.warn('Could not load config.js:', err.message);
  CONFIG = {
    serverRecognition: { threshold: 0.5, maxResults: 10, classes: [], model: 'YOLO' }
  };
}

function normalizeServerRecognitionAction(item) {
  if (!item || typeof item !== 'object') return null;
  const action = item.action || item;
  const actionName = item.actionName || action?.type || item?.type;
  const actionValue =
    action?.value ??
    action?.values ??
    item?.value ??
    item?.values;
  const interval =
    Number(item?.interval) > 0
      ? Number(item.interval)
      : Number(item?.timeout) > 0
        ? Number(item.timeout)
        : 0;
  if (!actionName) return null;
  return { actionName, actionValue, interval, raw: item };
}

async function runDeclarativeServerRecognitionActions(config, detections) {
  if (!Array.isArray(detections) || detections.length === 0) return;
  const actions = Array.isArray(config?.serverRecognitionActions)
    ? config.serverRecognitionActions
    : [];
  if (!actions.length) return;

  const streamId = 'api-recognize';
  const configName = config?.id || config?.name || 'config';
  const now = Date.now();

  for (let i = 0; i < actions.length; i++) {
    const action = normalizeServerRecognitionAction(actions[i]);
    if (!action) continue;

    const throttleKey = `${configName}:${i}:${action.actionName}`;
    if (action.interval > 0) {
      const lastRun = serverRecognitionActionLastRun.get(throttleKey) ?? 0;
      if (now - lastRun < action.interval) continue;
      serverRecognitionActionLastRun.set(throttleKey, now);
    }

    await orchestrateServerActions(
      streamId,
      configName,
      action.actionName,
      detections,
      action.actionValue,
      action.raw
    );
  }
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
      setLastRecognitionResults(detections);

      await runDeclarativeServerRecognitionActions(effectiveConfig, detections);

      const actionFns = effectiveConfig?.serverRecognitionActionFunctions;
      if (Array.isArray(actionFns) && actionFns.length > 0) {
        await serverRecognitionActions(detections, actionFns);
      }

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