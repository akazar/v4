/**
 * hosting-service.js — Front-end hosting for the v4 app.
 * Registers Express routes and static middleware for: root landing page, /factory (production demo),
 * /ua (Ukrainian landing), /config-creator, /config-creator-adv, /config-manager, /camera-stream, /image-upload, /model-training,
 * /model-training/dashboard,
 * /server-detection,
 * /server-reasoning, /compare, /streaming, /annotate, /debug, and /documentation (docs build). Serves the v4 root for shared lib/ and db/configs/.
 */

import { existsSync } from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { getIceServersForNode } from '../../lib/ice-servers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sets up front-end hosting routes for the Express app
 * @param {Express} app - Express application instance
 */
export function setupHostingService(app) {
  // WebRTC ICE (STUN/TURN) for browsers and docs — from ICE_SERVERS env (JSON array string).
  app.get('/api/ice', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '3600');
    res.json({ iceServers: getIceServersForNode() });
  });
  app.options('/api/ice', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });

  // Path definitions
  const v4Root = path.join(__dirname, '..', '..');
  const appsPath = path.join(v4Root, 'apps');
  const landingPath = path.join(appsPath, 'landing');
  const configCreatorPath = path.join(appsPath, 'config-creator');
  const configCreatorAdvPath = path.join(appsPath, 'config-creator-adv');
  const configManagerPath = path.join(appsPath, 'config-manager');
  const cameraStreamPath = path.join(appsPath, 'camera-stream');
  const imageUploadPath = path.join(appsPath, 'image-upload');
  const serverDetectionPath = path.join(appsPath, 'server-detection');
  const serverReasoningPath = path.join(appsPath, 'server-reasoning');
  const comparePath = path.join(appsPath, 'compare');
  const factoryPath = path.join(appsPath, 'factory');
  const debugPath = path.join(appsPath, 'debug');
  const streamingPath = path.join(appsPath, 'streaming');
  const annotatePath = path.join(appsPath, 'annotate');
  const modelTrainingPath = path.join(appsPath, 'model-training');
  const conveyorPocPath = path.join(appsPath, 'conveyor-poc');
  const uiKitPath = path.join(appsPath, 'ui-kit');
  const docsBuildPath = path.join(appsPath, 'docs', 'build');

  /**
   * Resolve a pre-rendered docs HTML file for client-router paths (e.g. /documentation/docs/intro).
   * Docusaurus emits docs/intro/index.html; express.static does not serve that without a trailing slash.
   */
  function resolveDocsHtml(relPath) {
    const rel = relPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rel) {
      return path.join(docsBuildPath, 'index.html');
    }
    const candidates = [
      path.join(docsBuildPath, rel, 'index.html'),
      path.join(docsBuildPath, `${rel}.html`),
    ];
    for (const file of candidates) {
      if (existsSync(file)) {
        return file;
      }
    }
    return null;
  }

  // Landing page at root (EN) and Ukrainian at /ua
  app.get('/', (req, res) => {
    res.sendFile(path.join(landingPath, 'index.html'));
  });
  app.get('/ua', (req, res) => {
    res.sendFile(path.join(landingPath, 'ua', 'index.html'));
  });
  app.get('/ua/', (req, res) => {
    res.sendFile(path.join(landingPath, 'ua', 'index.html'));
  });
  app.use(express.static(landingPath));

  // Documentation site (production build). Dev / hot reload: npm run docs:dev from repo root.
  if (existsSync(path.join(docsBuildPath, 'index.html'))) {
    // Short paths without the /documentation prefix (e.g. /docs/intro from bookmarks).
    app.get(/^\/docs(\/.*)?$/, (req, res) => {
      const target =
        req.path === '/docs' ? '/documentation/docs/intro' : `/documentation${req.path}`;
      res.redirect(301, target);
    });

    app.get('/documentation', (req, res) => {
      res.redirect(301, '/documentation/');
    });
    app.get('/documentation/', (req, res) => {
      res.sendFile(path.join(docsBuildPath, 'index.html'));
    });

    app.use(
      '/documentation',
      express.static(docsBuildPath, { redirect: false }),
      (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return next();
        }
        const file = resolveDocsHtml(req.path);
        if (file) {
          return res.sendFile(file);
        }
        next();
      }
    );
  } else {
    console.warn(
      '[hosting] Skipping /documentation — run npm run docs:build (apps/docs/build missing).'
    );
  }

  // v4 root (db/configs/, lib/, etc.) at / for module imports from all apps
  // This must come before apps static to ensure module imports work
  app.use(express.static(v4Root));

  // Serve apps static files (other app assets)
  app.use(express.static(appsPath));

  // Shared stylesheet (explicit mount so /ui-kit/ui-kit.css always resolves)
  app.use('/ui-kit', express.static(uiKitPath));

  // Legacy config URLs (configs moved to db/configs/)
  app.get(/^\/config\/public(\/.*)?$/, (req, res) => {
    const rest = req.path.slice('/config/public'.length) || '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/db/configs/public${rest}${qs}`);
  });

  // Production demo: flexible configuration web version at /factory
  app.get(/^\/factory\/web(\/.*)?$/, (req, res) => {
    const rest = req.path.slice('/factory/web'.length) || '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/factory${rest}${qs}`);
  });
  app.use('/factory', express.static(factoryPath));
  app.get('/factory', (req, res) => {
    res.sendFile(path.join(factoryPath, 'index.html'));
  });
  app.get('/factory/', (req, res) => {
    res.sendFile(path.join(factoryPath, 'index.html'));
  });
  app.get('/factory/:id', (req, res) => {
    res.sendFile(path.join(factoryPath, 'index.html'));
  });

  // Config generator at /config-creator
  app.use('/config-creator', express.static(configCreatorPath));
  app.get('/config-creator', (req, res) => {
    res.sendFile(path.join(configCreatorPath, 'index.html'));
  });
  app.get('/config-creator/', (req, res) => {
    res.sendFile(path.join(configCreatorPath, 'index.html'));
  });

  // Config generator (advanced copy) at /config-creator-adv
  app.use('/config-creator-adv', express.static(configCreatorAdvPath));
  app.get('/config-creator-adv', (req, res) => {
    res.sendFile(path.join(configCreatorAdvPath, 'index.html'));
  });
  app.get('/config-creator-adv/', (req, res) => {
    res.sendFile(path.join(configCreatorAdvPath, 'index.html'));
  });

  // Configuration manager at /config-manager
  app.use('/config-manager', express.static(configManagerPath));
  app.get('/config-manager', (req, res) => {
    res.sendFile(path.join(configManagerPath, 'index.html'));
  });
  app.get('/config-manager/', (req, res) => {
    res.sendFile(path.join(configManagerPath, 'index.html'));
  });

  // Camera-stream client at /camera-stream
  app.use('/camera-stream', express.static(cameraStreamPath));
  app.get('/camera-stream', (req, res) => {
    res.sendFile(path.join(cameraStreamPath, 'index.html'));
  });
  app.get('/camera-stream/', (req, res) => {
    res.sendFile(path.join(cameraStreamPath, 'index.html'));
  });

  // Image upload client
  app.use('/image-upload', express.static(imageUploadPath));
  app.get('/image-upload', (req, res) => {
    res.sendFile(path.join(imageUploadPath, 'index.html'));
  });
  app.get('/image-upload/', (req, res) => {
    res.sendFile(path.join(imageUploadPath, 'index.html'));
  });

  // Model training / VLM fine-tuning UI at /model-training (client-only simulation)
  app.use('/model-training', express.static(modelTrainingPath));
  app.get('/model-training/dashboard', (req, res) => {
    res.sendFile(path.join(modelTrainingPath, 'dashboard.html'));
  });
  app.get('/model-training/dashboard/', (req, res) => {
    res.sendFile(path.join(modelTrainingPath, 'dashboard.html'));
  });
  app.get('/model-training', (req, res) => {
    res.sendFile(path.join(modelTrainingPath, 'index.html'));
  });
  app.get('/model-training/', (req, res) => {
    res.sendFile(path.join(modelTrainingPath, 'index.html'));
  });

  // Server-detection client at /server-detection
  app.use('/server-detection', express.static(serverDetectionPath));
  app.get('/server-detection', (req, res) => {
    res.sendFile(path.join(serverDetectionPath, 'index.html'));
  });
  app.get('/server-detection/', (req, res) => {
    res.sendFile(path.join(serverDetectionPath, 'index.html'));
  });

  // Server-reasoning client at /server-reasoning
  app.use('/server-reasoning', express.static(serverReasoningPath));
  app.get('/server-reasoning', (req, res) => {
    res.sendFile(path.join(serverReasoningPath, 'index.html'));
  });
  app.get('/server-reasoning/', (req, res) => {
    res.sendFile(path.join(serverReasoningPath, 'index.html'));
  });

  // Compare app (recognition & reasoning comparison) at /compare
  app.use('/compare', express.static(comparePath));
  app.get('/compare', (req, res) => {
    res.sendFile(path.join(comparePath, 'index.html'));
  });
  app.get('/compare/', (req, res) => {
    res.sendFile(path.join(comparePath, 'index.html'));
  });

   // Debug client at /debug
   app.use('/debug', express.static(debugPath));
   app.get('/debug', (req, res) => {
    res.sendFile(path.join(debugPath, 'index.html'));
  });   
  app.get('/debug/', (req, res) => {
    res.sendFile(path.join(debugPath, 'index.html'));
  });

  // Streaming app at /streaming
  app.use('/streaming', express.static(streamingPath));
  app.get('/streaming', (req, res) => {
    res.sendFile(path.join(streamingPath, 'index.html'));
  });
  app.get('/streaming/', (req, res) => {
    res.sendFile(path.join(streamingPath, 'index.html'));
  });

  // Conveyor POC artifact generator at /conveyor-poc
  app.use('/conveyor-poc', express.static(conveyorPocPath));
  app.get('/conveyor-poc', (req, res) => {
    res.sendFile(path.join(conveyorPocPath, 'index.html'));
  });
  app.get('/conveyor-poc/', (req, res) => {
    res.sendFile(path.join(conveyorPocPath, 'index.html'));
  });

  // VIA image annotator at /annotate
  app.use('/annotate', express.static(annotatePath));
  app.get('/annotate', (req, res) => {
    res.sendFile(path.join(annotatePath, 'index.html'));
  });
  app.get('/annotate/', (req, res) => {
    res.sendFile(path.join(annotatePath, 'index.html'));
  });
}
