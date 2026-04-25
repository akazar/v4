/**
 * conveyor-poc orchestrator.
 *
 * Reads a saved configuration from the v4 server + its asset manifest, then generates all
 * edge + server artifacts and packages them into a single ZIP bundle named after the
 * configId. All the string templates live in templates.js for clarity.
 */

import {
    configFileContents,
    readmeContents,
    sdkContents,
    edgeMainWebContents,
    edgeMainNodeContents,
    defaultUiHtmlContents,
    defaultUiCssContents,
    defaultUiJsContents,
    nodePackageSnippetContents,
    serverPipelineContents,
    customActionStubContents,
    inferEdgeType,
} from './templates.js';
import { createZipBlob, downloadBlob } from './zip.js';

const configSelect = document.getElementById('configSelect');
const configSummaryEl = document.getElementById('configSummary');
const runLogEl = document.getElementById('runLog');
const howToPanelEl = document.getElementById('howToRunPanel');
const btnRun = document.getElementById('btnRunPipeline');
const optIncludeServerPipeline = document.getElementById('optIncludeServerPipeline');

function log(message, kind = 'info') {
    const line = document.createElement('span');
    line.className = `log-line log-${kind}`;
    line.textContent = message;
    runLogEl.appendChild(line);
    runLogEl.scrollTop = runLogEl.scrollHeight;
}

function clearLog() {
    runLogEl.innerHTML = '';
}

async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
        const err = new Error(json?.error || `${res.status} ${res.statusText}`);
        err.response = json;
        throw err;
    }
    return json;
}

async function loadConfigList() {
    configSelect.innerHTML = '';
    try {
        const names = await fetchJson('/api/configurations');
        const ids = (Array.isArray(names) ? names : [])
            .filter((n) => typeof n === 'string' && n.endsWith('.js'))
            .map((n) => n.replace(/\.js$/, ''))
            .sort();
        if (!ids.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No configurations — create one in config-creator-adv';
            configSelect.appendChild(opt);
            configSelect.disabled = true;
            return;
        }
        for (const id of ids) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            configSelect.appendChild(opt);
        }
        configSelect.disabled = false;
        configSelect.value = ids[0];
        await renderSummaryForSelected();
    } catch (err) {
        log('Failed to load configurations: ' + err.message, 'error');
    }
}

function summaryItem(label, value) {
    return `<div><span class="summary-label">${label}</span><span>${value ?? '—'}</span></div>`;
}

async function renderSummaryForSelected() {
    const id = configSelect.value;
    configSummaryEl.innerHTML = '';
    howToPanelEl.innerHTML = '<p class="hint">Pick a configuration and click <em>Run pipeline</em> to see the commands tailored to it.</p>';
    if (!id) return;

    try {
        const [config, manifest] = await Promise.all([
            fetchJson(`/api/configurations/${encodeURIComponent(id)}`),
            fetchJson(`/api/configurations/${encodeURIComponent(id)}/assets`).catch(() => ({ assets: {} })),
        ]);
        const assetCount = Object.values(manifest?.assets || {}).filter(Boolean).length;
        configSummaryEl.innerHTML = [
            summaryItem('Config id', id),
            summaryItem('Edge type', config?.edgeType || 'web'),
            summaryItem('Local recognition', config?.localRecognition ? 'yes' : 'no'),
            summaryItem('Server recognition', config?.serverRecognition ? 'yes' : 'no'),
            summaryItem('Bounding boxes', config?.boundingBoxStyles ? 'yes' : 'no'),
            summaryItem('Uploaded assets', String(assetCount)),
        ].join('');
    } catch (err) {
        configSummaryEl.innerHTML = `<div class="hint log-error">Failed to load config: ${err.message}</div>`;
    }
}

configSelect.addEventListener('change', renderSummaryForSelected);

async function fetchAssetText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.text();
}

/** Sanitize configId for use as a folder / file name. Keep the readable id when possible. */
function safeBundleName(configId) {
    return (configId || 'conveyor-bundle').replace(/[^a-zA-Z0-9_-]/g, '-') || 'conveyor-bundle';
}

/**
 * Resolve a relative ES module specifier against an existing absolute path.
 * Mirrors Node / browser URL resolution for `./` and `../` specifiers.
 */
