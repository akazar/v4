/**
 * main.js — Entry point for the v4 server.
 * Creates the Express app, wires front-end hosting (hosting-service.js) and API logic (action-services/api-service.js),
 * then starts the HTTP server on PORT (default 3001).
 */

import http from 'http';
import express from 'express';
import { setupHostingService } from './services/hosting-service.js';
import { setupApiService } from './services/action-services/api-service.js';
import { setupRecognitionService } from './services/recognition-service.js';
import { setupReasoningService } from './services/reasoning-service.js';
import { setupNotificationService } from './services/action-services/notification-service.js';
import { setupDbService } from './services/action-services/db-service.js';
import { setupConfigurationService } from './services/configuration-service.js';
import { setupStreamingService } from './services/streaming-service.js';
import { setupStreamingHomeMetaService } from './services/streaming-home-meta-service.js';
import { setupCapturedStreamService } from './services/captured-stream-service.js';
import { setupAnnotateExportService } from './services/annotate-export-service.js';
import { setupModelTrainingService } from './services/model-training-service.js';

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
setupHostingService(app);

// Setup service logic (API endpoints, middleware)
setupApiService(app);

// Setup recognition API (POST /api/recognize)
setupRecognitionService(app);

// Setup reasoning API (POST /api/reasoning)
setupReasoningService(app);

// Setup notification API (POST /api/notify)
setupNotificationService(app);

// Setup database API (POST /api/db)
setupDbService(app);

// Setup configuration API (GET /api/configurations)
setupConfigurationService(app);

// Save COCO exports from VIA annotator to apps/annotate/annotation-list
setupAnnotateExportService(app);

// Simulated trained weights to db/models
setupModelTrainingService(app);

// Home stream metadata API (for Node streamers to resolve sourceUrl by streamId)
setupStreamingHomeMetaService(app);

// Setup streaming signaling (Socket.IO on the HTTP server)
setupStreamingService(server);

// Puppeteer-based capture preview (streaming/captured-stream-streamer)
setupCapturedStreamService(app);

// Start the server
server.listen(PORT, () => {
  console.log(`v4 server running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
