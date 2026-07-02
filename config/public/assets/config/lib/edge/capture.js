/**
 * Gets the video stream from the device camera
 * @param {Object} constraints - Media stream constraints (optional)
 * @returns {Promise<MediaStream>} Promise that resolves to the camera stream
 */
export async function getCameraStream(cameraStream = 'environment', constraints = { 
    video: { 
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    },
    audio: false 
}) {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            // navigator.mediaDevices is hidden by the browser on insecure origins
            // (anything other than https://, http://localhost, http://127.0.0.1, or file://).
            const isSecure = typeof window !== 'undefined' && window.isSecureContext;
            const origin = typeof location !== 'undefined' ? location.origin : '<unknown origin>';
            const detail = isSecure
                ? 'navigator.mediaDevices is unavailable in this browser.'
                : `Page is not a secure context (${origin}). The Camera API requires HTTPS, ` +
                  'http://localhost, or http://127.0.0.1. Options:\n' +
                  '  • Open the page from the host machine via http://localhost:<port>\n' +
                  '  • Serve over HTTPS (e.g. `npx http-server -S -C cert.pem -K key.pem`, mkcert, ngrok)\n' +
                  '  • Chrome workaround for LAN: chrome://flags/#unsafely-treat-insecure-origin-as-secure\n' +
                  `       → add ${origin} → relaunch.`;
            throw new Error('getUserMedia is not available. ' + detail);
        }

        constraints.video.facingMode = cameraStream; // 'environment' or 'user'
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
    } catch (error) {
        console.error('Error accessing camera:', error);
        throw error;
    }
}

/**
 * Creates or reuses a video element, attaches the camera stream, and returns the element
 * @param {Document} doc - Document instance (e.g. document)
 * @param {MediaStream} cameraStream - Camera stream from getCameraStream()
 * @returns {HTMLVideoElement} The video element with the stream attached
 */
export function attachCameraStreamToVideo(doc, cameraStream) {
    let videoElement = doc.getElementById('camera-background');

    if (!videoElement) {
        videoElement = doc.createElement('video');
        videoElement.id = 'camera-background';
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.loop = false;

        videoElement.style.position = 'fixed';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.zIndex = '0';
        videoElement.style.backgroundColor = '#000';

        doc.body.insertBefore(videoElement, doc.body.firstChild);
    }

    if (videoElement.srcObject) {
        const oldStream = videoElement.srcObject;
        oldStream.getTracks().forEach(track => track.stop());
    }

    videoElement.srcObject = cameraStream;
    return videoElement;
}

/**
 * Waits for video to be ready and starts playback
 * @param {HTMLVideoElement} videoElement - Video element to play
 * @returns {Promise<void>} Promise that resolves when video is playing
 */
export async function waitForVideoAndPlay(videoElement) {
    if (!videoElement) {
        throw new Error('Video element is null or undefined');
    }
    
    await new Promise((resolve, reject) => {
        const playVideo = () => {
            videoElement.play()
                .then(() => {
                    console.log('Video is playing');
                    resolve();
                })
                .catch((err) => {
                    console.error('Error playing video:', err);
                    reject(err);
                });
        };
        
        // If metadata is already loaded, play immediately
        if (videoElement.readyState >= 1) {
            playVideo();
        } else {
            // Otherwise wait for metadata
            videoElement.onloadedmetadata = playVideo;
            // Timeout fallback
            setTimeout(() => {
                if (videoElement && videoElement.readyState >= 1) {
                    playVideo();
                } else {
                    reject(new Error('Video element failed to load metadata'));
                }
            }, 1000);
        }
    });

    console.log('Camera stream initialized successfully');
}
