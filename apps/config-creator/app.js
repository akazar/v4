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

    function buildConfigJs() {
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

        const ui = useUi && document.getElementById('ui').checked;

        let localRecognitionStr = 'null';
        if (useLocalRecognition) {
            const classesInput = document.getElementById('localClasses').value;
            const classes = classesInput.split(',').map(s => s.trim()).filter(Boolean);
            if (classes.length === 0) classes.push('person');
            const maxResults = parseInt(document.getElementById('localMaxResults').value, 10) || 10;
            const threshold = parseFloat(document.getElementById('localThreshold').value) || 0.5;
            const iouThreshold = parseFloat(document.getElementById('localIouThreshold').value) || 0.45;
            const model = (document.getElementById('localModel').value || 'YOLO').replace(/"/g, '\\"');
            localRecognitionStr = `{
        classes: ${formatClassesArray(classes)},
        maxResults: ${maxResults},
        threshold: ${threshold},
        iouThreshold: ${iouThreshold},
        model: '${model}'
    }`;
        }

        let boundingBoxStylesStr = 'null';
        if (useBoundingBoxStyles) {
            const interval = parseInt(document.getElementById('boundingBoxInterval').value, 10) || 1000;
            boundingBoxStylesStr = `{
        strokeStyle: '${(document.getElementById('strokeStyle').value || '#00FFAA').replace(/'/g, "\\'")}',
        lineWidth: ${parseInt(document.getElementById('lineWidth').value, 10) || 3},
        shadowColor: '${(document.getElementById('shadowColor').value || 'rgba(0, 0, 0, 0.5)').replace(/'/g, "\\'")}',
        shadowBlur: ${parseInt(document.getElementById('shadowBlur').value, 10) || 4},
        font: '${(document.getElementById('font').value || '16px system-ui, -apple-system, sans-serif').replace(/'/g, "\\'")}',
        labelBgColor: '${(document.getElementById('labelBgColor').value || 'rgba(0, 0, 0, 0.8)').replace(/'/g, "\\'")}',
        labelTextColor: '${(document.getElementById('labelTextColor').value || '#00FFAA').replace(/'/g, "\\'")}',
        labelPadding: ${parseInt(document.getElementById('labelPadding').value, 10) || 6},
        borderRadius: ${parseInt(document.getElementById('borderRadius').value, 10) || 4},
        interval: ${interval}
    }`;
        }

        let localRecognitionActionFunctionsStr = '[]';
        if (useLocalRecognitionActionFunctions) {
            const rows = document.querySelectorAll('#localRecognitionActions .action-row');
            const actions = Array.from(rows).map(row => {
                const body = row.querySelector('.action-body').value.trim();
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? (parseInt(intervalInput.value, 10) || 5000) : 5000;
                return { body, interval };
            }).filter(a => a.body.length > 0);
            if (actions.length > 0) {
                localRecognitionActionFunctionsStr = '[\n' + actions.map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return `        {
            func: (recognitionResults) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < actions.length - 1 ? ',' : ''}`;
                }).join('\n') + '\n    ]';
            }
        }

        let localRegularActionFunctionsStr = '[]';
        if (useLocalRegularActionFunctions) {
            const regularActionRows = document.querySelectorAll('#localRegularActions .action-row');
            const regularActions = Array.from(regularActionRows).map(row => {
                const body = row.querySelector('.action-body').value.trim();
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? (parseInt(intervalInput.value, 10) || 15000) : 15000;
                return { body, interval };
            }).filter(a => a.body.length > 0);
            if (regularActions.length > 0) {
                localRegularActionFunctionsStr = '[\n' + regularActions.map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return `        {
            func: (recognitionResults) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < regularActions.length - 1 ? ',' : ''}`;
                }).join('\n') + '\n    ]';
            }
        }

        let serverRecognitionStr = 'null';
        if (useServerRecognition) {
            const classesInput = document.getElementById('serverClasses').value;
            const classes = classesInput.split(',').map(s => s.trim()).filter(Boolean);
            if (classes.length === 0) classes.push('person');
            const maxResults = parseInt(document.getElementById('serverMaxResults').value, 10) || 10;
            const threshold = parseFloat(document.getElementById('serverThreshold').value) || 0.5;
            const iouThreshold = parseFloat(document.getElementById('serverIouThreshold').value) || 0.45;
            const model = (document.getElementById('serverModel').value || 'YOLO').replace(/"/g, '\\"');
            serverRecognitionStr = `{
        classes: ${formatClassesArray(classes)},
        maxResults: ${maxResults},
        threshold: ${threshold},
        iouThreshold: ${iouThreshold},
        model: '${model}'
    }`;
        }

        let serverReasoningStr = 'null';
        if (useServerReasoning) {
            const model = (document.getElementById('serverReasoningModel').value || 'openai').replace(/"/g, '\\"');
            const prompt = document.getElementById('serverReasoningPrompt').value.trim() ||
                'Describe this image in detail. What objects, people, or scene do you see?';
            serverReasoningStr = `{
        model: '${model}',
        prompt: '${escapeForSingleQuotedJs(prompt)}'
    }`;
        }

        let serverRecognitionActionFunctionsStr = '[]';
        if (useServerRecognitionActionFunctions) {
            const rows = document.querySelectorAll('#serverRecognitionActions .action-row');
            const actions = Array.from(rows).map(row => {
                const body = row.querySelector('.action-body').value.trim();
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? (parseInt(intervalInput.value, 10) || 5000) : 5000;
                return { body, interval };
            }).filter(a => a.body.length > 0);
            if (actions.length > 0) {
                serverRecognitionActionFunctionsStr = '[\n' + actions.map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return `        {
            func: (recognitionResults) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < actions.length - 1 ? ',' : ''}`;
                }).join('\n') + '\n    ]';
            }
        }

        let serverReasoningActionFunctionsStr = '[]';
        if (useServerReasoningActionFunctions) {
            const rows = document.querySelectorAll('#serverReasoningActions .action-row');
            const actions = Array.from(rows).map(row => {
                const body = row.querySelector('.action-body').value.trim();
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? (parseInt(intervalInput.value, 10) || 5000) : 5000;
                return { body, interval };
            }).filter(a => a.body.length > 0);
            if (actions.length > 0) {
                serverReasoningActionFunctionsStr = '[\n' + actions.map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return `        {
            func: (recognitionResults, reasoningResults) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < actions.length - 1 ? ',' : ''}`;
                }).join('\n') + '\n    ]';
            }
        }

        let serverRegularActionFunctionsStr = '[]';
        if (useServerRegularActionFunctions) {
            const serverRegularRows = document.querySelectorAll('#serverRegularActions .action-row');
            const serverRegularActions = Array.from(serverRegularRows).map(row => {
                const body = row.querySelector('.action-body').value.trim();
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? (parseInt(intervalInput.value, 10) || 10000) : 10000;
                return { body, interval };
            }).filter(a => a.body.length > 0);
            if (serverRegularActions.length > 0) {
                serverRegularActionFunctionsStr = '[\n' + serverRegularActions.map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return `        {
            func: (recognitionResults, reasoningResults) => {\n${indented}\n            },
            interval: ${a.interval}
        }${i < serverRegularActions.length - 1 ? ',' : ''}`;
                }).join('\n') + '\n    ]';
            }
        }

        const out = `/**
 * Single configuration object for the v4 app
 */
const CONFIG = {
    /////////////////////// LOCAL CONFIG ///////////////////////
    ui: ${ui},
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
        return out;
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
        const js = buildConfigJs();
        downloadFile(js, 'config.js');
    });
})();
