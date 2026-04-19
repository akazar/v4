(function () {
    'use strict';

    const form = document.getElementById('configForm');

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
            '<div class="field declarative-field flex-grow">' +
            '<label>Method name(s), comma-separated</label>' +
            '<input type="text" class="decl-action-value" value=""></div>' +
            '<div class="field interval-field">' +
            '<label>Timeout (ms)</label>' +
            '<input type="number" class="decl-timeout" value="' + timeout + '" min="0"></div>' +
            '<button type="button" class="btn-remove" title="Remove">−</button>';

        const sel = row.querySelector('.decl-action-type');
        const valIn = row.querySelector('.decl-action-value');

        const defaults = {
            DB: 'your-db-id',
            API: 'https://your-api.com/webhook',
            NOTIFY: 'your-telegram-chat-id',
            CUSTOM: 'my-method',
        };
        const t = preset.type || 'DB';
        if (t === 'DB' || t === 'API' || t === 'NOTIFY') {
            sel.value = t;
            valIn.value = preset.valueStr != null ? preset.valueStr : defaults[t];
        } else if (t === 'CUSTOM') {
            sel.value = 'CUSTOM';
            valIn.value = preset.valueStr != null ? preset.valueStr : defaults.CUSTOM;
        } else {
            sel.value = 'CUSTOM';
            valIn.value = preset.valueStr != null ? preset.valueStr : String(t);
        }

        row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
        container.appendChild(row);
        syncDeclarativeCustomJsVisibility();
    }

    function readDeclarativeActions(containerId) {
        const rows = document.querySelectorAll(`#${containerId} .declarative-action-row`);
        return Array.from(rows)
            .map((row) => {
                const sel = row.querySelector('.decl-action-type');
                const type = sel?.value === 'CUSTOM' ? 'CUSTOM' : sel?.value;
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

    function hasDeclarativeCustomRow(containerId) {
        return Array.from(document.querySelectorAll(`#${containerId} .decl-action-type`)).some(
            (el) => el.value === 'CUSTOM'
        );
    }

    function syncDeclarativeCustomJsVisibility() {
        const pairs = [
            ['localRecognitionActionsList', 'localRecognitionActionsCustomJsWrap'],
            ['localRecognitionActionFunctionsList', 'localRecognitionActionFunctionsCustomJsWrap'],
            ['localRegularActionsList', 'localRegularActionFunctionsCustomJsWrap'],
            ['serverRecognitionActionsList', 'serverRecognitionActionsCustomJsWrap'],
            ['serverRegularActionFunctionsList', 'serverRegularActionFunctionsCustomJsWrap'],
        ];
        for (const [containerId, wrapId] of pairs) {
            const wrap = document.getElementById(wrapId);
            if (!wrap) continue;
            wrap.hidden = !hasDeclarativeCustomRow(containerId);
        }
    }

    /** Single source of truth: read all form fields into one data object. */
    function readFormConfig() {
        const useUi = isSectionEnabled('useUi');
        const useLocalRecognition = isSectionEnabled('useLocalRecognition');
        const useBoundingBoxStyles = isSectionEnabled('useBoundingBoxStyles');
        const useLocalRecognitionActions = isSectionEnabled('useLocalRecognitionActions');
        const useLocalRecognitionActionFunctions = isSectionEnabled('useLocalRecognitionActionFunctions');
        const useLocalRegularActionFunctions = isSectionEnabled('useLocalRegularActionFunctions');
        const useServerRecognition = isSectionEnabled('useServerRecognition');
        const useServerRecognitionActions = isSectionEnabled('useServerRecognitionActions');
        const useServerRegularActionFunctions = isSectionEnabled('useServerRegularActionFunctions');

        const configName = (document.getElementById('configName').value || 'config').trim() || 'config';
        const configIdInput = (document.getElementById('configId').value || '').trim();
        const configId = configIdInput ? slugId(configIdInput) : slugId(configName);
        const configDescription =
            (document.getElementById('configDescription').value || '').trim() || 'Default configuration';
        const edgeType = readEdgeType();
        const ui = useUi && edgeType === 'web' && document.getElementById('ui').checked;
        const uiAssetFileName = (inputId) => {
            const el = document.getElementById(inputId);
            return (el?.files?.[0]?.name ?? '').trim();
        };
        const uiHtmlPath = ui ? uiAssetFileName('uiHtmlFile') : '';
        const uiCssPath = ui ? uiAssetFileName('uiCssFile') : '';
        const uiJsPath = ui ? uiAssetFileName('uiJsFile') : '';

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

        const localStartupAction = (document.getElementById('localStartupActionMethodName')?.value ?? '').trim();
        const serverStartupAction = (document.getElementById('serverStartupActionMethodName')?.value ?? '').trim();

        return {
            configName,
            configId,
            configDescription,
            edgeType,
            ui,
            uiHtmlPath,
            uiCssPath,
            uiJsPath,
            localRecognition,
            boundingBoxStyles,
            localStartupAction,
            localRecognitionActions: useLocalRecognitionActions ? readDeclarativeActions('localRecognitionActionsList') : [],
            localRecognitionActionFunctions: useLocalRecognitionActionFunctions
                ? readDeclarativeActions('localRecognitionActionFunctionsList')
                : [],
            localRegularActionFunctionsDeclarative: useLocalRegularActionFunctions
                ? readDeclarativeActions('localRegularActionsList')
                : [],
            serverRecognition,
            serverStartupAction,
            serverRecognitionActions: useServerRecognitionActions
                ? readDeclarativeActions('serverRecognitionActionsList')
                : [],
            serverRegularActionFunctions: useServerRegularActionFunctions
                ? readDeclarativeActions('serverRegularActionFunctionsList')
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

    /** JavaScript object literal matching `const CONFIG = { ... }` (includes function bodies; not JSON). */
    function buildConfigObjectLiteralBody(d) {
        const localRecognitionStr = formatLocalRecognitionJs(d.localRecognition);
        const boundingBoxStylesStr = formatBoundingBoxStylesJs(d.boundingBoxStyles);
        const serverRecognitionStr = formatServerRecognitionJs(d.serverRecognition);
        const localRecognitionActionsStr = formatDeclarativeActionsJs(d.localRecognitionActions);
        const localRecognitionActionFunctionsStr = formatDeclarativeActionsJs(d.localRecognitionActionFunctions);
        const localRegularActionFunctionsStr = formatDeclarativeActionsJs(d.localRegularActionFunctionsDeclarative);
        const serverRecognitionActionsStr = formatDeclarativeActionsJs(d.serverRecognitionActions);
        const serverRegularActionFunctionsStr = formatDeclarativeActionsJs(d.serverRegularActionFunctions);

        return `{
    /////////////////////// LOCAL CONFIG ///////////////////////
    id: '${escapeForSingleQuotedJs(d.configId)}',
    name: '${escapeForSingleQuotedJs(d.configName)}',
    description: '${escapeForSingleQuotedJs(d.configDescription)}',
    edgeType: '${escapeForSingleQuotedJs(d.edgeType)}',
    ui: ${d.ui},
    uiHtmlPath: '${escapeForSingleQuotedJs(d.uiHtmlPath)}',
    uiCssPath: '${escapeForSingleQuotedJs(d.uiCssPath)}',
    uiJsPath: '${escapeForSingleQuotedJs(d.uiJsPath)}',
    localRecognition: ${localRecognitionStr},
    boundingBoxStyles: ${boundingBoxStylesStr},
    localStartupAction: '${escapeForSingleQuotedJs(d.localStartupAction)}',
    localRecognitionActions: ${localRecognitionActionsStr},
    localRecognitionActionFunctions: ${localRecognitionActionFunctionsStr},
    localRegularActionFunctions: ${localRegularActionFunctionsStr},

    /////////////////////// SERVER CONFIG ///////////////////////
    serverRecognition: ${serverRecognitionStr},
    serverStartupAction: '${escapeForSingleQuotedJs(d.serverStartupAction)}',
    serverRecognitionActions: ${serverRecognitionActionsStr},
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
            uiHtmlPath: d.uiHtmlPath,
            uiCssPath: d.uiCssPath,
            uiJsPath: d.uiJsPath,
            localRecognition: d.localRecognition,
            boundingBoxStyles: d.boundingBoxStyles,
            localStartupAction: d.localStartupAction,
            localRecognitionActions: d.localRecognitionActions,
            localRecognitionActionFunctions: d.localRecognitionActionFunctions,
            localRegularActionFunctions: d.localRegularActionFunctionsDeclarative,
            serverRecognition: d.serverRecognition,
            serverStartupAction: d.serverStartupAction,
            serverRecognitionActions: d.serverRecognitionActions,
            serverRegularActionFunctions: d.serverRegularActionFunctions,
        };
    }

    /** Same serializable object as POST /api/configurations `config` (function bodies omitted). */
    function getSharedConfigurationObject() {
        return buildConfigObject();
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /** Declarative “Custom…” JS attachments: downloaded next to config.js under fixed names (not in CONFIG). */
    const CUSTOM_ACTION_JS_DOWNLOADS = [
        ['localRecognitionActionsCustomJsFile', 'localRecognitionActions.js'],
        ['localRecognitionActionFunctionsCustomJsFile', 'localRecognitionActionFunctions.js'],
        ['localRegularActionFunctionsCustomJsFile', 'localRegularActionFunctions.js'],
        ['serverRecognitionActionsCustomJsFile', 'serverRecognitionActions.js'],
        ['serverRegularActionFunctionsCustomJsFile', 'serverRegularActionFunctions.js'],
    ];

    function downloadFileFromInput(fileInputId, downloadAsName) {
        const input = document.getElementById(fileInputId);
        const file = input?.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadAsName;
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadAllCustomActionAttachments() {
        let delay = 0;
        const stepMs = 120;
        for (const [inputId, filename] of CUSTOM_ACTION_JS_DOWNLOADS) {
            if (!document.getElementById(inputId)) continue;
            const id = inputId;
            const name = filename;
            setTimeout(() => downloadFileFromInput(id, name), delay);
            delay += stepMs;
        }
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

        addDeclarativeActionRow('localRecognitionActionFunctionsList', { type: 'DB', valueStr: 'your-db-id', timeout: 2000 });
        addDeclarativeActionRow('localRecognitionActionFunctionsList', {
            type: 'API',
            valueStr: 'https://your-api.com/webhook',
            timeout: 5000,
        });
        addDeclarativeActionRow('localRecognitionActionFunctionsList', {
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

        addDeclarativeActionRow('serverRegularActionFunctionsList', { type: 'DB', valueStr: 'your-db-id', timeout: 2000 });
        addDeclarativeActionRow('serverRegularActionFunctionsList', {
            type: 'API',
            valueStr: 'https://your-api.com/webhook',
            timeout: 25000,
        });
        addDeclarativeActionRow('serverRegularActionFunctionsList', {
            type: 'NOTIFY',
            valueStr: 'your-telegram-chat-id',
            timeout: 30000,
        });
        addDeclarativeActionRow('serverRegularActionFunctionsList', {
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

    document.getElementById('addLocalRecognitionActionFunctionsDeclarativeAction').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionFunctionsList')
    );
    document.getElementById('presetLocalRecognitionActionFunctionsDb').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionFunctionsList', { type: 'DB', timeout: 2000 })
    );
    document.getElementById('presetLocalRecognitionActionFunctionsApi').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionFunctionsList', { type: 'API', timeout: 5000 })
    );
    document.getElementById('presetLocalRecognitionActionFunctionsNotify').addEventListener('click', () =>
        addDeclarativeActionRow('localRecognitionActionFunctionsList', { type: 'NOTIFY', timeout: 11000 })
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

    document.getElementById('addServerRegularDeclarativeAction').addEventListener('click', () =>
        addDeclarativeActionRow('serverRegularActionFunctionsList')
    );
    document.getElementById('presetServerRegularActionsDb').addEventListener('click', () =>
        addDeclarativeActionRow('serverRegularActionFunctionsList', { type: 'DB', timeout: 2000 })
    );
    document.getElementById('presetServerRegularActionsApi').addEventListener('click', () =>
        addDeclarativeActionRow('serverRegularActionFunctionsList', { type: 'API', timeout: 25000 })
    );
    document.getElementById('presetServerRegularActionsNotify').addEventListener('click', () =>
        addDeclarativeActionRow('serverRegularActionFunctionsList', { type: 'NOTIFY', timeout: 30000 })
    );

    seedInitialRows();

    document.querySelectorAll('.coco-picker-root').forEach(initCocoPicker);

    function syncUiEnableFieldVisibility() {
        const edgeWeb = readEdgeType() === 'web';
        const wrap = document.getElementById('uiEnableWrap');
        const assets = document.getElementById('uiAssetFieldsWrap');
        const uiOn = document.getElementById('ui')?.checked;
        if (wrap) wrap.hidden = !edgeWeb;
        if (assets) assets.hidden = !edgeWeb || !uiOn;
    }

    document.getElementById('edgeType').addEventListener('change', syncUiEnableFieldVisibility);
    document.getElementById('ui').addEventListener('change', syncUiEnableFieldVisibility);
    syncUiEnableFieldVisibility();

    (function initDeclarativeCustomJsVisibility() {
        const formEl = document.getElementById('configForm');
        if (!formEl) return;
        formEl.addEventListener('change', (e) => {
            if (e.target.classList && e.target.classList.contains('decl-action-type')) {
                syncDeclarativeCustomJsVisibility();
            }
        });
        formEl.addEventListener('click', (e) => {
            if (e.target.closest && e.target.closest('.declarative-action-row .btn-remove')) {
                setTimeout(syncDeclarativeCustomJsVisibility, 0);
            }
        });
        syncDeclarativeCustomJsVisibility();
    })();

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const d = readFormConfig();
        const js = buildConfigJs();
        downloadFile(js, d.configId + '.js');
        downloadAllCustomActionAttachments();
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
        const js = buildConfigJs();
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
            downloadFile(js, fileName);
            downloadAllCustomActionAttachments();
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
            'localStartupAction',
            'localRecognitionActions',
            'localRecognitionActionFunctions',
            'localRegularActionFunctions',
        ],
        server: [
            'serverRecognition',
            'serverStartupAction',
            'serverRecognitionActions',
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
