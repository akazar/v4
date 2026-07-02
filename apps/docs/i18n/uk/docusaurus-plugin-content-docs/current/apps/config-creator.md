---
title: Генератор конфігурації
---

# Config generator (`/config-creator`)

## Головна ідея

**Config Generator** — **редактор на формах**, який збирає повний об’єкт у формі **`config.js`** для Vision v4: метадані, прапор UI, локальне та серверне розпізнавання, стилі рамок, декларативні дії, функції-дії, дефолти server reasoning і експорт.

## Детальніше

Форма розбита на **картки**. Кожну секцію можна **включити або виключити** з фінального експорту чекбоксами «Include in config» — зручно для експериментів.

## Візуальні елементи

- **Шапка** — відповідність «повній» схемі з `db/configs/public`.
- **Ім’я та опис** — id, display name, description.
- **UI** — master toggle; **Enable UI**.
- **Local recognition** — класи (з COCO picker), max results, пороги, IOU, модель, розміри, інтервал.
- **Bounding box styles** — обводка, тінь, шрифт, кольори лейблів, padding, radius, інтервал перемальовування.
- **Local recognition actions (declarative)** — динамічні рядки; пресети DB/API/Notify.
- **Local recognition action functions** — змішані рядки з інтервалами.
- **Local regular action functions** — періодичні декларативні дії.
- **Server recognition** — дзеркало локальних контролів для сервера.
- **Server reasoning** — провайдер і промпт.
- **Server recognition actions / functions** — аналогічно локальним.
- **Server reasoning action functions** — тіла функцій і лічильники.
- **Server regular action functions** — від останнього опису reasoning.
- **Футер форми** — **Generate & Download** і **Generate and Save** (POST на API).

## Сценарії користувача

1. Заповнити id / ім’я / опис.
2. Налаштувати розпізнавання локально та/або на сервері.
3. Стилі оверлею для запису демо або доступності.
4. Додати дії через пресети або невеликі функції.
5. Завантажити `config.js` або зберегти в `db/configs/public`.
6. Перевірити в factory або camera-stream з новим id.

**Результат:** узгоджені конфіги без ручного редагування великих JS-об’єктів.

## Code

### `apps/config-creator/app.js`

**IIFE** `'use strict'` без ESM-експорту; слухачі після **`DOMContentLoaded`**.

**Допоміжні функції**

| Назва | Аргументи | Повертає | Призначення |
|-------|-----------|----------|-------------|
| `indentBlock` | текст, кількість пробілів | рядок | Форматування згенерованого JS. |
| `escapeForSingleQuotedJs` | рядок | екранований | Безпечне вставляння в одинарні лапки. |
| `slugId` | рядок | slug | Ім’я файлу для конфігу. |
| `formatClassesArray` | масив рядків | літерал масиву | Поле **`classes`**. |
| `isSectionEnabled` | id чекбокса | boolean | Чи включати секцію. |
| `num` / `float` | input, дефолт | число | Парсинг чисел. |
| `parseClasses` | рядок через кому | масив | Класи з поля вводу. |
| `COCO_CLASSES_80` | — | константа | Повний список COCO для UI. |

**Конвеєр:** читання полів форми → об’єкт **`CONFIG`** у пам’яті → **Blob** для **`config-<id>.js`** або **`fetch('/api/configurations', …)`** з **`POST`** і тілом **`name`** + **`config`** (точні ключі — у скрипті).

**DOM:** динамічні списки дій; кнопки пресетів додають шаблони.

**Сторінка:** **`index.html`** підключає **`app.js`**.

**API:** **`POST /api/configurations`**; завантаження через **Blob** / **`URL.createObjectURL`**.

### `apps/config-creator/index.html`

**`<form id="configForm">`** з **`<section class="card">`**; поля відповідають ключам конфігу з підписів.
