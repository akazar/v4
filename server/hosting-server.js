/**
 * hosting-server.js — Front-end hosting for the v4 app.
 * Registers Express routes and static middleware for: root landing page, /factory (production demo),
 * /config-creator, /camera-stream, /image-upload, /server-detection, and /server-reasoning. Serves the v4 root for shared lib/ and config/.
 */

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
  const factoryWebPath = path.join(__dirname, '..', 'factory', 'web');
  const debugPath = path.join(__dirname, '..', 'apps', 'debug');

  // Landing page at root (index + styles from apps/landing)
  app.get('/', (req, res) => {
    res.sendFile(path.join(landingPath, 'index.html'));
  });
  app.use(express.static(landingPath));

  // v4 root (config/, lib/, etc.) at / for module imports from all apps
  // This must come before apps static to ensure module imports work
  app.use(express.static(v4Root));

  // Serve apps static files (other app assets)
  app.use(express.static(appsPath));

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

   // Debug client at /debug
   app.use('/debug', express.static(debugPath));
   app.get('/debug', (req, res) => {
    res.sendFile(path.join(debugPath, 'index.html'));
  });   
  app.get('/debug/', (req, res) => {
    res.sendFile(path.join(debugPath, 'index.html'));
  });
}
