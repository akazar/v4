export function serverHeartbeat({ streamId }, entry) {
    console.log('[server/serverHeartbeat] tick', {
        streamId,
        at: new Date().toISOString(),
        timeout: entry?.timeout,
		entry: entry
    });
}