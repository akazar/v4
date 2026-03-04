import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from '../../lib/edge/capture.js';
import { videoToReusableCanvas, scaleDetectionsToVideo } from '../../lib/edge/source-to-canvas.js';
import { boundingBoxes, clearBoundingBoxes } from '../../lib/edge/bounding-boxes.js';
import { action, localRecognitionActions } from '../../lib/edge/actions.js';
import { injectTopButtons } from '../../lib/edge/ui.js';

let cameraStream = null;
let videoElement = null;

let recognitionInterval = null;
let boundingBoxInterval = null;
let regularActionIntervals = [];
let recognitionResults = [];
let recognitionRunning = false;
let recognitionCanvas = null;

/**
 * Start the recognition loop for real-time object detection.
 * Uses the currently selected model (YOLO or MEDIAPIPE) from the model selector.
 */
async function startRecognitionLoop(config) {
    const { boundingBoxStyles, localRecognition, localRecognitionActionFunctions, localRegularActionFunctions } = config;
    let recognizer = null;
    const model = config.localRecognition?.model ?? 'YOLO';

    if (model === 'MEDIAPIPE') {
        const { recognize } = await import('../../lib/edge/recognition/mediapipe/recognize-mediapipe.js');
        recognizer = recognize;
    } else {
        const { recognizeWithYolo } = await import('../../lib/edge/recognition/yolo/recognize-yolo.js');
        recognizer = recognizeWithYolo;
    }

    recognitionInterval = setInterval(async () => {
        if (recognitionRunning || !videoElement || videoElement.readyState < 2) return;
        recognitionRunning = true;
        try {
            const captureSize = localRecognition?.maxCaptureSize ?? 640;
            recognitionCanvas = videoToReusableCanvas(
                videoElement,
                { maxWidth: captureSize, maxHeight: captureSize },
                recognitionCanvas
            );

            const rawResults = await recognizer(recognitionCanvas, config);

            recognitionResults = scaleDetectionsToVideo(
                rawResults,
                recognitionCanvas,
                videoElement
            );

            if (localRecognitionActionFunctions.length > 0) {
                localRecognitionActions(recognitionResults, localRecognitionActionFunctions);
            }
        } finally {
            recognitionRunning = false;
        }
    }, localRecognition.interval);

    if (boundingBoxStyles) {
        boundingBoxInterval = setInterval(() => {
            if (videoElement && videoElement.readyState >= 2) {
                boundingBoxes(recognitionResults, videoElement, boundingBoxStyles);
            }
        }, boundingBoxStyles.interval);
    }

    if (localRegularActionFunctions.length > 0) {
        localRegularActionFunctions.forEach(funcObj => {
            const id = setInterval(async () => {
                action(recognitionResults, [funcObj.func]);
            }, funcObj.interval);
            regularActionIntervals.push(id);
        });
    }
}

/**
 * Stop the recognition loop
 */
function stopRecognitionLoop() {
    if (recognitionInterval) {
        clearInterval(recognitionInterval);
        recognitionInterval = null;
    }
    if (boundingBoxInterval) {
        clearInterval(boundingBoxInterval);
        boundingBoxInterval = null;
    }
    regularActionIntervals.forEach(id => clearInterval(id));
    regularActionIntervals = [];
}

/**
 * Start the camera stream
 */
async function startCameraStream() {
    cameraStream = await getCameraStream();
    videoElement = attachCameraStreamToVideo(document, cameraStream);
}

/**
 * Stop the camera stream
 */
function stopCameraStream() {   
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (videoElement) {
        videoElement.srcObject = null;
    }
}

/**
 * Initialize the camera stream and display it as background
 */
async function initCameraBackground() {
    try {
        await startCameraStream();
        await waitForVideoAndPlay(videoElement);            
    } catch (error) {
        console.error('Failed to initialize camera:', error);
        alert('Unable to access camera. Please ensure you have granted camera permissions.');
    }
}

function initApp(config) {
    const onReady = () => {
        initCameraBackground();
        if (config.ui) {
            injectTopButtons(document, config);
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
                startRecognitionLoop(config);
            } else {
                stopRecognitionLoop();
                clearBoundingBoxes();
            }
        });
    } else {
        startRecognitionLoop(config);
    }

    window.addEventListener('beforeunload', () => {
        stopRecognitionLoop();
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