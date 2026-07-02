---
title: Compare
---

# Compare (`/compare`)

## Головна ідея

**Compare** дозволяє **завантажити одне зображення** й бачити **чотири локальні панелі детекції**, **дві серверні** та **два виходи reasoning** поруч — порівняти рушії та провайдерів на **тих самих пікселях** без повторного завантаження.

## Детальніше

Сторінка підвантажує ONNX для локального YOLO. У кожній панелі **свій** вибір моделі або reasoning.

## Візуальні елементи

- **Шапка** — один upload, багато панелей.
- **Блок завантаження** — файл, статус.
- **Оригінал** — еталонне зображення.
- **Локальне розпізнавання** — дві колонки: випадаючий список моделі, canvas, підсумок.
- **Серверне розпізнавання** — ще дві колонки з вибором серверної моделі.
- **Reasoning** — дві колонки, ChatGPT/Gemini, **read-only** textarea.

## Сценарії користувача

1. Завантажити PNG/JPEG; перевірити прев’ю.
2. Локально порівняти ліву/праву моделі (наприклад MediaPipe vs YOLO).
3. Запустити серверні панелі й порівняти результати.
4. Запустити обидва reasoning-провайдери на тому ж зображенні.
5. Обрати модель/провайдера для продакшену на основі доказів.

**Результат:** рішення A/B на **одному** кадрі.

## Code

### `apps/compare/app.js`

**Імпорти:** **`CONFIG`** з **`db/configs/public/config-default.js`**; **`drawBoundingBoxes`**; **`recognizeWithYolo`**; **`recognize`** як **`recognizeMediapipe`**.

**Стан:** **`currentDataUrl`**, **`currentFile`** (Blob для YOLO), **`localRecognitionPromise`** — черга, щоб MediaPipe і YOLO не перетинались у браузері.

**DOM:** **`modelSelects`** — `.model-select` з **`data-scope`** (`local` або `server`) і **`data-panel`**; **`reasoningSelects`**.

**Хелпери:** **`resizeCanvasToImage`**, **`projectDetectionsToCanvas`** — масштаб з natural size на canvas.

**Локально:** **`runLocalRecognition`** — гілка MEDIAPIPE/YOLO, **`local-*-canvas`**, **`local-*-summary`**.

**Сервер:** **`fetch('/api/recognize', …)`** як у server-detection, **`server-*-canvas`**.

**Reasoning:** **`fetch('/api/reasoning', …)`** — **`#reasoning-left`**, **`#reasoning-right`**.

**Сторінка:** `index.html` + CDN **`ort.min.js`**.

**Зв’язок:** **`recognition-server.js`**, **`reasoning-server.js`**, edge-recognizers.
