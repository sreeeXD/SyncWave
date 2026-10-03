import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// In-memory room store: Map<roomCode, Room>
const rooms = new Map();

/**
 * Generate a random 6-character room code (e.g. SW-8492)
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SW-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRoomPublicState(room) {
  const now = Date.now();
  let calculatedPositionSec = room.playbackState.positionSec;

  // Calculate current target position if playing
  if (room.playbackState.isPlaying && room.playbackState.serverTimestamp) {
    const elapsedSec = (now - room.playbackState.serverTimestamp) / 1000;
    calculatedPositionSec += elapsedSec;
  }

  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    isPlaying: room.playbackState.isPlaying,
    currentTrack: room.playbackState.currentTrack,
    positionSec: calculatedPositionSec,
    serverTimestamp: now,
    lastSyncTimestamp: room.playbackState.serverTimestamp,
    participants: Array.from(room.participants.values()),
  };
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);
  let currentRoomCode = null;

  // Handle NTP Clock Synchronization
  socket.on('ntp_ping', (data = {}, callback) => {
    const t1 = Date.now();
    const t0 = data.t0 || t1;
    const t2 = Date.now();
    if (typeof callback === 'function') {
      callback({ t0, t1, t2 });
    } else {
      socket.emit('ntp_pong', { t0, t1, t2 });
    }
  });

  // Handle Room Creation
  socket.on('create_room', (data = {}, callback) => {
    // Enforce max ONE room per socket. If currently in a room, leave it first.
    if (currentRoomCode && rooms.has(currentRoomCode)) {
      console.log(`[Room Lifecycle] Socket ${socket.id} is leaving existing room ${currentRoomCode} before creating a new one.`);
      handleUserExit(socket, currentRoomCode);
    }

    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const deviceModel = data.deviceModel || 'Android Device';
    const osVersion = data.osVersion || 'Android 14';

    const hostParticipant = {
      id: socket.id,
      name: 'Host',
      deviceModel,
      isHost: true,
      avatarColor: 'bg-indigo-600',
      latencyMs: 0,
      driftMs: 0,
      volume: 85,
      isMuted: false,
      isBuffering: false,
      connectionType: 'WiFi 6',
      osVersion,
    };

    const initialTrack = data.initialTrack || {
      id: 'track-1',
      title: 'Neon Horizon (Direct Feed)',
      artist: 'Aether Echoes',
      album: 'Synthetic Dreams 2026',
      sourceApp: 'Spotify Connect',
      sourceType: 'spotify_sync',
      duration: 184,
      colorGradient: 'from-fuchsia-600 via-purple-600 to-indigo-900',
      coverArtTheme: 'neon',
      bpm: 120,
    };

    const newRoom = {
      id: `room-${Date.now()}`,
      code,
      hostId: socket.id,
      createdAt: Date.now(),
      playbackState: {
        trackId: initialTrack.id,
        currentTrack: initialTrack,
        isPlaying: false,
        positionSec: 0,
        serverTimestamp: Date.now(),
      },
      participants: new Map([[socket.id, hostParticipant]]),
    };

    rooms.set(code, newRoom);
    currentRoomCode = code;
    socket.join(code);

    console.log(`[Room Created] Code: ${code} | Host: ${socket.id}`);

    const roomState = getRoomPublicState(newRoom);
    if (typeof callback === 'function') {
      callback({ success: true, roomCode: code, participantId: socket.id, roomState });
    } else {
      socket.emit('room_created', { success: true, roomCode: code, participantId: socket.id, roomState });
    }
  });

  // Handle Room Joining
  socket.on('join_room', (data = {}, callback) => {
    const rawCode = data.roomCode || '';
    const formattedCode = rawCode.trim().toUpperCase();

    if (!rooms.has(formattedCode)) {
      console.log(`[Join Failed] Invalid Room Code: ${formattedCode}`);
      const errRes = { success: false, error: `Room "${formattedCode}" does not exist.` };
      if (typeof callback === 'function') callback(errRes);
      else socket.emit('room_error', errRes);
      return;
    }

    // Enforce max ONE room per socket. If currently in a different room, leave it first.
    if (currentRoomCode && currentRoomCode !== formattedCode && rooms.has(currentRoomCode)) {
      console.log(`[Room Lifecycle] Socket ${socket.id} is leaving existing room ${currentRoomCode} before joining ${formattedCode}.`);
      handleUserExit(socket, currentRoomCode);
    } else if (currentRoomCode === formattedCode && rooms.has(formattedCode)) {
      // Already in this room, just return current state
      console.log(`[Room Lifecycle] Socket ${socket.id} is already in room ${formattedCode}. Returning existing state.`);
      const room = rooms.get(formattedCode);
      const roomState = getRoomPublicState(room);
      if (typeof callback === 'function') {
        callback({ success: true, roomCode: formattedCode, participantId: socket.id, roomState });
      } else {
        socket.emit('room_joined', { success: true, roomCode: formattedCode, participantId: socket.id, roomState });
      }
      return;
    }

    const room = rooms.get(formattedCode);
    const deviceModel = data.deviceModel || 'Android Phone';
    const osVersion = data.osVersion || 'Android 14';
    const isHost = room.participants.size === 0;

    const colors = ['bg-emerald-600', 'bg-purple-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-cyan-600'];
    const randomColor = colors[room.participants.size % colors.length];

    const newParticipant = {
      id: socket.id,
      name: `User ${socket.id.substring(0, 4)}`,
      deviceModel,
      isHost,
      avatarColor: randomColor,
      latencyMs: 12,
      driftMs: 0,
      volume: 80,
      isMuted: false,
      isBuffering: false,
      connectionType: 'WiFi LAN',
      osVersion,
    };

    if (isHost) {
      room.hostId = socket.id;
    }

    room.participants.set(socket.id, newParticipant);
    currentRoomCode = formattedCode;
    socket.join(formattedCode);

    console.log(`[Participant Joined] Room: ${formattedCode} | User: ${socket.id}`);

    const roomState = getRoomPublicState(room);

    if (typeof callback === 'function') {
      callback({ success: true, roomCode: formattedCode, participantId: socket.id, roomState });
    } else {
      socket.emit('room_joined', { success: true, roomCode: formattedCode, participantId: socket.id, roomState });
    }

    // Broadcast room update to all sockets in the room
    io.to(formattedCode).emit('room_updated', roomState);
  });

  // Handle Synchronized Playback Commands (P0.5)
  // Host -> Backend -> All Clients
  socket.on('playback_command', (data = {}, callback) => {
    const code = data.roomCode || currentRoomCode;
    if (!code || !rooms.has(code)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    const room = rooms.get(code);

    // Host Authorization Validation (Rule: Only host can control playback)
    if (socket.id !== room.hostId) {
      console.warn(`[Unauthorized Command] Socket ${socket.id} is not host of Room ${code}`);
      if (typeof callback === 'function') callback({ success: false, error: 'Only the Host can control room playback.' });
      return;
    }

    const now = Date.now();
    const type = data.type; // 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE'

    if (type === 'PLAY') {
      room.playbackState.isPlaying = true;
      room.playbackState.positionSec = typeof data.positionSec === 'number' ? data.positionSec : room.playbackState.positionSec;
      room.playbackState.serverTimestamp = now;
    } else if (type === 'PAUSE') {
      room.playbackState.isPlaying = false;
      room.playbackState.positionSec = typeof data.positionSec === 'number' ? data.positionSec : room.playbackState.positionSec;
      room.playbackState.serverTimestamp = now;
    } else if (type === 'SEEK') {
      room.playbackState.positionSec = typeof data.positionSec === 'number' ? data.positionSec : 0;
      room.playbackState.serverTimestamp = now;
    } else if (type === 'TRACK_CHANGE' && data.track) {
      room.playbackState.currentTrack = data.track;
      room.playbackState.trackId = data.track.id;
      room.playbackState.positionSec = 0;
      room.playbackState.serverTimestamp = now;
    }

    console.log(`[Playback Command] Room: ${code} | Type: ${type} | Pos: ${room.playbackState.positionSec}s | Track: ${room.playbackState.currentTrack.title}`);

    const commandPayload = {
      type,
      roomCode: code,
      hostId: room.hostId,
      trackId: room.playbackState.currentTrack.id,
      currentTrack: room.playbackState.currentTrack,
      isPlaying: room.playbackState.isPlaying,
      positionSec: room.playbackState.positionSec,
      serverTimestamp: now,
    };

    // Broadcast command payload with authoritative server timestamp to ALL room clients
    io.to(code).emit('playback_command', commandPayload);

    if (typeof callback === 'function') {
      callback({ success: true, command: commandPayload });
    }
  });

  // Handle Leaving Room
  socket.on('leave_room', (data = {}, callback) => {
    const code = data.roomCode || currentRoomCode;
    if (code && rooms.has(code)) {
      handleUserExit(socket, code);
    }
    if (typeof callback === 'function') callback({ success: true });
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    if (currentRoomCode && rooms.has(currentRoomCode)) {
      handleUserExit(socket, currentRoomCode);
    } else {
      rooms.forEach((room, code) => {
        if (room.participants.has(socket.id)) {
          handleUserExit(socket, code);
        }
      });
    }
  });
});

function handleUserExit(socket, code) {
  const room = rooms.get(code);
  if (!room) return;

  room.participants.delete(socket.id);
  socket.leave(code);

  console.log(`[User Left] Room: ${code} | User: ${socket.id}`);

  if (room.participants.size === 0) {
    console.log(`[Room Destroyed] Room: ${code} is now empty`);
    rooms.delete(code);
  } else {
    // If host left, assign host to first remaining participant
    if (room.hostId === socket.id) {
      const firstParticipant = room.participants.values().next().value;
      firstParticipant.isHost = true;
      room.hostId = firstParticipant.id;
      console.log(`[Host Reassigned] Room: ${code} | New Host: ${firstParticipant.id}`);
      io.to(code).emit('host_changed', { newHostId: firstParticipant.id, hostName: firstParticipant.name });
    }

    const roomState = getRoomPublicState(room);
    io.to(code).emit('room_updated', roomState);
  }
}

app.get('/', (req, res) => {
  res.json({
    name: 'SyncWave Real-Time WebSocket Server',
    status: 'online',
    activeRooms: rooms.size,
    timestamp: Date.now(),
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SyncWave Backend Server running on port ${PORT}`);
  console.log(`==================================================\n`);
});
