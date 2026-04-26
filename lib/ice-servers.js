/**
 * Shared ICE (STUN/TURN) configuration for WebRTC.
 * - Node: set `process.env.ICE_SERVERS` to a JSON string (array of RTCIceServer objects).
 * - Browser: typically `GET /api/ice` on the v4 host, or `fetchIceServersFromBaseUrl(signalingUrl)` for conveyor bundles.
 */

export const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function normalizeIceEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const urls = entry.urls ?? entry.url;
    if (urls == null) return null;
    const out = { ...entry };
    if ('url' in out && !('urls' in out)) {
        out.urls = out.url;
        delete out.url;
    }
    return out;
}

/**
 * Parse and validate ICE servers from a JSON string (e.g. process.env.ICE_SERVERS).
 * On parse error or invalid shape, returns {@link DEFAULT_ICE_SERVERS}.
 * @param {string|undefined|null} raw
 * @returns {Array<RTCIceServer>}
 */
export function parseIceServersString(raw) {
    if (raw == null) return DEFAULT_ICE_SERVERS;
    const s = String(raw).trim();
    if (s === '') return DEFAULT_ICE_SERVERS;
    let parsed;
    try {
        parsed = JSON.parse(s);
    } catch {
        return DEFAULT_ICE_SERVERS;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ICE_SERVERS;
    const out = [];
    for (const e of parsed) {
        const n = normalizeIceEntry(e);
        if (n && n.urls != null) out.push(n);
    }
    return out.length > 0 ? out : DEFAULT_ICE_SERVERS;
}

/**
 * ICE list for Node (publishers, SFU, CLI streamers).
 * @returns {Array<RTCIceServer>}
 */
export function getIceServersForNode() {
    if (typeof process === 'undefined' || !process?.env) return DEFAULT_ICE_SERVERS;
    return parseIceServersString(process.env.ICE_SERVERS);
}

/**
 * Fetches `GET /api/ice` relative to the current page origin (v4 app).
 * @returns {Promise<Array<RTCIceServer>>}
 */
export async function fetchIceServersForPage() {
    if (typeof fetch === 'undefined' || typeof location === 'undefined') {
        return DEFAULT_ICE_SERVERS;
    }
    try {
        const url = new URL('/api/ice', location.origin);
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return DEFAULT_ICE_SERVERS;
        const j = await res.json();
        if (j && Array.isArray(j.iceServers) && j.iceServers.length) {
            return parseIceServersString(JSON.stringify(j.iceServers));
        }
    } catch (err) {
        console.warn('[ice-servers] fetch /api/ice failed, using default STUN', err);
    }
    return DEFAULT_ICE_SERVERS;
}

/**
 * For static bundles: fetch ICE from the signaling / v4 host (CORS allowed on `/api/ice`).
 * @param {string} baseUrl - e.g. `https://example.com:3001` (no trailing slash required)
 * @returns {Promise<Array<RTCIceServer>>}
 */
export async function fetchIceServersFromBaseUrl(baseUrl) {
    if (typeof fetch === 'undefined' || !baseUrl) {
        return DEFAULT_ICE_SERVERS;
    }
    try {
        const u = new URL('/api/ice', String(baseUrl).trim());
        const res = await fetch(u, { mode: 'cors' });
        if (!res.ok) return DEFAULT_ICE_SERVERS;
        const j = await res.json();
        if (j && Array.isArray(j.iceServers) && j.iceServers.length) {
            return parseIceServersString(JSON.stringify(j.iceServers));
        }
    } catch (err) {
        console.warn('[ice-servers] fetch ICE from', baseUrl, err);
    }
    return DEFAULT_ICE_SERVERS;
}
