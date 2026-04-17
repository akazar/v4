---
title: lib/
---

# Спільні бібліотеки (`lib/`)

## Головна ідея

**`lib/`** — **перевикористовувані блоки** Vision v4: **edge** (браузер: камера, малювання, локальні моделі) і **cloud** (сервер: API, стримінг, оркестрація). Застосунки імпортують звідси; сервер віддає корінь репозиторію статикою, тож браузер завантажує ці модулі як ES modules.

## Детальніше

### Edge (`lib/edge/`)

Для **ін-браузерних** сценаріїв:

- **Capture** — потік камери, відео, готовність кадрів.
- **Image / canvas** — нормалізація кадрів або файлів у canvas / data URL.
- **Local recognition** — MediaPipe і YOLO повністю в браузері (CDN або ваги в бандлі).
- **Overlays** — рамки з урахуванням геометрії відображення.
- **Actions** — побічні ефекти від результатів (лог, таймерні хуки).
- **UI helpers** — наприклад **`injectTopButtons`**, коли **`config.ui`**.

### Cloud (`lib/cloud/`)

Для **сервера** та **гібридних** потоків:

- **HTTP API** — розпізнавання, reasoning, сповіщення, БД, конфігурація, model-training, експорт annotate, метадані стримів.
- **Streaming** — сигналінг WebRTC, реєстр потоків, SFU-стиль, формати кадрів, розпізнавання на потоці де застосовно.
- **Action servers** — декларативні дії після детекції або reasoning.
- **Captured stream** — серверний прев’ю захоплення для «web capture».
- **Shared state** — координація між клієнтами.
- **Utilities** — зображення, нотифікації, легка персистенція.

## Функціональні деталі

| Шар | Що бачить користувач |
|-----|----------------------|
| **Edge** | Жива камера з рамками; локальне завантаження зображень; у стримінгу — детекція на захопленому кадрі без зайвого RTT. |
| **Cloud** | Server-detection/compare отримують серверні бокси; reasoning — текст; метадані стримів; список конфігів; збереження placeholder-ваг. |
| **Скрізь** | Узгоджена форма «результату детекції» між панелями compare. |

**Примітка:** у репозиторії **`lib/API.md`** — довідник по edge-функціях; тут рівень можливостей.

## Code

### `lib/edge/` (браузер)

| Модуль | Основні експорти | Коротко про поведінку | Хто використовує |
|--------|------------------|------------------------|------------------|
| `capture.js` | `getCameraStream`, `attachCameraStreamToVideo`, `waitForVideoAndPlay` | Опційні **constraints** для `getUserMedia` | camera-stream, factory, debug |
| `image-format.js` | `toDataUrl`, `dataUrlToCanvas` | Джерело → JPEG data URL; canvas | image upload, server-detection/reasoning |
| `source-to-canvas.js` | `imageToCanvas`, `videoToReusableCanvas` | Відео/blob → canvas з лімітами розміру | camera, factory, debug |
| `bounding-boxes.js` | `boundingBoxes`, `clearBoundingBoxes`, `drawBoundingBoxes` | Результати, відео/canvas, стилі | усі оверлеї |
| `recognition/mediapipe/…` | `recognize` | canvas або data URL + **config** | camera, image upload, compare |
| `recognition/yolo/…` | `recognizeWithYolo`, `getImageFromSource` | Джерело + **classes** у config | camera, image upload, compare, factory |
| `actions.js` | `action`, `localRecognitionActionsFromConfig`, … | Масив результатів + функції / рядки конфігу | camera-stream, factory, image-upload |
| `ui.js` | `injectTopButtons` | **`doc`**, **`config.ui`** | factory |

### `lib/cloud/` (сервер + гібрид)

| Модуль | Експорт | Роль |
|--------|---------|------|
| `recognition-server.js` | `setupRecognitionServer(app)` | **`POST /api/recognize`**, тіло **`image`**, опційно **`mime`**, **`config`** |
| `reasoning-server.js` | `setupReasoningServer(app)` | **`POST /api/reasoning`**, **`model`**, **`prompt`**, **`imageBase64`** |
| `configuration-server.js` | `setupConfigurationServer(app)` | CRUD-стиль для **`config/public`** |
| `streaming-server/streaming-server.js` | `setupStreamingServer(server)` | Socket.IO, реєстр, сімейство **`streaming-server/*.js`** |
| `action-servers/api-server.js` | `setupApiServer(app)` | CORS, JSON, **`/health`**, **`.env`**, **`/api/describe`** |
| `model-training-server.js` | `setupModelTrainingServer(app)` | Файли в **`apps/model-training/models-list`** |
| `annotate-export-server.js` | `setupAnnotateExportServer(app)` | Експорт у **`apps/annotate/annotation-list`** |
| `captured-stream-server.js` | `setupCapturedStreamServer(app)` | Puppeteer для стримінгу |
| `shared-state.js` | getters/setters | Останні результати для оркестраторів дій |

### `lib/scheduled-actions-manager.js`

**`apps/streaming/dashboard.js`** викликає **`createScheduledActionsManager`**, щоб узгодити таймерні дії конфігу з подіями розпізнавання.

**Правило:** браузерні **`import '/lib/…'`** працюють лише тому, що **`hosting-server.js`** віддає корінь репозиторію як статику.
