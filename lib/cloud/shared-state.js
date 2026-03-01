/**
 * shared-state.js — Shared in-memory state for last reasoning and recognition results.
 * Used so that reasoning-server, recognition-server, and api-server (intervals/actions)
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
