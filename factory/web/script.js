import CONFIG from '../../config/config-factory.js';
import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from '../../lib/edge/capture.js';
import { toDataUrl } from '../../lib/edge/image-format.js';
import { recognize } from '../../lib/edge/recognition/mediapipe/recognize-mediapipe.js';
import { recognizeWithYolo } from '../../lib/edge/recognition/yolo/recognize-yolo.js';
import { boundingBoxes, clearBoundingBoxes } from '../../lib/edge/bounding-boxes.js';
import { action, localRecognitionActions } from '../../lib/edge/actions.js';

let cameraStream = null;
let videoElement = null;

let recognitionInterval = null;
let regularActionIntervals = [];
let recognitionResults = [];

/**
 * Start the recognition loop for real-time object detection.
 * Uses the currently selected model (YOLO or MEDIAPIPE) from the model selector.
 */
function startRecognitionLoop() {
    const { boundingBoxStyles, localRecognitionActionFunctions, localRegularActionFunctions } = CONFIG;
    const modelSelect = document.getElementById('modelSelect');

    recognitionInterval = setInterval(async () => {
        if (videoElement && videoElement.readyState >= 2) {
            const model = modelSelect?.value ?? 'YOLO';
            const dataUrl = await toDataUrl(videoElement);
            recognitionResults = model === 'MEDIAPIPE'
                ? await recognize(dataUrl, CONFIG)
                : await recognizeWithYolo(dataUrl, CONFIG);
            if (boundingBoxStyles) {
                boundingBoxes(recognitionResults, videoElement, boundingBoxStyles);
            }
            if (localRecognitionActionFunctions.length > 0) {
                localRecognitionActions(recognitionResults, localRecognitionActionFunctions);
            }
        }
    }, boundingBoxStyles.interval);

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

// Initialize camera when page loads
window.addEventListener('DOMContentLoaded', () => {
    initCameraBackground();
    startRecognitionLoop();
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    stopRecognitionLoop();
    clearBoundingBoxes();
    stopCameraStream();
});
