const CONFIG = {
    "name": "config777",
    "description": "Default configuration777",
    "ui": true,
    "localRecognition": {
        "classes": [
            "person",
            "dog",
            "car"
        ],
        "maxResults": 10,
        "threshold": 0.5,
        "iouThreshold": 0.45,
        "model": "YOLO"
    },
    "boundingBoxStyles": {
        "strokeStyle": "#00FFAA",
        "lineWidth": 3,
        "shadowColor": "rgba(0, 0, 0, 0.5)",
        "shadowBlur": 4,
        "font": "16px system-ui, -apple-system, sans-serif",
        "labelBgColor": "rgba(0, 0, 0, 0.8)",
        "labelTextColor": "#00FFAA",
        "labelPadding": 6,
        "borderRadius": 4,
        "interval": 1000
    },
    "localRecognitionActionFunctions": [],
    "localRegularActionFunctions": [],
    "serverRecognition": {
        "classes": [
            "person",
            "dog",
            "car"
        ],
        "maxResults": 10,
        "threshold": 0.5,
        "iouThreshold": 0.45,
        "model": "YOLO"
    },
    "serverReasoning": {
        "model": "openai",
        "prompt": "Describe this image in detail. What objects, people, or scene do you see?"
    },
    "serverRecognitionActionFunctions": [],
    "serverReasoningActionFunctions": [],
    "serverRegularActionFunctions": []
};

export default CONFIG;
export { CONFIG };
