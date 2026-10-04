import { AudioTrack, MusicProviderType } from '../types';
import { IMusicProvider, MusicProviderCapabilities } from './MusicProvider';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// ─── Module-level singletons (survive provider instance recreation) ───────────

let apiLoadPromise: Promise<void> | null = null;

// Diagnostic counters for leak detection
let _playerCreatedCount = 0;
let _playerDestroyedCount = 0;
let _positionLoopStartCount = 0;
let _positionLoopStopCount = 0;

function logDiagnostic(tag: string, extra = '') {
  console.log(
    `[YouTubeDiag] ${tag} | players: created=${_playerCreatedCount} destroyed=${_playerDestroyedCount} active=${_playerCreatedCount - _playerDestroyedCount} | loops: started=${_positionLoopStartCount} stopped=${_positionLoopStopCount} active=${_positionLoopStartCount - _positionLoopStopCount}${extra ? ' | ' + extra : ''}`
  );
}

/**
 * Loads the YouTube IFrame API script exactly once per page lifecycle.
 * Returns the same Promise for every subsequent call.
 */
function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise((resolve) => {
    if (!document.getElementById('youtube-iframe-api-script')) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(script, firstScript);
    }

    // Assign global callback exactly once
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      console.log('[YouTubeProvider] Official YouTube IFrame API Loaded & Ready');
      if (typeof existing === 'function') existing();
      resolve();
    };
  });

  return apiLoadPromise;
}

// ─── YouTubeProvider ──────────────────────────────────────────────────────────

/**
 * P1-B.2 YouTubeProvider
 *
 * KEY ARCHITECTURE CHANGES:
 *  1. Deterministic DOM lifecycle: uses setContainerElement(el) called from a
 *     React useEffect with a real DOM ref. Never queries document.getElementById.
 *  2. Player creation only when BOTH (a) IFrame API ready AND (b) container element set.
 *  3. Generation tokens protect every async path.
 *  4. Leak-proof: player counter, position loop counter, full destroy().
 *  5. Position polling calls notify() so AudioEngine subscribers see updates.
 */
export class YouTubeProvider implements IMusicProvider {
  public id = 'youtube-provider';
  public name = 'Official YouTube Embedded Player';
  public providerType: MusicProviderType = 'youtube';

  public capabilities: MusicProviderCapabilities = {
    play: true,
    pause: true,
    seek: true,
    position: true,
    trackChange: true,
    backgroundPlayback: false,
  };

  private player: any = null;
  private isPlayerReady: boolean = false;
  private currentTrack: AudioTrack | null = null;
  private isPlaying: boolean = false;
  private playbackPositionSec: number = 0;
  private durationSec: number = 0;

  private errorState: string | null = null;
  private autoplayBlocked: boolean = false;
  private autoplayCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  // Generation counter — incremented on every loadTrack() and destroy()
  private loadGeneration: number = 0;

  private onStateChangeCallbacks: Set<() => void> = new Set();

  // Authoritative container element set by React (via setContainerElement).
  // NEVER looked up via document.getElementById.
  private containerElement: HTMLElement | null = null;
  private containerReadyResolve: (() => void) | null = null;
  private containerReadyPromise: Promise<void> | null = null;

  private targetVideoId: string | null = null;
  private positionPollingInterval: ReturnType<typeof window.setInterval> | null = null;

  constructor() {
    // Pre-warm the IFrame API immediately so it's ready by the time
    // setContainerElement is called from React.
    loadYouTubeIframeApi().catch(() => {});
  }

  // ─── Container element lifecycle ─────────────────────────────────────────

  /**
   * Called by React PlaybackScreen via useEffect when the YouTube player
   * container div is mounted in the DOM. This is the authoritative signal
   * that the container is ready — NOT a polling loop.
   */
  public setContainerElement(el: HTMLElement | null): void {
    if (el) {
      console.log('[YouTubeProvider] Container element mounted and received from React.');
      this.containerElement = el;
      if (this.containerReadyResolve) {
        this.containerReadyResolve();
        this.containerReadyResolve = null;
      }
    } else {
      console.log('[YouTubeProvider] Container element unmounted (React cleanup).');
      this.containerElement = null;
      this.containerReadyPromise = null;
    }
  }

  /**
   * Returns a Promise that resolves when the container element is available.
   * If already available, resolves immediately.
   */
  private waitForContainer(): Promise<void> {
    if (this.containerElement) {
      return Promise.resolve();
    }
    if (!this.containerReadyPromise) {
      this.containerReadyPromise = new Promise((resolve) => {
        this.containerReadyResolve = resolve;
      });
    }
    return this.containerReadyPromise;
  }

  // ─── IMusicProvider public interface ─────────────────────────────────────

