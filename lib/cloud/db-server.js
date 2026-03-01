/**
 * Registers the DB API on the given Express app.
 * @param {Express.Application} app - Express application instance
 */
export function setupDbServer(app) {
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