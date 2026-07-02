import { localActions } from './local-actions.js';

export function orchestrateLocalActions(streamId, configName, actionName, eventData = [], actionValue) {
  console.log('[local-actions-orchestrator] Orchestrating actions for streamId', streamId, configName, actionName, eventData, 'value:', actionValue);
  const fn = localActions[actionName];
  if (fn) {
    return fn(eventData, actionValue);
  }
  return {
    success: false,
    data: {
      message: 'Action not found',
    },
  };
}
