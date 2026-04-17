---
title: package.json і package-lock.json
---

# Маніфести пакунків

## Головна ідея

Кореневі **`package.json`** і **`package-lock.json`** задають **Node.js-застосунок** Vision v4: залежності під час виконання, точку входу сервера та відтворювані інсталяції. Разом вони перетворюють репозиторій на одиницю, з якої можна запустити HTTP-сервер і допоміжні CLI-скрипти розпізнавання.

## Детальніше

- **`package.json`** іменує проєкт, оголошує ES-модулі, задає engines (Node 18+) і фіксує **прямі** залежності: Express, Socket.IO, Sharp, ONNX Runtime, Puppeteer, клієнти OpenAI і Google GenAI, dotenv, пакунки для WebRTC у стримінгу.
- **`package-lock.json`** зберігає **точне дерево залежностей** (у т.ч. транзитивні), щоб `npm install` дав однакові версії на машинах і в CI.

**`apps/docs/package.json`** (цей сайт документації) **окремий**: лише збирає Docusaurus і не впливає на основний сервер Vision v4 у корені репозиторію.

## Функціональні деталі

**Скрипти кореневого `package.json`**

- **Запуск основного сервера** — основний процес HTTP/Socket.IO, що хостить `apps/` і cloud API.
- **YOLO (CLI)** — опційний запуск cloud/edge YOLO з командного рядка.
- **MediaPipe (CLI)** — те саме для MediaPipe.

**Ролі залежностей (поведінково)**

- **Веб-фреймворк і realtime** — статика, API, канали для сигналінгу стримінгу.
- **Зображення та моделі** — ресайз, конвертація, ONNX де потрібно.
- **Автоматизація браузера** — headless-сценарії для захоплення чи розпізнавання на сервері.
- **Клієнти AI** — зображення та промпти до хмарних моделей.
- **Середовище** — секрети та порти з `.env` під час старту.

**Lockfile**

- Однакові версії після клону чи деплою.
- Варто комітити, щоб prod і dev збігалися.

## Code

### Кореневий `package.json`

| Поле | Значення |
|------|----------|
| `name` / `version` / `description` | Метадані npm; `description` коротко описує стек Vision v4. |
| `"type": "module"` | Node трактує `.js` як **ES modules** (`import` / `export`). |
| `main` | Вказує на **`server/main.js`**. |
| `scripts.start` | **`node server/main.js`** — prod-вхід для HTTP + Socket.IO. |
| `scripts.recognize:yolo` | Прямий запуск **`lib/cloud/recognition/yolo/recognize-yolo.mjs`**. |
| `scripts.recognize:mediapipe` | **`lib/cloud/recognition/mediapipe/recognize-mediapipe.js`**. |
| `scripts.docs:*` | Делегує в **`apps/docs`** через **`npm run … --prefix apps/docs`**. |
| `engines.node` | **>= 18** для основного застосунку (у docs окремо Node 20). |
| `dependencies` | Лише **прямі** пакунки з semver `^`. Споживачі: **`server/main.js`**, **`lib/cloud/**`**, **`server/hosting-server.js`**, модулі стримінгу тощо. |

**Як це використовується:** усе, що стартує через `npm start` або читає маніфест, резолвить **import** у `node_modules` з цього списку.

### Кореневий `package-lock.json`

| Поняття | Роль |
|---------|------|
| **`lockfileVersion`** | Формат 3 (npm 7+). |
| **`packages[""]`** на вершині | Дзеркалить ім’я/версію та **прямі** залежності з `package.json`. |
| **`packages["node_modules/…"]`** | Кожен ключ — вирішений пакунок: **`version`**, **`resolved`**, **`integrity`**, вкладені **`dependencies`**. |

**Логіка:** npm ставить **ідентичне дерево** без повторного резолву діапазонів. **`npm install`** при додаванні dep оновлює `package.json` і lockfile.

**Хто читає:** розробники та CI; **код застосунку** lockfile не імпортує.

### `apps/docs/package.json`

| Поле | Роль |
|------|------|
| `private: true` | Забороняє випадковий `npm publish` сайту документації. |
| `scripts` | **`docusaurus start` / `build` / `serve`** тощо. |
| `dependencies` | **React 19**, **@docusaurus/core**, preset-classic, MDX, prism. |

**Зв’язок:** ізольовано від runtime Vision; міст **`docs:*`** у **кореневому** `package.json`.

### `apps/docs/package-lock.json`

Та сама роль, що й кореневий lockfile, але лише для залежностей **Docusaurus**. Обидва lockfile варто комітити для відтворюваних збірок документації.
