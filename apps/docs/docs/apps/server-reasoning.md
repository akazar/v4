---
title: Server reasoning
---

# Server reasoning (`/server-reasoning`)

## Main idea

**Server reasoning** sends an **image plus a text prompt** to the backend, which calls a **vision-capable chat model** (OpenAI ChatGPT family or Google Gemini). The textual answer appears on the page—useful for captions, Q&A, and open-ended analysis.

## More detail

Requires the main server and properly configured **API keys** in `.env`. This UI does not run local YOLO/MediaPipe.

## Visual elements

- **Title & description** — Explains image + reasoning flow.
- **Model selector** — Chooses ChatGPT vs Gemini backends (labels may reflect marketing names).
- **File input** — Image upload.
- **URL input** — Optional remote image.
- **Prompt field** — Free-text instructions (default placeholder suggests descriptive analysis).
- **Reasoning button** — Submits the request; shows loading state implicitly via eventual text.
- **Result text region** — Read-only paragraph area for the model response.

## User workflows

1. **Verify credentials** — Confirm provider keys exist server-side.
2. **Pick provider** — Select ChatGPT or Gemini.
3. **Attach image** — Upload or link an image.
4. **Compose prompt** — Ask a specific question (“Count red objects”) or request a narrative description.
5. **Run** — Click **Reasoning**; read the response in the result area.
6. **Iterate** — Adjust prompt or image and repeat.

**Outcome:** Non-technical reviewers can **ask questions** about a scene without running detectors, while engineers can **smoke-test** reasoning endpoints.

## Code

### `apps/server-reasoning/script.js`

| Constant | Meaning |
|----------|---------|
| **`REASONING_SERVER_URL`** | `CONFIG.serverReasoning?.reasoningServerUrl ?? ''` |
| **`DEFAULT_PROMPT`** | `CONFIG.serverReasoning?.prompt ?? 'Describe…'` |

**`loadImageFromUrl(url)`** — **`new Image()`**, **`crossOrigin = 'anonymous'`**, sets **`currentImageSource`**.

**`runReasoning(imageSource, model, prompt)`** — converts **`imageSource`** with **`toDataUrl`** to **`imageBase64`**, then **`POST`**s to **`…/api/reasoning`** with JSON properties **`model`**, **`prompt`**, and **`imageBase64`**; returns **`data.reasoning`**; throws when **`res.ok`** is false.

**Server counterpart:** **`lib/cloud/reasoning-server.js`** — reads **`GEMINI_API_KEY` / `OPENAI_API_KEY`**, **`parseModelSelector`**, vision calls.

**DOM:** `#fileInput`, `#urlInput`, `#promptInput`, `#modelSelect`, `#reasoningBtn`, `#reasoningResultText`.
