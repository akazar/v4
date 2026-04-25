import { orchestrateServerActions } from './cloud/action-servers/server-actions-orchestrator.js';
import { orchestrateLocalActions } from './edge/actions/local-actions-orchestrator.js';

const STREAM_INACTIVITY_MS = 30_000;
const CLEANUP_INTERVAL_MS = 1_000;

/**
 * @typedef {{ actionName: string, interval: number, actionValue: unknown }} LocalActionConfig
 * @typedef {{ configName: string, config: { actions: LocalActionConfig[] }, lastProcessAt: number, lastActionRuns: Map<string, number> }} StreamState
 */

/**
 * Creates a stream-aware scheduled actions manager.
 * - register(streamId, configName): binds a stream to a config file/object.
 * - process(streamId, eventData): runs due actions for the stream.
 * Streams are auto-unregistered after 30s with no process() call.
 *
 * @param {{ configRoot?: string, actionsProperty?: string, fallbackActionProperties?: string[], loadConfig?: (configName: string, options?: { configRoot?: string }) => Promise<object> }} [options]
 */
export function createScheduledActionsManager(options = {}) {
  const configRoot = options.configRoot;
  const actionsProperty = options.actionsProperty || 'serverRecognitionActions';
  const fallbackActionProperties = Array.isArray(options.fallbackActionProperties)
    ? options.fallbackActionProperties
    : ['localRecognitionActions', 'localRecognitionActionFunctions', 'serverRecognitionActionFunctions'];
  const loadConfigImpl = typeof options.loadConfig === 'function' ? options.loadConfig : defaultNodeLoadConfig;
  /** Server SFU path uses server orchestrator; dashboard local path uses edge orchestrator. */
  const useServerOrchestrator = actionsProperty === 'serverRecognitionActions';
  /** @type {Map<string, StreamState>} */
  const streamStates = new Map();
  /** @type {Map<string, { actions: LocalActionConfig[] }>} */
  const configCache = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [streamId, state] of streamStates.entries()) {
      if (state.lastProcessAt > 0 && now - state.lastProcessAt > STREAM_INACTIVITY_MS) {
        streamStates.delete(streamId);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();

  function normalizeStreamId(streamId) {
    return typeof streamId === 'string' ? streamId.trim() : '';
  }

  async function loadAndNormalizeConfig(configName) {
    if (configCache.has(configName)) {
      return configCache.get(configName);
    }

    let parsed = {};
    try {
      parsed = (await loadConfigImpl(configName, { configRoot })) || {};
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      parsed = {};
    }

    let rawActions = Array.isArray(parsed?.[actionsProperty]) ? parsed[actionsProperty] : [];
    if (!rawActions.length) {
      for (const alt of fallbackActionProperties) {
        if (alt === actionsProperty) continue;
        if (Array.isArray(parsed?.[alt])) {
          rawActions = parsed[alt];
          break;
        }
      }
    }

    const normalized = {
      actions: rawActions
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          actionName: item?.actionName || item?.action?.type || item?.type || 'UNKNOWN_ACTION',
          interval:
            Number(item?.interval) > 0
              ? Number(item.interval)
              : Number(item?.timeout) > 0
                ? Number(item.timeout)
                : 0,
          // Accept canonical `value` (singular) and legacy/form-generator `values` (plural),
          // at both the nested `action.*` path and the flat top-level path.
          actionValue:
            item?.action?.value ??
            item?.action?.values ??
            item?.value ??
            item?.values,
        })),
    };
    configCache.set(configName, normalized);
    return normalized;
  }

  async function register(streamId, configName) {
    if (!streamId || typeof streamId !== 'string') {
      throw new Error('register(streamId, configName): streamId must be a non-empty string');
    }
    if (!configName || typeof configName !== 'string') {
      throw new Error('register(streamId, configName): configName must be a non-empty string');
    }

    const trimmedStreamId = streamId.trim();
    const trimmedConfigName = configName.trim();
    if (!trimmedStreamId || !trimmedConfigName) {
      throw new Error('register(streamId, configName): streamId/configName cannot be empty');
    }

    const config = await loadAndNormalizeConfig(trimmedConfigName);
    streamStates.set(trimmedStreamId, {
      configName: trimmedConfigName,
      config,
      lastProcessAt: Date.now(),
      lastActionRuns: new Map(),
    });
  }

  function unregister(streamId) {
    const normalizedStreamId = normalizeStreamId(streamId);
    if (!normalizedStreamId) return;
    streamStates.delete(normalizedStreamId);
  }

  async function process(streamId, eventData) {
    const normalizedStreamId = normalizeStreamId(streamId);
    const state = streamStates.get(normalizedStreamId);
    if (!state) {
      return { processed: false, reason: 'stream-not-registered' };
    }
    const now = Date.now();
    if (state.lastProcessAt > 0 && now - state.lastProcessAt > STREAM_INACTIVITY_MS) {
      streamStates.delete(normalizedStreamId);
      return { processed: false, reason: 'stream-registration-expired' };
    }
    state.lastProcessAt = now;
    // Recognition actions are only meaningful when there is at least one detection to act on.
    // Without this gate, DB/API/NOTIFY fire on every empty tick (~1Hz) just because the
    // recognizer ran, which spams the action backends.
    const hasDetections = Array.isArray(eventData) ? eventData.length > 0 : Boolean(eventData);
    if (!hasDetections) {
      return { processed: false, reason: 'no-detections' };
    }
    const actions = state.config?.actions || [];
    for (const action of actions) {
      const lastRun = state.lastActionRuns.get(action.actionName) ?? 0;
      const minInterval = action.interval || 0;
      if (lastRun > 0 && now - lastRun < minInterval) {
        continue;
      }

      console.log('[scheduled-action]', 'streamId:', normalizedStreamId, 'configName:', state.configName, 'actionName:', action.actionName, 'eventData:', eventData);
      if (useServerOrchestrator) {
        orchestrateServerActions(
          normalizedStreamId,
          state.configName,
          action.actionName,
          eventData,
          action.actionValue
        );
      } else {
        orchestrateLocalActions(
          normalizedStreamId,
          state.configName,
          action.actionName,
          eventData,
          action.actionValue
        );
      }
      state.lastActionRuns.set(action.actionName, now);
    }

    return { processed: true };
  }

  return {
    register,
    unregister,
    process,
  };
}

async function defaultNodeLoadConfig(configName, options = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('createScheduledActionsManager: loadConfig is required in browser environment');
  }

  const { default: path } = await import('node:path');
  const { access } = await import('node:fs/promises');
  const { pathToFileURL } = await import('node:url');

  const root = options.configRoot || path.join(process.cwd(), 'config', 'public');
  const configPath = path.join(root, `${configName}.js`);
  await access(configPath);
  const mod = await import(pathToFileURL(configPath).href);
  return mod.default ?? mod.CONFIG ?? {};
}
