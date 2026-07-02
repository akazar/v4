export const CONFIG = {
    "id": "config",
    "name": "config",
    "description": "Default configuration",
    "edgeType": "web",
    "ui": true,
    "uiHtmlPath": "ui.html",
    "uiCssPath": "ui.css",
    "uiJsPath": "ui.js",
    "localRecognition": {
        "classes": [
            "person",
            "dog",
            "car"
        ],
        "maxResults": 10,
        "threshold": 0.5,
        "iouThreshold": 0.45,
        "model": "YOLO",
        "inputSize": 320,
        "maxCaptureSize": 320,
        "interval": 1000
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
    "localStartupAction": "",
    "localRecognitionActions": [],
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
        "model": "YOLO",
        "interval": 1000
    },
    "serverStartupAction": "",
    "serverRecognitionActions": [],
    "serverRegularActionFunctions": [],
    "signalingUrl": "http://localhost:3001"
};
export default CONFIG;
