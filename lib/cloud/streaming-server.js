import { Server } from 'socket.io';

/**
 * Sets up the WebRTC streaming signaling server using Socket.IO.
 * @param {import('http').Server} httpServer - Node HTTP server instance
 */
export function setupStreamingServer(httpServer) {
  const io = new Server(httpServer);

  const streamSenders = new Map();
  const streamViewers = new Map();

  function getAvailableStreams() {
    return Array.from(streamSenders.keys()).sort();
  }

  io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    socket.on('get-available-streams', () => {
      socket.emit('available-streams', {
        streams: getAvailableStreams(),
      });
    });

    socket.on('register-streamer', ({ streamId }) => {
      if (!streamId) return;

      streamSenders.set(streamId, socket.id);
      socket.data.role = 'streamer';
      socket.data.streamId = streamId;

      console.log(`Streamer registered: ${streamId} -> ${socket.id}`);

      io.emit('available-streams', {
        streams: getAvailableStreams(),
      });

      const viewers = streamViewers.get(streamId);
      if (viewers) {
        for (const viewerSocketId of viewers) {
          io.to(viewerSocketId).emit('streamer-available', { streamId });
        }
      }
    });

    socket.on('register-viewer', ({ streamIds }) => {
      if (!Array.isArray(streamIds)) return;

      socket.data.role = 'viewer';
      socket.data.streamIds = streamIds;

      for (const streamId of streamIds) {
        if (!streamViewers.has(streamId)) {
          streamViewers.set(streamId, new Set());
        }
        streamViewers.get(streamId).add(socket.id);

        if (streamSenders.has(streamId)) {
          socket.emit('streamer-available', { streamId });
        }
      }

      console.log(`Viewer ${socket.id} subscribed to: ${streamIds.join(', ')}`);
    });

    socket.on('viewer-request-offer', ({ streamId }) => {
      const streamerSocketId = streamSenders.get(streamId);
      if (!streamerSocketId) return;

      io.to(streamerSocketId).emit('viewer-request-offer', {
        streamId,
        viewerSocketId: socket.id,
      });
    });

    socket.on('offer', ({ streamId, viewerSocketId, offer }) => {
      io.to(viewerSocketId).emit('offer', {
        streamId,
        streamerSocketId: socket.id,
        offer,
      });
    });

    socket.on('answer', ({ streamId, streamerSocketId, answer }) => {
      io.to(streamerSocketId).emit('answer', {
        streamId,
        viewerSocketId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ streamId, targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice-candidate', {
        streamId,
        fromSocketId: socket.id,
        candidate,
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected:', socket.id);

      if (socket.data.role === 'streamer' && socket.data.streamId) {
        const streamId = socket.data.streamId;
        streamSenders.delete(streamId);

        io.emit('available-streams', {
          streams: getAvailableStreams(),
        });

        const viewers = streamViewers.get(streamId);
        if (viewers) {
          for (const viewerSocketId of viewers) {
            io.to(viewerSocketId).emit('streamer-unavailable', { streamId });
          }
        }
      }

      if (socket.data.role === 'viewer' && Array.isArray(socket.data.streamIds)) {
        for (const streamId of socket.data.streamIds) {
          const viewers = streamViewers.get(streamId);
          if (viewers) {
            viewers.delete(socket.id);
            if (viewers.size === 0) {
              streamViewers.delete(streamId);
            }
          }
        }
      }
    });
  });
}
