# SyncWave Architecture & Migration Plan

## A. Current Architecture Overview

Currently, SyncWave is a frontend-only React prototype (Vite + Capacitor + Tailwind CSS) simulating multi-user audio synchronization in a single browser or across browser tabs on the same machine.

```
+-----------------------------------------------------------------------+
|                            Browser / Tab                              |
|  +---------------------+   BroadcastChannel   +--------------------+  |
|  |       App.tsx       | <------------------> |    AudioEngine     |  |
|  | (Local React State) |  'syncwave_audio...' |  (Web Audio Synth) |  |
|  +---------------------+                      +--------------------+  |
+-----------------------------------------------------------------------+
```

### Key Components Currently Present:
1. `src/App.tsx`: Manages React state for local playback (`isPlaying`, `positionSec`, `volume`), hardcoded room code (`SYNC-8088`), and mock participants.
2. `src/services/audioEngine.ts`: Uses browser `BroadcastChannel` to pass `PLAY`/`PAUSE`/`SEEK` events locally between tabs. Uses Web Audio API synthesizers for audio playback.
3. `src/services/clockSync.ts`: Implements Christian's NTP algorithm data structure for ping-pong synchronization, but operates on mock data without a real server connection.
4. `src/services/nativeAndroidBridge.ts`: Capacitor plugin bridge calling Android native code.
5. `src/components/`:
   - `RoomManagerModal.tsx`: Displays a fake static SVG QR code and room details.
   - `SourceSelectorModal.tsx`: Displays options for audio input sources including local file upload and system capture.
   - `AudioLatencyMeter.tsx`: Displays simulated latency, jitter, and drift meters.
   - `NativeCodeModal.tsx` & `RequirementsModal.tsx`: Modals presenting static documentation and native Kotlin code bundles.

---

## B. Problems Discovered

1. **No Real Backend**: Rooms, participants, and playback state are held entirely in local React component state.
2. **Local BroadcastChannel**: `BroadcastChannel` is used for tab-to-tab communication, which does not work across different devices or networks.
3. **Hardcoded State**: Room code (`SYNC-8088`) and participants (`You (Host)`, `Alex Rivera`, `Maya Chen`) are hardcoded or randomly generated mock state.
4. **Unsupported/Deprecated Features**:
   - Local MP3/WAV file uploads (`loadCustomAudioFile`).
   - System Audio Capture & PCM streaming (`AudioPlaybackCaptureConfiguration`, `AudioCaptureService`).
   - User-facing latency/drift analytics dashboards (`AudioLatencyMeter.tsx`).
5. **Fake QR Code**: Hardcoded static SVG representation instead of a functional QR code encoding the real room join URL.
6. **No Room Validation / Disconnect Handling**: No real socket events for user presence (`JOIN`, `LEAVE`, `DISCONNECT`, `HOST_CHANGE`).

---

## C. Target Architecture

The target architecture is a **State & Control Synchronization Model** (NOT audio transmission).

```
                      +-----------------------------+
                      |        SyncWave Node.js     |
                      |        WebSocket Server     |
                      |                             |
                      |  - Room Manager             |
                      |  - Participant Presence     |
                      |  - Authoritative Room State |
                      |  - Host Control Validation  |
                      |  - Command Broadcast        |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               | WebSocket (JSON)                          | WebSocket (JSON)
               v                                           v
    +--------------------+                       +--------------------+
    |   Client A (Host)  |                       | Client B (Peer)    |
    |   Android / Web    |                       |   Android / Web    |
    +---------+----------+                       +---------+----------+
              |                                            |
              v                                            v
    Music Service Provider                      Music Service Provider
    (Plays local audio track)                   (Plays local audio track)
              |                                            |
              +---------------------+----------------------+
                                    |
                            SAME TRACK
                            SAME POSITION (timestamped)
                            SAME PLAY/PAUSE STATE
```

### Architectural Principles:
1. **Zero Audio Transmission**: No PCM, WebRTC, Opus, or system audio streaming passes through the backend server.
2. **State & Command Relay**: Backend holds room authority, validates room creation/joining, tracks presence, handles host reassignment, and broadcasts timestamped playback commands (`PLAY`, `PAUSE`, `SEEK`, `TRACK_CHANGE`).
3. **Provider Abstraction**: Isolated music provider interface (`MusicProvider`) controlling local playback.

---

## D. Implementation Plan

### Phase P0 (Current Phase — FOUNDATION / REAL MULTI-USER ROOMS)
- [x] Repository audit & `ARCHITECTURE.md`
- [ ] Create Node.js + Socket.IO / WebSocket backend in `server/`
  - Room manager: `createRoom`, `joinRoom`, `leaveRoom`, `disconnect`, `getRoomState`
  - Host assignment & host transfer on disconnect
  - Participant presence tracking with real device details
- [ ] Implement client-side `socketService` in `src/services/socketService.ts`
- [ ] Replace `BroadcastChannel` with WebSocket socket connection
- [ ] Replace hardcoded `SYNC-8088` with dynamic 6-character room codes (`SW-XXXX`)
- [ ] Replace mock participants with real connected users
- [ ] Update `RoomManagerModal.tsx` to generate real QR code encoding join URL (`window.location.origin?room=SW-XXXX`)
- [ ] Clean up local file upload UI and simulated audio capture references

### Phase P0.5 (PLAYBACK STATE PROTOCOL)
- Backend authoritative playback state structure (`trackId`, `provider`, `status`, `position`, `serverTimestamp`, `hostId`)
- Timestamped synchronization model for `PLAY`, `PAUSE`, `SEEK`, `TRACK_CHANGE`

### Phase P1 (CLOCK SYNCHRONIZATION & PROVIDER ABSTRACTION)
- Client/Server NTP-like clock offset estimation for internal command calculation (hidden from UI)
- Clean `MusicProvider` abstraction interface

### Phase P2 (REAL SYNCHRONIZED PLAYBACK)
- End-to-end synchronized playback execution across connected clients

### Phase P3 (DRIFT CORRECTION)
- Gentle micro-rate adjustments and threshold-based seek alignment

### Phase P4 (ANDROID / CAPACITOR POLISH)
- Native Android background playback controls & lifecycle management without audio capture code

---

## E. Files Created

- `ARCHITECTURE.md`: Architecture specification and migration plan.
- `server/package.json`: Backend dependencies (`express`, `socket.io`, `cors`).
- `server/index.js`: Real-time WebSocket room manager & presence server.
- `src/services/socketService.ts`: Client-side Socket.IO client manager.

---

## F. Files Modified

- `package.json`: Add scripts to start server (`"server": "node server/index.js"`, `"dev:all"`).
- `src/App.tsx`: Connect to real socket server, manage real room lifecycle, dynamic room code and participants.
- `src/components/RoomManagerModal.tsx`: Integrate real room creation/join, real QR code generation, remove mock participants.
- `src/components/PlaybackScreen.tsx`: Update top bar room details to show real socket connection status and room code.
- `src/components/SourceSelectorModal.tsx`: Remove local file upload option.
- `src/types/index.ts`: Clean up types for Socket events, dynamic room state, real participants.

---

## G. Files Removed / Deprecated

- `src/components/AudioLatencyMeter.tsx`: Removed (User-facing analytics/charts non-negotiable directive).
- Local file upload handlers and simulated system audio capture pipelines.
