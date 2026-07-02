/**
 * API for the captured-stream demo: Puppeteer opens a URL, screenshots a CSS-selected
 * element on an interval, and serves the latest frame to the browser for a video-like preview.
 */
import express from 'express';
import { randomBytes } from 'node:crypto';
import puppeteer from 'puppeteer';

const jsonParser = express.json({ limit: '32kb' });

function makeSessionId() {
  return randomBytes(16).toString('hex');
}

function isAllowedPageUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

function clampIntervalMs(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1000;
  return Math.min(60_000, Math.max(200, Math.round(x)));
}

/** JPEG bytes or base64 string → data URL (handles Buffer, Uint8Array, arrays — not Array.toString). */
function jpegToDataUrl(screenshotResult) {
  if (typeof screenshotResult === 'string') {
    if (screenshotResult.startsWith('data:')) return screenshotResult;
    return `data:image/jpeg;base64,${screenshotResult}`;
  }
  if (Buffer.isBuffer(screenshotResult)) {
    return `data:image/jpeg;base64,${screenshotResult.toString('base64')}`;
  }
  return `data:image/jpeg;base64,${Buffer.from(screenshotResult).toString('base64')}`;
}

/**
 * @param {import('express').Express} app
 */
export function setupCapturedStreamService(app) {
  const sessions = new Map();

  async function destroySession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.stopped = true;
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
    try {
      await session.browser?.close();
    } catch {
      /* ignore */
    }
    sessions.delete(sessionId);
  }

  async function runCapture(session) {
    if (session.stopped || session.captureBusy) return;
    session.captureBusy = true;
    try {
      const { page, selector } = session;
      const el = await page.$(selector);
      if (!el) {
        session.lastError = `Selector matched no element: ${selector}`;
        return;
      }
      const shot = await el.screenshot({
        type: 'jpeg',
        quality: 78,
        encoding: 'base64',
      });
      session.lastError = null;
      session.frameSeq += 1;
      session.lastFrame = {
        image: jpegToDataUrl(shot),
        seq: session.frameSeq,
      };
    } catch (err) {
      session.lastError = err?.message || String(err);
    } finally {
      session.captureBusy = false;
    }
  }

  app.post('/api/captured-stream/start', jsonParser, async (req, res) => {
    const pageUrl = req.body?.pageUrl ?? req.body?.url;
    const selector = typeof req.body?.selector === 'string' ? req.body.selector.trim() : '';
    const intervalMs = clampIntervalMs(req.body?.intervalMs ?? req.body?.interval);

    if (!isAllowedPageUrl(pageUrl)) {
      return res.status(400).json({ error: 'Invalid or missing page URL (http/https only).' });
    }
    if (!selector) {
      return res.status(400).json({ error: 'CSS selector is required.' });
    }

    const sessionId = makeSessionId();
    let browser;

    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

      await page.goto(pageUrl.trim(), {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await page.waitForSelector(selector, {
        timeout: 30_000,
        state: 'attached',
      });

      const session = {
        browser,
        page,
        selector,
        intervalMs,
        timer: null,
        stopped: false,
        captureBusy: false,
        frameSeq: 0,
        lastFrame: null,
        lastError: null,
      };

      sessions.set(sessionId, session);

      session.timer = setInterval(() => {
        runCapture(session);
      }, intervalMs);

      await runCapture(session);

      return res.json({ sessionId, intervalMs });
    } catch (err) {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
      }
      const message = err?.message || String(err);
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/captured-stream/frame/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      seq: session.frameSeq,
      image: session.lastFrame?.image ?? null,
      error: session.lastError,
    });
  });

  app.post('/api/captured-stream/stop/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    if (!sessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    await destroySession(sessionId);
    return res.json({ ok: true });
  });
}
