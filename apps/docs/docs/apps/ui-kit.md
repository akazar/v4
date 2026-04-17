---
title: UI kit
---

# Shared UI kit (`apps/ui-kit`)

## Main idea

**`apps/ui-kit/ui-kit.css`** is a **shared design layer** for Vision v4 browser apps. It is mounted at **`/ui-kit`** so every page can link **`/ui-kit/ui-kit.css`** and receive consistent colors, typography, spacing, and component styling.

## More detail

The UI kit is **not** a separate application with its own workflow; it is a **stylesheet module** consumed by landing, streaming, training, config tools, compare, and other pages.

## Functional details

| Function | Benefit |
|----------|---------|
| **Visual consistency** | Buttons, panels, links, and status regions look related across disparate tools. |
| **Faster page authoring** | New apps can adopt the same tokens without copying one-off CSS from another folder. |
| **Theming hooks** | Central variables (e.g. muted text, surfaces) keep dark/light or brand tweaks localized. |

## User workflows

There is **no end-user workflow** beyond the fact that when you open any app that references the kit, your experience **inherits** these styles automatically. Developers change the kit when they want a **cross-app** visual update.

## Code

### `apps/ui-kit/ui-kit.css`

**Role:** Global **design tokens** (CSS variables on `:root`), resets, typography utility classes, button styles, form controls, cards — consumed via **`<link rel="stylesheet" href="/ui-kit/ui-kit.css">`**.

**Parameters:** none (not a script). **Selectors** target shared class names (e.g. `.btn`, theme colors).

**Hosting:** `express.static` mount **`/ui-kit`** → **`apps/ui-kit`** (`server/hosting-server.js`), guaranteeing **`/ui-kit/ui-kit.css`** resolves even when generic `apps` static order would not.

**Used by:** `apps/landing`, `apps/camera-stream`, `apps/config-creator`, `apps/streaming` HTML shells, etc.

**Consumers in repo:** search **`ui-kit.css`** in `apps/**` HTML.
