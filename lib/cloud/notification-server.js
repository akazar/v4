/**
 * Registers the notification API on the given Express app.
 * @param {Express.Application} app - Express application instance
 */
export function setupNotificationServer(app) {
  /**
   * POST /api/notify
   * Body: { recognitionResults: Array, channel: string, recipient: string }
   * Returns: { success: true } or { success: false, error: string }
   */
  app.post('/api/notify', async (req, res) => {
    try {
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