/**
 * Single configuration object for the v4 app
 */
const CONFIG = {
    /////////////////////// LOCAL CONFIG ///////////////////////
    ui: true,
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
        interval: 1000
    },
    localRecognitionActionFunctions: [
        // {
        //     func: (recognitionResults) => {
        //         console.log(`[Factory - Recognition Action] Detected ${recognitionResults.length} object(s)` + ' (5000ms delay)');
        //     },
        //     interval: 5000 // min ms between runs of this function (null = no throttle) 
        // },
        // {
        //     func: (recognitionResults) => {
        //         fetch(`/api/notify`, {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({
        //                 recognitionResults: recognitionResults,
        //                 reasoningResults: reasoningResults,
        //                 channel: 'email',
        //                 recipient: 'test@test.com'
        //             })
        //         })
        //             .then(response => response.json())
        //             .then(data => console.log('[Notify]', data))
        //             .catch(error => console.error('[Notify] Failed to fetch. Is the server running?', error));
        //     },
        //     interval: 10000 // min ms between runs of this function (null = no throttle)
        // }  
    ],
    localRegularActionFunctions: [
        // {
        //     func: (recognitionResults) => {
        //         console.log('[Factory - Local Regular Action] Results (12000ms delay):', recognitionResults);
        //     },
        //     interval: 12000, //number of milliseconds between each recognition
        // },
        // {
        //     func: (recognitionResults) => {
        //         console.log('[Factory - Local Regular Action] Results (16000ms delay):', recognitionResults);
        //     },
        //     interval: 16000, //number of milliseconds between each recognition
        // },
        // {
        //     func: (recognitionResults, reasoningResults) => {
        //         console.log('[Factory - Local Regular Action] Results (20000ms delay):', recognitionResults);
        //         fetch(`/api/db`, {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({
        //                 recognitionResults: recognitionResults,
        //                 reasoningResults: reasoningResults
        //             })
        //         })
        //     },
        //     interval: 20000, //number of milliseconds between each recognition
        // }
    ],

    /////////////////////// SERVER CONFIG ///////////////////////
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
            'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ],
        maxResults: 10,
        threshold: 0.5,
        iouThreshold: 0.45,
        model: 'YOLO', // 'MEDIAPIPE' || 'YOLO'
    },
    serverReasoning: {
        model: 'openai', // or 'google'
        prompt: 'Describe this image in detail. What objects, people, or scene do you see?'
    },   
    serverRecognitionActionFunctions: [
        // {
        //     func: (recognitionResults) => {
        //         console.log('[Server Recognition Action] Results:', recognitionResults);
        //     },
        //     interval: 5000
        // }
    ],
    serverReasoningActionFunctions: [
        // {
        //     func: (recognitionResults, description) => {
        //         console.log('[Server Reasoning Action] Description:', recognitionResults, description);
        //     },
        //     interval: 5000
        // }
    ],
    serverRegularActionFunctions: [
        // {
        //     func: (recognitionResults,description) => {
        //         console.log('[Server Regular Action] Description:', recognitionResults, description);
        //     },
        //     interval: 10000
        // }
    ],
};

export default CONFIG;
export { CONFIG };
