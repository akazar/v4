/**
 * hosting-server.js — Front-end hosting for the v4 app.
 * Registers Express routes and static middleware for: root landing page, /factory (production demo),
 * /ua (Ukrainian landing), /config-creator, /config-manager, /camera-stream, /image-upload, /model-training,
 * /model-training/dashboard,
 * /server-detection,
 * /server-reasoning, /compare, /streaming, /annotate, /debug, and /documentation (Docusaurus build). Serves the v4 root for shared lib/ and config/.
 */

import { existsSync } from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sets up front-end hosting routes for the Express app
 * @param {Express} app - Express application instance
 */
export function setupFrontendHosting(app) {
  // Path definitions
  const v4Root = path.join(__dirname, '..');
  const appsPath = path.join(__dirname, '..', 'apps');
  const landingPath = path.join(__dirname, '..', 'apps', 'landing');
  const configCreatorPath = path.join(__dirname, '..', 'apps', 'config-creator');
  const configManagerPath = path.join(__dirname, '..', 'apps', 'config-manager');
  const cameraStreamPath = path.join(__dirname, '..', 'apps', 'camera-stream');
  const imageUploadPath = path.join(__dirname, '..', 'apps', 'image-upload');
  const serverDetectionPath = path.join(__dirname, '..', 'apps', 'server-detection');
  const serverReasoningPath = path.join(__dirname, '..', 'apps', 'server-reasoning');
  const comparePath = path.join(__dirname, '..', 'apps', 'compare');
  const factoryWebPath = path.join(__dirname, '..', 'factory', 'web');
  const debugPath = path.join(__dirname, '..', 'apps', 'debug');
  const streamingPath = path.join(__dirname, '..', 'apps', 'streaming');
  const annotatePath = path.join(__dirname, '..', 'apps', 'annotate');
  const modelTrainingPath = path.join(__dirname, '..', 'apps', 'model-training');
  const uiKitPath = path.join(appsPath, 'ui-kit');
  const docsBuildPath = path.join(__dirname, '..', 'apps', 'docs', 'build');

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

  // Docusaurus docs (production build). Dev / hot reload: npm run docs:dev from repo root.
  // Serve /documentation/ explicitly: express.static's default trailing-slash redirects would
  // 301 /documentation/ → /documentation/ and cause ERR_TOO_MANY_REDIRECTS.
  if (existsSync(path.join(docsBuildPath, 'index.html'))) {
    app.get('/documentation/', (req, res) => {
      res.sendFile(path.join(docsBuildPath, 'index.html'));
    });
    app.get('/documentation', (req, res) => {
      res.redirect(301, '/documentation/');
    });
    app.use(
      '/documentation',
      express.static(docsBuildPath, { redirect: false })
    );
  } else {
    console.warn(
      '[hosting] Skipping /documentation — run npm run docs:build (apps/docs/build missing).'
    );
  }

  // v4 root (config/, lib/, etc.) at / for module imports from all apps
  // This must come before apps static to ensure module imports work
  app.use(express.static(v4Root));

  // Serve apps static files (other app assets)
  app.use(express.static(appsPath));

  // Shared stylesheet (explicit mount so /ui-kit/ui-kit.css always resolves)
  app.use('/ui-kit', express.static(uiKitPath));

  // Production demo: flexible configuration web version at /factory
  app.use('/factory', express.static(factoryWebPath));
  app.get('/factory', (req, res) => {
    res.sendFile(path.join(factoryWebPath, 'index.html'));
  });
  app.get('/factory/', (req, res) => {
    res.sendFile(path.join(factoryWebPath, 'index.html'));
  });
  app.get('/factory/:id', (req, res) => {
    res.sendFile(path.join(factoryWebPath, 'index.html'));
  });

  // Config generator at /config-creator
  app.use('/config-creator', express.static(configCreatorPath));
  app.get('/config-creator', (req, res) => {
    res.sendFile(path.join(configCreatorPath, 'index.html'));
  });
  app.get('/config-creator/', (req, res) => {
    res.sendFile(path.join(configCreatorPath, 'index.html'));
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

  // VIA image annotator at /annotate
  app.use('/annotate', express.static(annotatePath));
  app.get('/annotate', (req, res) => {
    res.sendFile(path.join(annotatePath, 'index.html'));
  });
  app.get('/annotate/', (req, res) => {
    res.sendFile(path.join(annotatePath, 'index.html'));
  });
}
