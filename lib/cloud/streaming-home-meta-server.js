/**
 * In-memory mirror of apps/streaming home page stream metadata (localStorage shape).
 * Lets CLI streamers resolve M3U8 sourceUrl by streamId after the home page syncs.
 */

/** @type {{ v: number, entries: unknown[], hidden: string[] }} */
let homeStreamsPayload = { v: 1, entries: [], hidden: [] };

/**
 * @param {import('express').Express} app
 */
export function setupStreamingHomeMetaServer(app) {
  app.post('/api/streaming/home-streams-sync', (req, res) => {
    const body = req.body;
    if (!body || body.v !== 1 || !Array.isArray(body.entries)) {
      return res
        .status(400)
        .json({ error: 'Expected { v: 1, entries: [...], hidden?: [...] }' });
    }
    homeStreamsPayload = {
      v: 1,
      entries: body.entries,
      hidden: Array.isArray(body.hidden) ? body.hidden : [],
    };
    return res.json({ ok: true });
  });

  app.get('/api/streaming/home-stream/:streamId', (req, res) => {
    const id = req.params.streamId;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing streamId' });
    }
    const hidden = new Set(homeStreamsPayload.hidden || []);
    if (hidden.has(id)) {
      return res.status(404).json({ error: 'Stream was removed on the home page' });
    }
    const entry = homeStreamsPayload.entries.find(
      (e) => e && typeof e === 'object' && e.streamId === id
    );
    if (!entry) {
      return res.status(404).json({
        error:
          'Unknown streamId. Open apps/streaming/index.html once (same browser session syncs), create the stream with an M3U8 URL, or pass the URL as the second CLI argument.',
      });
    }
    return res.json({
      streamId: entry.streamId,
      mode: entry.mode || 'p2p',
      sourceUrl: entry.sourceUrl || '',
      capture: entry.capture || null,
    });
  });
}