function resolveRelativePath(fromRelPath, spec) {
    const base = fromRelPath.split('/').slice(0, -1);
    const parts = spec.split('/');
    const out = [...base];
    for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') out.pop();
        else out.push(p);
    }
    return out.join('/');
}

/**
 * Walk ES module imports starting at the given entry paths (relative to v4 repo root,
 * e.g. `lib/cloud/pipeline/server-pipeline.js`) and collect every file under `lib/` or
 * `config/` that is reachable. Fetches files via the v4 static hosting (same origin).
 *
 * Uses a tolerant regex that covers static `import ... from '...'`, side-effect `import '...'`,
 * `export ... from '...'`, and dynamic `import('...')`. Bare specifiers (npm packages) are
 * skipped — they are satisfied at runtime by the user running `npm install` in the bundle.
 */
async function collectLibDependencies(entryRelPaths) {
    const IMPORT_RE = /(?:\bimport\s*(?:[\w\s*{},$]+?\s+from\s+)?|\bexport\s+[\w\s*{},$]+?\s+from\s+|\bimport\s*\()\s*['"`]([^'"`]+)['"`]/g;
    const INCLUDE_PREFIXES = ['lib/', 'config/'];
    const visited = new Map();
    const queue = [...entryRelPaths];

    while (queue.length) {
        const rel = queue.shift();
        if (visited.has(rel)) continue;
        visited.set(rel, null);
        let text;
        try {
            const res = await fetch('/' + rel);
            if (!res.ok) continue;
            text = await res.text();
        } catch {
            continue;
        }
        visited.set(rel, text);

        IMPORT_RE.lastIndex = 0;
        let m;
        while ((m = IMPORT_RE.exec(text)) !== null) {
            const spec = m[1];
            if (!spec) continue;
            let next;
            if (spec.startsWith('/')) next = spec.replace(/^\/+/, '');
            else if (spec.startsWith('.')) next = resolveRelativePath(rel, spec);
            else continue; // bare specifier → npm package
            if (!INCLUDE_PREFIXES.some((p) => next.startsWith(p))) continue;
            if (!visited.has(next)) queue.push(next);
        }
    }

    const out = {};
    for (const [rel, text] of visited) if (text !== null) out[rel] = text;
    return out;
}

/**
 * Write generated web-runnable files back to the server's `config/public/assets/<id>/`
 * folder, so the hosted URL `/config/public/assets/<id>/ui.html` can actually resolve
 * `sdk.js`, `edge-main.js`, and (when the user didn't upload a custom UI) the defaults.
 *
 * `uploads` is a partial map keyed by ASSET_FILE_NAMES keys in the server whitelist.
 */
async function uploadGeneratedWebAssets(configId, uploads, extraFiles = null, copyFiles = null) {
    if (!configId) return { skipped: true };
    const hasUploads = uploads && Object.keys(uploads).length;
    const hasExtras = extraFiles && Object.keys(extraFiles).length;
    const hasCopies = copyFiles && Object.keys(copyFiles).length;
    if (!hasUploads && !hasExtras && !hasCopies) return { skipped: true };
    try {
        const body = {};
        if (hasUploads) body.assets = uploads;
        if (hasExtras) body.extraFiles = extraFiles;
        if (hasCopies) body.copyFiles = copyFiles;
        const res = await fetch(`/api/configurations/${encodeURIComponent(configId)}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data?.error || `${res.status} ${res.statusText}` };
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}

function hasServerPipelineOptions(config) {
    return Boolean(
        config?.serverRecognition
        || (Array.isArray(config?.serverRecognitionActions) && config.serverRecognitionActions.length)
        || (Array.isArray(config?.serverRegularActionFunctions) && config.serverRegularActionFunctions.length)
        || config?.serverStartupAction
    );
}

function renderHowToRun({ configId, edgeType, streamId, hasServerPipeline }) {
    const streamSuffix = streamId ? streamId : '<streamId>';
    const bundleName = safeBundleName(configId);
    const items = [];
    const isWeb = edgeType === 'web';
    items.push(`
        <div class="howto-step">
            <h3>1. Unzip the bundle</h3>
            <p class="hint">The download is <code>${bundleName}.zip</code>. Extract it so you end up with a
            <code>${bundleName}/</code> folder. The bundle is <strong>fully self-contained</strong>: a local <code>lib/</code> copy${isWeb ? '' : ' + <code>package.json</code>'} ships inside${isWeb ? ', so all <code>./lib/...</code> imports resolve relative to the bundle (host it from any static server)' : ', so <code>V4_ROOT</code> is never required'}.</p>
        </div>
    `);
    items.push(`
        <div class="howto-step">
            <h3>2. Create a stream in the dashboard</h3>
            <p class="hint">Pick a stream id (e.g. <code>${streamSuffix}</code>) and mode SFU.</p>
            <a class="howto-link" target="_blank" rel="noopener" href="/streaming">Open Streaming dashboard ↗</a>
        </div>
    `);

    if (edgeType === 'web') {
        items.push(`
            <div class="howto-step">
                <h3>3. Run the edge (web)</h3>
                <p class="hint">Hosted by v4 (lib/ has been mirrored to the asset folder, so it works out of the box):</p>
                <pre>http://localhost:3001/config/public/assets/${configId}/ui.html?streamId=${streamSuffix}</pre>
                <p class="hint">Or host the extracted bundle on any static server and open <code>ui.html</code>:</p>
                <pre>cd ${bundleName}
npx serve -p 8081       # or: python -m http.server 8081
# then http://&lt;host&gt;:8081/ui.html?streamId=${streamSuffix}</pre>
            </div>
        `);
    } else {
        items.push(`
            <div class="howto-step">
                <h3>3. Run the edge (node)</h3>
                <p class="hint">Self-contained — everything needed lives inside the folder:</p>
                <pre>cd ${bundleName}
npm install
node edge-main.js ${streamSuffix}</pre>
            </div>
        `);
    }

    if (hasServerPipeline) {
        items.push(`
            <div class="howto-step">
                <h3>${isWeb ? '3b' : '4'}. Run the server pipeline</h3>
                <p class="hint">Also self-contained (uses the bundle's own <code>lib/</code>):</p>
                <pre>cd ${bundleName}
npm install${isWeb ? '' : '  # (already done for the node edge)'}
node server-pipeline.js ${configId} ${streamSuffix}</pre>
            </div>
        `);
    }

    items.push(`
        <div class="howto-step">
            <h3>${hasServerPipeline ? '5' : '4'}. Watch the stream</h3>
            <a class="howto-link" target="_blank" rel="noopener" href="/streaming/dashboard.html?streams=${encodeURIComponent(streamSuffix)}&modes=sfu">Open dashboard viewer ↗</a>
        </div>
    `);

    howToPanelEl.innerHTML = items.join('');
}

async function runPipeline() {
    const configId = configSelect.value;
    if (!configId) {
        log('Select a configuration first.', 'error');
        return;
    }

    btnRun.disabled = true;
    clearLog();
    log(`Loading ${configId}…`);

    try {
        const [config, manifest] = await Promise.all([
            fetchJson(`/api/configurations/${encodeURIComponent(configId)}`),
            fetchJson(`/api/configurations/${encodeURIComponent(configId)}/assets`).catch(() => ({ assets: {} })),
        ]);

        const edgeType = inferEdgeType(config);
        const assets = manifest?.assets || {};
        const includeServer = optIncludeServerPipeline.checked && hasServerPipelineOptions(config);
        const localRecognitionModel = String(config?.localRecognition?.model || 'YOLO').toUpperCase();
        const hasLocalRecognition = Boolean(config?.localRecognition);

        log(`Edge type: ${edgeType}; server pipeline: ${includeServer ? 'yes' : 'no'}`);

        /** Files to bundle, relative to the top-level folder inside the zip. */
        const files = [];
        files.push({
            name: 'config.js',
            contents: configFileContents(config, { signalingUrl: location.origin }),
        });
        files.push({ name: 'sdk.js', contents: sdkContents() });

        if (edgeType === 'web') {
            files.push({ name: 'edge-main.js', contents: edgeMainWebContents(config, { assets, configId }) });
            files.push({
                name: 'ui.html',
                contents: assets.uiHtml ? await fetchAssetText(assets.uiHtml) : defaultUiHtmlContents(config, { configId }),
            });
            files.push({
                name: 'ui.css',
                contents: assets.uiCss ? await fetchAssetText(assets.uiCss) : defaultUiCssContents(),
            });
            files.push({
                name: 'ui.js',
                contents: assets.uiJs ? await fetchAssetText(assets.uiJs) : defaultUiJsContents(),
            });
        } else {
            files.push({ name: 'edge-main.js', contents: edgeMainNodeContents(config, { configId, assets }) });
        }

        const customActionAssetKeys = [
            'localRecognitionActions',
            'localRegularActionFunctions',
            'localStartupAction',
            'serverRecognitionActions',
            'serverRegularActionFunctions',
            'serverStartupAction',
        ];
        // Fetch all uploaded custom action / startup JS files in parallel.
        const customFetches = customActionAssetKeys
            .filter((key) => assets[key])
            .map(async (key) => ({ name: `${key}.js`, contents: await fetchAssetText(assets[key]) }));
        for (const entry of await Promise.all(customFetches)) {
            files.push(entry);
        }

        // Always include stubs for server-side custom modules when we include the server pipeline but
        // the user didn't upload their own, so the generated server-pipeline.js imports never crash.
        if (includeServer) {
            const serverCustomKeys = ['serverRecognitionActions', 'serverRegularActionFunctions', 'serverStartupAction'];
            for (const key of serverCustomKeys) {
                if (!assets[key]) {
                    files.push({ name: `${key}.js`, contents: customActionStubContents(key) });
                }
            }
        }

        if (includeServer) {
            files.push({ name: 'server-pipeline.js', contents: serverPipelineContents(config, { configId }) });
        }

        // Bundle the full transitive set of `lib/` (and any imported `config/`) files so the
        // bundle is self-contained:
        //   - Web bundles can be hosted from any static server (no v4 dependency for /lib/).
        //   - Node bundles can run anywhere — no V4_ROOT required.
        const hasNodeEdge = edgeType !== 'web';
        const needsPackageJson = hasNodeEdge || includeServer;
        if (needsPackageJson) {
            files.push({
                name: 'package.json',
                contents: nodePackageSnippetContents({
                    configId,
                    hasNodeEdge,
                    hasServerPipeline: includeServer,
                    hasLocalRecognition,
                    localRecognitionModel,
                }),
            });
        }
        const libFiles = {};
        const entries = [];
        if (edgeType === 'web') {
            // Imported by the generated web edge-main.js / sdk.js.
            entries.push(
                'lib/edge/recognition-pipeline.js',
                'lib/edge/capture.js',
                'lib/edge/webrtc-publisher.js',
                'lib/edge/bounding-boxes.js',
            );
        } else {
            entries.push('lib/edge/webrtc-publisher.node.js');
            if (hasLocalRecognition) {
                entries.push('lib/cloud/streaming-server/i420-jpeg.js');
                entries.push(
                    localRecognitionModel === 'MEDIAPIPE'
                        ? 'lib/cloud/recognition/mediapipe/recognize-mediapipe.js'
                        : 'lib/cloud/recognition/yolo/recognize-yolo.mjs'
                );
            }
        }
        if (includeServer) {
            entries.push('lib/cloud/pipeline/server-pipeline.js');
        }
        log(`Walking lib/ import graph from ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}…`);
        const collected = await collectLibDependencies(entries);
        Object.assign(libFiles, collected);
        log(`  bundled ${Object.keys(collected).length} shared file${Object.keys(collected).length === 1 ? '' : 's'} under lib/ + config/`);

        // Binary asset deps that aren't reachable via the JS import walker (e.g. ML model files
        // loaded at runtime from script-relative URLs). Map: relPath -> Uint8Array.
        // Also tracked separately as `binaryCopyMap` so the v4 server can do a fast filesystem
        // copy into the asset folder instead of base64-roundtripping multi-MB binaries.
        const binaryFiles = {};
        const binaryCopyMap = {};
        const usesYolo = hasLocalRecognition && (localRecognitionModel === '' || localRecognitionModel === 'YOLO' || localRecognitionModel.startsWith('YOLO'));
        if (usesYolo) {
            const yoloModelRel = edgeType === 'web'
                ? 'lib/edge/recognition/yolo/models/yolo11n.onnx'
                : 'lib/cloud/recognition/yolo/models/yolo11n.onnx';
            try {
                log(`Fetching ${yoloModelRel} (binary, ~10 MB)…`);
                const res = await fetch('/' + yoloModelRel);
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
                const buf = new Uint8Array(await res.arrayBuffer());
                binaryFiles[yoloModelRel] = buf;
                binaryCopyMap[yoloModelRel] = yoloModelRel;
                log(`  bundled ${yoloModelRel} (${buf.length.toLocaleString()} bytes)`);
            } catch (err) {
                log(`Warning: failed to bundle YOLO model from ${yoloModelRel}: ${err.message}`, 'error');
            }
        }

        files.push({
            name: 'README.md',
            contents: readmeContents(config, {
                edgeType,
                configId,
                hasServerPipeline: includeServer,
                selfContainedLib: true,
            }),
        });

        const bundleName = safeBundleName(configId);
        const zipEntries = files.map((f) => ({ name: `${bundleName}/${f.name}`, content: f.contents }));
        for (const [rel, content] of Object.entries(libFiles)) {
            zipEntries.push({ name: `${bundleName}/${rel}`, content });
        }
        for (const [rel, content] of Object.entries(binaryFiles)) {
            zipEntries.push({ name: `${bundleName}/${rel}`, content });
        }

        const libCount = Object.keys(libFiles).length;
        const binCount = Object.keys(binaryFiles).length;
        const totalCount = files.length + libCount + binCount;
        const sharedTail = libCount || binCount
            ? ` (incl. ${libCount} shared lib/config${binCount ? `, ${binCount} binary asset${binCount === 1 ? '' : 's'}` : ''})`
            : '';
        log(`Packaging ${totalCount} file${totalCount === 1 ? '' : 's'}${sharedTail} into ${bundleName}.zip…`);
        for (const f of files) log(`  + ${bundleName}/${f.name}`);

        const blob = createZipBlob(zipEntries);
        downloadBlob(blob, `${bundleName}.zip`);

        log(`Bundle downloaded: ${bundleName}.zip (${blob.size.toLocaleString()} bytes).`, 'success');

        // For web edges, also publish the generated runtime (edge-main.js, sdk.js) — and
        // default ui.html/css/js when the user didn't upload custom ones — to the same
        // assets folder that ui.html is hosted from. Without this, opening the hosted URL
        // 404s on those files because they only exist inside the downloaded ZIP.
        if (edgeType === 'web') {
            const byName = Object.fromEntries(files.map((f) => [f.name, f.contents]));
            const uploads = {
                sdkJs: byName['sdk.js'],
                edgeMainJs: byName['edge-main.js'],
                configJs: byName['config.js'],
            };
            if (!assets.uiHtml) uploads.uiHtml = byName['ui.html'];
            if (!assets.uiCss) uploads.uiCss = byName['ui.css'];
            if (!assets.uiJs) uploads.uiJs = byName['ui.js'];

            // Mirror lib/* (and any imported config/*) into the asset folder so the v4-hosted
            // ui.html can resolve the now-relative `./lib/...` imports from edge-main.js.
            // Binary assets (e.g. yolo11n.onnx) are copied server-side via `binaryCopyMap` to
            // skip the JSON/base64 roundtrip for multi-MB files.
            const result = await uploadGeneratedWebAssets(configId, uploads, libFiles, binaryCopyMap);
            if (result.ok) {
                const count = Object.keys(result.data?.saved || {}).length;
                const extraCount = Object.keys(result.data?.savedExtras || {}).length;
                const copiedCount = Object.keys(result.data?.copied || {}).length;
                const parts = [];
                if (extraCount) parts.push(`${extraCount} lib/config file${extraCount === 1 ? '' : 's'}`);
                if (copiedCount) parts.push(`${copiedCount} binary asset${copiedCount === 1 ? '' : 's'}`);
                const tail = parts.length ? ` + ${parts.join(' + ')}` : '';
                log(`Published ${count} runtime file${count === 1 ? '' : 's'}${tail} to /config/public/assets/${configId}/`, 'success');
            } else if (!result.skipped) {
                log(`Warning: failed to publish runtime files to server: ${result.error}`, 'error');
            }
        }

        renderHowToRun({
            configId,
            edgeType,
            streamId: 'demo',
            hasServerPipeline: includeServer,
        });
    } catch (err) {
        console.error(err);
        log('Pipeline failed: ' + err.message, 'error');
    } finally {
        btnRun.disabled = false;
    }
}

btnRun.addEventListener('click', () => {
    void runPipeline();
});

void loadConfigList();
