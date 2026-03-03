(function () {
    'use strict';

    const form = document.getElementById('configForm');

    function indentBlock(text, spaces) {
        const pad = ' '.repeat(spaces);
        return text
            .split('\n')
            .map(line => (line.trim() === '' ? '' : pad + line))
            .join('\n');
    }

    function escapeForSingleQuotedJs(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    function formatClassesArray(arr) {
        return '[\n            ' + arr.map(s => "'" + escapeForSingleQuotedJs(s) + "'").join(',\n            ') + '\n        ]';
    }

    function isSectionEnabled(id) {
        const el = document.getElementById(id);
        return el ? el.checked : true;
    }

    const num = (el, def) => (el ? (parseInt(el.value, 10) || def) : def);
    const float = (el, def) => (el ? (parseFloat(el.value) || def) : def);
    const parseClasses = (val) => {
        const arr = (val || '').split(',').map(s => s.trim()).filter(Boolean);
        return arr.length ? arr : ['person'];
    };

    function readActionRows(containerId, defaultInterval) {
        const rows = document.querySelectorAll(`#${containerId} .action-row`);
        return Array.from(rows).map(row => {
            const body = row.querySelector('.action-body').value.trim();
            const intervalInput = row.querySelector('.interval-ms');
            const interval = intervalInput ? (parseInt(intervalInput.value, 10) || defaultInterval) : defaultInterval;
            return { body, interval };
        }).filter(a => a.body.length > 0);
    }

    /** Single source of truth: read all form fields into one data object. */
    function readFormConfig() {
        const useUi = isSectionEnabled('useUi');
        const useLocalRecognition = isSectionEnabled('useLocalRecognition');
        const useBoundingBoxStyles = isSectionEnabled('useBoundingBoxStyles');
        const useLocalRecognitionActionFunctions = isSectionEnabled('useLocalRecognitionActionFunctions');
        const useLocalRegularActionFunctions = isSectionEnabled('useLocalRegularActionFunctions');
        const useServerRecognition = isSectionEnabled('useServerRecognition');
        const useServerReasoning = isSectionEnabled('useServerReasoning');
        const useServerRecognitionActionFunctions = isSectionEnabled('useServerRecognitionActionFunctions');
        const useServerReasoningActionFunctions = isSectionEnabled('useServerReasoningActionFunctions');
        const useServerRegularActionFunctions = isSectionEnabled('useServerRegularActionFunctions');

        const configName = (document.getElementById('configName').value || 'config').trim() || 'config';
        const configId = configName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'config';
        const configDescription = (document.getElementById('configDescription').value || '').trim() || 'Default configuration';
        const ui = useUi && document.getElementById('ui').checked;

        let localRecognition = null;
        if (useLocalRecognition) {
            localRecognition = {
                classes: parseClasses(document.getElementById('localClasses').value),
                maxResults: num(document.getElementById('localMaxResults'), 10),
                threshold: float(document.getElementById('localThreshold'), 0.5),
                iouThreshold: float(document.getElementById('localIouThreshold'), 0.45),
                model: document.getElementById('localModel').value || 'YOLO',
                interval: num(document.getElementById('localInterval'), 1000),
            };
        }

        let boundingBoxStyles = null;
        if (useBoundingBoxStyles) {
            boundingBoxStyles = {
                strokeStyle: document.getElementById('strokeStyle').value || '#00FFAA',
                lineWidth: num(document.getElementById('lineWidth'), 3),
                shadowColor: document.getElementById('shadowColor').value || 'rgba(0, 0, 0, 0.5)',
                shadowBlur: num(document.getElementById('shadowBlur'), 4),
                font: document.getElementById('font').value || '16px system-ui, -apple-system, sans-serif',
                labelBgColor: document.getElementById('labelBgColor').value || 'rgba(0, 0, 0, 0.8)',
                labelTextColor: document.getElementById('labelTextColor').value || '#00FFAA',
                labelPadding: num(document.getElementById('labelPadding'), 6),
                borderRadius: num(document.getElementById('borderRadius'), 4),
                interval: num(document.getElementById('boundingBoxInterval'), 1000),
            };
        }

        let serverRecognition = null;
        if (useServerRecognition) {
            serverRecognition = {
                classes: parseClasses(document.getElementById('serverClasses').value),
                maxResults: num(document.getElementById('serverMaxResults'), 10),
                threshold: float(document.getElementById('serverThreshold'), 0.5),
                iouThreshold: float(document.getElementById('serverIouThreshold'), 0.45),
                model: document.getElementById('serverModel').value || 'YOLO',
            };
        }

        let serverReasoning = null;
        if (useServerReasoning) {
            serverReasoning = {
                model: document.getElementById('serverReasoningModel').value || 'openai',
                prompt: document.getElementById('serverReasoningPrompt').value.trim() ||
                    'Describe this image in detail. What objects, people, or scene do you see?',
            };
        }

        return {
            configName,
            configId,
            configDescription,
            ui,
            localRecognition,
            boundingBoxStyles,
            serverRecognition,
            serverReasoning,
            localRecognitionActionFunctions: useLocalRecognitionActionFunctions ? readActionRows('localRecognitionActions', 5000) : [],
            localRegularActionFunctions: useLocalRegularActionFunctions ? readActionRows('localRegularActions', 15000) : [],
            serverRecognitionActionFunctions: useServerRecognitionActionFunctions ? readActionRows('serverRecognitionActions', 5000) : [],
            serverReasoningActionFunctions: useServerReasoningActionFunctions ? readActionRows('serverReasoningActions', 5000) : [],
            serverRegularActionFunctions: useServerRegularActionFunctions ? readActionRows('serverRegularActions', 10000) : [],
        };
    }

    function formatRecognitionJs(obj) {
        if (!obj) return 'null';
        return `{
        classes: ${formatClassesArray(obj.classes)},
        maxResults: ${obj.maxResults},
        threshold: ${obj.threshold},
        iouThreshold: ${obj.iouThreshold},
        model: '${String(obj.model).replace(/'/g, "\\'")}',
        interval: ${obj.interval}
    }`;
    }

    function formatBoundingBoxStylesJs(obj) {
        if (!obj) return 'null';
        const q = (s) => (s || '').replace(/'/g, "\\'");
        return `{
        strokeStyle: '${q(obj.strokeStyle)}',
        lineWidth: ${obj.lineWidth},
        shadowColor: '${q(obj.shadowColor)}',
        shadowBlur: ${obj.shadowBlur},
        font: '${q(obj.font)}',
        labelBgColor: '${q(obj.labelBgColor)}',
        labelTextColor: '${q(obj.labelTextColor)}',
        labelPadding: ${obj.labelPadding},
        borderRadius: ${obj.borderRadius},
        interval: ${obj.interval}
    }`;
    }

    function formatReasoningJs(obj) {
        if (!obj) return 'null';
        return `{
        model: '${String(obj.model).replace(/'/g, "\\'")}',
        prompt: '${escapeForSingleQuotedJs(obj.prompt)}'
    }`;
    }

    function formatActionFunctionsJs(actions, paramList) {
        if (!actions.length) return '[]';
        return '[\n' + actions.map((a, i) => {
            const indented = indentBlock(a.body, 12);
            return `        {
            func: (${paramList}) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < actions.length - 1 ? ',' : ''}`;
        }).join('\n') + '\n    ]';
    }

    function buildConfigJs() {
        const d = readFormConfig();
        const localRecognitionStr = formatRecognitionJs(d.localRecognition);
        const boundingBoxStylesStr = formatBoundingBoxStylesJs(d.boundingBoxStyles);
        const serverRecognitionStr = formatRecognitionJs(d.serverRecognition);
        const serverReasoningStr = formatReasoningJs(d.serverReasoning);
        const localRecognitionActionFunctionsStr = formatActionFunctionsJs(d.localRecognitionActionFunctions, 'recognitionResults');
        const localRegularActionFunctionsStr = formatActionFunctionsJs(d.localRegularActionFunctions, 'recognitionResults');
        const serverRecognitionActionFunctionsStr = formatActionFunctionsJs(d.serverRecognitionActionFunctions, 'recognitionResults');
        const serverReasoningActionFunctionsStr = formatActionFunctionsJs(d.serverReasoningActionFunctions, 'recognitionResults, reasoningResults');
        const serverRegularActionFunctionsStr = formatActionFunctionsJs(d.serverRegularActionFunctions, 'recognitionResults, reasoningResults');

        return `/**
 * Single configuration object for the v4 app
 */
const CONFIG = {
    /////////////////////// LOCAL CONFIG ///////////////////////
    id: '${escapeForSingleQuotedJs(d.configId)}',
    name: '${escapeForSingleQuotedJs(d.configName)}',
    description: '${escapeForSingleQuotedJs(d.configDescription)}',
    ui: ${d.ui},
    localRecognition: ${localRecognitionStr},
    boundingBoxStyles: ${boundingBoxStylesStr},
    localRecognitionActionFunctions: ${localRecognitionActionFunctionsStr},
    localRegularActionFunctions: ${localRegularActionFunctionsStr},

    /////////////////////// SERVER CONFIG ///////////////////////
    serverRecognition: ${serverRecognitionStr},
    serverReasoning: ${serverReasoningStr},
    serverRecognitionActionFunctions: ${serverRecognitionActionFunctionsStr},
    serverReasoningActionFunctions: ${serverReasoningActionFunctionsStr},
    serverRegularActionFunctions: ${serverRegularActionFunctionsStr},
};

export default CONFIG;
export { CONFIG };
`;
    }

    /** Returns a plain object for POST /api/configurations (action arrays are [] because JSON cannot serialize functions). */
    function buildConfigObject() {
        const d = readFormConfig();
        return {
            id: d.configId,
            name: d.configName,
            description: d.configDescription,
            ui: d.ui,
            localRecognition: d.localRecognition,
            boundingBoxStyles: d.boundingBoxStyles,
            localRecognitionActionFunctions: [],
            localRegularActionFunctions: [],
            serverRecognition: d.serverRecognition,
            serverReasoning: d.serverReasoning,
            serverRecognitionActionFunctions: [],
            serverReasoningActionFunctions: [],
            serverRegularActionFunctions: [],
        };
    }

    const PRESET_NOTIFICATION_BODY = `fetch(\`/api/notify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        recognitionResults: recognitionResults,
        channel: 'email',
        recipient: 'test@test.com'
    })
})
    .then(response => response.json())
    .then(data => console.log('[Notify]', data))
    .catch(error => console.error('[Notify] Failed to fetch. Is the server running?', error));`;
    const PRESET_NOTIFICATION_INTERVAL = 10000;

    const PRESET_DB_BODY = `fetch(\`/api/db\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        recognitionResults: recognitionResults,
    })
})`;
    const PRESET_DB_INTERVAL = 20000;

    const PRESET_SERVER_NOTIFICATION_BODY = `fetch(\`/api/notify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        recognitionResults: recognitionResults,
        reasoningResults: reasoningResults,
        channel: 'email',
        recipient: 'test@test.com'
    })
})
    .then(response => response.json())
    .then(data => console.log('[Notify]', data))
    .catch(error => console.error('[Notify] Failed to fetch. Is the server running?', error));`;
    const PRESET_SERVER_NOTIFICATION_INTERVAL = 10000;

    const PRESET_SERVER_DB_BODY = `console.log('[Factory - Local Regular Action] Results (20000ms delay):', recognitionResults);
fetch(\`/api/db\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        recognitionResults: recognitionResults,
        reasoningResults: reasoningResults
    })
})`;
    const PRESET_SERVER_DB_INTERVAL = 20000;

    function addActionRow(containerId, withInterval, defaultInterval) {
        const container = document.getElementById(containerId);
        const row = document.createElement('div');
        row.className = 'action-row' + (withInterval ? ' with-interval' : '');
        const intervalVal = defaultInterval != null ? defaultInterval : 15000;
        row.innerHTML = withInterval
            ? `<textarea class="action-body" rows="3" placeholder="console.log(recognitionResults);"></textarea>
               <div class="field interval-field">
                   <label>Interval (ms)</label>
                   <input type="number" class="interval-ms" value="${intervalVal}" min="0">
               </div>
               <button type="button" class="btn-remove" title="Remove">−</button>`
            : `<textarea class="action-body" rows="2" placeholder="console.log(recognitionResults);"></textarea>
               <button type="button" class="btn-remove" title="Remove">−</button>`;
        container.appendChild(row);
        row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    }

    function addActionRowWithPreset(containerId, bodyText, interval) {
        addActionRow(containerId, true, interval);
        const container = document.getElementById(containerId);
        const lastRow = container.querySelector('.action-row:last-child');
        lastRow.querySelector('.action-body').value = bodyText;
        lastRow.querySelector('.interval-ms').value = interval;
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    document.getElementById('addLocalRecognitionAction').addEventListener('click', () =>
        addActionRow('localRecognitionActions', true, 5000));
    document.getElementById('addLocalRecognitionNotification').addEventListener('click', () =>
        addActionRowWithPreset('localRecognitionActions', PRESET_NOTIFICATION_BODY, PRESET_NOTIFICATION_INTERVAL));
    document.getElementById('addLocalRecognitionDb').addEventListener('click', () =>
        addActionRowWithPreset('localRecognitionActions', PRESET_DB_BODY, PRESET_DB_INTERVAL));

    document.getElementById('addLocalRegularAction').addEventListener('click', () =>
        addActionRow('localRegularActions', true, 15000));
    document.getElementById('addLocalRegularNotification').addEventListener('click', () =>
        addActionRowWithPreset('localRegularActions', PRESET_NOTIFICATION_BODY, PRESET_NOTIFICATION_INTERVAL));
    document.getElementById('addLocalRegularDb').addEventListener('click', () =>
        addActionRowWithPreset('localRegularActions', PRESET_DB_BODY, PRESET_DB_INTERVAL));

    document.getElementById('addServerRecognitionAction').addEventListener('click', () =>
        addActionRow('serverRecognitionActions', true, 5000));
    document.getElementById('addServerRecognitionNotification').addEventListener('click', () =>
        addActionRowWithPreset('serverRecognitionActions', PRESET_NOTIFICATION_BODY, PRESET_NOTIFICATION_INTERVAL));
    document.getElementById('addServerRecognitionDb').addEventListener('click', () =>
        addActionRowWithPreset('serverRecognitionActions', PRESET_DB_BODY, PRESET_DB_INTERVAL));
    document.getElementById('addServerReasoningAction').addEventListener('click', () =>
        addActionRow('serverReasoningActions', true, 5000));
    document.getElementById('addServerReasoningNotification').addEventListener('click', () =>
        addActionRowWithPreset('serverReasoningActions', PRESET_SERVER_NOTIFICATION_BODY, PRESET_SERVER_NOTIFICATION_INTERVAL));
    document.getElementById('addServerReasoningDb').addEventListener('click', () =>
        addActionRowWithPreset('serverReasoningActions', PRESET_SERVER_DB_BODY, PRESET_SERVER_DB_INTERVAL));

    document.getElementById('addServerRegularAction').addEventListener('click', () =>
        addActionRow('serverRegularActions', true, 10000));
    document.getElementById('addServerRegularNotification').addEventListener('click', () =>
        addActionRowWithPreset('serverRegularActions', PRESET_SERVER_NOTIFICATION_BODY, PRESET_SERVER_NOTIFICATION_INTERVAL));
    document.getElementById('addServerRegularDb').addEventListener('click', () =>
        addActionRowWithPreset('serverRegularActions', PRESET_SERVER_DB_BODY, PRESET_SERVER_DB_INTERVAL));

    document.querySelectorAll('#localRecognitionActions .btn-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#localRegularActions .btn-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#serverRecognitionActions .btn-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#serverReasoningActions .btn-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#serverRegularActions .btn-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const d = readFormConfig();
        const js = buildConfigJs();
        downloadFile(js, d.configId + '.js');
    });

    document.getElementById('btnGenerateAndSave').addEventListener('click', async function () {
        const config = buildConfigObject();
        const fileName = config.id + '.js';
        try {
            const res = await fetch('/api/configurations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: config.id, config }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Save failed.');
                return;
            }
            alert(`Saved as ${data.file || fileName}`);
        } catch (err) {
            console.error(err);
            alert('Request failed. Is the server running?');
        }
    });
})();
