import { serverActions } from './server-actions.js';

export function orchestrateServerActions(streamId, configName, actionName, eventData = [], actionValue) {
  console.log('[server-actions-orchestrator] Orchestrating actions for streamId', streamId, configName, actionName, eventData, 'value:', actionValue);
  const fn = serverActions[actionName];
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
