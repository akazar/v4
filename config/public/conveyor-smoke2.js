const CONFIG = {
    "id": "conveyor-smoke2",
    "name": "Conveyor smoke test 2",
    "description": "Full-fat config to validate conveyor-poc 2",
    "edgeType": "web",
    "ui": true,
    "uiHtmlPath": "ui.html",
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
            "type": "DB",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        },
        {
            "type": "API",
            "values": [
                "http://localhost:3001/api/notify"
            ],
            "timeout": 5000
        },
        {
            "type": "NOTIFY",
            "values": [
                "your-telegram-chat-id"
            ],
            "timeout": 11000
        },
        {
            "type": "CUSTOM",
            "values": [
                "onPerson",
                "onDog"
            ],
            "timeout": 1500
        }
    ],
    "localRecognitionActionFunctions": [
        {
            "type": "DB",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        },
        {
            "type": "API",
            "values": [
                "http://localhost:3001/api/notify"
            ],
            "timeout": 5000
        },
        {
            "type": "NOTIFY",
            "values": [
                "your-telegram-chat-id"
            ],
            "timeout": 11000
        },
        {
            "type": "CUSTOM",
            "values": [
                "onPerson",
                "onDog"
            ],
            "timeout": 1500
        }
    ],
    "localRegularActionFunctions": [
        {
            "type": "DB",
            "values": [
                "dbNULPId"
            ],
            "timeout": 10000
        },
        {
            "type": "API",
            "values": [
                "http://localhost:3001/api/notify"
            ],
            "timeout": 15000
        },
        {
            "type": "NOTIFY",
            "values": [
                "your-telegram-chat-id"
            ],
            "timeout": 21000
        },
        {
            "type": "CUSTOM",
            "values": [
                "heartbeat"
            ],
            "timeout": 5000
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
            "type": "DB",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        },
        {
            "type": "API",
            "values": [
                "http://localhost:3001/api/notify"
            ],
            "timeout": 25000
        },
        {
            "type": "NOTIFY",
            "values": [
                "your-telegram-chat-id"
            ],
            "timeout": 30000
        },
        {
            "type": "CUSTOM",
            "values": [
                "onServerAlert"
            ],
            "timeout": 2000
        }
    ],
    "serverRegularActionFunctions": [
        {
            "type": "DB",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        },
        {
            "type": "API",
            "values": [
                "http://localhost:3001/api/notify"
            ],
            "timeout": 25000
        },
        {
            "type": "NOTIFY",
            "values": [
                "your-telegram-chat-id"
            ],
            "timeout": 30000
        },
        {
            "type": "CUSTOM",
            "values": [
                "serverHeartbeat"
            ],
            "timeout": 5000
        }
    ]
};

export default CONFIG;
export { CONFIG };
