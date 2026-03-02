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

export function setupConfigurationServer(app) {
    app.get('/api/configurations/:id', async (req, res) => {
        const idParam = req.params.id;
        const configuration = await getConfiguration(idParam);
        res.json(configuration);
    });
}