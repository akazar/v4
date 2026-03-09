const CONFIG = {
    "id": "config",
    "name": "config",
    "description": "Default configuration",
    "ui": true,
    "localRecognition": {
        "classes": [
            "person",
            "dog",
            "car",
            "chair"
        ],
        "maxResults": 10,
        "threshold": 0.5,
        "iouThreshold": 0.45,
        "model": "YOLO",
        "inputSize": 320,
        "maxCaptureSize": 320,
        "interval": 2000
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
    "localRecognitionActionFunctions": [
        {
          "action": {
            "type": "DB",
            "value": ["dbPersonalId"]
          },
          "timeout": 2000
        },
        {
          "action": {
            "type": "API",
            "value": ["https://223.com/"]
          },
          "timeout": 5000
        },
        {
          "action": {
            "type": "NOTIFY",
            "value": ["telegramIdPersonal"]
          },
          "timeout": 11000
        }
    ],
    "localRegularActionFunctions": [
        {
            "action": {
              "type": "DB",
              "value": ["dbNULPId"]
            },
            "timeout": 10000
          },
          {
            "action": {
              "type": "API",
              "value": ["https://lpnu.ua/"]
            },
            "timeout": 15000
          },
          {
            "action": {
              "type": "NOTIFY",
              "value": ["telegramNULPId"]
            },
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
