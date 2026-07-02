---
title: config/
---

# Конфігурація (`db/configs/`)

## Головна ідея

**`db/configs/`** зберігає **JavaScript-об’єкти конфігурації**: як працює розпізнавання (моделі, пороги, класи), як виглядають рамки, які **дії** виконувати після детекції або після тексту reasoning. Пресети лежать у **`db/configs/public/`** — їх можна отримати через API конфігурації та інструменти на кшталт Config Manager.

## Детальніше

### Основні файли

- **Головний модуль конфігу** задає типову структуру для апок (локальне та серверне розпізнавання, reasoning, списки дій, прапор UI).
- **`config-factory.js`** — довідковий профіль для демо **factory** (на диску); жива сторінка factory зазвичай тягне конфіг через API.
- **`config-default.js`** і **`config-old.js`** — базові або історичні знімки для порівняння чи міграції.

### Публічні пресети (`db/configs/public/`)

Багато файлів (тематичні імена) — **готові профілі**: підмножини класів, пресети дій, mobile/dashboard, ухил у YOLO або MediaPipe тощо. **Config Manager** показує список для перегляду/видалення; **Config Generator** орієнтується на «повну» схему.

## Функціональні деталі

| Можливість | Ефект |
|------------|--------|
| **Класи та пороги** | Що вважати детекцією і з якою впевненістю показувати чи реагувати. |
| **Вибір моделі** | YOLO чи MediaPipe для локального та/або серверного блоку. |
| **Інтервали** | Як часто ганяти розпізнавання, оновлювати рамки, викликати періодичні дії. |
| **Стилі рамок** | Колір, шрифт, відступи, тіні для лейблів. |
| **Хуки дій** | Декларативні дії (notify, HTTP, DB) або вбудовані функції — по-різному на клієнті й сервері. |
| **Прапор UI** | Показувати чи ховати екранні кнопки (headless vs інтерактив). |
| **Видимість списку** | Файли в `db/configs/public/` потрапляють у серверний лістинг — оператор обирає профіль без SSH. |

**Типовий процес:** Config Generator → зберегти в `db/configs/public` → відкрити Factory або Config Manager.

## Code

### `db/configs/config.js`

| Символ | Роль |
|--------|------|
| **`CONFIG`** | Об’єкт: **`id`**, **`name`**, **`description`**, **`ui`**, **`localRecognition`**, **`boundingBoxStyles`**, **`localRegularActionFunctions`**, **`manualRecognitionActionFunctions`**, **`serverRecognition`**, **`serverReasoning`**, **`serverReasoningActionFunctions`**, **`serverRegularActionFunctions`** тощо. |
| **`export default CONFIG`**, **`export { CONFIG }`** | Подвійний ESM-експорт. |

**Використовують:** **`apps/camera-stream/script.js`**, **`image-upload`**, **`server-detection`**, **`server-reasoning`** — статичний import; **`lib/cloud/recognition-server.js`**, **`api-server.js`** — серверні дефолти та списки дій.

### `db/configs/config-factory.js`

Та сама форма **`CONFIG`**, налаштована під factory (наприклад **`name: 'config-factory'`**). Зручно як шаблон для авторів; **apps/factory/script.js** у рантаймі зазвичай отримує JSON з **`/api/configurations/:id`**.

### `db/configs/config-default.js` / `config-old.js`

Знімки для **compare** (`apps/compare/app.js` імпортує **`db/configs/public/config-default.js`**) або архів.

### `db/configs/public/*.js` (пресети)

Зазвичай **`export default CONFIG`**. Ім’я файлу **без `.js`** стає **`id`** в API.

**Споживачі:** **`configuration-server.js`** — **`getConfiguration(id)`** і **`import()`** з `db/configs/public`, fallback **`db/configs/config.js`**; браузер — **`GET /db/configs/public/…`** як текст (Config Manager View).

### `lib/cloud/configuration-server.js`

| Символ | Параметри | Логіка |
|--------|-----------|--------|
| **`CONFIG_PUBLIC_DIR`** | — | Абсолютний шлях до **`db/configs/public`**. |
| **`isSafeConfigName(name)`** | рядок | Безпечні символи; без dotfiles. |
| **`getConfiguration(id)`** | id без `.js` | Спроба public, інакше **`config.js`**. |
| **`configObjectToJsSource(config)`** | об’єкт | **`JSON.stringify`** + обгортка **`export default`**. |
| **`setupConfigurationServer(app)`** | Express | GET список, GET один, POST збереження, DELETE. |

**Зв’язки:** **`apps/config-manager/app.js`**, **`apps/debug/script.js`**, **`apps/config-creator/app.js`**.
