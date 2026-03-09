import { sendNotification } from './utils/notification.js';

/**
 * Registers the notification API on the given Express app.
 * @param {Express.Application} app - Express application instance
 */
export function setupNotificationServer(app) {
  /**
   * POST /api/notify/:recipientId - Send notification to recipient (e.g. telegram id from edge config).
   * Body: recognition results array (JSON).
   */
  app.post('/api/notify/:recipientId', async (req, res) => {
    try {
      const { recipientId } = req.params;
      const recognitionResults = Array.isArray(req.body) ? req.body : req.body?.recognitionResults ?? req.body;
      const data = await sendNotification(recognitionResults, 'telegram', recipientId);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('[notification server]', err?.stack ?? err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  });

  /**
   * POST /api/notify
   * Body: { recognitionResults: Array, channel: string, recipient: string }
   * Returns: { success: true } or { success: false, error: string }
   */
  app.post('/api/notify', async (req, res) => {
    try {
      console.log('[notification server] Notification: ', req.body);
      const { recognitionResults, channel, recipient } = req.body ?? {};
      
      console.log('[notification server] Notification: ', recognitionResults, channel, recipient);


      const data = await sendNotification(recognitionResults, channel, recipient);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('[notification server]', err?.stack ?? err);
      return res.status(500).json({
        success: false,
        error: err?.message ?? String(err),
      });
    }
  });
}