  public subscribe(cb: () => void) {
    this.onStateChangeCallbacks.add(cb);
    return () => {
      this.onStateChangeCallbacks.delete(cb);
    };
  }

  private notify() {
    this.onStateChangeCallbacks.forEach((cb) => cb());
  }

  public getErrorMessage(): string | null {
    return this.errorState;
  }

  public isAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  public isReady(): boolean {
    return this.isPlayerReady;
  }

  /**
   * Called within a direct user tap gesture to unlock autoplay.
   */
  public async userInteractAndPlay(): Promise<void> {
    if (!this.isPlayerReady || !this.player) {
      console.warn('[YouTubeProvider] userInteractAndPlay called before player is ready.');
      this.errorState = 'YouTube player is loading… Please tap again in a moment.';
      this.notify();
      return;
    }
    console.log('[YouTubeProvider] User gesture → unlocking YouTube player.');
    this.autoplayBlocked = false;
    this.errorState = null;
    this.notify();
    try {
      if (typeof this.player.playVideo === 'function') {
        this.player.playVideo();
      }
    } catch (e) {
      console.error('[YouTubeProvider] userInteractAndPlay exception:', e);
    }
  }

  /**
   * Load a new track. Waits for BOTH IFrame API AND container element.
   */
  public async loadTrack(track: AudioTrack): Promise<void> {
    this.loadGeneration++;
    const gen = this.loadGeneration;

    const videoId = track.sourceId || track.id.replace('youtube:', '');
    console.log(`[YouTubeProvider] loadTrack (Gen #${gen}): ${track.title} | VideoID: ${videoId}`);

    this.currentTrack = track;
    this.errorState = null;
    this.autoplayBlocked = false;
    this.targetVideoId = videoId;
    
    // MUST notify here so React re-renders and creates the container element.
    this.notify();

    if (!videoId || videoId.length < 6) {
      this.errorState = 'Invalid YouTube Video ID.';
      this.notify();
      return;
    }

    // Wait for BOTH conditions simultaneously
    console.log(`[YouTubeProvider] Waiting for IFrame API + container (Gen #${gen})…`);
    await Promise.all([loadYouTubeIframeApi(), this.waitForContainer()]);

    if (gen !== this.loadGeneration) {
      console.warn(`[YouTubeProvider] Aborting loadTrack Gen #${gen} (superseded by Gen #${this.loadGeneration})`);
      return;
    }

    if (!this.containerElement) {
      console.error('[YouTubeProvider] Container element is null after waitForContainer resolved!');
      this.errorState = 'YouTube player container is not available.';
      this.notify();
      return;
    }

    // If player already exists and is ready, reuse via loadVideoById
    if (this.player && this.isPlayerReady) {
      try {
        console.log(`[YouTubeProvider] Reusing existing player. loadVideoById: ${videoId}`);
        this.player.loadVideoById({ videoId });
      } catch (e) {
        console.warn('[YouTubeProvider] loadVideoById failed, recreating player:', e);
        this.createPlayerInstance(videoId, gen);
      }
    } else {
      this.createPlayerInstance(videoId, gen);
    }
  }

