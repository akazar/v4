---
title: Стримінг (WebRTC)
---

# Multi-stream WebRTC (`/streaming`)

## Головна ідея

Модуль **streaming** координує **кілька живих джерел відео** — камери пристроїв, **HLS (M3U8)** URL або **серверне захоплення** фрагментів зовнішніх вебсторінок — і показує їх у **сітці переглядачів** з опційним **захопленням кадру та розпізнаванням** (YOLO/MediaPipe) на клієнті. Сигналінг — **Socket.IO** на тому ж хості, що й основний сервер.

## Детальніше

Кілька HTML-входів:

- **Home** (`/streaming`) — створення стрімерів, джерела, вибір, збережені набори, viewer / **viewer dashboard**, QR для мобільних стрімерів.
- **Streamer** — публікація відео після старту захоплення.
- **Viewer** — кілька вхідних потоків і зона **Capture & Recognition**.
- **Viewer dashboard** — сітка для багатьох потоків ті самі можливості (`dashboard.html`).
- **Спеціалізовані стрімери** — наприклад лише M3U8 або captured-stream для Node/браузера.

## Візуальні елементи — Home

- Заголовок сторінки.
- **Панель створення стріму:** ім’я; вкладки **Local camera**, **M3U8 URL**, **Web capture**; для камери — радіо **P2P** vs **WebRTC server**; для M3U8 — поле URL; для capture — URL сторінки, **CSS selector**, інтервал скриншота, режим стримінгу; кнопка **Create streamer**; статус.
- **Доступні стріми:** Select all, Clear, Open viewer, Open viewer dashboard, Save selected; список карток; статус.
- **Збережені набори:** підказка; список; статус.
- **QR modal** — підкладка, закрити, підпис, область QR.

## Візуальні елементи — Streamer

- Інфоблок: id, режим, джерело, статус.
- Локальне прев’ю відео.
- **Start / Stop camera** (або аналог для не-камери).

## Візуальні елементи — Viewer

- Список id потоків.
- Сітка відео.
- **Capture & Recognition:** підпис джерела; вибір моделі; canvas результату; текстовий summary.

## Візуальні елементи — Viewer dashboard

- Заголовок і пояснення query **`modes`** у порядку потоків (P2P vs сервер).
- Розширена сітка відео; логіка в **`dashboard.js`**.

## Сценарії користувача

### A. Кілька камер

1. На Home створити стрімери для пристроїв.
2. Виділити всі → **Open viewer dashboard**.
3. За потреби **capture** і розпізнавання.

### B. HLS

1. Вкладка M3U8, URL плейлиста, створити стрімер.
2. Відкрити viewer разом із камерами.

### C. Захоплення вебсторінки

1. Web capture: URL, селектор, інтервал.
2. P2P або серверний режим.
3. Глядачі бачать послідовність знімків регіону.

### D. Мобільний публішер

1. QR з desktop на телефон; відкрити URL стрімера.
2. Дозволити камеру; дивитися з desktop viewer.

### E. Збережені пресети

1. Виділити набір потоків → **Save selected**.
2. Пізніше відкрити з **Saved streams**.

**Результат:** багато одночасних контекстів і **on-demand** аналітика на одному кадрі.

## Code

### `apps/streaming/home.js`

| Символ | Роль |
|--------|------|
| **`io()`** | клієнт Socket.IO (той самий origin). |
| **`normalizeStreamName` / `generateStreamId`** | нормалізація імен; випадкові id. |
| **`looksLikeM3u8Url`**, **`streamerPageForSource`** | маршрутизація на **`streamer.html`**, **`m3u8-streamer.html`**, capture з query-параметрами. |
| **Вкладки** | **`[data-home-source-tab]`**; радіо P2P/SFU. |
| **Списки** | **`#streamsContainer`**; **localStorage** для збережених наборів. |
| **QR modal** | бібліотека **qrcodejs**. |

### `apps/streaming/streamer.js`

Локальний відеотрек, обмін SDP/ICE через Socket.IO (деталі — у файлі: **`streamId`**, **`mode`**).

### `apps/streaming/viewer.js`

Query **`?streams=`**; Socket.IO; сітка; **capture** з **`HTMLVideoElement`**; YOLO/MediaPipe з **`ort`** на сторінці.

### `apps/streaming/dashboard.js`

**Імпорти:** **`./process.js`**, **`/lib/scheduled-actions-manager.js`**, **`./dashboard-events/p2p-webrtc.js`**, **`server-webrtc.js`**.

**Query:** **`streams`**, **`modes`** → **`streamModes`** (p2p чи sfu).

**Стан:** **`streamState`** Map на **streamId**; завантаження **`/db/configs/public/config-default.js`** або списку конфігів.

**`shouldUseServerRecognitionForStream`** — SFU без **localRecognition** → серверний шлях детекції.

### `apps/streaming/process.js`

Міст між кадрами відео, розпізнаванням і оверлеєм для viewer/dashboard.

### Сервер

**`lib/cloud/streaming-server/streaming-server.js`** — Socket.IO, кімнати, інтеграція з **`sfu-server-recognition.js`**.

### Node-стрімери (опційно)

**`apps/streaming/node-streamers/*.js`** — headless-публікація для файлу, m3u8, capture з **`wrtc`**.
