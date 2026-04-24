const CONFIG = {
    "id": "conveyor-smoke4",
    "name": "Conveyor smoke test 4",
    "description": "Full-fat config to validate conveyor-poc 4",
    "edgeType": "web",
    "ui": true,
    "uiHtmlPath": "",
    "uiCssPath": "ui.css",
    "uiJsPath": "ui.js",
    "localRecognition": {
        "classes": [
            "person",
            "dog",
            "car",
            "cell phone",
            "laptop",
            "cup"
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
    "localStartupAction": "onLocalStart",
    "localRecognitionActions": [
        {
            "action": {
                "type": "DB",
                "value": [
                    "your-db-id"
                ]
            },
            "timeout": 2000
        },
        {
            "action": {
                "type": "API",
                "value": [
                    "http://localhost:3001/api/notify"
                ]
            },
            "timeout": 5000
        },
        {
            "action": {
                "type": "NOTIFY",
                "value": [
                    "your-telegram-chat-id"
                ]
            },
            "timeout": 11000
        }
    ],
    "localRecognitionActionFunctions": [
        {
            "action": {
                "type": "CUSTOM",
                "value": [
                    "onPerson",
                    "onDog"
                ]
            },
            "timeout": 1500
        },
        {
            "action": {
                "type": "DB",
                "value": [
                    "your-db-id"
                ]
            },
            "timeout": 5000
        },
        {
            "action": {
                "type": "API",
                "value": [
                    "http://localhost:3001/api/notify"
                ]
            },
            "timeout": 11000
        }
    ],
    "localRegularActionFunctions": [
        {
            "action": {
                "type": "NOTIFY",
                "value": [
                    "your-telegram-chat-id"
                ]
            },
            "timeout": 10000
        },
        {
            "action": {
                "type": "CUSTOM",
                "value": [
                    "onPerson",
                    "onDog"
                ]
            },
            "timeout": 1500
        },
        {
            "action": {
                "type": "DB",
                "value": [
                    "dbNULPId"
                ]
            },
            "timeout": 21000
        }
    ],
    "serverRecognition": {
        "classes": [
            "person",
            "dog",
            "car",
            "cell phone",
            "laptop",
            "cup"
        ],
        "maxResults": 10,
        "threshold": 0.5,
        "iouThreshold": 0.45,
        "model": "YOLO",
        "interval": 1000
    },
    "serverStartupAction": "onServerStart",
    "serverRecognitionActions": [
        {
            "action": {
                "type": "NOTIFY",
                "value": [
                    "heartbeat"
                ]
            },
            "timeout": 2000
        },
        {
            "action": {
                "type": "CUSTOM",
                "value": [
                    "person",
                    "dog",
                    "car",
                    "cell phone",
                    "laptop",
                    "cup"
                ]
            },
            "timeout": 25000
        },
        {
            "action": {
                "type": "DB",
                "value": [
                    "onServerStart"
                ]
            },
            "timeout": 30000
        },
        {
            "action": {
                "type": "CUSTOM",
                "value": [
                    "onServerAlert"
                ]
            },
            "timeout": 1000
        }
    ],
    "serverRegularActionFunctions": [
        {
            "action": {
                "type": "API",
                "value": [
                    "http://localhost:3001/api/notify"
                ]
            },
            "timeout": 2000
        },
        {
            "action": {
                "type": "NOTIFY",
                "value": [
                    "your-telegram-chat-id"
                ]
            },
            "timeout": 25000
        },
        {
            "action": {
                "type": "CUSTOM",
                "value": [
                    "serverHeartbeat"
                ]
            },
            "timeout": 5000
        },
        {
            "action": {
                "type": "DB",
                "value": [
                    "your-db-id"
                ]
            },
            "timeout": 6000
        }
    ]
};

export default CONFIG;
export { CONFIG };
