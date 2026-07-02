export function heartbeat(results, entry) {
    console.log('[regular/heartbeat] tick', {
        timestamp: new Date().toISOString(),
        lastResults: results?.length ?? 0,
        timeout: entry?.timeout,
		entry: entry
    });
}