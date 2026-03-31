const CONFIG = {
    "id": "config-test",
    "name": "Test",
    "description": "Test configuration",
    "ui": true,
    "localRecognition": {
        "classes": [
            "person",
            "dog",
            "car",
            "bicycle",
            "motorcycle",
            "airplane",
            "bus",
            "train",
            "truck",
            "boat",
            "traffic light",
            "fire hydrant",
            "stop sign",
            "parking meter",
            "bench",
            "bird",
            "cat",
            "horse",
            "sheep",
            "cow",
            "elephant",
            "bear",
            "zebra",
            "giraffe",
            "backpack",
            "umbrella",
            "handbag",
            "tie",
            "suitcase",
            "frisbee",
            "skis",
            "snowboard",
            "sports ball",
            "kite",
            "baseball bat",
            "baseball glove",
            "skateboard",
            "surfboard",
            "tennis racket",
            "bottle",
            "wine glass",
            "cup",
            "fork",
            "knife",
            "spoon",
            "bowl",
            "banana",
            "apple",
            "sandwich",
            "orange",
            "broccoli",
            "carrot",
            "hot dog",
            "pizza",
            "donut",
            "cake",
            "chair",
            "couch",
            "potted plant",
            "bed",
            "dining table",
            "toilet",
            "tv",
            "laptop",
            "mouse",
            "remote",
            "keyboard",
            "cell phone",
            "microwave",
            "oven",
            "toaster",
            "sink",
            "refrigerator",
            "book",
            "clock",
            "vase",
            "scissors",
            "teddy bear",
            "hair drier",
            "toothbrush"
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
                "https://your-api.com/webhook"
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
            "type": "some-local-777",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        }
    ],
    "localRecognitionActionFunctions": [],
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
                "https://lpnu.ua/"
            ],
            "timeout": 15000
        },
        {
            "type": "NOTIFY",
            "values": [
                "telegramNULPId"
            ],
            "timeout": 21000
        }
    ],
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
    "serverReasoning": {
        "model": "openai",
        "prompt": "Describe this image in detail. What objects, people, or scene do you see?"
    },
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
                "https://your-api.com/webhook"
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
            "type": "server-007",
            "values": [
                "007 value data"
            ],
            "timeout": 6000
        },
        {
            "type": "server-action-777",
            "values": [
                "your-db-id"
            ],
            "timeout": 2000
        }
    ],
    "serverRecognitionActionFunctions": [],
    "serverReasoningActionFunctions": [],
    "serverRegularActionFunctions": []
};

export default CONFIG;
export { CONFIG };
