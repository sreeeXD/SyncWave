/**
 * Audio Engine Service for SyncWave
 * Encapsulates music provider playback & phase-lock drift correction for multi-device sync.
 */

import { AudioTrack } from '../types';
import { globalClockSync } from './clockSync';
import { IMusicProvider, PRESET_TRACKS, SynthMusicProvider } from './MusicProvider';

export { PRESET_TRACKS };

class AudioEngineService {
  private activeProvider: IMusicProvider;
  private onStateChangeCallbacks: Set<() => void> = new Set();
  private driftCorrectionTimer: number | null = null;

  // Track room target playback state for drift correction
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

  public setPlaybackRate(rate: number): void {
    this.activeProvider.setPlaybackRate(rate);
  }

  /**
   * Apply synchronized remote playback state from WebSocket host server command
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
   * Update internal reference of room playback target for continuous phase locking
   */
  public updateRoomTarget(isPlaying: boolean, positionSec: number, serverTimestamp: number): void {
    this.roomTargetState = {
      isPlaying,
      serverTimestamp,
      positionSec,
    };
  }

  /**
   * Phase-Lock Loop (PLL) Drift Correction (Phase 3)
   * Continuously compares local playback position with calculated authoritative room timeline.
   */
  private startDriftCorrectionLoop() {
    if (this.driftCorrectionTimer) window.clearInterval(this.driftCorrectionTimer);

    this.driftCorrectionTimer = window.setInterval(() => {
      if (!this.roomTargetState || !this.activeProvider.getIsPlaying()) {
        this.activeProvider.setPlaybackRate(1.0);
        return;
      }

      if (!this.roomTargetState.isPlaying) {
        return;
      }

      const nowServer = globalClockSync.getAdjustedServerTime();
      const elapsedSec = (nowServer - this.roomTargetState.serverTimestamp) / 1000;
      const expectedPosSec = this.roomTargetState.positionSec + elapsedSec;
      const localPosSec = this.activeProvider.getPosition();
      const driftSec = localPosSec - expectedPosSec;
      const driftMs = driftSec * 1000;

      // Phase 3 Strategy Rules:
      // 1. Hard Seek if drift > 1.0 second
      if (Math.abs(driftSec) > 1.0) {
        console.warn(`[Drift Correction] Hard seek triggered! Drift: ${Math.round(driftMs)}ms`);
        this.activeProvider.seek(Math.max(0, expectedPosSec));
        this.activeProvider.setPlaybackRate(1.0);
      }
      // 2. Micro-tune playback rate if drift is between 15ms and 1000ms
      else if (Math.abs(driftMs) > 15) {
        // If local is ahead (driftMs > 0), slow down (rate < 1.0)
        // If local is behind (driftMs < 0), speed up (rate > 1.0)
        const rateComp = globalClockSync.calculatePlaybackRateCompensation(-driftMs);
        this.activeProvider.setPlaybackRate(rateComp);
      }
      // 3. Perfect alignment (<15ms)
      else {
        this.activeProvider.setPlaybackRate(1.0);
      }
    }, 1000);
  }
}

export const globalAudioEngine = new AudioEngineService();
