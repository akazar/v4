---
title: Config manager
---

# Config manager (`/config-manager`)

## Головна ідея

**Config Manager** — **консоль оператора** для файлів у **`db/configs/public`**: список профілів, перегляд сирого вмісту, **видалення** через API сервера.

## Детальніше

Сторінка очікує **запущений сервер Vision v4**, щоб відповідали маршрути `/api/configurations` та пов’язані.

## Візуальні елементи

- **Шапка** — заголовок і підзаголовок з згадкою `db/configs/public`.
- **Область статусу** — повідомлення про успіх/помилку (завантаження, видалення).
- **Список конфігів** — рядки з кнопками дій (перегляд, тест у factory, видалення).
- **Панель перегляду** — підкладка, аркуш з заголовком, **закрити**, прокручувана **pre** з текстом файлу.

## Сценарії користувача

1. Відкрити `/config-manager`.
2. Після завантаження перевірити список і статус.
3. **View** — прочитати повний конфіг у панелі; закрити.
4. **Test** — відкрити factory з обраним id.
5. **Delete** — прибрати зайві тестові профілі.

**Результат:** вміст `db/configs/public` **знаходять і підтримують** без SSH.

## Code

### `apps/config-manager/app.js`

| Символ | Тип | Роль |
|--------|-----|------|
| `listEl` | HTMLElement | `#configList` — рядки `<li>`. |
| `statusEl` | HTMLElement | `#status`. |
| `viewPanel`, … | елементи | модальний перегляд. |
| `setStatus(message, isError?)` | функція | клас **`.error`**. |
| `fileNameToId(fileName)` | функція | відрізає **`.js`** для API id. |
| `loadList()` | async | **`GET /api/configurations`**, рендер кнопок з **`data-*`**. |
| `escapeHtml` / `escapeAttr` | функції | захист від XSS. |
| `showConfigSource(fileName)` | async | **`GET /db/configs/public/<file>`** як **текст**. |
| `openViewPanel` / `closeViewPanel` | функції | **`hidden`**, ARIA, фокус. |
| Delete | делегування | **`DELETE /api/configurations/:id`**. |
| Test | — | відкриває factory з query **`id`** (див. файл). |

**Життєвий цикл:** `loadList()` при готовності DOM; слухачі кліків.

**Залежності:** **`configuration-server.js`**; статика **`/db/configs/public`** для перегляду.

### `apps/config-manager/index.html`

Статичний каркас: шапка, **`#status`**, **`#configList`**, **`#viewPanel`** — без інлайн-логіки.
