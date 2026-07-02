import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_LIST_DIR = path.join(__dirname, '..', '..', 'db', 'models');

const CHECKPOINT_EXTS = new Set(['.pt', '.tflite', '.safetensors']);

/** Extension for simulated checkpoint type (empty file on disk). */
export function extensionForModelId(modelId) {
  const id = String(modelId || '');
  if (id.startsWith('vlm-')) return '.safetensors';
  if (id.includes('efficientdet')) return '.tflite';
  return '.pt';
}

function safeStem(modelId) {
  const s = String(modelId || 'model')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'model';
}

/** Sanitize checkpoint stem (section 1 name or client-resolved stem); strips accidental extension. */
function sanitizeCheckpointStem(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const noExt = value.trim().replace(/\.(pt|tflite|safetensors)$/i, '');
  const s = noExt.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return s.length ? s : null;
}

function resolveModelFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!CHECKPOINT_EXTS.has(ext)) {
    return null;
  }
  const base = path.basename(filename);
  if (!base || base === '.' || base === '..' || base.includes('..')) {
    return null;
  }
  const absDir = path.resolve(MODELS_LIST_DIR);
  const absFile = path.resolve(path.join(MODELS_LIST_DIR, base));
  const rel = path.relative(absDir, absFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return { absFile, withExt: base };
}

export function setupModelTrainingServer(app) {
  app.get('/api/model-training/models-list', async (req, res) => {
    try {
      await fs.mkdir(MODELS_LIST_DIR, { recursive: true });
      const entries = await fs.readdir(MODELS_LIST_DIR, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && CHECKPOINT_EXTS.has(path.extname(e.name).toLowerCase()))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      res.json({ files });
    } catch (err) {
      console.error('GET /api/model-training/models-list error:', err);
      res.status(500).json({ error: err.message || 'Failed to list model files.' });
    }
  });

  app.delete('/api/model-training/models-list/:name', async (req, res) => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : '';
      const resolved = resolveModelFile(name);
      if (!resolved) {
        return res.status(400).json({ error: 'Invalid or unknown model file name.' });
      }
      await fs.unlink(resolved.absFile);
      res.json({ ok: true, file: resolved.withExt });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found.' });
      }
      console.error('DELETE /api/model-training/models-list/:name error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete model file.' });
    }
  });

  app.post('/api/model-training/save-model', async (req, res) => {
    try {
      const modelId = req.body?.modelId;
      if (typeof modelId !== 'string' || !modelId.trim()) {
        return res.status(400).json({ error: 'Body must include a non-empty string "modelId".' });
      }

      const stem =
        sanitizeCheckpointStem(req.body?.outputStem) ||
        sanitizeCheckpointStem(req.body?.trainedModelName) ||
        safeStem(modelId.trim());

      const ext = extensionForModelId(modelId.trim());
      const name = `${stem}${ext}`;
      const resolved = resolveModelFile(name);
      if (!resolved) {
        return res.status(400).json({ error: 'Invalid target file name.' });
      }

      await fs.mkdir(MODELS_LIST_DIR, { recursive: true });
      await fs.writeFile(resolved.absFile, Buffer.alloc(0));

      res.status(201).json({
        ok: true,
        file: resolved.withExt,
        path: `db/models/${resolved.withExt}`,
      });
    } catch (err) {
      console.error('POST /api/model-training/save-model error:', err);
      res.status(500).json({ error: err.message || 'Failed to save model file.' });
    }
  });
}
