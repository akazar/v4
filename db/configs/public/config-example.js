/**
 * Example config: all parameters filled for demo of full application functionality.
 * Replace placeholder values (your-db-id, your-api-url, your-telegram-id) with real ones to use.
 */
const CONFIG = {
    id: 'config-example',
    name: 'Example (full demo)',
    description: 'All options enabled with placeholder values for easy testing',
    ui: true,

    // ——— Local object detection (browser) ———
    localRecognition: {
        classes: ['person', 'dog', 'car', 'chair'],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO',           // 'YOLO' | 'MEDIAPIPE'
        inputSize: 320,
        maxCaptureSize: 320,
        interval: 2000,
    },

    // ——— How detection boxes are drawn on video ———
    boundingBoxStyles: {
        strokeStyle: '#00FFAA',
        lineWidth: 3,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 4,
        font: '16px system-ui, -apple-system, sans-serif',
        labelBgColor: 'rgba(0, 0, 0, 0.8)',
        labelTextColor: '#00FFAA',
        labelPadding: 6,
        borderRadius: 4,
        interval: 1000,
    },

    // ——— When something is detected: save to DB, call API, send notification (each throttled by timeout) ———
    localRecognitionActionFunctions: [
        { action: { type: 'DB', value: ['your-db-id'] }, timeout: 2000 },
        { action: { type: 'API', value: ['https://your-api.com/webhook'] }, timeout: 5000 },
        { action: { type: 'NOTIFY', value: ['your-telegram-chat-id'] }, timeout: 11000 },
    ],

    // ——— Periodic actions (e.g. heartbeat) ———
    localRegularActionFunctions: [
        { action: { type: 'DB', value: ['your-db-id'] }, timeout: 10000 },
        { action: { type: 'API', value: ['https://your-api.com/ping'] }, timeout: 15000 },
        { action: { type: 'NOTIFY', value: ['your-telegram-chat-id'] }, timeout: 21000 },
    ],

    // ——— Server-side object detection (when using server pipeline) ———
    serverRecognition: {
        classes: ['person', 'dog', 'car', 'chair'],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO',
    },

    // ——— Server-side image description (LLM) ———
    serverReasoning: {
        model: 'openai',   // 'openai' | 'google'
        prompt: 'Describe this image in detail. What objects, people, or scene do you see?',
    },

    // ——— Server actions (run on server when using server recognition/reasoning pipeline) ———
    serverRecognitionActionFunctions: [
        {
            func: (recognitionResults) => {
                console.log('[Server Recognition] Detected', recognitionResults?.length ?? 0, 'object(s)');
            },
            interval: 5000,
        },
    ],
    serverReasoningActionFunctions: [
        {
            func: (description) => {
                console.log('[Server Reasoning] Description:', description?.slice(0, 80) + (description?.length > 80 ? '…' : ''));
            },
            counter: null,
        },
    ],
    serverRegularActionFunctions: [
        {
            func: (description) => {
                console.log('[Server Regular] Last description:', description?.slice(0, 60) + (description?.length > 60 ? '…' : ''));
            },
            interval: 10000,
        },
    ],
};

export default CONFIG;
export { CONFIG };
