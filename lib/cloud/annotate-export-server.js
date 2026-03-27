import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANNOTATION_LIST_DIR = path.join(__dirname, '..', '..', 'apps', 'annotate', 'annotation-list');

const ALLOWED_SIDECAR_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);

function stemFromJsonName(jsonName) {
  const base = path.basename(jsonName);
  if (!base.toLowerCase().endsWith('.json')) {
    return null;
  }
  return base.slice(0, -'.json'.length);
}

async function unlinkSidecarImagesForStem(stem) {
  if (!stem || stem.includes('..') || stem.includes('/') || stem.includes('\\')) {
    return;
  }
  const absDir = path.resolve(ANNOTATION_LIST_DIR);
  for (const ext of ALLOWED_SIDECAR_EXT) {
    const imgName = `${stem}.${ext}`;
    const absFile = path.resolve(path.join(ANNOTATION_LIST_DIR, imgName));
    const rel = path.relative(absDir, absFile);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      continue;
    }
    try {
      await fs.unlink(absFile);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
}

function resolveAnnotationFile(userFilename) {
  let name =
    typeof userFilename === 'string' && userFilename.trim()
      ? path.basename(userFilename.trim())
      : `coco-${Date.now()}.json`;
  if (!name.endsWith('.json')) {
    name = `${name}.json`;
  }
  if (!name || name === '.' || name === '..') {
    return null;
  }
  const absDir = path.resolve(ANNOTATION_LIST_DIR);
  const absFile = path.resolve(path.join(ANNOTATION_LIST_DIR, name));
  const rel = path.relative(absDir, absFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return { absFile, withExt: name };
}

export function setupAnnotateExportServer(app) {
  app.get('/api/annotate/annotation-list', async (req, res) => {
    try {
      await fs.mkdir(ANNOTATION_LIST_DIR, { recursive: true });
      const entries = await fs.readdir(ANNOTATION_LIST_DIR, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      res.json({ files });
    } catch (err) {
      console.error('GET /api/annotate/annotation-list error:', err);
      res.status(500).json({ error: err.message || 'Failed to list annotation files.' });
    }
  });

  app.delete('/api/annotate/annotation-list/:name', async (req, res) => {
    try {
      const resolved = resolveAnnotationFile(req.params.name);
      if (!resolved) {
        return res.status(400).json({ error: 'Invalid file name.' });
      }
      await fs.unlink(resolved.absFile);
      const stem = stemFromJsonName(resolved.withExt);
      if (stem) {
        await unlinkSidecarImagesForStem(stem);
      }
      res.json({ ok: true, deleted: resolved.withExt });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found.' });
      }
      console.error('DELETE /api/annotate/annotation-list/:name error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete file.' });
    }
  });

  app.post('/api/annotate/coco', async (req, res) => {
    try {
      const { filename, coco, sidecarImage } = req.body ?? {};
      if (!coco || typeof coco !== 'object' || Array.isArray(coco)) {
        return res.status(400).json({ error: 'Request body must include a "coco" object (COCO JSON).' });
      }

      const resolved = resolveAnnotationFile(filename);
      if (!resolved) {
        return res.status(400).json({ error: 'Invalid "filename": must be a safe .json file name (no path segments).' });
      }

      const stem = stemFromJsonName(resolved.withExt);
      let imageFile = null;
      let imagePath = null;
      let sidecarBuf = null;
      let sidecarExt = null;

      if (stem && sidecarImage && typeof sidecarImage === 'object') {
        sidecarExt = String(sidecarImage.ext || '')
          .toLowerCase()
          .replace(/^\./, '');
        if (!ALLOWED_SIDECAR_EXT.has(sidecarExt)) {
          return res.status(400).json({
            error: `Invalid sidecar image extension. Allowed: ${[...ALLOWED_SIDECAR_EXT].join(', ')}`,
          });
        }
        if (typeof sidecarImage.base64 !== 'string' || !sidecarImage.base64.length) {
          return res.status(400).json({ error: 'sidecarImage.base64 is required when sidecarImage is sent.' });
        }
        sidecarBuf = Buffer.from(sidecarImage.base64, 'base64');
        if (!sidecarBuf.length) {
          return res.status(400).json({ error: 'sidecarImage.base64 could not be decoded.' });
        }
        if (sidecarBuf.length > 80 * 1024 * 1024) {
          return res.status(400).json({ error: 'Sidecar image exceeds size limit (80 MB).' });
        }
        imageFile = `${stem}.${sidecarExt}`;
        const absImg = path.resolve(path.join(ANNOTATION_LIST_DIR, imageFile));
        const absDir = path.resolve(ANNOTATION_LIST_DIR);
        const relImg = path.relative(absDir, absImg);
        if (relImg.startsWith('..') || path.isAbsolute(relImg)) {
          return res.status(400).json({ error: 'Invalid sidecar image path.' });
        }
      }

      await fs.mkdir(ANNOTATION_LIST_DIR, { recursive: true });
      await fs.writeFile(resolved.absFile, JSON.stringify(coco, null, 2), 'utf8');

      if (stem && sidecarBuf && sidecarExt) {
        await unlinkSidecarImagesForStem(stem);
        const absImg = path.resolve(path.join(ANNOTATION_LIST_DIR, `${stem}.${sidecarExt}`));
        await fs.writeFile(absImg, sidecarBuf);
        imagePath = `apps/annotate/annotation-list/${imageFile}`;
      }

      res.status(201).json({
        ok: true,
        file: resolved.withExt,
        path: `apps/annotate/annotation-list/${resolved.withExt}`,
        imageFile: imageFile || undefined,
        imagePath: imagePath || undefined,
      });
    } catch (err) {
      console.error('POST /api/annotate/coco error:', err);
      res.status(500).json({ error: err.message || 'Failed to save COCO file.' });
    }
  });
}
