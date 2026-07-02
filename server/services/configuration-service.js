import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_ROOT = path.join(__dirname, '..', '..', 'db', 'configs');
const CONFIG_PUBLIC_DIR = path.join(CONFIG_ROOT, 'public');
const CONFIG_ASSETS_DIR = path.join(CONFIG_PUBLIC_DIR, 'assets');

/**
 * Per-configuration asset keys uploaded from config-creator-adv (user files) and
 * conveyor-poc (generated runtime). Each key maps to a fixed filename on disk under
 * `db/configs/public/assets/<configId>/`. Custom action JS files are ES modules with
 * named exports (see conveyor-poc generator).
 */
const ASSET_FILE_NAMES = Object.freeze({
    uiHtml: 'ui.html',
    uiCss: 'ui.css',
    uiJs: 'ui.js',
    localRecognitionActions: 'localRecognitionActions.js',
    localRegularActionFunctions: 'localRegularActionFunctions.js',
    serverRecognitionActions: 'serverRecognitionActions.js',
    serverRegularActionFunctions: 'serverRegularActionFunctions.js',
    localStartupAction: 'localStartupAction.js',
    serverStartupAction: 'serverStartupAction.js',
    sdkJs: 'sdk.js',
    edgeMainJs: 'edge-main.js',
    configJs: 'config.js',
});

const ASSET_KEYS = Object.freeze(Object.keys(ASSET_FILE_NAMES));

function isSafeConfigName(name) {
    if (typeof name !== 'string' || !name.length) return false;
    return /^[a-zA-Z0-9_-]+$/.test(name) && !/^\./.test(name);
}

function assetDirForId(id) {
    return path.join(CONFIG_ASSETS_DIR, id);
}

function assetUrlForId(id, fileName) {
    return `/db/configs/public/assets/${encodeURIComponent(id)}/${fileName}`;
}

async function getConfiguration(id) {
    // Returns the configuration object from db/configs/public/<id>.js, or config.js as fallback
    // <id> should not include ".js"
    const tryImportConfig = async (name) => {
        try {
            const mod = await import(`../../db/configs/public/${name}.js`, { assert: { type: "javascript" } });
            return mod.default || mod.CONFIG;
        } catch (err) {
            return null;
        }
    };

    let configuration = await tryImportConfig(id);
    if (!configuration) {
        // fallback to main config.js (db/configs/, not public/)
        try {
            const fallback = await import(`../../db/configs/config.js`, { assert: { type: "javascript" } });
            configuration = fallback.default || fallback.CONFIG;
        } catch (err2) {
            throw new Error(`Configuration "${id}" not found, and fallback config.js failed to load.`);
        }
    }
    if (!configuration) {
        throw new Error(`Malformed configuration (id: "${id}")`);
    }
    return configuration;
}

function configObjectToJsSource(config) {
    const serialized = JSON.stringify(config, null, 4);
    return `const CONFIG = ${serialized};\n\nexport default CONFIG;\nexport { CONFIG };\n`;
}

