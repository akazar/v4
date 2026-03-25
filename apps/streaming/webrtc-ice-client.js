/**
 * ICE list from the signaling server (env-driven TURN/STUN). Used by streamer, dashboard, viewer.
 */

const DEFAULT = [{ urls: 'stun:stun.l.google.com:19302' }];

let iceServers = DEFAULT;

/**
 * @param {import('socket.io-client').Socket} socket
 */
export function attachWebRtcIceFromServer(socket) {
  socket.on('webrtc-ice-servers', ({ iceServers: servers }) => {
    if (Array.isArray(servers) && servers.length > 0) {
      iceServers = servers;
    }
  });
}

export function getIceServers() {
  return iceServers;
}
