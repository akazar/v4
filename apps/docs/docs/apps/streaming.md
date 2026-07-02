---
title: Streaming (WebRTC)
---

# Multi-stream WebRTC (`/streaming`)

## Main idea

The **streaming** module orchestrates **multiple live video sources**—device cameras, **HLS (M3U8)** URLs, or **server-captured** regions of external web pages—and displays them in **grid viewers** with optional **frame capture and object recognition** (YOLO/MediaPipe) on the client. Signaling uses **Socket.IO** on the same host as the main server.

## More detail

The experience spans several HTML entry points:

- **Home** (`/streaming/index.html` served at `/streaming`) — create streamers, pick sources, manage selections, save sets, open viewer or **viewer dashboard**, show QR codes for mobile streamers.
- **Streamer** — per-source page that publishes video after the user starts capture.
- **Viewer** — watches **multiple** incoming streams and includes a **Capture & Recognition** strip.
- **Viewer dashboard** — grid-focused layout for many streams with the same recognition affordances as the viewer (served as `dashboard.html` under the streaming app path).
- **Specialized streamer pages** — e.g. M3U8-only or captured-stream helpers for Node or browser workflows.

## Visual elements — Home

- **Page title** — Identifies multi-stream home.
- **Create streamer panel**
  - **Stream name** text field — human label for the source.
  - **Source tabs** — **Local camera**, **M3U8 URL**, **Web capture** (each reveals different inputs).
  - **Local camera tab** — **Streaming type** radio group: **Peer-to-peer WebRTC** vs **WebRTC server streaming** (SFU-style path).
  - **M3U8 tab** — URL field for playlist location.
  - **Web capture tab** — Explainer text; **Page URL**; **CSS selector** for the region to screenshot; **Screenshot interval** milliseconds; separate **streaming type** radios for capture mode.
  - **Create streamer** button — Opens the appropriate streamer URL/window and shows status text.
- **Available streams panel**
  - **Select all**, **Clear selections**, **Open viewer for selected streams**, **Open viewer dashboard**, **Save selected streams** buttons.
  - **Streams list** — Per-stream cards/rows with selection checkboxes, metadata, and actions (e.g. QR, open streamer—depending on client).
  - **Status line** — Viewer-related feedback.
- **Saved streams panel**
  - Hint text explaining that saved sets reopen streamers + dashboard together and that deletions cascade.
  - **Saved sets list** with its own status region.
- **QR modal** — Backdrop, close button, label, and QR target area for scanning streamer URLs on phones.

## Visual elements — Streamer page

- **Info block** — Stream id, streaming mode label, optional source details, status text.
- **Local preview video** — Shows what is being published.
- **Start / Stop camera** buttons — Control capture lifecycle (wording may vary for non-camera sources but pattern is start/stop).

## Visual elements — Viewer page

- **Info block** — Lists requested stream ids.
- **Video grid** — One cell per remote stream with live video.
- **Capture & Recognition zone**
  - Heading and **source label** showing which stream was last captured.
  - **Model select** — MediaPipe vs YOLO for the frozen frame analysis.
  - **Result canvas** — Draws the captured frame with detections.
  - **Summary** — Textual stats or timing for the last capture.

## Visual elements — Viewer dashboard

- **Title** and explanatory note about **modes** query parameters matching stream order (P2P vs server-assisted).
- **Video grid** — Larger dashboard-oriented layout of the same streams, with integrated recognition loop behavior driven by `dashboard.js`.

## User workflows

### A. Multi-camera monitoring

1. On **Home**, enter names and create **camera** streamers for each device (each device opens its streamer tab).
2. Select all streams → **Open viewer dashboard** to watch the wall.
3. Optionally **capture** frames from suspicious feeds and run recognition.

### B. HLS / file-style source

1. Choose **M3U8 URL** tab, paste playlist URL, create streamer.
2. Open viewer with that stream selected alongside cameras.

### C. Web page region streaming

1. Choose **Web capture**, supply page URL + selector + interval.
2. Pick P2P or server streaming mode.
3. Create streamer; viewers see periodic snapshots as a video-like feed (conceptually a screen-region stream).

### D. Mobile publisher

1. Create streamer on desktop; open **QR** to launch the streamer URL on a phone browser.
2. Approve camera on mobile; view from desktop viewer.

### E. Saved presets

1. Select recurring combination (e.g. front door + lobby).
2. **Save selected streams**; later, launch from **Saved streams** to reopen the whole set.

**Outcome:** Vision v4 supports **many simultaneous live contexts** with optional **on-demand** analytics on any single frame.

## Code

### `apps/streaming/home.js`

| Symbol | Role |
|--------|------|
| **`io()`** | Socket.IO client (**default same origin**). |
| **`normalizeStreamName` / `generateStreamId`** | Sanitize labels; random **stream-** ids. |
| **`looksLikeM3u8Url`**, **`streamerPageForSource`** | Route creation to **`streamer.html`**, **`m3u8-streamer.html`**, **captured** URLs, with query params (`streamId`, `mode`, `sourceUrl`, capture fields). |
| **Tab UI** | **`[data-home-source-tab]`** toggles **camera / m3u8 / capture** panels; reads **P2P vs SFU** radios. |
| **Lists** | Renders stream cards into **`#streamsContainer`**; **localStorage** persistence for **saved** sets (see file). |
| **QR modal** | Builds **qrcodejs** canvas for mobile **streamer** URLs. |

### `apps/streaming/streamer.js` (module)

Attaches **local video** track, exchanges **SDP** / ICE via Socket.IO with home/viewer protocol (**see file** for `streamId`, **mode** handling).

### `apps/streaming/viewer.js`

URL **`?streams=a,b`**; **Socket.IO** subscription; **video grid**; **capture** pipeline: grabs frame from selected **`HTMLVideoElement`**, runs **YOLO/MediaPipe** via shared helpers (**`ort`** on page).

### `apps/streaming/dashboard.js`

**Imports:** **`./process.js`** (**`recognizeOnVideoOverlay`**, **`drawDetectionsOnOverlay`**, **config helpers**); **`/lib/scheduled-actions-manager.js`**; **`./dashboard-events/p2p-webrtc.js`**, **`server-webrtc.js`**.

**Query params:** **`streams`**, **`modes`** → **`streamModes` Map** (`p2p` vs `sfu`).

**State:** **`streamState` Map** per **streamId** — video el, overlay canvas, peer connection or SFU logic, **config** (loads **`/db/configs/public/config-default.js`** or discovered list).

**Recognition:** **`shouldUseServerRecognitionForStream`** — SFU + config without **localRecognition** → server-driven detection path.

### `apps/streaming/process.js` (not fully enumerated)

Bridges **video frames** to **recognition** and **overlay** drawing for dashboard/viewer patterns.

### Server pairing

**`server/services/streaming-service.js`** — Socket.IO namespaces, room routing, **`sfu-server-recognition.js`** integration for server-side inferencing.

### Node streamers (optional)

**`apps/streaming/node-streamers/*.js`** — headless publishers for **local file**, **m3u8**, **captured** feeds using **`wrtc`** / same signaling conventions.
