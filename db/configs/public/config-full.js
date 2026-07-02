/**
 * Union of every property shape used across configs in this folder.
 * Replace placeholder values before use; trim keys your deployment does not need.
 */
const CONFIG = {
    id: 'config-full',
    name: 'Full merged configuration',
    description: 'All option keys and nested fields appearing in any public config',
    ui: true,

    /////////////////////// LOCAL — recognition ///////////////////////
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
            'scissors', 'teddy bear', 'hair drier', 'toothbrush',
        ],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO', // 'YOLO' | 'MEDIAPIPE'
        inputSize: 320,
        maxCaptureSize: 320,
        interval: 1000,
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

    /** Declarative actions (DB / API / NOTIFY / custom types); used by scheduled-actions / some dashboards */
    localRecognitionActions: [
        { action: { type: 'DB', value: ['your-db-id'] }, timeout: 2000 },
        { action: { type: 'API', value: ['https://your-api.com/webhook'] }, timeout: 5000 },
        { action: { type: 'NOTIFY', value: ['your-telegram-chat-id'] }, timeout: 11000 },
        { action: { type: 'local-001', value: ['001 value data'] }, timeout: 3000 },
    ],

    /**
     * Mixed shapes across configs: `{ action, timeout }` for config-driven fetch, or `{ func, interval }` for callbacks.
     */
    localRecognitionActionFunctions: [
        { action: { type: 'DB', value: ['dbPersonalId'] }, timeout: 2000 },
        { action: { type: 'API', value: ['https://example.com/'] }, timeout: 5000 },
        { action: { type: 'NOTIFY', value: ['telegramIdPersonal'] }, timeout: 11000 },
        {
            func: (recognitionResults) => {
                console.log(`[Recognition Action] Detected ${recognitionResults.length} object(s)`);
            },
            interval: 5000,
        },
    ],

    localRegularActionFunctions: [
        { action: { type: 'DB', value: ['dbNULPId'] }, timeout: 10000 },
        { action: { type: 'API', value: ['https://lpnu.ua/'] }, timeout: 15000 },
        { action: { type: 'NOTIFY', value: ['telegramNULPId'] }, timeout: 21000 },
    ],

    /////////////////////// SERVER ///////////////////////
    serverRecognition: {
        classes: [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
            'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
            'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
            'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
            'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase',
            'scissors', 'teddy bear', 'hair drier', 'toothbrush',
        ],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO', // 'MEDIAPIPE' | 'YOLO'
        interval: 1000,
    },

    serverReasoning: {
        model: 'openai', // 'openai' | 'google'
        prompt: 'Describe this image in detail. What objects, people, or scene do you see?',
    },

    serverRecognitionActions: [
        { action: { type: 'DB', value: ['your-db-id'] }, timeout: 2000 },
        { action: { type: 'API', value: ['https://your-api.com/webhook'] }, timeout: 25000 },
        { action: { type: 'NOTIFY', value: ['your-telegram-chat-id'] }, timeout: 30000 },
        { action: { type: 'server-007', value: ['007 value data'] }, timeout: 6000 },
    ],

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
