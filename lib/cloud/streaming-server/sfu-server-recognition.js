/**
 * Server-side object detection on SFU publisher video: I420 frames → JPEG → lib/cloud/recognition,
 * then Socket.IO emit to subscribers. Optional max dimensions align with lib/edge/source-to-canvas.js scaling idea.
 */

import path from 'path';
import { pathToFileURL } from 'url';
import { scaleDetectionsToVideo } from '../../edge/source-to-canvas.js';
import { i420FrameToJpegDataUrl } from './i420-jpeg.js';
import { recognize as recognizeYolo } from '../recognition/yolo/recognize-yolo.mjs';
import { recognize as recognizeMediapipe } from '../recognition/mediapipe/recognize-mediapipe.js';
import { serverRecognitionActions } from '../action-servers/actions-runner.js';
import { createScheduledActionsManager } from '../../scheduled-actions-manager.js';

const ROOM_PREFIX = 'sfu-srvrec:';
const scheduledActionsManager = createScheduledActionsManager();

/** @type {{ getSession: (streamId: string) => { publisherStream?: import('wrtc').MediaStream | null } | undefined, wrtc: object | null }} */
let recognitionDeps = {
  getSession: () => undefined,
  wrtc: null,
};

let mediapipeSfuWarned = false;

/** @type {Map<string, {
 *   refCount: number,
 *   intervalId: ReturnType<typeof setInterval> | null,
 *   sink: { stop: () => void } | null,
 *   latestFrame: { width: number, height: number, data: Uint8Array } | null,
 *   busy: boolean,
 *   fullConfig: object,
 *   streamId: string,
 * }>} */
const recognitionByStream = new Map();

function getProjectRoot() {
  return process.cwd();
}

/**
 * @param {string} configPath - URL path e.g. /config/public/config-dashboard.js
 */
export function resolvePublicConfigFile(configPath) {
  if (!configPath || typeof configPath !== 'string') return null;
  const trimmed = configPath.trim();
  const withoutLead = trimmed.replace(/^\/+/, '');
  const abs = path.normalize(path.join(getProjectRoot(), withoutLead));
  const publicDir = path.normalize(path.join(getProjectRoot(), 'config', 'public'));
  const rel = path.relative(publicDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (!abs.endsWith('.js')) return null;
  return abs;
}

export async function loadPublicStreamConfig(configPath) {
  const abs = resolvePublicConfigFile(configPath);
  if (!abs) throw new Error('Invalid config path');
  const mod = await import(pathToFileURL(abs).href);
  return mod.default ?? mod.CONFIG;
}

function usesServerRecognition(cfg) {
  return (
    cfg &&
    typeof cfg === 'object' &&
    cfg.serverRecognition != null &&
    typeof cfg.serverRecognition === 'object'
  );
}

function postProcessDetections(detections, sr) {
  if (!Array.isArray(detections)) return [];
  let d = detections;
  if (sr?.classes?.length) {
    const set = new Set(sr.classes.map((c) => String(c).toLowerCase()));
    d = d.filter((x) => set.has(String(x.class).toLowerCase()));
  }
  const max = sr?.maxResults ?? 10;
  return d
    .slice()
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, max);
}

function configNameFromPath(configPath) {
  if (!configPath || typeof configPath !== 'string') return null;
  const fileName = configPath.split('/').filter(Boolean).pop();
  if (!fileName) return null;
  if (!fileName.endsWith('.js') && !fileName.endsWith('.json')) return null;
  return fileName.replace(/\.(js|json)$/i, '');
}

/**
 * @param {import('socket.io').Server} io
 * @param {{ getSession: (streamId: string) => { publisherStream: import('wrtc').MediaStream | null } | undefined, wrtc: typeof import('@roamhq/wrtc') | null }} deps
 */
