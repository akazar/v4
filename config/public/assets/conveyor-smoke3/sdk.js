/**
 * conveyor-poc SDK: exposes `window.vision` (browser) / `globalThis.vision` (node) so UIs and
 * external scripts can read latest recognition results and toggle overlays without knowing the
 * internals of the recognition pipeline.
 *
 * Internal state (`_latestRecognition`, `_video`, `_config`) is set by
 * lib/edge/recognition-pipeline.js when it is given `sdkNamespace: window.vision`.
 */

const namespace =
    typeof window !== 'undefined'
        ? (window.vision = window.vision || {})
        : (globalThis.vision = globalThis.vision || {});

namespace._latestRecognition = [];
namespace._video = null;
namespace._config = null;

namespace.getLatestRecognition = function getLatestRecognition() {
    return namespace._latestRecognition || [];
};

namespace.getVideoStream = function getVideoStream() {
    const v = namespace._video;
    if (!v) return null;
    return v.srcObject || null;
};

namespace.drawBoundingBoxes = async function drawBoundingBoxes(styles) {
    if (typeof document === 'undefined') return;
    const { boundingBoxes } = await import('./lib/edge/bounding-boxes.js');
    const v = namespace._video;
    if (!v) return;
    boundingBoxes(namespace._latestRecognition || [], v, styles || namespace._config?.boundingBoxStyles || {});
};

namespace.manualCapture = function manualCapture() {
    console.log('[sdk] manualCapture fired');
};

export function initSdk({ video, config } = {}) {
    if (video) namespace._video = video;
    if (config) namespace._config = config;
    return namespace;
}

export default namespace;
