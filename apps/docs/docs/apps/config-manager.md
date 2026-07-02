---
title: Config manager
---

# Config manager (`/config-manager`)

## Main idea

The **Config Manager** is an **operator console** for files in **`db/configs/public`**: it lists available configuration profiles, shows raw contents in a viewer, and supports **deletion** through the server API.

## More detail

The page assumes the **main Vision v4 server** is running so `/api/configurations` (and related routes) respond.

## Visual elements

- **Header** — Title and subtitle referencing `db/configs/public`.
- **Status region** — Live region for success/error messages (loads, deletes).
- **Configuration list** — Bulleted or row list of config files with actions (open in factory, view source, delete—exact buttons depend on client but the DOM provides list + panel pattern).
- **View panel (modal/sheet)** — When opened:
  - **Backdrop** dims the page.
  - **Sheet** contains a title, **close** control, and a **scrollable code/pre** area showing the selected config body as text.

## User workflows

1. **Open manager** — Navigate to `/config-manager`.
2. **Refresh mentally on load** — The list populates from the server; watch the status region if the API fails.
3. **Inspect** — Choose **view** on an entry to read the full config in the sheet; close when done.
4. **Launch demo** — Open the factory or other consumer using the chosen config id (via provided link or manual URL).
5. **Delete** — Remove obsolete test configs after confirming; status confirms completion.

**Outcome:** The filesystem under `db/configs/public` stays **discoverable** and **maintainable** without SSH access.

## Code

### `apps/config-manager/app.js`

| Symbol | Type | Role |
|--------|------|------|
| `listEl` | `HTMLElement` | `#configList` — populated `<li>` rows. |
| `statusEl` | `HTMLElement` | `#status` — user-facing messages. |
| `viewPanel`, `viewPanelTitle`, `viewPanelCode`, `viewPanelClose` | elements | Modal sheet DOM for **View**. |
| `setStatus(message, isError?)` | function | Toggles **`.error`** class. |
| `fileNameToId(fileName)` | function | Strips **`.js`** for API id. |
| `loadList()` | `async function` | **`GET /api/configurations`** → JSON array → renders **View / Test / Delete** buttons with **`data-*`** attrs. |
| `escapeHtml` / `escapeAttr` | functions | XSS-safe text insertion. |
| `showConfigSource(fileName)` | `async` | **`GET /db/configs/public/<file>`** as **text** (not JS module) for preview. |
| `openViewPanel` / `closeViewPanel` | functions | Toggles **`hidden`**, **ARIA**, focus. |
| Delete handler | event delegation | **`DELETE /api/configurations/:id`**. |
| **Test** handler | — | Opens **`/factory/?id=:id`** (see file for exact string). |

**Lifecycle:** `loadList()` on DOM ready; click listeners on list container + close button.

**Uses:** **`lib/cloud/configuration-server.js`** routes; static **`/db/configs/public`** for **View** raw source.

### `apps/config-manager/index.html`

Static shell: header, **`#status`**, **`#listContainer` > `#configList`**, **`#viewPanel`** dialog structure — **no inline logic**.
