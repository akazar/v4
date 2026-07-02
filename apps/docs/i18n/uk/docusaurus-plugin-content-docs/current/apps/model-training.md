---
title: Навчання моделі та дашборд
---

# Model training (`/model-training` та `/model-training/dashboard`)

## Головна ідея

Застосунок **model training** — **браузерна «кімната керування»** для підготовки **симульованих** завдань детекції або fine-tuning VLM: ім’я чекпойнту, базова модель, пари зображення+анотації, спліти **train/val/test**, гіперпараметри, **фейковий** цикл епох з графіками, потім **експорт** або **збереження** порожніх ваг. **Дашборд збережених моделей** показує файли в `db/models` і видаляє через API.

## Детальніше

**Увага:** метрики навчання **синтетичні** — UI перевіряє сценарії до підключення реального тренера.

## Візуальні елементи — Сторінка `/model-training`

- Посилання назад на головну та дашборд.
- Шапка з бейджем «UI preview».
- **Секція 1:** ім’я вихідного чекпойнту; правила імені та розширення.
- **Секція 2:** базова модель (dropdown з плейсхолдерами).
- **Секція 3:** multi-file зображення та анотації; збіг за **stem** імені файлу.
- **Секція 4:** кнопки авто-спліту 70/15/15 та 80/20/10; рядок summary; таблиця датасету з прев’ю та вибором спліту.
- **Секція 5:** epochs, batch, learning rate, weight decay, seed.
- **Секція 6:** Start/Stop навчання; прогрес; статус; лог метрик; canvas-графіки (loss, mAP, precision/recall, LR, час).
- **Секція 7:** Export model, Save model; статус.
- **Toast** успіху.

## Візуальні елементи — Дашборд `/model-training/dashboard`

- Посилання назад.
- Шапка з дозволеними розширеннями.
- Статус; список файлів з **trash**; **Refresh**.

## Сценарії користувача

### Оператор «навчання»

1. Ім’я чекпойнту.
2. Базова модель зі списку.
3. Завантажити зображення та sidecar; перевірити пари в таблиці.
4. Рознести по сплітах вручну або авто.
5. Гіперпараметри.
6. Запустити симуляцію; дивитися графіки.
7. Експорт локально або **Save** на сервер.

### Куратор моделей

1. Відкрити дашборд.
2. Оновити список `.pt` / `.tflite` / `.safetensors`.
3. Видалити зайві placeholder-файли.

**Результат:** узгодження UX форм і життєвого циклу артефактів до GPU-роботи.

## Code

### `apps/model-training/app.js`

| Символ | Роль |
|--------|------|
| **`extensionForModelId`** | `.safetensors` для префікса `vlm-`, `.tflite` якщо **`efficientdet`** в id, інакше `.pt`. |
| **`trainedStemFromInput`** | поле **`#trainedModelNameInput`**, санітизація. |
| **`getOutputCheckpointStem`** | введений stem або fallback з **`#modelSelect`**. |
| **`MODEL_OPTIONS`** | масив об’єктів з **`value`** та **`label`**. |
| **`datasetItems`** | рядки: id, imageFile, опційно annotationFile, split, objectUrl. |
| **`$(id)`** | getElementById з помилкою якщо немає елемента. |
| **Парування** | **`basenameNoExt`** для збігу stem. |
| **Графіки** | Canvas 2D; фейкові метрики в **`epochLog`**. |
| **Цикл** | таймери / rAF; прапор **`trainingRunning`**. |
| **Експорт** | порожній blob правильного розширення; **Save** → **POST** до API model-training. |

### `apps/model-training/dashboard.js`

**`loadModelsDashboard`** — **`GET /api/model-training/models-list`**, **`data.files`**, список з **`data-filename`**. Видалення — **`DELETE`** з ім’ям файлу.

**Допоміжні:** **`escapeHtml`**, **`escapeAttr`**, **`TRASH_ICON_SVG`**, **`setModelsDashboardStatus`**.

### HTML

**`index.html`** / **`dashboard.html`** — секції з **id** для скриптів; класичні **`<script src="app.js">`** / **`dashboard.js`**.

### Сервер

**`server/services/model-training-service.js`** — запис у **`db/models`**; фільтр розширень.
