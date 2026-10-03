/**
 * Audio Engine Service for SyncWave (P0.5 Synchronized Playback Layer)
 * Encapsulates demo music provider playback & simple threshold-based drift correction.
 */

import { AudioTrack } from '../types';
import { globalClockSync } from './clockSync';
import { IMusicProvider, PRESET_TRACKS, SynthMusicProvider } from './MusicProvider';

export { PRESET_TRACKS };

class AudioEngineService {
  private activeProvider: IMusicProvider;
  private onStateChangeCallbacks: Set<() => void> = new Set();
  private driftCorrectionTimer: number | null = null;

  // Authoritative room target playback state for synchronization
  private roomTargetState: {
    isPlaying: boolean;
    serverTimestamp: number;
    positionSec: number;
  } | null = null;

  constructor() {
    this.activeProvider = new SynthMusicProvider();
    (this.activeProvider as SynthMusicProvider).subscribe(() => {
      this.notify();
    });

    this.startDriftCorrectionLoop();
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

  public getAnalyser(): AnalyserNode | null {
    return this.activeProvider.getAnalyser();
  }

  public getIsPlaying(): boolean {
    return this.activeProvider.getIsPlaying();
  }

  public getCurrentTrack(): AudioTrack {
    return this.activeProvider.getCurrentTrack();
  }

  public getPosition(): number {
    return this.activeProvider.getPosition();
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

  public setTrack(track: AudioTrack): void {
    this.activeProvider.setTrack(track);
  }

  public setMasterVolume(vol0to100: number): void {
    this.activeProvider.setVolume(vol0to100);
  }

  public resetRoomTarget(): void {
    this.roomTargetState = null;
    this.activeProvider.setPlaybackRate(1.0);
  }

  /**
   * Apply synchronized remote playback state from WebSocket host server command or room join
   */
  public applyRemotePlaybackState(
    track: AudioTrack,
    isPlaying: boolean,
    positionSec: number,
    serverTimestamp: number = Date.now()
  ): void {
    this.roomTargetState = {
      isPlaying,
      serverTimestamp,
      positionSec,
    };

    if (this.activeProvider.getCurrentTrack().id !== track.id) {
      this.activeProvider.setTrack(track);
    }

    this.activeProvider.seek(positionSec);

    if (isPlaying && !this.activeProvider.getIsPlaying()) {
      this.activeProvider.play();
    } else if (!isPlaying && this.activeProvider.getIsPlaying()) {
      this.activeProvider.pause();
    }
  }

  /**
   * Simple Threshold-Based Drift Correction (P0.5)
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

      // P0.5 Simple Threshold Rule: If drift > 0.5s (500ms), perform simple seek correction
      if (Math.abs(driftSec) > 0.5) {
        console.warn(`[P0.5 Drift Correction] Seeking to authoritative position ${expectedPosSec.toFixed(2)}s (Drift: ${driftSec.toFixed(2)}s)`);
        this.activeProvider.seek(Math.max(0, expectedPosSec));
      }
    }, 2000);
  }
}

export const globalAudioEngine = new AudioEngineService();
