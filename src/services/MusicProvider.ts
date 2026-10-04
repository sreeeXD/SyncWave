import { AudioTrack, MusicProviderType } from '../types';
import { YouTubeProvider } from './YouTubeProvider';

export interface MusicProviderCapabilities {
  play: boolean;
  pause: boolean;
  seek: boolean;
  position: boolean;
  trackChange: boolean;
  backgroundPlayback: boolean;
}

export interface IMusicProvider {
  id: string;
  name: string;
  providerType: MusicProviderType;
  capabilities: MusicProviderCapabilities;

  loadTrack(track: AudioTrack): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(positionSec: number): void;
  getPosition(): number;
  getDuration(): number;
  getIsPlaying(): boolean;
  isBuffering?(): boolean; // Optional method to check if the provider is currently buffering
  getCurrentTrack(): AudioTrack | null;
  setVolume(vol0to100: number): void;
  setPlaybackRate?(rate: number): void;
  getAnalyser?(): AnalyserNode | null;
  destroy(): void;
}

export const PRESET_TRACKS: AudioTrack[] = [
  {
    id: 'track-1',
    title: 'Neon Horizon (Demo Feed)',
    artist: 'Aether Echoes',
    album: 'Synthetic Dreams 2026',
    sourceApp: 'SyncWave Demo Synth',
    sourceType: 'radio_stream',
    provider: 'demo',
    duration: 184,
    colorGradient: 'from-fuchsia-600 via-purple-600 to-indigo-900',
    coverArtTheme: 'neon',
    bpm: 120,
  },
  {
    id: 'track-2',
    title: 'Sunset Rooftop Session',
    artist: 'Kanso & The Waves',
    album: 'Warm Vinyl Nights',
    sourceApp: 'SyncWave Demo Synth',
    sourceType: 'radio_stream',
    provider: 'demo',
    duration: 215,
    colorGradient: 'from-amber-500 via-rose-600 to-slate-900',
    coverArtTheme: 'sunset',
    bpm: 88,
  },
  {
    id: 'track-3',
    title: 'Midnight Reverie',
    artist: 'Solas Mountain',
    album: 'Acoustic Pine Echoes',
    sourceApp: 'SyncWave Demo Synth',
    sourceType: 'radio_stream',
    provider: 'demo',
    duration: 168,
    colorGradient: 'from-emerald-600 via-teal-700 to-slate-950',
    coverArtTheme: 'forest',
    bpm: 96,
  },
  {
    id: 'track-4',
    title: 'Kinetic Sub-Bass Pulse',
    artist: 'Delta Matrix',
    album: 'Sub-Ohm Protocol',
    sourceApp: 'SyncWave Demo Synth',
    sourceType: 'radio_stream',
    provider: 'demo',
    duration: 240,
    colorGradient: 'from-blue-600 via-cyan-600 to-slate-900',
    coverArtTheme: 'cyan',
    bpm: 128,
  },
];

export class DemoMusicProvider implements IMusicProvider {
  public id = 'demo-provider';
  public name = 'Synchronized WebAudio Demo Provider';
  public providerType: MusicProviderType = 'demo';
  public capabilities: MusicProviderCapabilities = {
    play: true,
    pause: true,
    seek: true,
    position: true,
    trackChange: true,
    backgroundPlayback: true,
  };

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isPlaying: boolean = false;
  private currentTrack: AudioTrack = PRESET_TRACKS[0];
  private playbackPositionSec: number = 0;
  private lastTickEpoch: number = 0;
  private sequenceTimer: number | null = null;
  private playbackRate: number = 1.0;

  private onStateChangeCallbacks: Set<() => void> = new Set();

  constructor() {}

  private initAudio() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.musicGain.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  public getAnalyser(): AnalyserNode | null {
    this.initAudio();
    return this.analyser;
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

  public async loadTrack(track: AudioTrack): Promise<void> {
    this.setTrack(track);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): AudioTrack | null {
    return this.currentTrack;
  }

  public getPosition(): number {
    return this.playbackPositionSec;
  }

  public getDuration(): number {
    return this.currentTrack?.duration || 0;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.9, Math.min(1.1, rate));
  }

