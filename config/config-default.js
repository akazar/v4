const CONFIG = {
    /////////////////////// LOCAL CONFIG ///////////////////////
    id: 'config-default',
    name: 'config',
    description: 'Default configuration',
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
    localRecognitionActionFunctions: [],
    localRegularActionFunctions: [],

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
    serverRecognitionActionFunctions: [],
    serverReasoningActionFunctions: [],
    serverRegularActionFunctions: [],
};

export default CONFIG;
export { CONFIG };
