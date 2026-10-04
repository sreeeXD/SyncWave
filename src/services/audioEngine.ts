/**
 * Audio Engine Service for SyncWave
 * Encapsulates room playback synchronization using the abstract IMusicProvider interface.
 */

import { AudioTrack, MusicProviderType } from '../types';
import { globalClockSync } from './clockSync';
import {
  IMusicProvider,
  MusicProviderRegistry,
  PRESET_TRACKS,
} from './MusicProvider';
import { sendNativePlaybackHeartbeat } from './nativeAndroidBridge';

export { PRESET_TRACKS };

class AudioEngineService {
  private activeProvider: IMusicProvider;
  private onStateChangeCallbacks: Set<() => void> = new Set();
  private driftCorrectionTimer: number | null = null;
  private currentUnsubscribe: (() => void) | null = null;

  // Authoritative room target playback state for synchronization
  private roomTargetState: {
    isPlaying: boolean;
    serverTimestamp: number;
    positionSec: number;
  } | null = null;

  constructor() {
    this.activeProvider = MusicProviderRegistry.get('demo');
    this.attachProviderListener();
    this.startDriftCorrectionLoop();
  }

  private attachProviderListener() {
    if (this.currentUnsubscribe) {
      this.currentUnsubscribe();
      this.currentUnsubscribe = null;
    }
    if ('subscribe' in this.activeProvider && typeof (this.activeProvider as any).subscribe === 'function') {
      this.currentUnsubscribe = (this.activeProvider as any).subscribe(() => {
        this.notify();
      });
    }
  }

  public subscribe(cb: () => void) {
    this.onStateChangeCallbacks.add(cb);
    return () => {
      this.onStateChangeCallbacks.delete(cb);
    };
  }

  private notify() {
    this.onStateChangeCallbacks.forEach((cb) => cb());
  }

  public getActiveProviderType(): MusicProviderType {
    return this.activeProvider.providerType;
  }

  public getActiveProvider(): IMusicProvider {
    return this.activeProvider;
  }

  /**
   * Switch the active music provider via MusicProviderRegistry.
   * Throws an explicit error if the provider is not implemented.
   * DOES NOT secretly fall back to DemoMusicProvider.
   */
  public switchProvider(type: MusicProviderType): IMusicProvider {
    if (this.activeProvider.providerType === type) {
      return this.activeProvider;
    }

    console.log(`[ProviderSwitch] Switching active provider from "${this.activeProvider.providerType}" to "${type}"`);
    const oldProvider = this.activeProvider;
    try {
      oldProvider.pause();
      if (oldProvider.destroy) {
        oldProvider.destroy();
      }
    } catch (e) {
      console.warn(`[ProviderSwitch] Error during old provider teardown:`, e);
    }

    const newProvider = MusicProviderRegistry.get(type);
    this.activeProvider = newProvider;
    this.attachProviderListener();
    this.notify();
    return this.activeProvider;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.activeProvider.getAnalyser ? this.activeProvider.getAnalyser() : null;
  }

  public getIsPlaying(): boolean {
    return this.activeProvider.getIsPlaying();
  }

  public getCurrentTrack(): AudioTrack {
    return this.activeProvider.getCurrentTrack() || PRESET_TRACKS[0];
  }

  public getPosition(): number {
    return this.activeProvider.getPosition();
  }

  public getDuration(): number {
    return this.activeProvider.getDuration();
  }

  public async play(): Promise<void> {
    await this.activeProvider.play();
  }

  public pause(): void {
    this.activeProvider.pause();
  }

  public seek(positionSec: number): void {
    this.activeProvider.seek(positionSec);
  }

  public async setTrack(track: AudioTrack): Promise<void> {
    const trackProvider = track.provider || 'demo';
    if (this.activeProvider.providerType !== trackProvider) {
      this.switchProvider(trackProvider);
    }
    await this.activeProvider.loadTrack(track);
  }

  public setMasterVolume(vol0to100: number): void {
    this.activeProvider.setVolume(vol0to100);
  }

  public resetRoomTarget(): void {
    this.roomTargetState = null;
    if (this.activeProvider.setPlaybackRate) {
      this.activeProvider.setPlaybackRate(1.0);
    }
  }

  /**
   * Apply synchronized remote playback state from WebSocket host server command or room join
   */
  public async applyRemotePlaybackState(
    track: AudioTrack,
    isPlaying: boolean,
    positionSec: number,
    serverTimestamp: number = Date.now()
  ): Promise<void> {
    this.roomTargetState = {
      isPlaying,
      serverTimestamp,
      positionSec,
    };

    const trackProvider = track.provider || 'demo';
    if (this.activeProvider.providerType !== trackProvider) {
      this.switchProvider(trackProvider);
    }

    const current = this.activeProvider.getCurrentTrack();
    if (!current || current.id !== track.id) {
      await this.activeProvider.loadTrack(track);
    }

    this.activeProvider.seek(positionSec);

    if (isPlaying && !this.activeProvider.getIsPlaying()) {
      await this.activeProvider.play();
    } else if (!isPlaying && this.activeProvider.getIsPlaying()) {
      this.activeProvider.pause();
    }
  }

  private lastDriftCorrectionTime: number = 0;

  /**
   * Threshold-Based Drift Correction (P1-B.4)
   * Periodically checks if local position has drifted from authoritative server timestamp timeline.
   */
  private startDriftCorrectionLoop() {
    if (this.driftCorrectionTimer) window.clearInterval(this.driftCorrectionTimer);

    this.driftCorrectionTimer = window.setInterval(() => {
      if (!this.roomTargetState || !this.roomTargetState.isPlaying || !this.activeProvider.getIsPlaying()) {
        return;
      }

      const nowServer = globalClockSync.getAdjustedServerTime();
      const elapsedSec = Math.max(0, (nowServer - this.roomTargetState.serverTimestamp) / 1000);
      const expectedPosSec = this.roomTargetState.positionSec + elapsedSec;
      const localPosSec = this.activeProvider.getPosition();
      const driftSec = localPosSec - expectedPosSec;
      
      const isBuffering = this.activeProvider.isBuffering ? this.activeProvider.isBuffering() : false;
      const providerType = this.activeProvider.providerType;

      // Update forensic process death marker with live playback state
      sendNativePlaybackHeartbeat(
        providerType,
        this.activeProvider.getIsPlaying(),
        localPosSec,
        this.getCurrentTrack()?.title || ''
      );

      // Diagnostic logging requested by user
      console.log(`[AudioEngine] Drift Check | Provider: ${providerType} | Expected: ${expectedPosSec.toFixed(3)}s | Local: ${localPosSec.toFixed(3)}s | Drift: ${driftSec.toFixed(3)}s | Buffering: ${isBuffering}`);

      if (isBuffering) {
        console.log(`[AudioEngine] Skipping drift correction because provider is buffering.`);
        return;
      }

      // Avoid correcting too frequently (5 second cooldown)
      if (Date.now() - this.lastDriftCorrectionTime < 5000) {
        return;
      }

      // 1.5 second threshold to account for Bluetooth latency and normal jitter
      if (Math.abs(driftSec) > 1.5) {
        console.warn(`[AudioEngine] Drift Correction | Seeking to authoritative position ${expectedPosSec.toFixed(2)}s (Drift: ${driftSec.toFixed(2)}s)`);
        this.lastDriftCorrectionTime = Date.now();
        this.activeProvider.seek(Math.max(0, expectedPosSec));
      }
    }, 2000);
  }
}

export const globalAudioEngine = new AudioEngineService();