  public async play(): Promise<void> {
    this.initAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTickEpoch = performance.now();
    this.startSynthLoop();
    this.notify();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.sequenceTimer) {
      window.clearInterval(this.sequenceTimer);
      this.sequenceTimer = null;
    }
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
    console.log('[DemoMusicProvider] Paused synth loop & suspended AudioContext.');
    this.notify();
  }

  public seek(positionSec: number): void {
    this.playbackPositionSec = Math.max(0, Math.min(positionSec, this.currentTrack.duration));
    this.notify();
  }

  public setTrack(track: AudioTrack): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.currentTrack = track;
    this.playbackPositionSec = 0;

    if (wasPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public setVolume(vol0to100: number): void {
    this.initAudio();
    if (this.masterGain && this.ctx) {
      const targetGain = Math.max(0, Math.min(1, vol0to100 / 100));
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  public destroy(): void {
    console.log('[DemoMusicProvider] Destroying provider resources...');
    this.pause();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
      this.analyser = null;
      this.masterGain = null;
      this.musicGain = null;
    }
  }

  private startSynthLoop() {
    if (this.sequenceTimer) window.clearInterval(this.sequenceTimer);

    const synthScales: Record<string, number[][]> = {
      neon: [
        [220, 261.63, 329.63, 392],
        [174.61, 220, 261.63, 329.63],
        [196, 246.94, 293.66, 392],
        [164.81, 196, 246.94, 293.66],
      ],
      sunset: [
        [261.63, 329.63, 392, 493.88],
        [220, 261.63, 329.63, 392],
        [293.66, 349.23, 440, 523.25],
        [196, 246.94, 293.66, 349.23],
      ],
      forest: [
        [196, 246.94, 293.66],
        [220, 261.63, 329.63],
        [261.63, 329.63, 392],
        [174.61, 220, 261.63],
      ],
      cyan: [
        [130.81, 196, 261.63],
        [116.54, 174.61, 233.08],
        [98.0, 146.83, 196.0],
        [110.0, 164.81, 220.0],
      ],
      amber: [
        [220, 277.18, 329.63],
        [164.81, 207.65, 246.94],
        [185.0, 220, 277.18],
        [146.83, 185.0, 220],
      ],
    };

    let step = 0;
    const baseIntervalMs = Math.round((60000 / this.currentTrack.bpm) / 2);

    this.sequenceTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;

      const now = performance.now();
      const deltaSec = ((now - this.lastTickEpoch) / 1000) * this.playbackRate;
      this.lastTickEpoch = now;
      this.playbackPositionSec += deltaSec;

      if (this.playbackPositionSec >= this.currentTrack.duration) {
        this.playbackPositionSec = 0;
      }

      const themeKey = this.currentTrack.coverArtTheme || 'neon';
      const chords = synthScales[themeKey] || synthScales.neon;
      const chordIndex = Math.floor(step / 8) % chords.length;
      const currentChord = chords[chordIndex];

      const t = this.ctx.currentTime;

      if (step % 4 === 0) this.triggerKick(t);
      if (step % 8 === 4) this.triggerSnare(t);
      this.triggerHiHat(t, step % 2 === 1);
      if (step % 2 === 0) this.triggerBass(t, currentChord[0] / 2);
      this.triggerArp(t, currentChord[step % currentChord.length]);

      step++;
      this.notify();
    }, Math.round(baseIntervalMs / this.playbackRate));
  }

  private triggerKick(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  private triggerSnare(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gOsc = this.ctx.createGain();
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
    gOsc.gain.setValueAtTime(0.2, t);
    gOsc.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gOsc);
    gOsc.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.13);

    const noiseOsc = this.ctx.createOscillator();
    const gNoise = this.ctx.createGain();
    noiseOsc.type = 'triangle';
    noiseOsc.frequency.setValueAtTime(800, t);
    noiseOsc.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    gNoise.gain.setValueAtTime(0.15, t);
    gNoise.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noiseOsc.connect(gNoise);
    gNoise.connect(this.musicGain);
    noiseOsc.start(t);
    noiseOsc.stop(t + 0.11);
  }

  private triggerHiHat(t: number, open: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(7000, t);
    const dur = open ? 0.1 : 0.035;
    gain.gain.setValueAtTime(open ? 0.08 : 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  private triggerBass(t: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.29);
  }

  private triggerArp(t: number, freq: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.23);
  }
}

/**
 * MusicProviderRegistry / Factory
 * Manages registered providers and enforces that unimplemented providers
 * throw an explicit error rather than secretly playing demo audio.
 */
export class MusicProviderRegistry {
  private static providers: Map<MusicProviderType, IMusicProvider> = new Map();

  public static register(provider: IMusicProvider): void {
    this.providers.set(provider.providerType, provider);
  }

  public static get(type: MusicProviderType): IMusicProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Music provider "${type}" is not implemented yet.`);
    }
    return provider;
  }

  public static has(type: MusicProviderType): boolean {
    return this.providers.has(type);
  }

  public static getRegisteredTypes(): MusicProviderType[] {
    return Array.from(this.providers.keys());
  }
}

// Automatically register default DemoMusicProvider and YouTubeProvider
MusicProviderRegistry.register(new DemoMusicProvider());
MusicProviderRegistry.register(new YouTubeProvider());
