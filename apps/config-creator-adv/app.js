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
                const value = valStr.split(',').map((s) => s.trim()).filter(Boolean);
                const timeout = parseInt(row.querySelector('.decl-timeout')?.value, 10) || 0;
                // Canonical shape consumed by lib/edge/recognition-pipeline.js,
                // lib/cloud/pipeline/server-pipeline.js, and lib/scheduled-actions-manager.js.
                return { action: { type, value }, timeout };
            })
            .filter((a) => a.action.type && a.action.value.length);
    }

    function formatDeclarativeActionsJs(actions) {
        if (!actions.length) return '[]';
        return (
            '[\n' +
            actions
                .map((a, i) => {
                    const type = a?.action?.type ?? a?.type ?? '';
                    const valueList = a?.action?.value ?? a?.value ?? a?.values ?? [];
                    const vals = valueList.map((s) => "'" + escapeForSingleQuotedJs(s) + "'").join(', ');
                    return (
                        '        {\n' +
                        `            action: { type: '${escapeForSingleQuotedJs(type)}', value: [${vals}] },\n` +
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
 * Single configuration object for the v4 app (structure like db/configs/public/config-full.js)
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

    /**
     * Minimal zero-dependency ZIP writer (STORE / no compression).
     * Good enough for a handful of small text artifacts — no deflate, no zip64.
     * Layout: [local file header + data] x N, [central directory entry] x N, end-of-central-directory.
     */
    const ZIP_CRC_TABLE = (function () {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c >>> 0;
        }
        return table;
    })();

    function zipCrc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            c = ZIP_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function toBytes(content) {
        if (content instanceof Uint8Array) return content;
        if (content instanceof ArrayBuffer) return new Uint8Array(content);
        return new TextEncoder().encode(String(content ?? ''));
    }

    /**
     * Build a STORE-method ZIP Blob from [{ name, content }] where `content` is string | Uint8Array | ArrayBuffer.
     * Paths with forward slashes become nested folders in the archive.
     */
    function createZipBlob(entries) {
        const nameEncoder = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;

        for (const { name, content } of entries) {
            const nameBytes = nameEncoder.encode(name);
            const data = toBytes(content);
            const crc = zipCrc32(data);
            const size = data.length;

            const lfh = new ArrayBuffer(30);
            const lfhView = new DataView(lfh);
            lfhView.setUint32(0, 0x04034b50, true);
            lfhView.setUint16(4, 20, true);
            lfhView.setUint16(6, 0, true);
            lfhView.setUint16(8, 0, true);
            lfhView.setUint16(10, 0, true);
            lfhView.setUint16(12, 0x21, true);
            lfhView.setUint32(14, crc, true);
            lfhView.setUint32(18, size, true);
            lfhView.setUint32(22, size, true);
            lfhView.setUint16(26, nameBytes.length, true);
            lfhView.setUint16(28, 0, true);
            parts.push(new Uint8Array(lfh), nameBytes, data);

            const cdh = new ArrayBuffer(46);
            const cdhView = new DataView(cdh);
            cdhView.setUint32(0, 0x02014b50, true);
            cdhView.setUint16(4, 20, true);
            cdhView.setUint16(6, 20, true);
            cdhView.setUint16(8, 0, true);
            cdhView.setUint16(10, 0, true);
            cdhView.setUint16(12, 0, true);
            cdhView.setUint16(14, 0x21, true);
            cdhView.setUint32(16, crc, true);
            cdhView.setUint32(20, size, true);
            cdhView.setUint32(24, size, true);
            cdhView.setUint16(28, nameBytes.length, true);
            cdhView.setUint16(30, 0, true);
            cdhView.setUint16(32, 0, true);
            cdhView.setUint16(34, 0, true);
            cdhView.setUint16(36, 0, true);
            cdhView.setUint32(38, 0, true);
            cdhView.setUint32(42, offset, true);
            central.push(new Uint8Array(cdh), nameBytes);

            offset += 30 + nameBytes.length + size;
        }

        let centralSize = 0;
        for (const p of central) centralSize += p.length;

        const eocd = new ArrayBuffer(22);
        const eocdView = new DataView(eocd);
        eocdView.setUint32(0, 0x06054b50, true);
        eocdView.setUint16(4, 0, true);
        eocdView.setUint16(6, 0, true);
        eocdView.setUint16(8, entries.length, true);
        eocdView.setUint16(10, entries.length, true);
        eocdView.setUint32(12, centralSize, true);
        eocdView.setUint32(16, offset, true);
        eocdView.setUint16(20, 0, true);

        return new Blob([...parts, ...central, new Uint8Array(eocd)], { type: 'application/zip' });
    }

    async function readInputAsBytes(inputId) {
        const input = document.getElementById(inputId);
        const file = input?.files?.[0];
        if (!file) return null;
        try {
            return new Uint8Array(await file.arrayBuffer());
        } catch (err) {
            console.warn('[config-creator-adv] failed to read file bytes for', inputId, err);
            return null;
        }
    }

    /**
     * Assemble the full artifact list: <configId>/config.js + (if UI enabled) ui.html/css/js + custom action JS files
     * (including localStartupAction.js / serverStartupAction.js when attached).
     */
    async function collectBundleEntries(configId, configJs) {
        const folder = (configId || 'config').replace(/[^a-zA-Z0-9_-]/g, '-') || 'config';
        const entries = [{ name: `${folder}/config.js`, content: configJs }];

        if (uiAttachmentsEnabledInForm()) {
            for (const [inputId, filename] of UI_ASSET_DOWNLOADS) {
                const bytes = await readInputAsBytes(inputId);
                if (bytes) entries.push({ name: `${folder}/${filename}`, content: bytes });
            }
        }
        for (const [inputId, filename] of CUSTOM_ACTION_JS_DOWNLOADS) {
            const bytes = await readInputAsBytes(inputId);
            if (bytes) entries.push({ name: `${folder}/${filename}`, content: bytes });
        }
        return { folder, entries };
    }

    async function downloadBundleZip(configId, configJs) {
        const { folder, entries } = await collectBundleEntries(configId, configJs);
        const blob = createZipBlob(entries);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folder}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return entries.length;
    }

    /** Edge / UI assets when “Enable UI” is on: fixed download names (same order as inputs). */
    const UI_ASSET_DOWNLOADS = [
        ['uiHtmlFile', 'ui.html'],
        ['uiCssFile', 'ui.css'],
        ['uiJsFile', 'ui.js'],
    ];

    /** Declarative “Custom…” JS attachments: downloaded next to config.js under fixed names (not in CONFIG). */
    const CUSTOM_ACTION_JS_DOWNLOADS = [
        ['localRecognitionActionsCustomJsFile', 'localRecognitionActions.js'],
        ['localRegularActionFunctionsCustomJsFile', 'localRegularActionFunctions.js'],
        ['serverRecognitionActionsCustomJsFile', 'serverRecognitionActions.js'],
        ['serverRegularActionFunctionsCustomJsFile', 'serverRegularActionFunctions.js'],
        ['localStartupActionJsFile', 'localStartupAction.js'],
        ['serverStartupActionJsFile', 'serverStartupAction.js'],
    ];

    function uiAttachmentsEnabledInForm() {
        return (
            isSectionEnabled('useUi') &&
            readEdgeType() === 'web' &&
            document.getElementById('ui')?.checked === true
        );
    }

    /**
     * File-input id -> server-side asset key (matches ASSET_FILE_NAMES in lib/cloud/configuration-server.js).
     * Used by POST /api/configurations/:id/assets so conveyor-poc can retrieve them later.
     */
    const ASSET_UPLOADS = [
        ['uiHtmlFile', 'uiHtml', 'ui'],
        ['uiCssFile', 'uiCss', 'ui'],
        ['uiJsFile', 'uiJs', 'ui'],
        ['localRecognitionActionsCustomJsFile', 'localRecognitionActions'],
        ['localRegularActionFunctionsCustomJsFile', 'localRegularActionFunctions'],
        ['serverRecognitionActionsCustomJsFile', 'serverRecognitionActions'],
        ['serverRegularActionFunctionsCustomJsFile', 'serverRegularActionFunctions'],
        ['localStartupActionJsFile', 'localStartupAction'],
        ['serverStartupActionJsFile', 'serverStartupAction'],
    ];

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async function collectAssetsFromForm() {
        const uiOn = uiAttachmentsEnabledInForm();
        const assets = {};
        for (const [inputId, assetKey, group] of ASSET_UPLOADS) {
            if (group === 'ui' && !uiOn) continue;
            const input = document.getElementById(inputId);
            const file = input?.files?.[0];
            if (!file) continue;
            try {
                assets[assetKey] = await readFileAsText(file);
            } catch (err) {
                console.warn('[config-creator-adv] failed to read file for', assetKey, err);
            }
        }
        return assets;
    }

    async function uploadAssetsForConfig(configId) {
        const assets = await collectAssetsFromForm();
        if (!Object.keys(assets).length) return { skipped: true };
        try {
            const res = await fetch(`/api/configurations/${encodeURIComponent(configId)}/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assets }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                console.warn('[config-creator-adv] asset upload failed:', data);
                return { ok: false, error: data?.error || 'Asset upload failed' };
            }
            return { ok: true, data };
        } catch (err) {
            console.warn('[config-creator-adv] asset upload error:', err);
            return { ok: false, error: String(err?.message || err) };
        }
    }

    // Import is intentionally isolated so it can be removed without changing form generation/export code.
    async function importConfig(zipFile) {
        if (!zipFile) return;

        const entries = await readZipFileEntries(zipFile);
        const configEntry = findZipEntry(entries, ['config.js']);
        if (!configEntry) {
            throw new Error('ZIP does not contain config.js');
        }

        const config = parseConfigModuleSource(configEntry.text);
        if (!config || typeof config !== 'object') {
            throw new Error('config.js did not export a CONFIG object');
        }

        const assetByFileName = getImportAssetEntries(entries);
        const exportedNamesByFileName = {};
        for (const [fileName, entry] of Object.entries(assetByFileName)) {
            exportedNamesByFileName[fileName] = extractNamedExports(entry.text);
        }

        fillImportedConfigFields(config, exportedNamesByFileName);
        attachImportedAssetFiles(config, assetByFileName);
        syncUiEnableFieldVisibility();
        syncDeclarativeCustomJsVisibility();
        refreshPreviewIfOpen();
    }

    async function readZipFileEntries(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const eocdOffset = findZipEndOfCentralDirectory(view);
        if (eocdOffset < 0) throw new Error('Invalid ZIP file');

        const entryCount = view.getUint16(eocdOffset + 10, true);
        let centralOffset = view.getUint32(eocdOffset + 16, true);
        const decoder = new TextDecoder('utf-8');
        const entries = [];

        for (let i = 0; i < entryCount; i++) {
            if (view.getUint32(centralOffset, true) !== 0x02014b50) {
                throw new Error('Invalid ZIP central directory');
            }

            const method = view.getUint16(centralOffset + 10, true);
            const compressedSize = view.getUint32(centralOffset + 20, true);
            const nameLength = view.getUint16(centralOffset + 28, true);
            const extraLength = view.getUint16(centralOffset + 30, true);
            const commentLength = view.getUint16(centralOffset + 32, true);
            const localHeaderOffset = view.getUint32(centralOffset + 42, true);
            const nameBytes = bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength);
            const name = decoder.decode(nameBytes).replace(/\\/g, '/');

            if (!name.endsWith('/')) {
                const localNameLength = view.getUint16(localHeaderOffset + 26, true);
                const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
                const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
                const compressed = bytes.slice(dataStart, dataStart + compressedSize);
                const content = method === 0 ? compressed : await inflateZipEntry(method, compressed);
                entries.push({ name, bytes: content, text: decoder.decode(content) });
            }

            centralOffset += 46 + nameLength + extraLength + commentLength;
        }

        return entries;
    }

    function findZipEndOfCentralDirectory(view) {
        const minOffset = Math.max(0, view.byteLength - 0xFFFF - 22);
        for (let i = view.byteLength - 22; i >= minOffset; i--) {
            if (view.getUint32(i, true) === 0x06054b50) return i;
        }
        return -1;
    }

    async function inflateZipEntry(method, compressed) {
        if (method !== 8 || typeof DecompressionStream === 'undefined') {
            throw new Error('Only STORE or DEFLATE ZIP entries are supported in this browser');
        }

        const inflateWith = async (format) => {
            const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream(format));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        };

        try {
            return await inflateWith('deflate-raw');
        } catch (err) {
            return inflateWith('deflate');
        }
    }

    function parseConfigModuleSource(source) {
        const moduleSource = String(source || '')
            .replace(/export\s+default\s+CONFIG\s*;?/g, '')
            .replace(/export\s*\{\s*CONFIG\s*\}\s*;?/g, '')
            .replace(/export\s+(const|let|var)\s+CONFIG\s*=/, '$1 CONFIG =')
            .replace(/export\s+default\s+\{/, 'const CONFIG = {');

        return Function(`${moduleSource}\n; return typeof CONFIG !== 'undefined' ? CONFIG : null;`)();
    }

    function findZipEntry(entries, fileNames) {
        const wanted = fileNames.map((name) => name.toLowerCase());
        return entries.find((entry) => {
            const normalized = entry.name.toLowerCase();
            return wanted.some((fileName) => normalized === fileName || normalized.endsWith('/' + fileName));
        }) || null;
    }

    function getImportAssetEntries(entries) {
        const fileNames = [
            'ui.html',
            'ui.css',
            'ui.js',
            'localRecognitionActions.js',
            'localRegularActionFunctions.js',
            'serverRecognitionActions.js',
            'serverRegularActionFunctions.js',
            'localStartupAction.js',
            'serverStartupAction.js',
        ];
        return Object.fromEntries(
            fileNames
                .map((fileName) => [fileName, findZipEntry(entries, [fileName])])
                .filter(([, entry]) => Boolean(entry))
        );
    }

    function extractNamedExports(source) {
        const names = new Set();
        const text = String(source || '');
        const declarationRe = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
        let match;
        while ((match = declarationRe.exec(text))) {
            names.add(match[1] || match[2]);
        }

        const listRe = /export\s*\{\s*([^}]+)\s*\}/g;
        while ((match = listRe.exec(text))) {
            match[1]
                .split(',')
                .map((part) => part.trim().split(/\s+as\s+/i).pop().trim())
                .filter(Boolean)
                .forEach((name) => names.add(name));
        }

        return Array.from(names);
    }

    function fillImportedConfigFields(config, exportedNamesByFileName) {
        setFormValue('configId', config.id);
        setFormValue('configName', config.name);
        setFormValue('configDescription', config.description);
        setSelectValue('edgeType', config.edgeType || (config.ui ? 'web' : null));
        setCheckboxValue('useUi', Object.prototype.hasOwnProperty.call(config, 'ui'));
        setCheckboxValue('ui', Boolean(config.ui));

        fillRecognitionFields('local', config.localRecognition);
        fillBoundingBoxFields(config.boundingBoxStyles);
        fillRecognitionFields('server', config.serverRecognition);

        setFormValue(
            'localStartupActionMethodName',
            config.localStartupAction || exportedNamesByFileName['localStartupAction.js']?.[0] || ''
        );
        setFormValue(
            'serverStartupActionMethodName',
            config.serverStartupAction || exportedNamesByFileName['serverStartupAction.js']?.[0] || ''
        );

        const localRecognitionActions = pickActionList(config, 'localRecognitionActions', 'localRecognitionActionFunctions');
        fillActionRows(
            'localRecognitionActionsList',
            'useLocalRecognitionActions',
            localRecognitionActions,
            exportedNamesByFileName['localRecognitionActions.js'] || []
        );
        fillActionRows(
            'localRegularActionsList',
            'useLocalRegularActionFunctions',
            pickActionList(config, 'localRegularActionFunctions'),
            exportedNamesByFileName['localRegularActionFunctions.js'] || []
        );
        fillActionRows(
            'serverRecognitionActionsList',
            'useServerRecognitionActions',
            pickActionList(config, 'serverRecognitionActions', 'serverRecognitionActionFunctions'),
            exportedNamesByFileName['serverRecognitionActions.js'] || []
        );
        fillActionRows(
            'serverRegularActionFunctionsList',
            'useServerRegularActionFunctions',
            pickActionList(config, 'serverRegularActionFunctions'),
            exportedNamesByFileName['serverRegularActionFunctions.js'] || []
        );
    }

    function fillRecognitionFields(kind, recognition) {
        const isLocal = kind === 'local';
        setCheckboxValue(isLocal ? 'useLocalRecognition' : 'useServerRecognition', Boolean(recognition));
        if (!recognition) return;

        setFormValue(isLocal ? 'localClasses' : 'serverClasses', Array.isArray(recognition.classes) ? recognition.classes.join(', ') : '');
        setFormValue(isLocal ? 'localMaxResults' : 'serverMaxResults', recognition.maxResults);
        setFormValue(isLocal ? 'localThreshold' : 'serverThreshold', recognition.threshold);
        setFormValue(isLocal ? 'localIouThreshold' : 'serverIouThreshold', recognition.iouThreshold);
        setSelectValue(isLocal ? 'localModel' : 'serverModel', recognition.model);
        setFormValue(isLocal ? 'localInterval' : 'serverRecognitionInterval', recognition.interval);

        if (isLocal) {
            setFormValue('localInputSize', recognition.inputSize);
            setFormValue('localMaxCaptureSize', recognition.maxCaptureSize);
        }
    }

    function fillBoundingBoxFields(styles) {
        setCheckboxValue('useBoundingBoxStyles', Boolean(styles));
        if (!styles) return;

        setFormValue('strokeStyle', styles.strokeStyle);
        setFormValue('lineWidth', styles.lineWidth);
        setFormValue('shadowColor', styles.shadowColor);
        setFormValue('shadowBlur', styles.shadowBlur);
        setFormValue('font', styles.font);
        setFormValue('labelBgColor', styles.labelBgColor);
        setFormValue('labelTextColor', styles.labelTextColor);
        setFormValue('labelPadding', styles.labelPadding);
        setFormValue('borderRadius', styles.borderRadius);
        setFormValue('boundingBoxInterval', styles.interval);
    }

    function pickActionList(config, ...keys) {
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(config, key)) {
                return Array.isArray(config[key]) ? config[key] : [];
            }
        }
        return null;
    }

    function fillActionRows(containerId, includeCheckboxId, actionList, fallbackFunctionNames) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        const actions = actionList === null && fallbackFunctionNames.length
            ? [{ action: { type: 'CUSTOM', value: fallbackFunctionNames }, timeout: 2000 }]
            : (actionList || []);
        setCheckboxValue(includeCheckboxId, actionList !== null || fallbackFunctionNames.length > 0);

        for (const action of actions) {
            const preset = normalizeImportedAction(action);
            if (preset) addDeclarativeActionRow(containerId, preset);
        }
    }

    function normalizeImportedAction(action) {
        if (!action || typeof action !== 'object') return null;
        const actionObj = action.action || action;
        const type = actionObj.type || (action.func ? 'CUSTOM' : '');
        const value = actionObj.value || actionObj.values || (action.func?.name ? [action.func.name] : []);
        const valueStr = Array.isArray(value) ? value.join(', ') : String(value || '');
        const timeout = action.timeout ?? action.interval ?? action.counter ?? 2000;
        if (!type && !valueStr) return null;
        return { type: type || 'CUSTOM', valueStr, timeout };
    }

    function attachImportedAssetFiles(config, assetByFileName) {
        const assets = [
            ['uiHtmlFile', config.uiHtmlPath || 'ui.html', assetByFileName['ui.html']],
            ['uiCssFile', config.uiCssPath || 'ui.css', assetByFileName['ui.css']],
            ['uiJsFile', config.uiJsPath || 'ui.js', assetByFileName['ui.js']],
            ['localRecognitionActionsCustomJsFile', 'localRecognitionActions.js', assetByFileName['localRecognitionActions.js']],
            ['localRegularActionFunctionsCustomJsFile', 'localRegularActionFunctions.js', assetByFileName['localRegularActionFunctions.js']],
            ['serverRecognitionActionsCustomJsFile', 'serverRecognitionActions.js', assetByFileName['serverRecognitionActions.js']],
            ['serverRegularActionFunctionsCustomJsFile', 'serverRegularActionFunctions.js', assetByFileName['serverRegularActionFunctions.js']],
            ['localStartupActionJsFile', 'localStartupAction.js', assetByFileName['localStartupAction.js']],
            ['serverStartupActionJsFile', 'serverStartupAction.js', assetByFileName['serverStartupAction.js']],
        ];

        for (const [inputId, preferredName, entry] of assets) {
            if (entry) setFileInputFromZipEntry(inputId, entry, preferredName);
        }
    }

    function setFileInputFromZipEntry(inputId, entry, preferredName) {
        const input = document.getElementById(inputId);
        if (!input || typeof DataTransfer === 'undefined' || typeof File === 'undefined') return false;

        const dt = new DataTransfer();
        const fileName = zipBaseName(preferredName || entry.name);
        dt.items.add(new File([entry.bytes], fileName, { type: mimeTypeForFileName(fileName) }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function zipBaseName(path) {
        return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'asset.js';
    }

    function mimeTypeForFileName(fileName) {
        if (/\.html?$/i.test(fileName)) return 'text/html';
        if (/\.css$/i.test(fileName)) return 'text/css';
        if (/\.js$/i.test(fileName)) return 'text/javascript';
        return 'application/octet-stream';
    }

    function setFormValue(id, value) {
        if (value === undefined || value === null) return;
        const el = document.getElementById(id);
        if (!el) return;
        el.value = Array.isArray(value) ? value.join(', ') : String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setSelectValue(id, value) {
        if (value === undefined || value === null) return;
        const el = document.getElementById(id);
        if (!el) return;
        const normalized = String(value);
        if (Array.from(el.options).some((option) => option.value === normalized)) {
            el.value = normalized;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function setCheckboxValue(id, checked) {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = Boolean(checked);
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function refreshPreviewIfOpen() {
        const previewSection = document.getElementById('configPreviewSection');
        const previewJsonEl = document.getElementById('configPreviewJson');
        if (!previewSection || previewSection.hidden || !previewJsonEl) return;
        previewJsonEl.textContent = buildConfigObjectLiteralBody(readFormConfig());
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

    document.getElementById('btnImportConfig').addEventListener('click', () => {
        document.getElementById('importConfigZipFile')?.click();
    });

    document.getElementById('importConfigZipFile').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await importConfig(file);
            alert('Configuration imported from ZIP.');
        } catch (err) {
            console.error('[config-creator-adv] import failed:', err);
            alert('Failed to import configuration: ' + (err?.message || err));
        } finally {
            e.target.value = '';
        }
    });

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

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const d = readFormConfig();
        const js = buildConfigJs();
        try {
            await downloadBundleZip(d.configId, js);
        } catch (err) {
            console.error('[config-creator-adv] ZIP bundle failed:', err);
            alert('Failed to build ZIP bundle: ' + (err?.message || err));
        }
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

            const assetResult = await uploadAssetsForConfig(config.id);
            const assetCount = assetResult?.data?.saved ? Object.keys(assetResult.data.saved).length : 0;
            const assetMsg = assetResult?.skipped
                ? ''
                : assetResult?.ok
                    ? ` (${assetCount} asset file${assetCount === 1 ? '' : 's'} uploaded)`
                    : ` (assets failed: ${assetResult?.error || 'unknown'})`;

            alert(`Saved as ${data.file || fileName}${assetMsg}`);
            const alsoDownload = document.getElementById('alsoDownloadLocally')?.checked;
            if (alsoDownload) {
                try {
                    await downloadBundleZip(config.id, js);
                } catch (err) {
                    console.error('[config-creator-adv] ZIP bundle failed:', err);
                    alert('Failed to build ZIP bundle: ' + (err?.message || err));
                }
            }
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
