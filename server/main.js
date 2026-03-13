/**
 * main.js — Entry point for the v4 server.
 * Creates the Express app, wires front-end hosting (hosting-server.js) and API logic (api-server.js),
 * then starts the HTTP server on PORT (default 3001).
 */

import http from 'http';
import express from 'express';
import { setupFrontendHosting } from './hosting-server.js';
import { setupApiServer } from '../lib/cloud/api-server.js';
import { setupRecognitionServer } from '../lib/cloud/recognition-server.js';
import { setupReasoningServer } from '../lib/cloud/reasoning-server.js';
import { setupNotificationServer } from '../lib/cloud/notification-server.js';
import { setupDbServer } from '../lib/cloud/db-server.js';
import { setupConfigurationServer } from '../lib/cloud/configuration-server.js';
import { setupStreamingServer } from '../lib/cloud/streaming-server.js';

const PORT = process.env.PORT || 3001;

// Check OpenAI API key status
if (process.env.OPENAI_API_KEY) {
  const keyPreview = process.env.OPENAI_API_KEY.substring(0, 7) + '...' + process.env.OPENAI_API_KEY.slice(-4);
  console.log('✓ OPENAI_API_KEY loaded:', keyPreview);
} else {
  console.warn('⚠️  OPENAI_API_KEY not set. Set it in .env for /api/describe');
}

const app = express();
const server = http.createServer(app);

// Setup front-end hosting routes
setupFrontendHosting(app);

// Setup server logic (API endpoints, middleware)
setupApiServer(app);

// Setup recognition API (POST /api/recognize)
setupRecognitionServer(app);

// Setup reasoning API (POST /api/reasoning)
setupReasoningServer(app);

// Setup notification API (POST /api/notify)
setupNotificationServer(app);

// Setup database API (POST /api/db)
setupDbServer(app);

// Setup configuration API (GET /api/configurations)
setupConfigurationServer(app)

// Setup streaming signaling (Socket.IO on the HTTP server)
setupStreamingServer(server);

// Start the server
server.listen(PORT, () => {
  console.log(`v4 server running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
