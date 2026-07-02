import { serverActions } from './server-actions.js';

const customServerRecognitionModules = new Map();

function safeConfigName(configName) {
  const name = String(configName || '').trim();
  return /^[a-zA-Z0-9_-]+$/.test(name) ? name : '';
}

async function loadCustomServerRecognitionActions(configName) {
  const safeName = safeConfigName(configName);
  if (!safeName || typeof window !== 'undefined') return null;
  if (customServerRecognitionModules.has(safeName)) {
    return customServerRecognitionModules.get(safeName);
  }

  try {
    const [{ default: path }, { access }, { pathToFileURL }] = await Promise.all([
      import('node:path'),
      import('node:fs/promises'),
      import('node:url'),
    ]);
    const filePath = path.join(process.cwd(), 'config', 'public', 'assets', safeName, 'serverRecognitionActions.js');
    await access(filePath);
    const mod = await import(pathToFileURL(filePath).href);
    customServerRecognitionModules.set(safeName, mod);
    return mod;
  } catch (error) {
    customServerRecognitionModules.set(safeName, null);
    return null;
  }
}

async function runCustomServerRecognitionActions(streamId, configName, eventData, actionValue, actionConfig) {
  const names = Array.isArray(actionValue) ? actionValue : actionValue != null ? [actionValue] : [];
  if (!names.length) return { success: false, data: { message: 'No custom action names provided' } };

  const mod = await loadCustomServerRecognitionActions(configName);
  if (!mod) return { success: false, data: { message: 'Custom server action module not found' } };

  const results = [];
  for (const name of names) {
    const fn = mod?.[name];
    if (typeof fn !== 'function') {
      results.push({ name, success: false, error: 'Custom server action not found' });
      continue;
    }

    try {
      results.push({
        name,
        success: true,
        data: await Promise.resolve(fn(eventData, actionConfig)),
      });
    } catch (error) {
      console.error('[server-actions-orchestrator] Custom server action failed', streamId, configName, name, error);
      results.push({ name, success: false, error: String(error?.message || error) });
    }
  }

  return { success: results.some((item) => item.success), data: results };
}

export async function orchestrateServerActions(streamId, configName, actionName, eventData = [], actionValue, actionConfig = null) {
  console.log('[server-actions-orchestrator] Orchestrating actions for streamId', streamId, configName, actionName, eventData, 'value:', actionValue);
  const fn = serverActions[actionName];
  if (fn) {
    return fn(eventData, actionValue);
  }
  if (actionName === 'CUSTOM') {
    return runCustomServerRecognitionActions(streamId, configName, eventData, actionValue, actionConfig);
  }
  return {
    success: false,
    data: {
      message: 'Action not found',
    },
  };
}
