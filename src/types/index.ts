export type AudioSourceType = 'spotify_sync' | 'youtube_sync' | 'radio_stream';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  sourceApp: string; // e.g. "Spotify", "YouTube Music", "SoundCloud"
  sourceType: AudioSourceType;
  duration: number; // in seconds
  colorGradient: string;
  bpm: number;
  coverArtTheme: 'neon' | 'sunset' | 'forest' | 'amber' | 'cyan';
}

export interface Participant {
  id: string;
  name: string;
  deviceModel: string; // e.g., "Google Pixel 8 Pro", "Samsung Galaxy S24 Ultra"
  isHost: boolean;
  avatarColor: string;
  latencyMs: number;
  driftMs: number;
  volume: number; // 0 to 100
  isMuted: boolean;
  isBuffering: boolean;
  connectionType: 'WiFi 6' | '5G Ultra' | 'WiFi LAN' | 'Local P2P';
  osVersion: string;
}

export interface SyncMessage {
  type: 'SYNC_HEARTBEAT' | 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE' | 'JOIN_ROOM' | 'LEAVE_ROOM';
  roomId: string;
  senderId: string;
  timestamp: number;
  serverTime?: number;
  currentPositionSec?: number;
  isPlaying?: boolean;
  trackId?: string;
  payload?: any;
}

export interface RoomState {
  id: string;
  code: string;
  name?: string;
  hostId: string;
  isPlaying: boolean;
  currentTrack: AudioTrack;
  positionSec: number;
  lastSyncTimestamp: number;
  bufferLatencyMs?: number;
  qualityBitrate?: string;
  participants: Participant[];
}
