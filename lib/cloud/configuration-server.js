import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PUBLIC_DIR = path.join(__dirname, '..', '..', 'config', 'public');

function isSafeConfigName(name) {
    if (typeof name !== 'string' || !name.length) return false;
    return /^[a-zA-Z0-9_-]+$/.test(name) && !/^\./.test(name);
}

async function getConfiguration(id) {
    // Returns the configuration object from config/public/<id>.js, or config.js as fallback
    // <id> should not include ".js"
    const tryImportConfig = async (name) => {
        try {
            const mod = await import(`../../config/public/${name}.js`, { assert: { type: "javascript" } });
            return mod.default || mod.CONFIG;
        } catch (err) {
            return null;
        }
    };

    let configuration = await tryImportConfig(id);
    if (!configuration) {
        // fallback to main config.js (in project root config/, not config/public/)
        try {
            const fallback = await import(`../../config/config.js`, { assert: { type: "javascript" } });
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

export function setupConfigurationServer(app) {
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
}