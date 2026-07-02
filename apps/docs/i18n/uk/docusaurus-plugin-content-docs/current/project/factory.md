---
title: apps/factory/
---

# Configs (`db/configs/`)

## Головна ідея

**`apps/factory/`** містить **веб-демо у стилі продакшену**, яке проганяє повний **конфіг-керований** vision-конвеєр в одному браузерному досвіді. Статичний бандл у **`apps/factory/`** віддається за **`/factory`** (глибокі посилання наприклад `/factory/:id` теж віддають той самий shell, щоб клієнт прочитав id).

## Детальніше

Демо навмисно **мінімальне в HTML**: скрипти піднімають застосунок, підвантажують ONNX для YOLO за потреби, тягнуть **factory-конфігурацію**, запускають камеру й малюють оверлеї за конфігом.

Основні моменти:

- **Перемикач моделі** — локально YOLO або MediaPipe залежно від конфігу.
- **Дії** — інтервальні та періодичні дії зі списків конфігу.
- **Видимість UI** — конфіг може вмикати або приховувати екранні кнопки.

## Функціональні деталі

| Аспект | Результат |
|--------|-----------|
| **Прив’язка до конфігу** | Один об’єкт конфігу керує детекцією, малюванням і діями без перезбірки апу. |
| **Зв’язок з інструментами** | Config Generator і Config Manager — типовий шлях: створити профіль, зберегти, відкрити factory з цим id. |
| **Деплой** | Статика + спільний `lib/`, той самий Node-сервер і origin, без окремого бандлера для shell. |
| **Глибокі посилання** | Сегменти шляху або query дозволяють закладки з обраним id конфігу. |

**Стосунок з іншими застосунками:** за змістом близько до camera/streaming; **`apps/factory/`** — «вітрина» з лендінгу та документації.

## Code

### `apps/factory/index.html`

- **Head** — **`/ui-kit/ui-kit.css`**, **`styles.css`** за потреби; **body** мінімальний.
- **Scripts** — CDN **`ort.min.js`**, потім **`type="module"`** → **`script.js`**.

### `apps/factory/script.js`

**Імпорти (edge):** **`capture`**, **`source-to-canvas`**, **`bounding-boxes`**, **`actions`**, **`ui` → `injectTopButtons`**.

**Стан модуля:** **`cameraStream`**, **`videoElement`**, інтервали, **`recognitionResults`**, **`recognitionRunning`**, **`recognitionCanvas`** — той самий життєвий цикл, що й у **`apps/camera-stream`**.

**`startRecognitionLoop(config)`** — читає **`config.localRecognition.model`**, динамічний **`import()`** recognizer-а, **`setInterval`** з guard **`recognitionRunning`**, **`videoToReusableCanvas`**, **`scaleDetectionsToVideo`**, **`localRecognitionActionsFromConfig`**; окремий інтервал для **`boundingBoxStyles`**.

**`initApp(config)`** — якщо **`config.ui`**: **`injectTopButtons`** і **`ui:state`** для старту/зупинки та **`clearBoundingBoxes`**; інакше одразу **`startRecognitionLoop`**. **`beforeunload`** — прибирання.

**`getConfigIdFromPath()`** — **`?id=`** з **`URLSearchParams`**, за замовчуванням **`'config'`**.

**`main()`** — **`fetch('/api/configurations/' + encodeURIComponent(configId))`**, **`res.json()`** → **`initApp`**. Помилка — **alert** (на сервері **`getConfiguration`** може впасти назад на **`db/configs/config.js`**).

**`config-factory.js`** на диску — довідковий пресет; **жива** сторінка factory завжди отримує об’єкт через API.

**Хостинг:** **`server/hosting-server.js`**, шлях **`/factory`**.