export function registerSfuServerRecognition(io, deps) {
  recognitionDeps = deps;
  const { getSession, wrtc } = deps;
  const RTCVideoSink = wrtc?.nonstandard?.RTCVideoSink;
  const i420ToRgba = wrtc?.nonstandard?.i420ToRgba;

  function stopRecognition(streamId) {
    const st = recognitionByStream.get(streamId);
    if (!st) return;
    if (st.intervalId) {
      clearInterval(st.intervalId);
      st.intervalId = null;
    }
    if (st.sink) {
      try {
        st.sink.stop();
      } catch {
        /* ignore */
      }
      st.sink = null;
    }
    st.latestFrame = null;
    recognitionByStream.delete(streamId);
  }

  function decRef(streamId) {
    const st = recognitionByStream.get(streamId);
    if (!st) return;
    st.refCount -= 1;
    if (st.refCount <= 0) {
      stopRecognition(streamId);
    }
  }

  async function runRecognitionTick(streamId, st) {
    if (st.busy || !st.latestFrame) return;
    const frame = st.latestFrame;
    const cfg = st.fullConfig;
    const sr = cfg?.serverRecognition;
    if (!sr) return;

    st.busy = true;
    try {
      if (!i420ToRgba || !RTCVideoSink) return;

      const maxCap = sr.maxCaptureSize ?? sr.maxWidth;
      const maxW = typeof maxCap === 'number' ? maxCap : 1280;
      const maxH = typeof sr.maxCaptureHeight === 'number' ? sr.maxCaptureHeight : maxW;

      const { dataUrl, jpegWidth, jpegHeight, frameWidth, frameHeight } =
        await i420FrameToJpegDataUrl(frame, i420ToRgba, {
          maxWidth: maxW,
          maxHeight: maxH,
          jpegQuality: 85,
        });

      const recognize =
        sr.model === 'MEDIAPIPE' ? recognizeMediapipe : recognizeYolo;
      if (sr.model === 'MEDIAPIPE' && !mediapipeSfuWarned) {
        mediapipeSfuWarned = true;
        console.warn(
          '[SFU recognition] MEDIAPIPE runs a full Puppeteer session per frame; prefer YOLO for interval recognition.'
        );
      }

      let detections = await recognize(dataUrl, cfg);
      if (detections && typeof detections === 'object' && !Array.isArray(detections)) {
        detections = Array.isArray(detections.out) ? detections.out : [];
      }
      detections = postProcessDetections(detections, sr);
      await scheduledActionsManager.process(streamId, detections);
      const sourceLike = { width: jpegWidth, height: jpegHeight };
      const videoLike = { videoWidth: frameWidth, videoHeight: frameHeight };
      const scaled = scaleDetectionsToVideo(detections, sourceLike, videoLike);

      // const actionFns = cfg?.serverRecognitionActionFunctions;
      // if (Array.isArray(actionFns) && actionFns.length > 0) {
      //   await serverRecognitionActions(scaled, actionFns);
      // }

      io.to(`${ROOM_PREFIX}${streamId}`).emit('sfu-server-recognition', {
        streamId,
        detections: scaled,
        videoWidth: frameWidth,
        videoHeight: frameHeight,
      });
    } catch (err) {
      console.error('[SFU recognition]', streamId, err?.message || err);
    } finally {
      st.busy = false;
    }
  }

  function ensureRecognitionLoop(streamId, fullConfig) {
    const session = recognitionDeps.getSession(streamId);
    const ms = fullConfig?.serverRecognition?.interval ?? 1000;
    const videoTracks = session?.publisherStream?.getVideoTracks?.() ?? [];
    const track = videoTracks[0];
    if (!track || !RTCVideoSink || !i420ToRgba) {
      return;
    }

    let st = recognitionByStream.get(streamId);
    if (!st) {
      st = {
        refCount: 0,
        intervalId: null,
        sink: null,
        latestFrame: null,
        busy: false,
        fullConfig,
        streamId,
      };
      recognitionByStream.set(streamId, st);
    }

    st.fullConfig = fullConfig;

    if (!st.sink) {
      const sink = new RTCVideoSink(track);
      st.sink = sink;
      sink.onframe = ({ frame }) => {
        const s = recognitionByStream.get(streamId);
        if (!s || !frame?.data) return;
        s.latestFrame = {
          width: frame.width,
          height: frame.height,
          data: new Uint8Array(frame.data),
        };
      };
    }

    if (st.intervalId) {
      clearInterval(st.intervalId);
    }
    st.intervalId = setInterval(() => {
      void runRecognitionTick(streamId, st);
    }, Math.max(200, Number(ms) || 1000));
  }

  io.on('connection', (socket) => {
    socket.on('sfu-server-recognition-subscribe', async ({ streamId, configPath, configName }) => {
      if (!streamId || !configPath) return;
      if (!wrtc || !RTCVideoSink || !i420ToRgba) {
        socket.emit('sfu-server-recognition-error', {
          streamId,
          message: 'Server WebRTC / video sink unavailable',
        });
        return;
      }
      const session = recognitionDeps.getSession(streamId);
      if (!session?.publisherStream) {
        socket.emit('sfu-server-recognition-error', {
          streamId,
          message: 'Stream not active on server yet',
        });
        return;
      }

      try {
        const resolvedConfigName = configName || configNameFromPath(configPath);
        if (resolvedConfigName) {
          await scheduledActionsManager.register(streamId, resolvedConfigName);
        }
        const cfg = await loadPublicStreamConfig(configPath);
        if (!usesServerRecognition(cfg)) {
          socket.emit('sfu-server-recognition-error', {
            streamId,
            message: 'Config has no serverRecognition',
          });
          return;
        }

        if (socket.data.sfuServerRecStreams?.has(streamId)) {
          const st = recognitionByStream.get(streamId);
          if (st) {
            st.fullConfig = cfg;
            ensureRecognitionLoop(streamId, cfg);
          }
          socket.emit('sfu-server-recognition-ready', { streamId });
          return;
        }

        socket.join(`${ROOM_PREFIX}${streamId}`);
        if (!socket.data.sfuServerRecStreams) {
          socket.data.sfuServerRecStreams = new Set();
        }
        socket.data.sfuServerRecStreams.add(streamId);

        let st = recognitionByStream.get(streamId);
        if (st) {
          st.refCount += 1;
        } else {
          st = {
            refCount: 1,
            intervalId: null,
            sink: null,
            latestFrame: null,
            busy: false,
            fullConfig: cfg,
            streamId,
          };
          recognitionByStream.set(streamId, st);
        }
        st.fullConfig = cfg;
        ensureRecognitionLoop(streamId, cfg);

        socket.emit('sfu-server-recognition-ready', { streamId });
      } catch (err) {
        console.error('[SFU recognition] subscribe', err);
        socket.emit('sfu-server-recognition-error', {
          streamId,
          message: String(err?.message || err),
        });
      }
    });

    socket.on('sfu-server-recognition-unsubscribe', ({ streamId }) => {
      if (!streamId) return;
      socket.leave(`${ROOM_PREFIX}${streamId}`);
      if (socket.data.sfuServerRecStreams) {
        socket.data.sfuServerRecStreams.delete(streamId);
      }
      decRef(streamId);
    });

    socket.on('disconnect', () => {
      const set = socket.data.sfuServerRecStreams;
      if (!(set instanceof Set)) return;
      for (const sid of set) {
        decRef(sid);
      }
      socket.data.sfuServerRecStreams = null;
    });
  });
}

