---
title: Landing (EN & UA)
---

# Landing pages

## Main idea

The **landing** app is the **marketing and navigation hub** for Vision v4. The English page is served at **`/`**; a Ukrainian translation lives at **`/ua`**. Both summarize the platform and link into every major module.

## More detail

### Visual elements (English `/`)

- **Language switcher** — Shows the current locale (`EN`) and a link to the Ukrainian page.
- **Hero** — Product title, subtitle, and an **“All features”** disclosure control that expands a grid of shortcut cards.
- **Feature mini-cards** — Icon + label links to: production demo (`/factory` target as linked), streaming, config manager, config generator, camera stream, image upload, models dashboard, model training, annotator, compare, server detection, server reasoning.
- **System overview** — Prose sections describing real-time detection, batch images, server detection/reasoning, customization, actions, and training workspace.
- **Module cards** — Deep descriptions with **capabilities**, **use cases**, and sometimes **workflows** for: production demo, multi-stream WebRTC, config manager, config generator, camera stream, image upload, model training (+ dashboard), VIA annotator, compare, server detection, server reasoning.
- **Technical grid** — Short blurbs on model, configuration approach, architecture, API integration.
- **Footer** — Version/branding line.

### Visual elements (Ukrainian `/ua`)

Mirrors the English structure with localized copy and the same navigational purpose (language switch back to EN).

## User workflows

1. **Discover** — Open `/`, skim hero and overview.
2. **Jump to a tool** — Click a mini-card or module **Call to action** button (e.g. “Launch Streaming”, “Open Config Generator”).
3. **Compare modules** — Expand “All features” for a compact grid if you already know the name of the destination.
4. **Switch language** — Use the header language control to move between EN and UA landing variants.

**Outcome:** Users never need to memorize URL paths; the landing page is the **single map** of the whole system.

## Code

### `apps/landing/index.html`

- **Head** — `meta` viewport; **styles:** **`/ui-kit/ui-kit.css`**, **`styles.css`**.
- **Body structure** — **`<nav class="lang-switcher">`**: current `EN`, link to **`/ua/`**. **`.container`** → **`.hero`** (`h1`, **`.subtitle`**, **`<details class="features-accordion">`** with **`.features-cards-grid`** of **`<a class="feature-mini-card" href="…">`**). **`<main class="content">`**: **`.intro`**, **`.features`**, **`.modules`** (repeated **`.module-card`** blocks with **`.module-header`**, **`.cta-button`**, lists). **`.footer`**.

**No application JavaScript** — purely **static HTML + CSS**; links are hardcoded paths (`/streaming`, `/factory`, etc.).

### `apps/landing/ua/index.html`

Same component pattern with **Ukrainian** copy and **language link** back to **`/`**.

### `apps/landing/styles.css`

**Variables / rules** — layout for hero, accordion, feature grid, module cards, responsive typography (not enumerated here). **Used only** by landing HTML.

**What uses this code:** **`server/services/hosting-service.js`** **`sendFile`** / **`static(landingPath)`**; **no imports** from `lib/`.
