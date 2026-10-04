import React, { useState, useEffect, useCallback } from 'react';
import { globalAudioEngine, PRESET_TRACKS } from './services/audioEngine';
import { globalClockSync } from './services/clockSync';
import { AudioTrack, Participant, RoomState } from './types';
import { AndroidDeviceFrame } from './components/AndroidDeviceFrame';
import { PlaybackScreen } from './components/PlaybackScreen';
import { SourceSelectorModal } from './components/SourceSelectorModal';
import { RoomManagerModal } from './components/RoomManagerModal';
import { socketService, PlaybackCommandPayload } from './services/socketService';
import {
  getNativeDeviceStatus,
  openMusicReaderSettings,
} from './services/nativeAndroidBridge';
import { ShieldAlert } from 'lucide-react';

export type RoomConnectionStatus = 'no_room' | 'joining' | 'connected' | 'error';

export default function App() {
  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(PRESET_TRACKS[0]);
  const [positionSec, setPositionSec] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);

  // Native Device State
  const [isNative, setIsNative] = useState<boolean>(false);
  const [deviceModel, setDeviceModel] = useState<string>('Browser Client');
  const [osVersion, setOsVersion] = useState<string>('Web Version');
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(true);

  // Real Socket Room Lifecycle State (Explicit Room State Model)
  const [roomConnectionStatus, setRoomConnectionStatus] = useState<RoomConnectionStatus>('no_room');
  const [roomCode, setRoomCode] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');

  // Modals
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState<boolean>(false);
  const [isRoomManagerOpen, setIsRoomManagerOpen] = useState<boolean>(false);

  // Determine if this device is the current room host
  const currentParticipant = participants.find((p) => p.id === currentUserId);
  const isHost = currentParticipant?.isHost ?? false;

  // 1. Initialize Socket Connection & Native Device Info (NO AUTO ROOM CREATION)
  useEffect(() => {
    let isMounted = true;

    let unsubscribeConn: (() => void) | null = null;

    const init = async () => {
      const nativeStatus = await getNativeDeviceStatus();
      if (!isMounted) return;

      let devModel = 'Browser Client';
      let devOs = 'Web Version';

      if (nativeStatus.isNativeAndroid) {
        setIsNative(true);
        devModel = nativeStatus.deviceModel || 'Android Phone';
        devOs = nativeStatus.osVersion || 'Android 14';
        setHasNotificationPermission(nativeStatus.isNotificationPermissionGranted);
      } else {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) devModel = 'Android Chrome';
        else if (/iPhone|iPad/i.test(ua)) devModel = 'iOS Safari';
        else if (/Mac/i.test(ua)) devModel = 'Mac Chrome';
        else if (/Windows/i.test(ua)) devModel = 'Windows Client';
      }

      setDeviceModel(devModel);
      setOsVersion(devOs);

      // Connect Socket & Subscribe to connection status changes
      const socket = socketService.connect();
      if (socket.id) {
        setCurrentUserId(socket.id);
      }

      unsubscribeConn = socketService.subscribeConnectionStatus((connected) => {
        if (!isMounted) return;
        const currentSocket = socketService.getSocket();
        if (connected && currentSocket?.id) {
          setCurrentUserId(currentSocket.id);
        }
      });

      // Check URL parameters for ?room=SW-XXXX (Only join if URL param exists)
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoomCode = urlParams.get('room');

      if (urlRoomCode) {
        console.log(`[App] Joining room from URL query parameter: ${urlRoomCode}`);
        setRoomConnectionStatus('joining');
        const res = await socketService.joinRoom(urlRoomCode, { deviceModel: devModel, osVersion: devOs });
        if (res.success && res.roomState && isMounted) {
          updateRoomState(res.roomState);
          setRoomConnectionStatus('connected');
        } else if (isMounted) {
          console.warn(`[App] Failed to join URL room ${urlRoomCode}: ${res.error}. Remaining in NO_ROOM state.`);
          setRoomConnectionStatus('error');
          setRoomCode('');
          setParticipants([]);
        }
      } else {
        // Initial state MUST be NO_ROOM. Do NOT auto-create a room on app startup!
        setRoomConnectionStatus('no_room');
        setRoomCode('');
        setParticipants([]);
      }
    };

    init();

    // Listen to real-time room updates from WebSocket server
    const unsubscribeRoom = socketService.onRoomUpdated((updatedState: RoomState) => {
      if (isMounted) {
        updateRoomState(updatedState);
        setRoomConnectionStatus('connected');
      }
    });

    // Listen to host changes
    const unsubscribeHost = socketService.onHostChanged((info) => {
      if (isMounted) {
        setHostId(info.newHostId);
      }
    });

    // Listen to synchronized playback commands from backend
    const unsubscribePlayback = socketService.onPlaybackCommand((cmd: PlaybackCommandPayload) => {
      if (!isMounted) return;
      console.log(`[App] Received Playback Command: ${cmd.type} | Track: ${cmd.currentTrack.title}`);

      // Calculate target position based on server timestamp & NTP clock offset
      const nowServer = globalClockSync.getAdjustedServerTime();
      const elapsedSec = cmd.isPlaying ? Math.max(0, (nowServer - cmd.serverTimestamp) / 1000) : 0;
      const targetPosSec = cmd.positionSec + elapsedSec;

      globalAudioEngine.applyRemotePlaybackState(
        cmd.currentTrack,
        cmd.isPlaying,
        targetPosSec,
        cmd.serverTimestamp
      );
    });

    const unsubscribeKicked = socketService.onKicked(() => {
      console.warn('[App] Kicked from room by host');
      setRoomConnectionStatus('no_room');
      setRoomCode('');
      setParticipants([]);
      globalAudioEngine.resetRoomTarget();
      globalAudioEngine.pause();
      setTimeout(() => {
        alert('You have been removed from the room by the host.');
      }, 100);
    });

    return () => {
      isMounted = false;
      if (unsubscribeConn) unsubscribeConn();
      unsubscribeRoom();
      unsubscribeHost();
      unsubscribePlayback();
      unsubscribeKicked();
    };
  }, []);

  const updateRoomState = (state: RoomState) => {
    setRoomCode(state.code);
    setParticipants(state.participants || []);
    setHostId(state.hostId);

    if (state.currentTrack) {
      setCurrentTrack(state.currentTrack);
    }

    // Late Join Synchronization: Calculate target position based on serverTimestamp
    if (state.isPlaying) {
      const nowServer = globalClockSync.getAdjustedServerTime();
      const elapsedSec = Math.max(0, (nowServer - (state.lastSyncTimestamp || state.serverTimestamp || Date.now())) / 1000);
      const targetPosSec = state.positionSec + elapsedSec;
      globalAudioEngine.applyRemotePlaybackState(state.currentTrack, true, targetPosSec, state.serverTimestamp);
    } else {
      globalAudioEngine.applyRemotePlaybackState(state.currentTrack, false, state.positionSec, state.serverTimestamp);
    }
  };

  // Sync local AudioEngine state with UI state
  useEffect(() => {
    const unsubscribe = globalAudioEngine.subscribe(() => {
      setIsPlaying(globalAudioEngine.getIsPlaying());
      setCurrentTrack(globalAudioEngine.getCurrentTrack());
      setPositionSec(globalAudioEngine.getPosition());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Room Management Actions (Explicit user-triggered only)
  const handleCreateRoom = useCallback(async () => {
    setRoomConnectionStatus('joining');
    const res = await socketService.createRoom({ deviceModel, osVersion });
    if (res.success && res.roomState) {
      updateRoomState(res.roomState);
      setRoomConnectionStatus('connected');
    } else {
      setRoomConnectionStatus('error');
    }
  }, [deviceModel, osVersion]);

  const handleJoinRoom = useCallback(
    async (codeToJoin: string): Promise<boolean> => {
      setRoomConnectionStatus('joining');
      const res = await socketService.joinRoom(codeToJoin, { deviceModel, osVersion });
      if (res.success && res.roomState) {
        updateRoomState(res.roomState);
        setRoomConnectionStatus('connected');
        return true;
      }
      setRoomConnectionStatus('error');
      return false;
    },
    [deviceModel, osVersion]
  );

  const handleLeaveRoom = useCallback(async () => {
    socketService.leaveRoom();
    globalAudioEngine.resetRoomTarget();
    setRoomCode('');
    setParticipants([]);
    setHostId('');
    setRoomConnectionStatus('no_room');
  }, []);

  // Transport Control Handlers
  const handleTogglePlay = useCallback(() => {
    if (roomConnectionStatus === 'connected') {
      if (!isHost) return;
      if (isPlaying) {
        socketService.sendPlaybackCommand('PAUSE', { positionSec });
      } else {
        // MUST pre-emptively play locally to satisfy browser user-gesture requirements
        globalAudioEngine.play();
        socketService.sendPlaybackCommand('PLAY', { positionSec });
      }
    } else {
      if (isPlaying) {
        globalAudioEngine.pause();
      } else {
        globalAudioEngine.play();
      }
    }
  }, [isPlaying, positionSec, roomConnectionStatus, isHost]);

  const handleNextTrack = useCallback(() => {
    const currentIndex = PRESET_TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % PRESET_TRACKS.length;
    const nextTrack = PRESET_TRACKS[nextIndex];
    if (roomConnectionStatus === 'connected') {
      if (!isHost) return;
      socketService.sendPlaybackCommand('TRACK_CHANGE', { track: nextTrack });
    } else {
      globalAudioEngine.setTrack(nextTrack);
    }
  }, [currentTrack, roomConnectionStatus, isHost]);

  const handlePrevTrack = useCallback(() => {
    const currentIndex = PRESET_TRACKS.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + PRESET_TRACKS.length) % PRESET_TRACKS.length;
    const prevTrack = PRESET_TRACKS[prevIndex];
    if (roomConnectionStatus === 'connected') {
      if (!isHost) return;
      socketService.sendPlaybackCommand('TRACK_CHANGE', { track: prevTrack });
    } else {
      globalAudioEngine.setTrack(prevTrack);
    }
  }, [currentTrack, roomConnectionStatus, isHost]);

  const handleSeek = useCallback((newPos: number) => {
    if (roomConnectionStatus === 'connected') {
      if (!isHost) return;
      socketService.sendPlaybackCommand('SEEK', { positionSec: newPos });
    } else {
      globalAudioEngine.seek(newPos);
    }
  }, [roomConnectionStatus, isHost]);

  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    globalAudioEngine.setMasterVolume(newVol);
  }, []);

  const handleSelectTrack = useCallback((track: AudioTrack) => {
    if (roomConnectionStatus === 'connected') {
      if (!isHost) return;
      socketService.sendPlaybackCommand('TRACK_CHANGE', { track });
    } else {
      globalAudioEngine.setTrack(track);
    }
  }, [roomConnectionStatus, isHost]);

  const handleRemoveParticipant = useCallback((id: string) => {
    if (roomConnectionStatus === 'connected' && isHost) {
      socketService.kickParticipant(id);
    }
  }, [roomConnectionStatus, isHost]);

  const handleUpdateParticipantVolume = useCallback((id: string, vol: number) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, volume: vol, isMuted: vol === 0 } : p))
    );
  }, []);

  const handleToggleParticipantMute = useCallback((id: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isMuted: !p.isMuted } : p))
    );
  }, []);

  return (
    <AndroidDeviceFrame volume={volume} onVolumeChange={handleVolumeChange}>
      {/* Notification Access Permission Banner for Live Spotify/Music Recognition */}
      {isNative && !hasNotificationPermission && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 p-2.5 px-3 flex items-center justify-between text-xs text-amber-200 z-40 shrink-0">
          <div className="flex items-center gap-2 pr-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Grant <strong>Notification Access</strong> to auto-recognize Spotify & Music apps
            </span>
          </div>
          <button
            onClick={() => openMusicReaderSettings()}
            className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] hover:bg-amber-400 transition-colors shrink-0"
          >
            Grant Access
          </button>
        </div>
      )}

      {/* Primary Playback & Sync Hub Screen */}
      <PlaybackScreen
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        currentTrack={currentTrack}
        positionSec={positionSec}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        participants={participants}
        roomCode={roomCode}
        isHost={isHost}
        onOpenSourceSelector={() => setIsSourceSelectorOpen(true)}
        onOpenRoomManager={() => setIsRoomManagerOpen(true)}
        onPullShade={() => {}}
      />

      {/* Modals & Dialogs */}
      <SourceSelectorModal
        isOpen={isSourceSelectorOpen}
        onClose={() => setIsSourceSelectorOpen(false)}
        currentSourceType={currentTrack.sourceType}
        onSelectTrack={handleSelectTrack}
      />

      <RoomManagerModal
        isOpen={isRoomManagerOpen}
        onClose={() => setIsRoomManagerOpen(false)}
        roomCode={roomCode}
        participants={participants}
        currentUserId={currentUserId}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onRemoveParticipant={handleRemoveParticipant}
        onUpdateVolume={handleUpdateParticipantVolume}
        onToggleMute={handleToggleParticipantMute}
      />
    </AndroidDeviceFrame>
  );
}
