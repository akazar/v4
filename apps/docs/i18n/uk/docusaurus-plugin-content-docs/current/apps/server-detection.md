---
title: Server detection
---

# Server detection (`/server-detection`)

## Головна ідея

**Server detection** повторює UX **image upload**, але надсилає зображення на **API розпізнавання сервера** замість моделі в браузері. Відповідь — детекції; клієнт малює рамки на canvas; можна зберегти JPEG.

## Детальніше

Тега **ONNX на сторінці немає** — важка робота на сервері (конвеєр залежно від конфігурації).

## Візуальні елементи

- Заголовок: розпізнавання на сервері.
- **Model selector** — YOLO / MediaPipe для тіла запиту.
- Файл і URL.
- **Recognize** — POST до API.
- **Download** — після успіху.
- Canvas і placeholder.

## Сценарії користувача

1. Запустити сервер Vision v4, щоб працював **`/api/recognize`**.
2. Обрати модель на сервері.
3. Завантажити зображення.
4. **Recognize**; обробити помилки, якщо сервер недоступний.
5. **Download** за потреби.

**Результат:** слабкі клієнти все одно бачать детекції; інженери звіряють паритет із локальною моделлю.

## Code

### `apps/server-detection/script.js`

| Символ | Значення |
|--------|----------|
| **`RECOGNITION_SERVER_URL`** | `CONFIG.recognitionServerUrl ?? ''` — база для **`/api/recognize`**. |
| **DOM** | `#fileInput`, `#urlInput`, `#modelSelect`, кнопки, canvas, placeholder. |
| **`currentImageSource`**, **`resultCanvas`** | Джерело та композит для показу/завантаження. |

**`runRecognition(dataUrl, model)`** — **`fetch`** на **`RECOGNITION_SERVER_URL + '/api/recognize'`**, **`POST`**, JSON з **`image`** (data URL) і **`config`** (spread **`CONFIG`**, перевизначення **`serverRecognition.model`**). Очікує **`success`** і **`detections`**; **`dataUrlToCanvas`**, **`drawBoundingBoxes`** за **`coordinates`**, **`size`**, **`class`**, **`confidence`**.

**Сервер:** **`lib/cloud/recognition-server.js`**, **`POST /api/recognize`**.

**Edge:** **`image-format`**, **`bounding-boxes`**, опційно **`actions`**.
