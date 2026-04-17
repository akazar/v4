---
title: server/
---

# Сервер (`server/`)

## Головна ідея

Каталог **`server/`** — **точка входу Node.js** для Vision v4: створює HTTP-сервер, **хостить усі браузерні застосунки** з `apps/` (і пов’язану статику), підключає **REST API** для розпізнавання, міркувань, конфігурації, сповіщень, допоміжних операцій з БД, експорту анотацій, файлів model-training, метаданих стримінгу та **Socket.IO** для realtime стримінгу/сигналінгу.

## Детальніше

### Роль процесу

Під час запуску головного скрипту:

1. Завантажується середовище (опційно ключі з `.env`).
2. Створюється Express і нижній **http.Server** (для апгрейду WebSocket).
3. Реєструється **статичний хостинг** для HTML/CSS/JS з `apps/`, кореня репозиторію (спільні `config/` і `lib/`), `factory/web`, UI kit і зібраного Docusaurus за **`/documentation/`**, якщо існує **`apps/docs/build`**.
4. Підключаються **API** cloud-функцій: розпізнавання, міркування, сповіщення, БД, список/видача конфігів, експорт annotate, model-training, метадані home-stream, Puppeteer-захоплення.
5. Підключається підсистема **стримінгу** на тому ж порту (сигналінг і realtime).
6. Прослуховується **порт** (з env або за замовчуванням).

### Здоров’я та експлуатація

Є простий маршрут **health** для перевірок доступності. Логи старту показують, чи знайдено опційні AI-ключі (без повних секретів).

## Функціональні деталі

| Відповідальність | Що дає |
|-------------------|--------|
| **Статичний хостинг** | Лендінг, стримінг, навчання, compare, анотатор тощо без окремого frontend-білду для цих апок. |
| **Спільний корінь активів** | `config/` і `lib/` доступні браузеру за абсолютними шляхами. |
| **API розпізнавання** | Напр. server-detection і compare можуть знімати навантаження з клієнта. |
| **API міркувань** | Текстові відповіді про зображення через провайдерів. |
| **API конфігурації** | Config manager і подібні клієнти керують профілями. |
| **Сповіщення та БД** | Декларативні дії з конфігів можуть POST-ити події чи записи. |
| **Стримінг** | WebRTC і Socket.IO з одного origin. |
| **Попередній перегляд захоплення** | Серверні сценарії «web capture». |
| **Експорт annotate** | Збереження з VIA у відому теку. |
| **Файли model-training** | Placeholder-чекпойнти та список для дашборду. |

**Деплой:** зазвичай **один** процес Node (або process manager), який віддає і статику, і API. Масштабування та TLS — поза цим каталогом, але використовують той самий HTTP-вхід.

## Code

### `server/main.js`

| Символ | Тип | Роль |
|--------|-----|------|
| `PORT` | const | `process.env.PORT` або 3001 для `server.listen`. |
| `app` | Express | Створюється **`express()`**; отримує middleware і маршрути. |
| `server` | http.Server | **`http.createServer(app)`** — потрібен для **Socket.IO** на тому ж listener. |
| Перевірка OpenAI | гілка | Якщо є **`OPENAI_API_KEY`** — короткий прев’ю-лог; інакше попередження (згадка `/api/describe`). |

**Порядок підключення:**

1. **`setupFrontendHosting(app)`** — `server/hosting-server.js`.
2. **`setupApiServer(app)`** — CORS, JSON, **`/health`**, **`/api/describe`**, завантаження **`.env`** через **`api-server.js`**.
3. **`setupRecognitionServer(app)`** — **`POST /api/recognize`**.
4. **`setupReasoningServer(app)`** — **`POST /api/reasoning`**.
5. **`setupNotificationServer`**, **`setupDbServer`**, **`setupConfigurationServer`**.
6. **`setupAnnotateExportServer`**, **`setupModelTrainingServer`**, **`setupStreamingHomeMetaServer`**.
7. **`setupStreamingServer(server)`** — Socket.IO на **`server`**.
8. **`setupCapturedStreamServer(app)`** — Puppeteer.
9. **`server.listen(PORT, …)`**.

**Хто викликає:** `npm start` → **`package.json` → scripts.start**.

**Використовує:** перелічені **`lib/cloud/*`** і **`./hosting-server.js`**.

### `server/hosting-server.js`

| Експорт | Параметри | Повертає | Роль |
|---------|-----------|----------|------|
| **`setupFrontendHosting`** | `app` (Express) | void | **`app.get`** і **`express.static`**. |

**Константи шляхів:** `v4Root`, `appsPath`, `landingPath`, шляхи до кожного апу, `factoryWebPath`, `uiKitPath`, `docsBuildPath` (`apps/docs/build`) — усі через **`path.join(__dirname, '..', …)`** від **`server/`**.

**Логіка:**

- **`/`**, **`/ua`** → `index.html` лендінгу.
- **`/documentation`** — редірект на **`/documentation/`** і **`express.static(docsBuildPath)`**, якщо збірка існує (інакше попередження в консолі).
- **`express.static(v4Root)`** — **`/lib`**, **`/config`** з кореня репозиторію.
- **`express.static(appsPath)`** — активи `apps/`.
- **`/ui-kit`** → `apps/ui-kit`.
- **`/factory`**, **`/factory/:id`** → `factory/web`.
- Префікси **`/config-creator`**, **`/streaming`**, **`/annotate`** тощо — **static** + **`sendFile(index.html)`**.

**Хто користується:** усі сторінки в браузері; імпорти **`/lib`** та **`/config`**.

**Залежності:** `express`, `path`, **`fileURLToPath`** для `__dirname` у ESM.
