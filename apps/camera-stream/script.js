import CONFIG from '../../config/config.js';
import { getCameraStream, attachCameraStreamToVideo, waitForVideoAndPlay } from '../../lib/edge/capture.js';
import { toDataUrl } from '../../lib/edge/image-format.js';
import { recognize } from '../../lib/edge/recognition/mediapipe/detect-mediapipe.js';
import { recognizeWithYolo } from '../../lib/edge/recognition/yolo/detect-yolo.js';
import { boundingBoxes, clearBoundingBoxes } from '../../lib/edge/bounding-boxes.js';
import { action } from '../../lib/edge/actions.js';

let cameraStream = null;
let videoElement = null;

let recognitionInterval = null;
let regularActionIntervals = [];
let recognitionResults = [];


/**
 * Performs manual recognition on the current video frame.
 * - Checks if the video element is ready and has valid manual recognition functions.
 * - Converts the video frame to a canvas and performs recognition using the selected model.
 * - Calls the action function with the recognition results.
 */
async function manualRecognition() {
    const { manualRecognitionActionFunctions } = CONFIG;
    const model = document.getElementById('modelSelect')?.value ?? 'YOLO';

    if (videoElement && videoElement.readyState >= 2 && manualRecognitionActionFunctions.length > 0) {
        const dataUrl = await toDataUrl(videoElement);
        recognitionResults = model === 'MEDIAPIPE'
            ? await recognize(dataUrl, CONFIG)
            : await recognizeWithYolo(dataUrl, CONFIG);
        action(recognitionResults, manualRecognitionActionFunctions);
    }
}

/**
 * Start the recognition loop for real-time object detection.
 * Uses the currently selected model (YOLO or MEDIAPIPE) from the model selector.
 */
function startRecognitionLoop() {
    const { recognition, boundingBoxStyles, recognitionActionFunctions, regularActionFunctions } = CONFIG;
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
            if (recognitionActionFunctions.length > 0) {
                action(recognitionResults, recognitionActionFunctions);
            }
        }
    }, recognition.intervalMs);

    if (regularActionFunctions.length > 0) {
        regularActionFunctions.forEach(funcObj => {
            const id = setInterval(async () => {
                action(recognitionResults, [funcObj.func]);
            }, funcObj.intervalMs);
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
    
    // Set up button handlers
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const startRecognitionBtn = document.getElementById('startRecognitionBtn');
    const stopRecognitionBtn = document.getElementById('stopRecognitionBtn');
    const manualRecognitionBtn = document.getElementById('manualRecognitionBtn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            initCameraBackground();
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            // Stop recognition loop
            stopRecognitionLoop();
            // Clear bounding boxes
            clearBoundingBoxes();
            stopCameraStream();
        });
    }

    if (startRecognitionBtn) {
        startRecognitionBtn.addEventListener('click', () => {
            // Stop any existing recognition loop
            stopRecognitionLoop();
            // Start recognition loop after video is ready
            startRecognitionLoop();
        });
    }

    if (stopRecognitionBtn) {
        stopRecognitionBtn.addEventListener('click', () => {
            // Stop any existing recognition loop
            stopRecognitionLoop();
            // Clear bounding boxes
            clearBoundingBoxes();
        });
    }

    if (manualRecognitionBtn) {
        manualRecognitionBtn.addEventListener('click', async () => {
            await manualRecognition();
        });
    }
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    stopRecognitionLoop();
    clearBoundingBoxes();
    stopCameraStream();
});
