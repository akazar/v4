---
title: Debug (конфіг-керований shell)
---

# Factory debug (`/debug`)

## Головна ідея

**`/debug`** — **мінімальна HTML-оболонка** для розробників: тягне **JSON конфігурації** з сервера за query **`id`**, запускає **камеру** й **безперервний локальний цикл** розпізнавання (YOLO або MediaPipe за конфігом). Малювання рамок і багато хуків дій **закоментовані** в поточному скрипті — орієнтир на **консоль**, а не полірований UI.

## Детальніше

На відміну від `/camera-stream`, у розмітці **немає рядка кнопок**; тіло порожнє, відео/canvas додає runtime. ONNX для YOLO підключений.

## Візуальні елементи

- **За замовчуванням немає** — лише скрипти; прев’ю камери з’являється після інжекту.
- **Неявне відео** — майже на весь екран; помилки через **alert**.

## Сценарії користувача

1. Запустити сервер; API конфігурації має відповідати для обраного id.
2. Відкрити `/debug?id=<configId>` (якщо id немає — дефолт сервера).
3. Дозволити камеру.
4. Дивитися вивід у консолі devtools щодо інтервалу.
5. Змінити конфіг, перезавантажити.

**Результат:** швидка перевірка **fetch конфігу + інференс** без важких UI.

## Code

### `apps/debug/script.js`

**Імпорти:** **`capture`**, **`source-to-canvas`**, **`bounding-boxes`**, **`actions`**; **`injectTopButtons`** імпортований, але **не використовується** в поточному **`initApp`**.

**`startRecognitionLoop`** — як у **`apps/factory/script.js`**: динамічний **`import()`**, guard **`recognitionRunning`**, **`videoToReusableCanvas`**, **`scaleDetectionsToVideo`**. Гілки з **`boundingBoxes`** / **`localRecognitionActions`** часто закоментовані — **`console.log`**.

**`initApp`** — після **`initCameraBackground`** одразу **`startRecognitionLoop`** (без **`ui:state`**).

**`main`** — як factory: **`fetch('/api/configurations/…')`**, **`initApp`**.

**`index.html`** — **`ort.min.js`** + модульний скрипт.

**Порівняння з factory:** там **`injectTopButtons`** і **`ui:state`** керують стартом/стопом; у **debug** цикл стартує одразу після камери.
