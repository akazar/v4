/**
 * Example config: all parameters filled for demo of full application functionality.
 * Replace placeholder values (your-db-id, your-api-url, your-telegram-id) with real ones to use.
 */
const CONFIG = {
    id: 'config-local-action',
    name: 'Local Action',
    description: 'Local Action',
    ui: true,

    // ——— How detection boxes are drawn on video ———
    localRecognition: {
        classes: [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
            'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
            'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
            'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
            'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
            'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO',  // 'MEDIAPIPE' || 'YOLO'
        interval: 1000
    },
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
    localRecognitionActions: [
        { action: { type: 'DB', value: ['your-db-id'] }, timeout: 2000 },
        { action: { type: 'API', value: ['https://your-api.com/webhook'] }, timeout: 5000 },
        { action: { type: 'NOTIFY', value: ['your-telegram-chat-id'] }, timeout: 11000 },
        { action: { type: 'local-001', value: ['001 value data'] }, timeout: 3000 },
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
