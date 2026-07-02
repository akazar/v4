---
title: Огляд застосунків
---

# Застосунки в `apps/`

## Головна ідея

Каталог **`apps/`** містить **усі браузерні інтерфейси** Vision v4: лендінги, інструменти конфігурації, камера та зображення, серверне розпізнавання й reasoning, WebRTC-стримінг, анотацію, UI «навчання», дебаг і спільну **таблицю стилів UI kit**.

## Детальніше

Усе це віддає **основний Node-сервер** (див. [Сервер](../project/server)) за префіксами на кшталт `/streaming`, `/camera-stream`, `/annotate` тощо. Корінь репозиторію також статичний, тож апки однаково імпортують **`/lib/...`** і **`/config/...`**.

### Індекс застосунків

| Застосунок | URL-префікс | Призначення (одним рядком) |
|------------|-------------|----------------------------|
| Лендінг (EN) | `/` | Огляд продукту та посилання на модулі |
| Лендінг (UA) | `/ua` | Український варіант лендінгу |
| UI kit | `/ui-kit` | Спільні CSS-токени та компоненти |
| Демо factory | `/factory` (файли в `apps/factory/`) | Повний конфіг-керований конвеєр |
| Config generator | `/config-creator` | Форма для збірки `config.js` |
| Config manager | `/config-manager` | Список / перегляд / видалення `config/public` |
| Camera stream | `/camera-stream` | Жива камера, локальне розпізнавання |
| Image upload | `/image-upload` | Статичне зображення в браузері |
| Server detection | `/server-detection` | Детекція через API сервера |
| Server reasoning | `/server-reasoning` | Зображення + промпт → текст через API |
| Compare | `/compare` | Порівняння локального/серверного та reasoning |
| Streaming | `/streaming` | WebRTC: home, streamer, viewer, dashboard |
| Model training | `/model-training` | Симульований UI навчання |
| Дашборд моделей | `/model-training/dashboard` | Список/видалення чекпойнтів |
| Annotate (VIA) | `/annotate` | Ручна анотація медіа |
| Debug | `/debug` | Мінімальний shell: конфіг за id + цикл розпізнавання |

У кожного застосунку окрема сторінка документації з **елементами інтерфейсу** та **сценаріями користувача**.

## Функціональні деталі

- **Спільні стилі** — більшість сторінок підключають `/ui-kit/ui-kit.css`.
- **Спільна логіка** — **`lib/edge/`** для розпізнавання, малювання й дій у камері, зображеннях, стримінгу, compare, factory.
- **Зв’язок із сервером** — апки з API потребують запущеного сервера; чисто локальні можуть працювати офлайн лише якщо вже закешовані активи (CDN-моделі можуть потребувати мережі).

## Code

### Статичні монти (`server/hosting-server.js`)

| URL-префікс | Файлова система | Типовий вхід |
|-------------|----------------|--------------|
| `/` | `apps/landing/` + статика `v4Root` | `index.html` |
| `/ua` | `apps/landing/ua/index.html` | дзеркало UA |
| (неявно) `apps/...` | `express.static(appsPath)` | активи по теках |
| `/lib/...` | `v4Root` | **`lib/**/*.js`** як ES modules |
| `/config/...` | `v4Root` | **`config/**/*.js`** |
| `/factory` | `apps/factory/` | SPA factory |
| … | див. документ «Сервер» | … |

### Узгодженість import у браузері

```text
import … from '/lib/edge/…';
import … from '../../config/config.js';
```

- **Початковий `/`** — відносно origin (потрібен **`v4Root`** у хостингу).
- **Відносні `../..`** — від **`apps/<app>/script.js`** до **`config/`**.

### Точки входу скриптів (приклади)

| Тека апу | Основний JS | Імпорти |
|----------|-------------|---------|
| `camera-stream` | `script.js` | `config/config.js`, `lib/edge/*` |
| `image-upload` | `script.js` | те саме |
| `server-detection` | `script.js` | config + **`fetch /api/recognize`** |
| `server-reasoning` | `script.js` | **`fetch /api/reasoning`** |
| `compare` | `app.js` | `config/public/config-default.js`, локально + сервер |
| `streaming` | `home.js`, `viewer.js`, `dashboard.js`, `streamer.js` | Socket.IO, `process.js` / події dashboard |
| `config-manager` | `app.js` | **`/api/configurations`**, **`/config/public/`** |
| `config-creator` | `app.js` | форма → рядок → завантаження / POST |
| `model-training` | `app.js`, `dashboard.js` | **`/api/model-training/models-list`** |
| `debug` | `script.js` | лише **`/api/configurations/:id`** |

**Важливо:** **`lib/cloud/**`** ніколи не імпортується з браузера; лише **`lib/edge/**`** і інколи **`/lib/scheduled-actions-manager.js`** (дашборд стримінгу).
