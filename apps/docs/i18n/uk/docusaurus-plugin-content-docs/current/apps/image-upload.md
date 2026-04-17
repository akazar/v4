---
title: Image upload
---

# Image upload (`/image-upload`)

## Головна ідея

**Image upload** аналізує **нерухомі зображення** локально (**YOLO** або **MediaPipe**): файл або URL, розпізнавання за запитом, рамки на canvas, **завантаження** JPEG з анотацією.

## Детальніше

ONNX для YOLO на сторінці. У прев’ю — підказка-плейсхолдер або canvas з результатом.

## Візуальні елементи

- Заголовок і інструкції.
- **Model selector** — YOLO / MediaPipe.
- **File input** — JPG/PNG.
- **URL input** — віддалене зображення (обмеження CORS для canvas).
- **Recognize** — один прохід детекції.
- **Download** — після успіху; зберегти JPG.
- **Preview canvas** — зображення з рамками.
- **Placeholder** — до першого запуску.

## Сценарії користувача

1. Обрати модель.
2. Файл або прямий URL зображення.
3. **Recognize** — дочекатися рамок і підписів.
4. Перевірити впевненість на canvas.
5. **Download** для звітів чи тікетів.

**Результат:** статична перевірка якості, модерація, порівняння з сервером через Compare.

## Code

### `apps/image-upload/script.js`

**Імпорти:** **`CONFIG`**, **`imageToCanvas`** з **`source-to-canvas.js`**, **`recognize`**, **`recognizeWithYolo`**, **`getImageFromSource`**, **`drawBoundingBoxes`**, **`action`**.

**DOM:** `#fileInput`, `#urlInput`, `#modelSelect`, `#recognizeBtn`, `#downloadBtn`, `#previewCanvas`, `#placeholder`.

**Стан:** `currentImageSource` (Blob або HTMLImageElement), `resultCanvas`.

**`runRecognition(source, model)`** — гілка MediaPipe/YOLO; для кожного результату поля **`x`**, **`y`**, **`width`**, **`height`**, **`label`** у **`drawBoundingBoxes`**.

**Завантаження:** blob URL / **`toDataURL`** з **`resultCanvas`**.

**Події:** зміна файлу, URL, клік Recognize / Download.

**Сторінка:** **`index.html`** + **`ort.min.js`**.

**Лише** **`lib/edge`** і статичний **`CONFIG`**.