/**
 * Stop recognition when SFU session is torn down (publisher left).
 * @param {string} streamId
 */
export function stopSfuServerRecognitionForStream(streamId) {
  const st = recognitionByStream.get(streamId);
  if (!st) return;
  if (st.intervalId) {
    clearInterval(st.intervalId);
    st.intervalId = null;
  }
  if (st.sink) {
    try {
      st.sink.stop();
    } catch {
      /* ignore */
    }
    st.sink = null;
  }
  st.latestFrame = null;
  recognitionByStream.delete(streamId);
}

/**
 * After publisher media is (re)attached, rebind the video sink so frames keep flowing.
 * @param {string} streamId
 */
export function notifySfuPublisherMediaUpdated(streamId) {
  const st = recognitionByStream.get(streamId);
  if (!st || st.refCount <= 0) return;

  const wrtc = recognitionDeps.wrtc;
  const RTCVideoSink = wrtc?.nonstandard?.RTCVideoSink;
  if (!RTCVideoSink) return;

  const session = recognitionDeps.getSession(streamId);
  const track = session?.publisherStream?.getVideoTracks?.()?.[0];
  if (!track) return;

  if (st.sink) {
    try {
      st.sink.stop();
    } catch {
      /* ignore */
    }
    st.sink = null;
  }

  const sink = new RTCVideoSink(track);
  st.sink = sink;
  sink.onframe = ({ frame }) => {
    const s = recognitionByStream.get(streamId);
    if (!s || !frame?.data) return;
    s.latestFrame = {
      width: frame.width,
      height: frame.height,
      data: new Uint8Array(frame.data),
    };
  };
}
