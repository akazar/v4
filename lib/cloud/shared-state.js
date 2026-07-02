/**
 * shared-state.js — Shared in-memory state for last reasoning and recognition results.
 * Used so that reasoning-service, recognition-service, and action-services/api-service (intervals/actions)
 * all see the same latest values regardless of which endpoint produced them.
 */

let lastReasoningResult = '';
let lastRecognitionResults = [];

export function getLastReasoningResult() {
  return lastReasoningResult;
}

export function setLastReasoningResult(value) {
  lastReasoningResult = typeof value === 'string' ? value : '';
}

export function getLastRecognitionResults() {
  return Array.isArray(lastRecognitionResults) ? lastRecognitionResults : [];
}

export function setLastRecognitionResults(value) {
  lastRecognitionResults = Array.isArray(value) ? value : [];
}
