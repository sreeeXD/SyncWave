import { io, Socket } from 'socket.io-client';
import { AudioTrack, Participant, RoomState } from '../types';
import { globalClockSync } from './clockSync';

export interface PlaybackCommandPayload {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE';
  roomCode: string;
  hostId: string;
  trackId: string;
  currentTrack: AudioTrack;
  isPlaying: boolean;
  positionSec: number;
  serverTimestamp: number;
}

const DEFAULT_SERVER_URL = 'http://192.168.0.102:3001';

class SocketService {
  private socket: Socket | null = null;
  private currentRoomCode: string | null = null;
  private isConnected: boolean = false;
  private ntpSyncInterval: number | null = null;
  private customServerUrl: string | null = null;

  private roomUpdatedCallbacks: Set<(roomState: RoomState) => void> = new Set();
  private hostChangedCallbacks: Set<(info: { newHostId: string; hostName: string }) => void> = new Set();
  private errorCallbacks: Set<(error: string) => void> = new Set();
  private playbackCommandCallbacks: Set<(cmd: PlaybackCommandPayload) => void> = new Set();
  private connectionStatusCallbacks: Set<(connected: boolean) => void> = new Set();

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.customServerUrl = localStorage.getItem('syncwave_server_url');
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getCurrentRoomCode(): string | null {
    return this.currentRoomCode;
  }

  public getServerUrl(): string {
    if (this.customServerUrl) {
      return this.customServerUrl;
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('10.0.2')) {
        const protocol = window.location.protocol.startsWith('http') ? window.location.protocol : 'http:';
        return `${protocol}//${hostname}:3001`;
      }
    }
    return DEFAULT_SERVER_URL;
  }

  public setServerUrl(url: string): void {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) return;

    let formattedUrl = trimmed;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `http://${formattedUrl}`;
    }
    if (!formattedUrl.includes(':', formattedUrl.indexOf('://') + 3)) {
      formattedUrl = `${formattedUrl}:3001`;
    }

    console.log(`[SocketService] Setting new backend server URL: ${formattedUrl}`);
    this.customServerUrl = formattedUrl;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('syncwave_server_url', formattedUrl);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyConnectionStatus(false);
    }

    this.connect();
  }

  public subscribeConnectionStatus(cb: (connected: boolean) => void): () => void {
    this.connectionStatusCallbacks.add(cb);
    cb(this.isConnected);
    return () => {
      this.connectionStatusCallbacks.delete(cb);
    };
  }

  private notifyConnectionStatus(connected: boolean) {
    this.connectionStatusCallbacks.forEach((cb) => cb(connected));
  }

  public connect(): Socket {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    const serverUrl = this.getServerUrl();
    console.log(`[SocketService] Connecting to backend server: ${serverUrl}`);

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log(`[SocketService] Connected! Socket ID: ${this.socket?.id}`);
      this.isConnected = true;
      this.notifyConnectionStatus(true);
      this.performNtpSync();
      if (this.ntpSyncInterval) window.clearInterval(this.ntpSyncInterval);
      this.ntpSyncInterval = window.setInterval(() => this.performNtpSync(), 5000);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[SocketService] Disconnected: ${reason}`);
      this.isConnected = false;
      this.notifyConnectionStatus(false);
      if (this.ntpSyncInterval) {
        window.clearInterval(this.ntpSyncInterval);
        this.ntpSyncInterval = null;
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error(`[SocketService] Connection Error to ${serverUrl}:`, err.message);
      this.isConnected = false;
      this.notifyConnectionStatus(false);
      this.errorCallbacks.forEach((cb) => cb(`Cannot connect to server at ${serverUrl}. Make sure Node.js server is running and devices are on the same Wi-Fi.`));
    });

    this.socket.on('room_updated', (roomState: RoomState) => {
      console.log(`[SocketService] Room updated:`, roomState);
      this.currentRoomCode = roomState.code;
      this.roomUpdatedCallbacks.forEach((cb) => cb(roomState));
    });

    this.socket.on('host_changed', (info: { newHostId: string; hostName: string }) => {
      console.log(`[SocketService] Host changed:`, info);
      this.hostChangedCallbacks.forEach((cb) => cb(info));
    });

    this.socket.on('playback_command', (cmd: PlaybackCommandPayload) => {
      console.log(`[SocketService] Received playback command:`, cmd);
      this.playbackCommandCallbacks.forEach((cb) => cb(cmd));
    });

    this.socket.on('room_error', (data: { error: string }) => {
      console.error(`[SocketService] Room error:`, data.error);
      this.errorCallbacks.forEach((cb) => cb(data.error));
    });

    return this.socket;
  }

  public async createRoom(deviceInfo: { deviceModel: string; osVersion: string }): Promise<{
    success: boolean;
    roomCode?: string;
    participantId?: string;
    roomState?: RoomState;
    error?: string;
  }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit('create_room', deviceInfo, (res: any) => {
        if (res?.success) {
          this.currentRoomCode = res.roomCode;
          resolve(res);
        } else {
          resolve({ success: false, error: res?.error || 'Failed to create room' });
        }
      });
    });
  }

  public async joinRoom(
    roomCode: string,
    deviceInfo: { deviceModel: string; osVersion: string }
  ): Promise<{
    success: boolean;
    roomCode?: string;
    participantId?: string;
    roomState?: RoomState;
    error?: string;
  }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit('join_room', { roomCode, ...deviceInfo }, (res: any) => {
        if (res?.success) {
          this.currentRoomCode = res.roomCode;
          resolve(res);
        } else {
          resolve({ success: false, error: res?.error || `Room "${roomCode}" does not exist.` });
        }
      });
    });
  }

  public sendPlaybackCommand(
    type: 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE',
    payload: { positionSec?: number; track?: AudioTrack } = {}
  ): void {
    if (this.socket && this.currentRoomCode) {
      this.socket.emit('playback_command', {
        type,
        roomCode: this.currentRoomCode,
        ...payload,
      });
    }
  }

  public leaveRoom(): void {
    if (this.socket && this.currentRoomCode) {
      this.socket.emit('leave_room', { roomCode: this.currentRoomCode });
      this.currentRoomCode = null;
    }
  }

  public onRoomUpdated(cb: (roomState: RoomState) => void): () => void {
    this.roomUpdatedCallbacks.add(cb);
    return () => {
      this.roomUpdatedCallbacks.delete(cb);
    };
  }

  public onHostChanged(cb: (info: { newHostId: string; hostName: string }) => void): () => void {
    this.hostChangedCallbacks.add(cb);
    return () => {
      this.hostChangedCallbacks.delete(cb);
    };
  }

  public onPlaybackCommand(cb: (cmd: PlaybackCommandPayload) => void): () => void {
    this.playbackCommandCallbacks.add(cb);
    return () => {
      this.playbackCommandCallbacks.delete(cb);
    };
  }

  public performNtpSync(): void {
    if (!this.socket || !this.isConnected) return;
    const t0 = Date.now();
    this.socket.emit('ntp_ping', { t0 }, (res: any) => {
      if (res && res.t1 !== undefined && res.t2 !== undefined) {
        const t3 = Date.now();
        globalClockSync.processNtpExchange(res.t0 || t0, res.t1, res.t2, t3);
      }
    });
  }

  public onError(cb: (error: string) => void): () => void {
    this.errorCallbacks.add(cb);
    return () => {
      this.errorCallbacks.delete(cb);
    };
  }
}

export const socketService = new SocketService();
