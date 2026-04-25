---
title: Camera stream
---

# Camera stream (`/camera-stream`)

## Головна ідея

**Camera stream** — **інтерактивне живе демо** детекції в браузері: вебкамера на весь екран, **безперервне** або **ручне** розпізнавання (**YOLO** або **MediaPipe**), рамки за конфігом.

## Детальніше

Підвантажується ONNX для YOLO. Керування — у верхній смузі, камера лишається у фокусі.

## Візуальні елементи

- **Заголовок і короткий опис**.
- **Панель кнопок:** **Start Camera**, **Stop Camera**, **Start Recognition**, **Stop Recognition**, **Manual Recognition**.
- **Вибір моделі** — YOLO чи MEDIAPIPE.
- **Відеошар** — повноекранне відео та оверлей canvas (через edge-хелпери).

## Сценарії користувача

1. **Start Camera** — дозвіл браузера.
2. Обрати рушій YOLO/MediaPipe.
3. **Start Recognition** для періодичних оновлень; **Stop Recognition** для паузи.
4. **Manual Recognition** для одного кадру (презентації, світло).
5. **Stop Camera** — звільнити пристрій.

**Результат:** перевірка **затримки**, **списку класів** і **стилю рамок** на реальному відео без завантаження файлів.

## Code

### `apps/camera-stream/script.js`

**Імпорти:** **`CONFIG`** з **`../../config/config.js`**; **`lib/edge/capture`**, **`image-format`**, **`recognition/*`**, **`bounding-boxes`**, **`actions`**.

**Стан:** `cameraStream`, `videoElement`, інтервали, `recognitionResults`.

**`manualRecognition()`** — **`#modelSelect`**, **`toDataUrl(video)`**, **`recognize` / `recognizeWithYolo`**, **`action(..., manualRecognitionActionFunctions)`**.

**`startRecognitionLoop()`** — інтервал з **`CONFIG.boundingBoxStyles.interval`**, **`boundingBoxes`**, налаштовані дії розпізнавання, періодичні **`localRegularActionFunctions`**.

**Кнопки:** **`startBtn`**, **`stopBtn`**, **`startRecognitionBtn`**, **`stopRecognitionBtn`**, **`manualRecognitionBtn`**.

**Відмінність від factory:** статичний import конфігу; явні кнопки замість **`injectTopButtons`**.

### `apps/camera-stream/index.html`

Кнопки, **`#modelSelect`**, CDN **`ort.min.js`**, модуль **`script.js`**.
