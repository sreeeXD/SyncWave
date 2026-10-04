import { registerPlugin } from '@capacitor/core';

export interface NativeAndroidPlugin {
  getNativeStatus(): Promise<{
    isNativeAndroid: boolean;
    isCapturing: boolean;
    currentTrack: string;
    currentArtist: string;
    isPlaying: boolean;
    deviceModel: string;
    osVersion: string;
    isNotificationPermissionGranted: boolean;
  }>;
  openNotificationListenerSettings(): Promise<{ opened: boolean }>;
  startSystemAudioCapture(): Promise<{ requested: boolean }>;
  stopSystemAudioCapture(): Promise<{ stopped: boolean }>;
  recordPlaybackHeartbeat(options: {
    provider: string;
    isPlaying: boolean;
    position: number;
    track: string;
  }): Promise<void>;
}

const SyncWaveNative = registerPlugin<NativeAndroidPlugin>('SyncWaveNative');

export function sendNativePlaybackHeartbeat(provider: string, isPlaying: boolean, position: number, track: string): void {
  try {
    SyncWaveNative.recordPlaybackHeartbeat({ provider, isPlaying, position, track }).catch(() => {});
  } catch {}
}

export async function isNativeAndroidDevice(): Promise<boolean> {
  try {
    const status = await SyncWaveNative.getNativeStatus();
    return !!status?.isNativeAndroid;
  } catch {
    return false;
  }
}

export async function getNativeDeviceStatus() {
  try {
    return await SyncWaveNative.getNativeStatus();
  } catch {
    return {
      isNativeAndroid: false,
      isCapturing: false,
      currentTrack: '',
      currentArtist: '',
      isPlaying: false,
      deviceModel: 'Web Browser Emulator',
      osVersion: 'Web Version',
      isNotificationPermissionGranted: true,
    };
  }
}

export async function openMusicReaderSettings(): Promise<boolean> {
  try {
    const res = await SyncWaveNative.openNotificationListenerSettings();
    return res.opened;
  } catch (err) {
    console.warn('Could not open Notification Settings:', err);
    return false;
  }
}

export async function requestNativeSystemAudioCapture(): Promise<boolean> {
  try {
    const res = await SyncWaveNative.startSystemAudioCapture();
    return res.requested;
  } catch (err) {
    console.warn('Native system audio capture not available on Web:', err);
    return false;
  }
}

export async function stopNativeSystemAudioCapture(): Promise<boolean> {
  try {
    const res = await SyncWaveNative.stopSystemAudioCapture();
    return res.stopped;
  } catch (err) {
    console.warn('Native stop capture error:', err);
    return false;
  }
}
