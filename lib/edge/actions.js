/**
 * Action module for executing action functions with recognition results
 */

/**
 * Runs action functions with recognition results
 * @param {Array} recognitionResults - Recognition results array from recognize() function
 * @param {Array<Function>} actionFunctions - Array of functions to execute, each receiving recognitionResults as parameter
 * @returns {Promise<Array>} Results from all action functions
 */
export async function action(recognitionResults, actionFunctions = []) {
    if (!Array.isArray(actionFunctions) || actionFunctions.length === 0) {
        return [];
    }

    if (!Array.isArray(recognitionResults)) {
        console.warn('action: recognitionResults is not an array');
        return [];
    }

    const results = [];
    
    for (const actionFn of actionFunctions) {
        if (typeof actionFn !== 'function') {
            console.warn('action: skipping non-function item in actionFunctions array');
            continue;
        }

        try {
            const result = await Promise.resolve(actionFn(recognitionResults));
            results.push(result);
        } catch (error) {
            console.error('Error executing action function:', error);
            results.push({ error: error.message });
        }
    }

    return results;
}

/** Last run timestamp per local recognition action (index in array). Used for schedule.delay throttling. */
const localRecognitionLastRun = new Map();

/**
 * Runs local recognition action functions with recognitionResults.
 * Only runs when recognitionResults has one or more items.
 * Each function is throttled by its own schedule.delay (ms) from the last run of that function.
 * @param {Array} recognitionResults - Recognition results array from recognize()
 * @param {Array<{func: (recognitionResults: Array) => void, schedule?: {delay?: number|null}}>} localRecognitionActionFunctions - Array of { func, schedule } from config
 * @returns {Promise<Array>} Results from executed action functions
 */
export async function localRecognitionActions(recognitionResults, localRecognitionActionFunctions = []) {
    if (!Array.isArray(recognitionResults) || recognitionResults.length === 0) {
        return [];
    }
    if (!Array.isArray(localRecognitionActionFunctions) || localRecognitionActionFunctions.length === 0) {
        return [];
    }

    const now = Date.now();
    const results = [];

    for (let i = 0; i < localRecognitionActionFunctions.length; i++) {
        const item = localRecognitionActionFunctions[i];
        const fn = item?.func;
        const delayMs = item?.interval;

        if (typeof fn !== 'function') {
            console.warn('localRecognitionActions: skipping item without func at index', i);
            continue;
        }

        // When delay is null/undefined/0: run every time, no throttle
        const hasDelay = delayMs != null && typeof delayMs === 'number' && delayMs > 0;
        if (hasDelay) {
            const lastRun = localRecognitionLastRun.get(i) ?? 0;
            if (now - lastRun < delayMs) continue;
            localRecognitionLastRun.set(i, now);
        }

        try {
            const result = await Promise.resolve(fn(recognitionResults));
            results.push(result);
        } catch (error) {
            console.error('Error executing local recognition action function:', error);
            results.push({ error: error.message });
        }
    }

    return results;
}
