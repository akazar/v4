/**
 * Minimal zero-dependency ZIP writer (STORE / no compression).
 *
 * Produces a valid ZIP file from `[{ name, content }]` entries where `content` is
 * string | Uint8Array | ArrayBuffer. No deflate, no zip64 — suitable for small
 * text bundles (JS / HTML / CSS / MD). Paths with forward slashes become folders.
 */

const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function toBytes(content) {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    return new TextEncoder().encode(String(content ?? ''));
}

/**
 * Build a STORE-method ZIP Blob from [{ name, content }].
 * @param {Array<{ name: string, content: string | Uint8Array | ArrayBuffer }>} entries
 * @returns {Blob}
 */
export function createZipBlob(entries) {
    const nameEncoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    for (const { name, content } of entries) {
        const nameBytes = nameEncoder.encode(name);
        const data = toBytes(content);
        const crc = crc32(data);
        const size = data.length;

        const lfh = new ArrayBuffer(30);
        const lfhView = new DataView(lfh);
        lfhView.setUint32(0, 0x04034b50, true);
        lfhView.setUint16(4, 20, true);
        lfhView.setUint16(6, 0, true);
        lfhView.setUint16(8, 0, true);
        lfhView.setUint16(10, 0, true);
        lfhView.setUint16(12, 0x21, true);
        lfhView.setUint32(14, crc, true);
        lfhView.setUint32(18, size, true);
        lfhView.setUint32(22, size, true);
        lfhView.setUint16(26, nameBytes.length, true);
        lfhView.setUint16(28, 0, true);
        parts.push(new Uint8Array(lfh), nameBytes, data);

        const cdh = new ArrayBuffer(46);
        const cdhView = new DataView(cdh);
        cdhView.setUint32(0, 0x02014b50, true);
        cdhView.setUint16(4, 20, true);
        cdhView.setUint16(6, 20, true);
        cdhView.setUint16(8, 0, true);
        cdhView.setUint16(10, 0, true);
        cdhView.setUint16(12, 0, true);
        cdhView.setUint16(14, 0x21, true);
        cdhView.setUint32(16, crc, true);
        cdhView.setUint32(20, size, true);
        cdhView.setUint32(24, size, true);
        cdhView.setUint16(28, nameBytes.length, true);
        cdhView.setUint16(30, 0, true);
        cdhView.setUint16(32, 0, true);
        cdhView.setUint16(34, 0, true);
        cdhView.setUint16(36, 0, true);
        cdhView.setUint32(38, 0, true);
        cdhView.setUint32(42, offset, true);
        central.push(new Uint8Array(cdh), nameBytes);

        offset += 30 + nameBytes.length + size;
    }

    let centralSize = 0;
    for (const p of central) centralSize += p.length;

    const eocd = new ArrayBuffer(22);
    const eocdView = new DataView(eocd);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...parts, ...central, new Uint8Array(eocd)], { type: 'application/zip' });
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
