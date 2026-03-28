const pageUrlInput = document.getElementById('pageUrlInput');
const selectorInput = document.getElementById('selectorInput');
const intervalInput = document.getElementById('intervalInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const capturePreview = document.getElementById('capturePreview');

let sessionId = null;
let pollTimer = null;
let lastSeq = -1;

function setStatus(text) {
  statusEl.textContent = text;
}

function clampPollMs(intervalMs) {
  return Math.min(250, Math.max(100, Math.floor(intervalMs / 2)));
}

async function stopCapture() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const id = sessionId;
  sessionId = null;
  if (id) {
    try {
      await fetch(`/api/captured-stream/stop/${id}`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }
  lastSeq = -1;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Stopped.');
}

function startPolling(intervalMs) {
  if (pollTimer) clearInterval(pollTimer);
  const pollEvery = clampPollMs(intervalMs);
  pollTimer = setInterval(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/captured-stream/frame/${sessionId}`);
      if (r.status === 404) {
        setStatus('Session no longer exists on the server.');
        stopCapture();
        return;
      }
      if (!r.ok) {
        setStatus(`Frame request failed (${r.status}).`);
        return;
      }
      const j = await r.json();
      if (j.error) {
        setStatus(`Capture: ${j.error}`);
      } else if (j.seq > 0 && !j.error) {
        setStatus(`Live · frame ${j.seq}`);
      }
      if (j.image && j.seq !== lastSeq) {
        lastSeq = j.seq;
        capturePreview.src = j.image;
      }
    } catch (e) {
      setStatus(`Network error: ${e.message}`);
    }
  }, pollEvery);
}

startBtn.addEventListener('click', async () => {
  const pageUrl = pageUrlInput.value.trim();
  const selector = selectorInput.value.trim();
  const intervalMs = Number(intervalInput.value);

  if (!pageUrl || !selector) {
    setStatus('Page URL and CSS selector are required.');
    return;
  }
  if (!Number.isFinite(intervalMs) || intervalMs < 200 || intervalMs > 60000) {
    setStatus('Interval must be between 200 and 60000 ms.');
    return;
  }

  await stopCapture();

  setStatus('Starting Puppeteer (server)…');
  startBtn.disabled = true;

  try {
    const r = await fetch('/api/captured-stream/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageUrl, selector, intervalMs }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setStatus(`Error: ${j.error || r.statusText}`);
      startBtn.disabled = false;
      return;
    }
    sessionId = j.sessionId;
    lastSeq = -1;
    stopBtn.disabled = false;
    const usedInterval = j.intervalMs ?? intervalMs;
    setStatus('Session started. Waiting for frames…');
    startPolling(usedInterval);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  stopCapture();
});

window.addEventListener('beforeunload', () => {
  if (sessionId) {
    fetch(`/api/captured-stream/stop/${sessionId}`, { method: 'POST', keepalive: true });
  }
});
