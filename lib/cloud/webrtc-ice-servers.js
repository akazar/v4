/**
 * ICE server list for browser and Node (@roamhq/wrtc) PeerConnections.
 *
 * On hosts like Render.com, inbound UDP to your web service is not available, so
 * server-side WebRTC (SFU) cannot be reached via host/srflx candidates alone.
 * Set TURN (or WEBRTC_ICE_SERVERS) so media relays through a TURN provider.
 */

const DEFAULT_STUN = { urls: 'stun:stun.l.google.com:19302' };

let warnedRender = false;

/** @returns {RTCIceServer[]} */
export function getWebRtcIceServers() {
  const raw = process.env.WEBRTC_ICE_SERVERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('[WebRTC] WEBRTC_ICE_SERVERS is not valid JSON:', e.message);
    }
  }

  const servers = [DEFAULT_STUN];
  const turnUrls = process.env.TURN_URLS;
  const turnUser = process.env.TURN_USERNAME;
  const turnCred = process.env.TURN_CREDENTIAL;
  if (turnUrls && turnUser != null && turnCred != null) {
    const urls = turnUrls.split(',').map((s) => s.trim()).filter(Boolean);
    if (urls.length > 0) {
      servers.push({
        urls,
        username: turnUser,
        credential: turnCred,
      });
    }
  }
  return servers;
}

export function logWebRtcDeploymentHint() {
  if (warnedRender) return;
  const onRender = process.env.RENDER === 'true' || process.env.RENDER === '1';
  if (!onRender) return;
  const hasTurn =
    !!process.env.TURN_URLS ||
    (process.env.WEBRTC_ICE_SERVERS &&
      /turns?:/i.test(process.env.WEBRTC_ICE_SERVERS));
  if (hasTurn) return;
  warnedRender = true;
  console.warn(
    '[WebRTC] Detected Render: SFU/server streaming needs TURN (inbound UDP is not routed to web services). ' +
      'Set TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL or WEBRTC_ICE_SERVERS. ' +
      'See https://community.render.com/t/webrtc-udp-server-possible-the-render-com-server-will-be-the-central-peer/4109'
  );
}
