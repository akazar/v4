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

/** Last run timestamp per config-based action (index in array). Used for timeout throttling. */
const configActionLastRun = new Map();

/**
 * Builds request URL and body for a single action config item.
 * @param {{ type: string, value: Array }} action - { type: 'DB'|'API'|'NOTIFY', value }
 * @param {Array} recognitionResults - Payload array
 * @param {string} [baseUrl=''] - Base URL for DB and NOTIFY (e.g. '' for same-origin)
 * @returns {{ url: string, body: string }} url and JSON body string
 */
function getActionRequest(action, recognitionResults, baseUrl = '') {
    const type = action?.type;
    const value = Array.isArray(action?.value) ? action.value : [];
    const idOrUrl = value[0];
    const base = (baseUrl || '').replace(/\/$/, '');
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientID') || null;
    const payload = {
        clientId: clientId,
        recognitionResults: JSON.stringify(recognitionResults)
    };

    if (type === 'DB' && idOrUrl != null) {
        return {
            url: `${base}/api/db/${encodeURIComponent(String(idOrUrl))}`,
            body: payload,
        };
    }
    if (type === 'API' && idOrUrl != null) {
        return {
            url: String(idOrUrl),
            body: payload,
        };
    }
    if (type === 'NOTIFY' && idOrUrl != null) {
        return {
            url: `${base}/api/notify/${encodeURIComponent(String(idOrUrl))}`,
            body: payload,
        };
    }
    return { url: '', body: payload };
}

/**
 * Runs local recognition actions from config (action + timeout).
 * Only runs when recognitionResults has one or more items.
 * Each item is throttled by its timeout (ms) from the last run of that item.
 * Action types: DB (POST to database URL with id in path), API (POST to URL in value), NOTIFY (POST to notification URL with id in path).
 * @param {Array} recognitionResults - Recognition results array from recognize()
 * @param {Array<{ action: { type: 'DB'|'API'|'NOTIFY', value: Array }, timeout?: number }>} localRecognitionActionConfig - Array from config
 * @param {{ baseUrl?: string }} [options] - Optional baseUrl for DB and NOTIFY (default '' = same-origin)
 * @returns {Promise<Array>} Results from executed actions
 */
export async function localRecognitionActionsFromConfig(recognitionResults, localRecognitionActionConfig = [], options = {}) {
    if (!Array.isArray(recognitionResults) || recognitionResults.length === 0) {
        return [];
    }
    if (!Array.isArray(localRecognitionActionConfig) || localRecognitionActionConfig.length === 0) {
        return [];
    }

    const baseUrl = options?.baseUrl ?? '';
    const now = Date.now();
    const results = [];

    for (let i = 0; i < localRecognitionActionConfig.length; i++) {
        const item = localRecognitionActionConfig[i];
        const action = item?.action;
        const timeoutMs = item?.timeout;

        if (!action || action?.type == null || !Array.isArray(action?.value) || action.value.length === 0) {
            console.warn('localRecognitionActionsFromConfig: skipping invalid action at index', i);
            continue;
        }

        const { url, body } = getActionRequest(action, recognitionResults, baseUrl);
        if (!url) {
            console.warn('localRecognitionActionsFromConfig: unknown action type or missing value at index', i, action?.type);
            continue;
        }

        const hasTimeout = timeoutMs != null && typeof timeoutMs === 'number' && timeoutMs > 0;
        if (hasTimeout) {
            const lastRun = configActionLastRun.get(i) ?? 0;
            if (now - lastRun < timeoutMs) continue;
            configActionLastRun.set(i, now);
        }

        try {
            console.log('[localRecognitionActionsFromConfig] Requesting: ', url, body);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            const data = response.ok ? await response.json().catch(() => ({})) : { error: response.statusText };
            results.push(data);
        } catch (error) {
            console.error('localRecognitionActionsFromConfig: request failed at index', i, error);
            results.push({ error: error?.message ?? String(error) });
        }
    }

    return results;
}

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
