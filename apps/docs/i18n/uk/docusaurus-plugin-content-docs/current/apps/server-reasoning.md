---
title: Server reasoning
---

# Server reasoning (`/server-reasoning`)

## Головна ідея

**Server reasoning** надсилає на бекенд **зображення та текстовий промпт**; сервер викликає **vision-модель чату** (сімейство OpenAI ChatGPT або Google Gemini). Текстова відповідь показується на сторінці — підписи, Q&A, вільний аналіз.

## Детальніше

Потрібні основний сервер і **API-ключі** в `.env`. Локальні YOLO/MediaPipe тут не запускаються.

## Візуальні елементи

- Заголовок і опис потоку «зображення + reasoning».
- **Model selector** — ChatGPT чи Gemini.
- Файл і URL зображення.
- **Prompt** — вільний текст (плейсхолдер за замовчуванням).
- **Reasoning** — відправка запиту.
- Область **результату** — текст відповіді.

## Сценарії користувача

1. Переконатися, що ключі провайдерів є на сервері.
2. Обрати провайдера.
3. Прикріпити зображення.
4. Сформулювати промпт.
5. **Reasoning** — прочитати відповідь.
6. За потреби змінити промпт або зображення.

**Результат:** огляд сцену без детекторів; швидка перевірка reasoning API.

## Code

### `apps/server-reasoning/script.js`

| Константа | Значення |
|-----------|----------|
| **`REASONING_SERVER_URL`** | `CONFIG.serverReasoning?.reasoningServerUrl ?? ''` |
| **`DEFAULT_PROMPT`** | `CONFIG.serverReasoning?.prompt ?? 'Describe…'` |

**`loadImageFromUrl`** — **`Image`**, **`crossOrigin = 'anonymous'`**, **`currentImageSource`**.

**`runReasoning`** — **`toDataUrl`** → **`imageBase64`**, **`POST …/api/reasoning`** з полями **`model`**, **`prompt`**, **`imageBase64`**; **`data.reasoning`**; помилка, якщо **`res.ok`** хибне.

**Сервер:** **`lib/cloud/reasoning-server.js`**, **`GEMINI_API_KEY`**, **`OPENAI_API_KEY`**, **`parseModelSelector`**.

**DOM:** `#fileInput`, `#urlInput`, `#promptInput`, `#modelSelect`, `#reasoningBtn`, `#reasoningResultText`.
