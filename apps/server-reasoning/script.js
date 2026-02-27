/**
 * Server-reasoning client: load image from file or URL, send to POST /api/reasoning
 * with prompt and model (ChatGPT/Gemini), then show the reasoning text.
 */

import CONFIG from '../../config/config.js';
import { toDataUrl } from '../../lib/edge/image-format.js';

/** Base URL for POST /api/reasoning. Default '' = same origin (main server). Override via CONFIG.reasoningServerUrl. */
const REASONING_SERVER_URL = CONFIG.reasoning?.reasoningServerUrl ?? '';
const DEFAULT_PROMPT = CONFIG.reasoning?.prompt ?? 'Describe this image in detail.';

const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const promptInput = document.getElementById('promptInput');
const modelSelect = document.getElementById('modelSelect');
const reasoningBtn = document.getElementById('reasoningBtn');
const reasoningResultText = document.getElementById('reasoningResultText');

/** Current image source: File (from file input) or HTMLImageElement (from URL). */
let currentImageSource = null;

/**
 * Load image from URL into an HTMLImageElement and set as current source.
 */
function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            currentImageSource = img;
            resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load image from URL'));
        img.src = url;
    });
}

/**
 * Run reasoning via POST /api/reasoning and return the reasoning text.
 */
async function runReasoning(imageSource, model, prompt) {
    try {
        const imageBase64 = await toDataUrl(imageSource);
        const res = await fetch(`${REASONING_SERVER_URL}/api/reasoning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt || DEFAULT_PROMPT,
                imageBase64,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            const msg = data.error || res.statusText || 'Request failed';
            throw new Error(msg);
        }
        return data.reasoning ?? '';
    } catch (err) {
        console.error('Reasoning error:', err);
        throw err;
    }
}

/**
 * File selected.
 */
fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
        currentImageSource = file;
        urlInput.value = '';
    }
});

/**
 * Load image from URL input if present. Returns true to proceed, false to stop (e.g. load error).
 */
async function ensureImageSourceFromUrl() {
    const url = urlInput.value?.trim();
    if (!url) return true;
    try {
        await loadImageFromUrl(url);
        return true;
    } catch (e) {
        alert('Could not load image from URL. ' + (e.message || ''));
        return false;
    }
}

/**
 * Reasoning button clicked.
 */
reasoningBtn.addEventListener('click', async () => {
    if (!(await ensureImageSourceFromUrl())) return;
    if (!currentImageSource) {
        reasoningResultText.textContent = 'Please load an image (file or URL) first.';
        return;
    }
    reasoningResultText.textContent = '…';
    reasoningBtn.disabled = true;
    try {
        const model = modelSelect.value ?? 'chatgpt';
        const result = await runReasoning(currentImageSource, model, promptInput.value?.trim() || DEFAULT_PROMPT);
        reasoningResultText.textContent = result || '(No response)';
    } catch (err) {
        reasoningResultText.textContent = 'Reasoning failed: ' + (err?.message || 'Unknown error');
    } finally {
        reasoningBtn.disabled = false;
    }
});
