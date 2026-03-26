import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_CONFIG_ROOT = path.join(process.cwd(), 'config', 'public');
const STREAM_INACTIVITY_MS = 30_000;
const CLEANUP_INTERVAL_MS = 1_000;

/**
 * @typedef {{ actionName: string, interval: number }} LocalActionConfig
 * @typedef {{ configName: string, config: { serverRecognitionActions: LocalActionConfig[] }, lastProcessAt: number, lastActionRuns: Map<string, number> }} StreamState
 */

/**
 * Creates a stream-aware scheduled actions manager.
 * - register(streamId, configName): binds a stream to a JSON config file.
 * - process(streamId, eventData): runs due actions for the stream.
 * Streams are auto-unregistered after 30s with no process() call.
 *
 * @param {{ configRoot?: string }} [options]
 */
export function createScheduledActionsManager(options = {}) {
  const configRoot = options.configRoot || DEFAULT_CONFIG_ROOT;
  /** @type {Map<string, StreamState>} */
  const streamStates = new Map();
  /** @type {Map<string, { serverRecognitionActions: LocalActionConfig[] }>} */
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

  function toConfigPath(configName) {
    return path.join(configRoot, `${configName}.js`);
  }

  async function loadConfig(configName) {
    if (configCache.has(configName)) {
      return configCache.get(configName);
    }

    const configPath = toConfigPath(configName);
    let parsed = {};
    try {
      await fs.access(configPath);
      const mod = await import(pathToFileURL(configPath).href);
      parsed = mod.default ?? mod.CONFIG ?? {};
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
      // If config file is absent, treat as no local actions.
      parsed = {};
    }
    const serverRecognitionActions = Array.isArray(parsed?.serverRecognitionActions)
      ? parsed.serverRecognitionActions
      : Array.isArray(parsed?.localRecognitionActionFunctions)
        ? parsed.localRecognitionActionFunctions
      : Array.isArray(parsed?.serverRecognitionActionFunctions)
        ? parsed.serverRecognitionActionFunctions
        : [];
    const normalized = {
      serverRecognitionActions: serverRecognitionActions
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          actionName: item?.actionName || item?.action?.type || 'UNKNOWN_ACTION',
          interval:
            Number(item?.interval) > 0
              ? Number(item.interval)
              : Number(item?.timeout) > 0
                ? Number(item.timeout)
                : 0,
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

    const config = await loadConfig(trimmedConfigName);
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
    const actions = state.config?.serverRecognitionActions || [];
    for (const action of actions) {
      const lastRun = state.lastActionRuns.get(action.actionName) ?? 0;
      const minInterval = action.interval || 0;
      if (lastRun > 0 && now - lastRun < minInterval) {
        continue;
      }

      console.log('[scheduled-action]', {
        streamId: normalizedStreamId,
        configName: state.configName,
        actionName: action.actionName,
        eventData,
      });
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
