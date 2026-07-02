import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from '../../../lib/edge/capture.js';
import { clearBoundingBoxes } from '../../../lib/edge/bounding-boxes.js';
import { injectTopButtons } from '../../../lib/edge/ui.js';
import { startRecognitionPipeline } from '../../../lib/edge/recognition-pipeline.js';

let cameraStream = null;
let videoElement = null;
let pipelineHandle = null;

async function startCameraStream() {
    cameraStream = await getCameraStream();
    videoElement = attachCameraStreamToVideo(document, cameraStream);
}

function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
    }
    if (videoElement) {
        videoElement.srcObject = null;
    }
}

async function initCameraBackground() {
    try {
        await startCameraStream();
        await waitForVideoAndPlay(videoElement);
    } catch (error) {
        console.error('Failed to initialize camera:', error);
        alert('Unable to access camera. Please ensure you have granted camera permissions.');
    }
}

function startPipeline(config) {
    stopPipeline();
    pipelineHandle = startRecognitionPipeline({
        video: videoElement,
        config,
        runRegularActions: false,
    });
}

function stopPipeline() {
    if (pipelineHandle) {
        pipelineHandle.stop();
        pipelineHandle = null;
    }
}

function initApp(config) {
    const onReady = async () => {
        await initCameraBackground();
        if (config.ui) {
            injectTopButtons(document, config);
        } else if (videoElement) {
            startPipeline(config);
        }
    };

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    if (config.ui) {
        document.addEventListener('ui:state', (event) => {
            const { active } = event.detail;
            if (active) {
                startPipeline(config);
            } else {
                stopPipeline();
                clearBoundingBoxes();
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        stopPipeline();
        clearBoundingBoxes();
        stopCameraStream();
    });
}

function getConfigIdFromPath() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || 'config';
}

async function main() {
    const configId = getConfigIdFromPath();
    let config;
    try {
        const res = await fetch(`/api/configurations/${encodeURIComponent(configId)}`);
        if (!res.ok) {
            throw new Error(`Configuration "${configId}" failed: ${res.status}`);
        }
        config = await res.json();
    } catch (err) {
        console.error('Failed to load configuration:', err);
        alert(`Unable to load configuration (${configId}). ${err.message}`);
        return;
    }
    initApp(config);
}

main();
