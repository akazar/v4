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

    function slugId(raw) {
        const s = String(raw || '').trim();
        return s.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'config';
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

    const EDGE_TYPES = ['esp32', 'arduino', 'raspberry-pi', 'web'];

    function readEdgeType() {
        const raw = document.getElementById('edgeType')?.value || 'web';
        return EDGE_TYPES.includes(raw) ? raw : 'web';
    }
    const parseClasses = (val) => {
        const arr = (val || '').split(',').map(s => s.trim()).filter(Boolean);
        return arr.length ? arr : ['person'];
    };

    /** COCO 80 — same labels as YOLO (onnx COCO) and MediaPipe Object Detector in this project. */
    const COCO_CLASSES_80 = [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
        'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
        'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
        'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
        'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
        'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
        'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
        'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
        'scissors', 'teddy bear', 'hair drier', 'toothbrush',
    ];

    function mergeClassesIntoInput(inputEl, classesToAdd) {
        if (!inputEl || !classesToAdd.length) return;
        const existing = inputEl.value.split(',').map((s) => s.trim()).filter(Boolean);
        const seen = new Set(existing.map((s) => s.toLowerCase()));
        for (const c of classesToAdd) {
            const key = c.toLowerCase();
            if (!seen.has(key)) {
                existing.push(c);
                seen.add(key);
            }
        }
        inputEl.value = existing.join(', ');
    }

    function initCocoPicker(rootEl) {
        const inputId = rootEl.dataset.inputId;
        const input = document.getElementById(inputId);
        if (!input) return;

        const details = document.createElement('details');
        details.className = 'coco-picker';

        const summary = document.createElement('summary');
        summary.className = 'coco-summary';
        summary.textContent = 'COCO-80 labels (YOLO & Mediapipe)';
        details.appendChild(summary);

        const hint = document.createElement('p');
        hint.className = 'hint coco-hint';
        hint.textContent =
            'Click a label to append it. Filter the list, then use Add all visible for a subset. Names match server YOLO COCO list and MediaPipe category labels.';
        details.appendChild(hint);

        const filterInput = document.createElement('input');
        filterInput.type = 'search';
        filterInput.className = 'coco-filter';
        filterInput.placeholder = 'Filter labels…';
        filterInput.setAttribute('aria-label', 'Filter COCO labels');
        details.appendChild(filterInput);

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'coco-chips';
        chipsWrap.setAttribute('role', 'group');
        chipsWrap.setAttribute('aria-label', 'COCO class labels');
        details.appendChild(chipsWrap);

        const actions = document.createElement('div');
        actions.className = 'coco-picker-actions';

        const btnVisible = document.createElement('button');
        btnVisible.type = 'button';
        btnVisible.className = 'btn-preset';
        btnVisible.textContent = 'Add all visible';

        const btnAll = document.createElement('button');
        btnAll.type = 'button';
        btnAll.className = 'btn-preset';
        btnAll.textContent = 'Add all 80';

        actions.appendChild(btnVisible);
        actions.appendChild(btnAll);
        details.appendChild(actions);

        COCO_CLASSES_80.forEach((label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'coco-chip';
            btn.textContent = label;
            btn.dataset.label = label;
            btn.title = 'Add "' + label + '" to field';
            btn.addEventListener('click', () => mergeClassesIntoInput(input, [label]));
            chipsWrap.appendChild(btn);
        });

        filterInput.addEventListener('input', () => {
            const q = filterInput.value.trim().toLowerCase();
            chipsWrap.querySelectorAll('.coco-chip').forEach((chip) => {
                const lab = (chip.dataset.label || '').toLowerCase();
                chip.classList.toggle('coco-chip--hidden', q !== '' && !lab.includes(q));
            });
        });

        btnVisible.addEventListener('click', () => {
            const labels = Array.from(chipsWrap.querySelectorAll('.coco-chip:not(.coco-chip--hidden)')).map(
                (c) => c.dataset.label
            );
            mergeClassesIntoInput(input, labels);
        });

        btnAll.addEventListener('click', () => mergeClassesIntoInput(input, COCO_CLASSES_80.slice()));

        rootEl.appendChild(details);
    }

    function bindDeclTypeToggle(row) {
        const sel = row.querySelector('.decl-action-type');
        const wrap = row.querySelector('.decl-custom-type-wrap');
        if (!sel || !wrap) return;
        const sync = () => {
            wrap.style.display = sel.value === 'CUSTOM' ? '' : 'none';
        };
        sel.addEventListener('change', sync);
        sync();
    }

    function addDeclarativeActionRow(containerId, preset = {}) {
        const container = document.getElementById(containerId);
        const row = document.createElement('div');
        row.className = 'action-row declarative-action-row';
        const timeout = preset.timeout != null ? preset.timeout : 2000;
        row.innerHTML =
            '<div class="field declarative-field">' +
            '<label>Type</label>' +
            '<select class="decl-action-type">' +
            '<option value="DB">DB</option>' +
            '<option value="API">API</option>' +
            '<option value="NOTIFY">NOTIFY</option>' +
            '<option value="CUSTOM">Custom…</option>' +
            '</select></div>' +
            '<div class="field declarative-field decl-custom-type-wrap" style="display:none">' +
            '<label>Custom type</label>' +
            '<input type="text" class="decl-custom-type" placeholder="local-001"></div>' +
            '<div class="field declarative-field flex-grow">' +
            '<label>Value(s), comma-separated</label>' +
            '<input type="text" class="decl-action-value" value=""></div>' +
            '<div class="field interval-field">' +
            '<label>Timeout (ms)</label>' +
            '<input type="number" class="decl-timeout" value="' + timeout + '" min="0"></div>' +
            '<button type="button" class="btn-remove" title="Remove">−</button>';

        const sel = row.querySelector('.decl-action-type');
        const customWrap = row.querySelector('.decl-custom-type-wrap');
        const customIn = row.querySelector('.decl-custom-type');
        const valIn = row.querySelector('.decl-action-value');

        const t = preset.type || 'DB';
        if (t === 'DB' || t === 'API' || t === 'NOTIFY') {
            sel.value = t;
        } else {
            sel.value = 'CUSTOM';
            customWrap.style.display = '';
            customIn.value = t;
        }

        const defaults = {
            DB: 'your-db-id',
            API: 'https://your-api.com/webhook',
            NOTIFY: 'your-telegram-chat-id',
        };
        valIn.value = preset.valueStr != null ? preset.valueStr : defaults[t] || 'your-db-id';

        bindDeclTypeToggle(row);
        row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
        container.appendChild(row);
    }

    function readDeclarativeActions(containerId) {
        const rows = document.querySelectorAll(`#${containerId} .declarative-action-row`);
        return Array.from(rows)
            .map((row) => {
                const sel = row.querySelector('.decl-action-type');
                const customIn = row.querySelector('.decl-custom-type');
                let type = sel && sel.value === 'CUSTOM' ? (customIn?.value || '').trim() : sel?.value;
                const valStr = row.querySelector('.decl-action-value')?.value ?? '';
                const values = valStr.split(',').map((s) => s.trim()).filter(Boolean);
                const timeout = parseInt(row.querySelector('.decl-timeout')?.value, 10) || 0;
                return { type, values, timeout };
            })
            .filter((a) => a.type && a.values.length);
    }

    function formatDeclarativeActionsJs(actions) {
        if (!actions.length) return '[]';
        return (
            '[\n' +
            actions
                .map((a, i) => {
                    const vals = a.values.map((s) => "'" + escapeForSingleQuotedJs(s) + "'").join(', ');
                    return (
                        '        {\n' +
                        `            action: { type: '${escapeForSingleQuotedJs(a.type)}', value: [${vals}] },\n` +
                        `            timeout: ${a.timeout}\n` +
                        '        }' +
                        (i < actions.length - 1 ? ',' : '')
                    );
                })
                .join('\n') +
            '\n    ]'
        );
    }

    function readReasoningActionRows() {
        const rows = document.querySelectorAll('#serverReasoningActions .reasoning-action-row');
        return Array.from(rows)
            .map((row) => {
                const body = row.querySelector('.action-body')?.value.trim() ?? '';
                const counterRaw = row.querySelector('.reasoning-counter')?.value.trim() ?? '';
                let counter = null;
                if (counterRaw !== '') {
                    const n = parseInt(counterRaw, 10);
                    counter = Number.isNaN(n) ? null : n;
                }
                return body ? { body, counter } : null;
            })
            .filter(Boolean);
    }

    function formatReasoningActionFunctionsJs(actions) {
        if (!actions.length) return '[]';
        return (
            '[\n' +
            actions
                .map((a) => {
                    const indented = indentBlock(a.body, 12);
                    const counterStr = a.counter === null || a.counter === undefined ? 'null' : String(a.counter);
                    return (
                        '        {\n' +
                        '            func: (description) => {\n' +
                        indented +
                        '\n            },\n' +
                        `            counter: ${counterStr}\n` +
                        '        }'
                    );
                })
                .join(',\n') +
            '\n    ]'
        );
    }

    function readActionRows(containerId, defaultInterval) {
        const rows = document.querySelectorAll(`#${containerId} .action-row`);
        return Array.from(rows)
            .map((row) => {
                if (!row.classList.contains('with-interval') && !row.querySelector('.interval-ms')) return null;
                const body = row.querySelector('.action-body')?.value.trim() ?? '';
                const intervalInput = row.querySelector('.interval-ms');
                const interval = intervalInput ? parseInt(intervalInput.value, 10) || defaultInterval : defaultInterval;
                return body.length ? { body, interval } : null;
            })
            .filter(Boolean);
    }

    /** Single source of truth: read all form fields into one data object. */
    function readFormConfig() {
        const useUi = isSectionEnabled('useUi');
        const useLocalRecognition = isSectionEnabled('useLocalRecognition');
        const useBoundingBoxStyles = isSectionEnabled('useBoundingBoxStyles');
        const useLocalRecognitionActions = isSectionEnabled('useLocalRecognitionActions');
        const useLocalRegularActionFunctions = isSectionEnabled('useLocalRegularActionFunctions');
        const useServerRecognition = isSectionEnabled('useServerRecognition');
        const useServerReasoning = isSectionEnabled('useServerReasoning');
        const useServerRecognitionActions = isSectionEnabled('useServerRecognitionActions');
        const useServerRecognitionActionFunctions = isSectionEnabled('useServerRecognitionActionFunctions');
        const useServerReasoningActionFunctions = isSectionEnabled('useServerReasoningActionFunctions');
        const useServerRegularActionFunctions = isSectionEnabled('useServerRegularActionFunctions');

        const configName = (document.getElementById('configName').value || 'config').trim() || 'config';
        const configIdInput = (document.getElementById('configId').value || '').trim();
        const configId = configIdInput ? slugId(configIdInput) : slugId(configName);
        const configDescription =
            (document.getElementById('configDescription').value || '').trim() || 'Default configuration';
        const edgeType = readEdgeType();
        const ui = useUi && edgeType === 'web' && document.getElementById('ui').checked;

        let localRecognition = null;
        if (useLocalRecognition) {
            localRecognition = {
                classes: parseClasses(document.getElementById('localClasses').value),
                maxResults: num(document.getElementById('localMaxResults'), 10),
                threshold: float(document.getElementById('localThreshold'), 0.5),
                iouThreshold: float(document.getElementById('localIouThreshold'), 0.45),
                model: document.getElementById('localModel').value || 'YOLO',
                inputSize: num(document.getElementById('localInputSize'), 320),
                maxCaptureSize: num(document.getElementById('localMaxCaptureSize'), 320),
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
                interval: num(document.getElementById('serverRecognitionInterval'), 1000),
            };
        }

        let serverReasoning = null;
        if (useServerReasoning) {
            serverReasoning = {
                model: document.getElementById('serverReasoningModel').value || 'openai',
                prompt:
                    document.getElementById('serverReasoningPrompt').value.trim() ||
                    'Describe this image in detail. What objects, people, or scene do you see?',
            };
        }

        return {
            configName,
            configId,
            configDescription,
            edgeType,
            ui,
            localRecognition,
            boundingBoxStyles,
            localRecognitionActions: useLocalRecognitionActions ? readDeclarativeActions('localRecognitionActionsList') : [],
            localRegularActionFunctionsDeclarative: useLocalRegularActionFunctions
                ? readDeclarativeActions('localRegularActionsList')
                : [],
            serverRecognition,
            serverReasoning,
            serverRecognitionActions: useServerRecognitionActions
                ? readDeclarativeActions('serverRecognitionActionsList')
                : [],
            serverRecognitionActionFunctions: useServerRecognitionActionFunctions
                ? readActionRows('serverRecognitionActionFunctionsList', 5000)
                : [],
            serverReasoningActionFunctions: useServerReasoningActionFunctions ? readReasoningActionRows() : [],
            serverRegularActionFunctions: useServerRegularActionFunctions
                ? readActionRows('serverRegularActions', 10000)
                : [],
        };
    }

    function formatLocalRecognitionJs(obj) {
        if (!obj) return 'null';
        return `{
        classes: ${formatClassesArray(obj.classes)},
        maxResults: ${obj.maxResults},
        threshold: ${obj.threshold},
        iouThreshold: ${obj.iouThreshold},
        model: '${String(obj.model).replace(/'/g, "\\'")}',
        inputSize: ${obj.inputSize},
        maxCaptureSize: ${obj.maxCaptureSize},
        interval: ${obj.interval}
    }`;
    }

    function formatServerRecognitionJs(obj) {
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
        return (
            '[\n' +
            actions
                .map((a, i) => {
                    const indented = indentBlock(a.body, 12);
                    return (
                        '        {\n' +
                        `            func: (${paramList}) => {\n${indented}\n            },\n` +
                        `            interval: ${a.interval}\n` +
                        '        }' +
                        (i < actions.length - 1 ? ',' : '')
                    );
                })
                .join('\n') +
            '\n    ]'
        );
    }

    /** JavaScript object literal matching `const CONFIG = { ... }` (includes function bodies; not JSON). */
    function buildConfigObjectLiteralBody(d) {
        const localRecognitionStr = formatLocalRecognitionJs(d.localRecognition);
        const boundingBoxStylesStr = formatBoundingBoxStylesJs(d.boundingBoxStyles);
        const serverRecognitionStr = formatServerRecognitionJs(d.serverRecognition);
        const serverReasoningStr = formatReasoningJs(d.serverReasoning);
        const localRecognitionActionsStr = formatDeclarativeActionsJs(d.localRecognitionActions);
        const localRegularActionFunctionsStr = formatDeclarativeActionsJs(d.localRegularActionFunctionsDeclarative);
        const serverRecognitionActionsStr = formatDeclarativeActionsJs(d.serverRecognitionActions);
        const serverRecognitionActionFunctionsStr = formatActionFunctionsJs(
            d.serverRecognitionActionFunctions,
            'recognitionResults'
        );
        const serverReasoningActionFunctionsStr = formatReasoningActionFunctionsJs(d.serverReasoningActionFunctions);
        const serverRegularActionFunctionsStr = formatActionFunctionsJs(d.serverRegularActionFunctions, 'description');

        return `{
    /////////////////////// LOCAL CONFIG ///////////////////////
    id: '${escapeForSingleQuotedJs(d.configId)}',
    name: '${escapeForSingleQuotedJs(d.configName)}',
    description: '${escapeForSingleQuotedJs(d.configDescription)}',
    edgeType: '${escapeForSingleQuotedJs(d.edgeType)}',
    ui: ${d.ui},
    localRecognition: ${localRecognitionStr},
    boundingBoxStyles: ${boundingBoxStylesStr},
    localRecognitionActions: ${localRecognitionActionsStr},
    localRegularActionFunctions: ${localRegularActionFunctionsStr},

    /////////////////////// SERVER CONFIG ///////////////////////
    serverRecognition: ${serverRecognitionStr},
    serverReasoning: ${serverReasoningStr},
    serverRecognitionActions: ${serverRecognitionActionsStr},
    serverRecognitionActionFunctions: ${serverRecognitionActionFunctionsStr},
    serverReasoningActionFunctions: ${serverReasoningActionFunctionsStr},
    serverRegularActionFunctions: ${serverRegularActionFunctionsStr},
}`;
    }

    function buildConfigJs() {
        const d = readFormConfig();
        return `/**
 * Single configuration object for the v4 app (structure like config/public/config-full.js)
 */
const CONFIG = ${buildConfigObjectLiteralBody(d)};

export default CONFIG;
export { CONFIG };
`;
    }

    /** Returns a plain object for POST /api/configurations (function bodies omitted — not JSON-serializable). */
    function buildConfigObject() {
        const d = readFormConfig();
        return {
            id: d.configId,
            name: d.configName,
            description: d.configDescription,
            edgeType: d.edgeType,
            ui: d.ui,
            localRecognition: d.localRecognition,
            boundingBoxStyles: d.boundingBoxStyles,
            localRecognitionActions: d.localRecognitionActions,
            localRegularActionFunctions: d.localRegularActionFunctionsDeclarative,
            serverRecognition: d.serverRecognition,
            serverReasoning: d.serverReasoning,
            serverRecognitionActions: d.serverRecognitionActions,
            serverRecognitionActionFunctions: [],
            serverReasoningActionFunctions: [],
            serverRegularActionFunctions: [],
        };
    }

    /** Same serializable object as POST /api/configurations `config` (function bodies omitted). */
    function getSharedConfigurationObject() {
        return buildConfigObject();
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

    const PRESET_SERVER_REGULAR_NOTIFY_BODY = `fetch(\`/api/notify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        description: description,
        channel: 'email',
        recipient: 'test@test.com'
    })
})
    .then(response => response.json())
    .then(data => console.log('[Notify]', data))
    .catch(error => console.error('[Notify] Failed to fetch. Is the server running?', error));`;

    const PRESET_REASONING_NOTIFICATION_BODY = `fetch(\`/api/notify\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        description: description,
        channel: 'email',
        recipient: 'test@test.com'
    })
})
    .then(response => response.json())
    .then(data => console.log('[Notify]', data))
    .catch(error => console.error('[Notify] Failed to fetch.', error));`;

    const PRESET_SERVER_REGULAR_DB_BODY = `fetch(\`/api/db\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
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

    function addReasoningRow(bodyText) {
        const container = document.getElementById('serverReasoningActions');
        const row = document.createElement('div');
        row.className = 'action-row reasoning-action-row';
        row.innerHTML =
            '<textarea class="action-body" rows="2" placeholder="console.log(description);"></textarea>' +
            '<div class="field interval-field">' +
            '<label>Counter</label>' +
            '<input type="text" class="reasoning-counter" value="" placeholder="null">' +
            '</div>' +
            '<button type="button" class="btn-remove" title="Remove">−</button>';
        row.querySelector('.action-body').value = bodyText;
        row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
        container.appendChild(row);
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function seedInitialRows() {
        addDeclarativeActionRow('localRecognitionActionsList', { type: 'DB', valueStr: 'your-db-id', timeout: 2000 });
        addDeclarativeActionRow('localRecognitionActionsList', {
            type: 'API',
            valueStr: 'https://your-api.com/webhook',
            timeout: 5000,
        });
        addDeclarativeActionRow('localRecognitionActionsList', {
            type: 'NOTIFY',
            valueStr: 'your-telegram-chat-id',
            timeout: 11000,
        });

        addDeclarativeActionRow('localRegularActionsList', { type: 'DB', valueStr: 'dbNULPId', timeout: 10000 });
        addDeclarativeActionRow('localRegularActionsList', {
            type: 'API',
            valueStr: 'https://lpnu.ua/',
            timeout: 15000,
        });
        addDeclarativeActionRow('localRegularActionsList', {
            type: 'NOTIFY',
            valueStr: 'telegramNULPId',
            timeout: 21000,
        });

        addDeclarativeActionRow('serverRecognitionActionsList', { type: 'DB', valueStr: 'your-db-id', timeout: 2000 });
        addDeclarativeActionRow('serverRecognitionActionsList', {
            type: 'API',
            valueStr: 'https://your-api.com/webhook',
            timeout: 25000,
        });
        addDeclarativeActionRow('serverRecognitionActionsList', {
            type: 'NOTIFY',
            valueStr: 'your-telegram-chat-id',
            timeout: 30000,
        });
        addDeclarativeActionRow('serverRecognitionActionsList', {
            type: 'server-007',
            valueStr: '007 value data',
            timeout: 6000,
        });
    }

    document.getElementById('addLocalRecognitionDeclarativeAction').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionsList')
    );
    document.getElementById('presetLocalRecognitionActionsDb').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionsList', { type: 'DB', timeout: 2000 })
    );
    document.getElementById('presetLocalRecognitionActionsApi').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionsList', { type: 'API', timeout: 5000 })
    );
    document.getElementById('presetLocalRecognitionActionsNotify').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionsList', { type: 'NOTIFY', timeout: 11000 })
    );

    document.getElementById('addLocalRegularDeclarative').addEventListener('click', () =>
        addDeclarativeActionRow('localRegularActionsList')
    );
    document.getElementById('presetLocalRegularDb').addEventListener('click', () =>
        addDeclarativeActionRow('localRegularActionsList', { type: 'DB', timeout: 10000 })
    );
    document.getElementById('presetLocalRegularApi').addEventListener('click', () =>
        addDeclarativeActionRow('localRegularActionsList', { type: 'API', timeout: 15000 })
    );
    document.getElementById('presetLocalRegularNotify').addEventListener('click', () =>
        addDeclarativeActionRow('localRegularActionsList', { type: 'NOTIFY', timeout: 21000 })
    );

    document.getElementById('addServerRecognitionDeclarativeAction').addEventListener('click', () =>
        addDeclarativeActionRow('serverRecognitionActionsList')
    );
    document.getElementById('presetServerRecognitionActionsDb').addEventListener('click', () =>
        addDeclarativeActionRow('serverRecognitionActionsList', { type: 'DB', timeout: 2000 })
    );
    document.getElementById('presetServerRecognitionActionsApi').addEventListener('click', () =>
        addDeclarativeActionRow('serverRecognitionActionsList', { type: 'API', timeout: 25000 })
    );
    document.getElementById('presetServerRecognitionActionsNotify').addEventListener('click', () =>
        addDeclarativeActionRow('serverRecognitionActionsList', { type: 'NOTIFY', timeout: 30000 })
    );

    document.getElementById('addServerRecognitionAction').addEventListener('click', () =>
        addActionRow('serverRecognitionActionFunctionsList', true, 5000)
    );
    document.getElementById('addServerRecognitionNotification').addEventListener('click', () =>
        addActionRowWithPreset('serverRecognitionActionFunctionsList', PRESET_NOTIFICATION_BODY, PRESET_NOTIFICATION_INTERVAL)
    );
    document.getElementById('addServerRecognitionDb').addEventListener('click', () =>
        addActionRowWithPreset('serverRecognitionActionFunctionsList', PRESET_DB_BODY, PRESET_DB_INTERVAL)
    );

    document.getElementById('addServerReasoningAction').addEventListener('click', () => addReasoningRow(''));
    document.getElementById('addServerReasoningNotification').addEventListener('click', () =>
        addReasoningRow(PRESET_REASONING_NOTIFICATION_BODY)
    );
    document.getElementById('addServerReasoningDb').addEventListener('click', () =>
        addReasoningRow(`console.log('[Reasoning]', description);\nfetch(\`/api/db\`, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ description })\n});`)
    );

    document.getElementById('addServerRegularAction').addEventListener('click', () =>
        addActionRow('serverRegularActions', true, 10000)
    );
    document.getElementById('addServerRegularNotification').addEventListener('click', () =>
        addActionRowWithPreset('serverRegularActions', PRESET_SERVER_REGULAR_NOTIFY_BODY, PRESET_NOTIFICATION_INTERVAL)
    );
    document.getElementById('addServerRegularDb').addEventListener('click', () =>
        addActionRowWithPreset('serverRegularActions', PRESET_SERVER_REGULAR_DB_BODY, PRESET_SERVER_DB_INTERVAL)
    );

    document.querySelectorAll('#serverRecognitionActionFunctionsList .btn-remove').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#serverReasoningActions .btn-remove').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });
    document.querySelectorAll('#serverRegularActions .btn-remove').forEach((btn) => {
        btn.addEventListener('click', () => btn.closest('.action-row').remove());
    });

    seedInitialRows();

    document.querySelectorAll('.coco-picker-root').forEach(initCocoPicker);

    function syncUiEnableFieldVisibility() {
        const wrap = document.getElementById('uiEnableWrap');
        if (!wrap) return;
        wrap.hidden = readEdgeType() !== 'web';
    }

    document.getElementById('edgeType').addEventListener('change', syncUiEnableFieldVisibility);
    syncUiEnableFieldVisibility();

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const d = readFormConfig();
        const js = buildConfigJs();
        downloadFile(js, d.configId + '.js');
    });

    document.getElementById('btnPreviewConfig').addEventListener('click', function () {
        const previewSection = document.getElementById('configPreviewSection');
        const previewJsonEl = document.getElementById('configPreviewJson');
        previewJsonEl.textContent = buildConfigObjectLiteralBody(readFormConfig());
        previewSection.hidden = false;
    });

    document.getElementById('configPreviewClose').addEventListener('click', function () {
        document.getElementById('configPreviewSection').hidden = true;
    });

    document.getElementById('btnGenerateAndSave').addEventListener('click', async function () {
        const config = getSharedConfigurationObject();
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

    const CONFIG_SECTION_FILTERS = {
        all: null,
        general: ['meta', 'ui'],
        local: [
            'localRecognition',
            'boundingBoxStyles',
            'localRecognitionActions',
            'localRegularActionFunctions',
        ],
        server: [
            'serverRecognition',
            'serverReasoning',
            'serverRecognitionActions',
            'serverRecognitionActionFunctions',
            'serverReasoningActionFunctions',
            'serverRegularActionFunctions',
        ],
    };

    function applyConfigSectionFilter(filterKey) {
        const allowed = CONFIG_SECTION_FILTERS[filterKey];
        document.querySelectorAll('#configForm section.card[data-section]').forEach((el) => {
            const key = el.getAttribute('data-section');
            if (!allowed || allowed.includes(key)) {
                el.classList.remove('card-filter-hidden');
            } else {
                el.classList.add('card-filter-hidden');
            }
        });

        const scrollEl = document.querySelector('.config-panel-scroll');
        if (!scrollEl) return;
        requestAnimationFrame(() => {
            const firstVisible = scrollEl.querySelector('section.card[data-section]:not(.card-filter-hidden)');
            if (firstVisible) {
                firstVisible.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        });
    }

    function initConfigSectionFilter() {
        const panel = document.getElementById('configFilterPanel');
        if (!panel) return;
        panel.querySelectorAll('.config-filter-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-filter');
                if (!key || !Object.prototype.hasOwnProperty.call(CONFIG_SECTION_FILTERS, key)) return;
                panel.querySelectorAll('.config-filter-btn').forEach((b) => {
                    const on = b === btn;
                    b.classList.toggle('is-active', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                applyConfigSectionFilter(key);
            });
        });
        applyConfigSectionFilter('all');
    }

    initConfigSectionFilter();
})();