export function setupConfigurationService(app) {
    app.get('/api/configurations', async (req, res) => {
        try {
            const entries = await fs.readdir(CONFIG_PUBLIC_DIR, { withFileTypes: true });
            const names = entries
                .filter((e) => e.isFile())
                .map((e) => e.name);
            res.json(names);
        } catch (err) {
            console.error('GET /api/configurations error:', err);
            res.status(500).json({ error: err.message || 'Failed to list configurations.' });
        }
    });

    app.get('/api/configurations/:id', async (req, res) => {
        const idParam = req.params.id;
        const configuration = await getConfiguration(idParam);
        res.json(configuration);
    });

    app.post('/api/configurations', async (req, res) => {
        try {
            const { name, config } = req.body ?? {};
            if (!name || config === undefined) {
                return res.status(400).json({
                    error: 'Request body must include "name" (string) and "config" (object).',
                });
            }
            if (!isSafeConfigName(name)) {
                return res.status(400).json({
                    error: 'Invalid "name": use only letters, numbers, underscores, and hyphens (no extension).',
                });
            }
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                return res.status(400).json({
                    error: '"config" must be a plain object.',
                });
            }

            const filePath = path.join(CONFIG_PUBLIC_DIR, `${name}.js`);
            const content = configObjectToJsSource(config);
            await fs.writeFile(filePath, content, 'utf8');

            res.status(201).json({ ok: true, file: `${name}.js` });
        } catch (err) {
            console.error('POST /api/configurations error:', err);
            res.status(500).json({ error: err.message || 'Failed to save configuration.' });
        }
    });

    app.get('/api/configurations/:id/assets', async (req, res) => {
        try {
            const id = req.params.id;
            if (!isSafeConfigName(id)) {
                return res.status(400).json({
                    error: 'Invalid "id": use only letters, numbers, underscores, and hyphens.',
                });
            }

            const dir = assetDirForId(id);
            let entries = [];
            try {
                entries = await fs.readdir(dir);
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }

            const availableFiles = new Set(entries);
            const manifest = {};
            for (const [key, fileName] of Object.entries(ASSET_FILE_NAMES)) {
                manifest[key] = availableFiles.has(fileName) ? assetUrlForId(id, fileName) : null;
            }
            res.json({ id, assets: manifest, fileNames: ASSET_FILE_NAMES });
        } catch (err) {
            console.error('GET /api/configurations/:id/assets error:', err);
            res.status(500).json({ error: err.message || 'Failed to load assets.' });
        }
    });

    app.post('/api/configurations/:id/assets', async (req, res) => {
        try {
            const id = req.params.id;
            if (!isSafeConfigName(id)) {
                return res.status(400).json({
                    error: 'Invalid "id": use only letters, numbers, underscores, and hyphens.',
                });
            }

            const payload = req.body ?? {};
            const assets = payload.assets && typeof payload.assets === 'object' ? payload.assets : payload;
            if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
                return res.status(400).json({
                    error: 'Body must include "assets" object with text contents per key.',
                });
            }
            const extraFiles = payload.extraFiles && typeof payload.extraFiles === 'object' && !Array.isArray(payload.extraFiles)
                ? payload.extraFiles
                : null;
            // Binary file copies — { srcRelToV4Root: destRelToAssetDir }. Used for large assets
            // (e.g. lib/edge/recognition/yolo/models/yolo11n.onnx) that would be wasteful to
            // base64 through JSON. Server reads the source from its own filesystem.
            const copyFiles = payload.copyFiles && typeof payload.copyFiles === 'object' && !Array.isArray(payload.copyFiles)
                ? payload.copyFiles
                : null;

            const dir = assetDirForId(id);
            await fs.mkdir(dir, { recursive: true });

            const saved = {};
            const skipped = {};
            for (const key of ASSET_KEYS) {
                if (!(key in assets)) continue;
                const value = assets[key];
                if (value == null || value === '') {
                    continue;
                }
                if (typeof value !== 'string') {
                    skipped[key] = 'not a string';
                    continue;
                }
                const fileName = ASSET_FILE_NAMES[key];
                const filePath = path.join(dir, fileName);
                await fs.writeFile(filePath, value, 'utf8');
                saved[key] = assetUrlForId(id, fileName);
            }

            // Optional generic file map for self-contained web bundles (lib/ and config/ files
            // that the generated edge-main.js imports relatively). Paths must be sandboxed under
            // the asset directory and limited to known prefixes to avoid arbitrary write.
            const ALLOWED_EXTRA_PREFIXES = ['lib/', 'config/', 'db/configs/'];
            const savedExtras = {};
            const skippedExtras = {};
            if (extraFiles) {
                for (const [rawRel, value] of Object.entries(extraFiles)) {
                    if (typeof rawRel !== 'string' || !rawRel) continue;
                    if (typeof value !== 'string') { skippedExtras[rawRel] = 'not a string'; continue; }
                    const rel = rawRel.replace(/\\/g, '/').replace(/^\.?\/+/, '');
                    if (!ALLOWED_EXTRA_PREFIXES.some((p) => rel.startsWith(p))) {
                        skippedExtras[rawRel] = 'prefix not allowed';
                        continue;
                    }
                    if (rel.split('/').some((seg) => seg === '..' || seg === '' || /^\.+$/.test(seg))) {
                        skippedExtras[rawRel] = 'invalid path segment';
                        continue;
                    }
                    const filePath = path.resolve(dir, rel);
                    if (!filePath.startsWith(path.resolve(dir) + path.sep)) {
                        skippedExtras[rawRel] = 'escape attempt';
                        continue;
                    }
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, value, 'utf8');
                    savedExtras[rel] = `/db/configs/public/assets/${encodeURIComponent(id)}/${rel}`;
                }
            }

            const ALLOWED_COPY_PREFIXES = ['lib/', 'config/', 'db/configs/'];
            const V4_ROOT = path.join(__dirname, '..', '..');
            const copied = {};
            const skippedCopies = {};
            if (copyFiles) {
                for (const [rawSrc, rawDest] of Object.entries(copyFiles)) {
                    if (typeof rawSrc !== 'string' || typeof rawDest !== 'string' || !rawSrc || !rawDest) {
                        skippedCopies[rawSrc] = 'invalid pair';
                        continue;
                    }
                    const src = rawSrc.replace(/\\/g, '/').replace(/^\.?\/+/, '');
                    const dest = rawDest.replace(/\\/g, '/').replace(/^\.?\/+/, '');
                    if (!ALLOWED_COPY_PREFIXES.some((p) => src.startsWith(p))) {
                        skippedCopies[rawSrc] = 'src prefix not allowed';
                        continue;
                    }
                    if (!ALLOWED_EXTRA_PREFIXES.some((p) => dest.startsWith(p))) {
                        skippedCopies[rawSrc] = 'dest prefix not allowed';
                        continue;
                    }
                    if ([...src.split('/'), ...dest.split('/')].some((seg) => seg === '..' || seg === '' || /^\.+$/.test(seg))) {
                        skippedCopies[rawSrc] = 'invalid path segment';
                        continue;
                    }
                    const srcAbs = path.resolve(V4_ROOT, src);
                    const destAbs = path.resolve(dir, dest);
                    if (!srcAbs.startsWith(path.resolve(V4_ROOT) + path.sep) ||
                        !destAbs.startsWith(path.resolve(dir) + path.sep)) {
                        skippedCopies[rawSrc] = 'escape attempt';
                        continue;
                    }
                    try {
                        await fs.access(srcAbs);
                    } catch {
                        skippedCopies[rawSrc] = 'source not found';
                        continue;
                    }
                    await fs.mkdir(path.dirname(destAbs), { recursive: true });
                    await fs.copyFile(srcAbs, destAbs);
                    copied[rawSrc] = `/db/configs/public/assets/${encodeURIComponent(id)}/${dest}`;
                }
            }

            res.status(201).json({
                ok: true,
                id,
                saved,
                skipped,
                fileNames: ASSET_FILE_NAMES,
                ...(extraFiles ? { savedExtras, skippedExtras } : {}),
                ...(copyFiles ? { copied, skippedCopies } : {}),
            });
        } catch (err) {
            console.error('POST /api/configurations/:id/assets error:', err);
            res.status(500).json({ error: err.message || 'Failed to save assets.' });
        }
    });

    app.delete('/api/configurations/:id', async (req, res) => {
        try {
            const id = req.params.id;
            if (!isSafeConfigName(id)) {
                return res.status(400).json({
                    error: 'Invalid "id": use only letters, numbers, underscores, and hyphens (no extension).',
                });
            }
            const filePath = path.join(CONFIG_PUBLIC_DIR, `${id}.js`);
            await fs.unlink(filePath);
            res.json({ ok: true, deleted: `${id}.js` });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: `Configuration "${req.params.id}" not found.` });
            }
            console.error('DELETE /api/configurations/:id error:', err);
            res.status(500).json({ error: err.message || 'Failed to delete configuration.' });
        }
    });
}