import { createDb, readDb, updateDb, deleteDb } from './utils/db.js';

/**
 * Registers the DB API on the given Express app.
 * @param {Express.Application} app - Express application instance
 */
export function setupDbServer(app) {
  /**
   * POST /api/db/:dbId - Store recognition results for the given db id (e.g. from edge config).
   * Body: recognition results array (JSON).
   */
  app.post('/api/db/:dbId', async (req, res) => {
    try {
      console.log('[db server] Creating data: ', req.body);
      const { dbId } = req.params;
      const recognitionResults = req.body;
      const createdData = await updateDb({ dbId, recognitionResults });
      return res.json({ success: true, createdData });
    } catch (err) {
      console.error('[db server]', err?.stack ?? err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  /**
   * POST /api/db (create, read, update, delete) - CRUD operations
   * Body: { action: string, data: object }
   * Returns: { success: true } or { success: false, error: string }
   */  
  app.post('/api/db', async (req, res) => {
    try {
    const { action, data } = req.body ?? {};

    switch (action) {
      case 'create':
        const createdData = await createDb(data);
        return res.json({ success: true, createdData });
      case 'read':
        const readData = await readDb(data);
        return res.json({ success: true, readData });
      case 'update':
        const updatedData = await updateDb(data);
        return res.json({ success: true, updatedData });
      case 'delete':
        const deletedData = await deleteDb(data);
        return res.json({ success: true, deletedData });
      default:
        return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (err) {
      console.error('[db server]', err?.stack ?? err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });
}