  private createPlayerInstance(videoId: string, gen: number): void {
    if (gen !== this.loadGeneration) return;

    if (!window.YT || !window.YT.Player) {
      // Should not happen since loadYouTubeIframeApi was awaited, but guard anyway
      console.error('[YouTubeProvider] YT.Player not available after API load!');
      this.errorState = 'YouTube IFrame API failed to initialize.';
      this.notify();
      return;
    }

    if (!this.containerElement) {
      console.error('[YouTubeProvider] createPlayerInstance: containerElement is null!');
      this.errorState = 'YouTube player container disappeared before player creation.';
      this.notify();
      return;
    }

    // Destroy old player if it exists
    if (this.player) {
      console.log('[YouTubePlayer] Destroying old player before creating new one.');
      this.stopPositionPolling();
      try { this.player.destroy(); } catch (e) {}
      this.player = null;
      _playerDestroyedCount++;
      logDiagnostic('destroy-before-create');
    }

    this.isPlayerReady = false;

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';

    _playerCreatedCount++;
    logDiagnostic('create', `videoId=${videoId} gen=${gen} origin=${origin}`);

    try {
      // Pass the actual DOM element, not a string ID.
      // This eliminates the document.getElementById race condition entirely.
      this.player = new window.YT.Player(this.containerElement, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        host: 'https://www.youtube.com',
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: origin,
        },
        events: {
          onReady: (event: any) => this.onPlayerReady(event, gen),
          onStateChange: (event: any) => this.onPlayerStateChange(event, gen),
          onError: (event: any) => this.onPlayerError(event, gen),
          onAutoplayBlocked: (_event: any) => this.handleAutoplayBlocked(gen),
        },
      });
    } catch (e) {
      console.error('[YouTubeProvider] Exception during YT.Player construction:', e);
      _playerDestroyedCount++; // creation failed — not actually alive
      if (gen === this.loadGeneration) {
        this.errorState = 'Failed to create YouTube player instance.';
        this.notify();
      }
    }
  }

  // ─── YT.Player event handlers ────────────────────────────────────────────

  private onPlayerReady(event: any, gen: number): void {
    if (gen !== this.loadGeneration) return;
    console.log(`[YouTubePlayer] onReady (Gen #${gen}) videoId=${this.targetVideoId}`);
    this.isPlayerReady = true;
    this.errorState = null;

    try {
      const data = event.target.getVideoData?.();
      const dur = event.target.getDuration?.() ?? 0;
      if (this.currentTrack) {
        this.currentTrack = {
          ...this.currentTrack,
          title: (data?.title) || this.currentTrack.title,
          artist: (data?.author) || this.currentTrack.artist || 'YouTube Channel',
          duration: dur > 0 ? dur : this.currentTrack.duration,
        };
        if (dur > 0) this.durationSec = dur;
      }
    } catch (e) {}

    this.startPositionPolling(gen);
    this.notify();
  }

  private handleAutoplayBlocked(gen: number): void {
    if (gen !== this.loadGeneration) return;
    console.warn(`[YouTubePlayer] onAutoplayBlocked (Gen #${gen})`);
    this.autoplayBlocked = true;
    this.isPlaying = false;
    this.notify();
  }

  private onPlayerStateChange(event: any, gen: number): void {
    if (gen !== this.loadGeneration) return;
    const YTState = window.YT?.PlayerState;
    if (!YTState) return;

    console.log(`[YouTubePlayer] State=${event.data} (Gen #${gen})`);

    switch (event.data) {
      case YTState.PLAYING:
        this.isPlaying = true;
        this.autoplayBlocked = false;
        this.errorState = null;
        if (this.autoplayCheckTimeout) {
          clearTimeout(this.autoplayCheckTimeout);
          this.autoplayCheckTimeout = null;
        }
        break;
      case YTState.PAUSED:
        this.isPlaying = false;
        break;
      case YTState.ENDED:
        this.isPlaying = false;
        this.playbackPositionSec = 0;
        break;
      case YTState.BUFFERING:
        // Don't flip isPlaying — it may still be "playing" semantically
        break;
      case YTState.CUED:
      case -1: // UNSTARTED
        this.isPlaying = false;
        break;
    }
    this.notify();
  }

  private onPlayerError(event: any, gen: number): void {
    if (gen !== this.loadGeneration) return;

    const code = event.data;
    const state = this.player && typeof this.player.getPlayerState === 'function'
      ? this.player.getPlayerState()
      : -1;
    console.error(`[YouTubePlayer] Error code=${code} videoId=${this.targetVideoId} state=${state} gen=${gen}`);

    let msg: string;
    switch (code) {
      case 2:   msg = 'Invalid YouTube video ID (Code 2).'; break;
      case 5:   msg = 'HTML5 player error in YouTube embedded frame (Code 5).'; break;
      case 100: msg = 'Video not found, removed, or set to private (Code 100).'; break;
      case 101:
      case 150: msg = 'Video owner does not allow embedded playback (Code 101/150).'; break;
      case 151: msg = 'This YouTube video is unavailable in the current network or account environment (Code 151).'; break;
      case 153: msg = 'YouTube embedding authorization error — missing origin/Referer identity (Code 153).'; break;
      default:  msg = `YouTube player error (Code ${code}).`;
    }

    this.errorState = msg;
    this.isPlaying = false;
    this.notify();
  }

  // ─── Position polling ─────────────────────────────────────────────────────

  /**
   * Exactly ONE polling loop per player. Start after onReady.
   * The loop calls notify() so AudioEngine subscribers receive position updates.
   */
  private startPositionPolling(gen: number): void {
    this.stopPositionPolling();

    _positionLoopStartCount++;
    logDiagnostic('loop-start', `gen=${gen}`);

    let lastNotifyTime = 0;
    this.positionPollingInterval = window.setInterval(() => {
      // Self-stop if generation changed (stale loop)
      if (gen !== this.loadGeneration) {
        this.stopPositionPolling();
        return;
      }

      if (this.player && this.isPlayerReady) {
        try {
          const curr = this.player.getCurrentTime?.();
          const dur = this.player.getDuration?.();
          let changed = false;
          let durChanged = false;

          if (typeof curr === 'number' && !isNaN(curr) && curr !== this.playbackPositionSec) {
            this.playbackPositionSec = curr;
            changed = true;
          }
          if (typeof dur === 'number' && dur > 0 && dur !== this.durationSec) {
            this.durationSec = dur;
            if (this.currentTrack && this.currentTrack.duration !== dur) {
              this.currentTrack = { ...this.currentTrack, duration: dur };
            }
            durChanged = true;
          }

          if (changed || durChanged) {
            const now = Date.now();
            // Throttle position-only notifications to 1Hz, but immediately notify on duration change
            if (durChanged || now - lastNotifyTime >= 1000) {
              lastNotifyTime = now;
              this.notify();
            }
          }
        } catch (e) {}
      }
    }, 250) as unknown as ReturnType<typeof window.setInterval>;
  }

  private stopPositionPolling(): void {
    if (this.positionPollingInterval !== null) {
      window.clearInterval(this.positionPollingInterval as any);
      this.positionPollingInterval = null;
      _positionLoopStopCount++;
      logDiagnostic('loop-stop');
    }
  }

  // ─── Playback control ─────────────────────────────────────────────────────

  public async play(): Promise<void> {
    this.errorState = null;
    if (!this.player || !this.isPlayerReady) {
      console.warn('[YouTubeProvider] play() — player not ready yet');
      return;
    }
    try {
      this.player.playVideo();
      // Detect autoplay block after short grace period
      if (this.autoplayCheckTimeout) clearTimeout(this.autoplayCheckTimeout);
      this.autoplayCheckTimeout = setTimeout(() => {
        this.autoplayCheckTimeout = null;
        if (!this.player || !this.isPlayerReady) return;
        if (this.loadGeneration !== this.loadGeneration) return; // always true, just keep as guard
        try {
          const state = this.player.getPlayerState?.();
          const YTState = window.YT?.PlayerState;
          if (YTState && state === YTState.UNSTARTED) {
            console.warn('[YouTubeProvider] Autoplay check: player is UNSTARTED after playVideo(), assuming blocked');
            this.autoplayBlocked = true;
            this.notify();
          }
        } catch (e) {}
      }, 1500);
    } catch (e) {
      console.error('[YouTubeProvider] playVideo() exception:', e);
      this.autoplayBlocked = true;
      this.notify();
    }
  }

  public pause(): void {
    if (this.player && this.isPlayerReady && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
        this.isPlaying = false;
        this.notify();
      } catch (e) {}
    }
  }

  public seek(positionSec: number): void {
    const safe = Math.max(0, positionSec);
    this.playbackPositionSec = safe;
    if (this.player && this.isPlayerReady && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(safe, true);
        this.notify();
      } catch (e) {}
    }
  }

  public getPosition(): number {
    if (this.player && this.isPlayerReady && typeof this.player.getCurrentTime === 'function') {
      try {
        const t = this.player.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) return t;
      } catch (e) {}
    }
    return this.playbackPositionSec;
  }

  public getDuration(): number {
    if (this.player && this.isPlayerReady && typeof this.player.getDuration === 'function') {
      try {
        const d = this.player.getDuration();
        if (typeof d === 'number' && d > 0) return d;
      } catch (e) {}
    }
    return this.durationSec || this.currentTrack?.duration || 0;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public isBuffering(): boolean {
    if (!this.player || !this.isPlayerReady) return false;
    try {
      return this.player.getPlayerState?.() === window.YT?.PlayerState?.BUFFERING;
    } catch (e) {
      return false;
    }
  }

  public getCurrentTrack(): AudioTrack | null {
    return this.currentTrack;
  }

  public setVolume(vol0to100: number): void {
    if (this.player && this.isPlayerReady && typeof this.player.setVolume === 'function') {
      try {
        this.player.setVolume(Math.max(0, Math.min(100, vol0to100)));
      } catch (e) {}
    }
  }

  // ─── Destroy ─────────────────────────────────────────────────────────────

  public destroy(): void {
    this.loadGeneration++; // Invalidate all in-flight async work
    console.log(`[YouTubeProvider] destroy() Gen #${this.loadGeneration}`);

    this.stopPositionPolling();

    if (this.player) {
      try { this.player.destroy(); } catch (e) {}
      this.player = null;
      _playerDestroyedCount++;
      logDiagnostic('destroy');
    }

    this.isPlayerReady = false;
    this.isPlaying = false;
    this.currentTrack = null;
    this.targetVideoId = null;
    this.containerElement = null;
    this.containerReadyResolve = null;
    this.containerReadyPromise = null;
    if (this.autoplayCheckTimeout) {
      clearTimeout(this.autoplayCheckTimeout);
      this.autoplayCheckTimeout = null;
    }
  }
}
