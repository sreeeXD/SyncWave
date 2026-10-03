import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Radio,
  Volume2,
  VolumeX,
  Disc3,
  ChevronDown,
  Repeat,
  Lock,
  Crown,
  Youtube,
  AlertTriangle,
  Touchpad,
  Loader2,
} from 'lucide-react';
import { AudioTrack, Participant } from '../types';
import { VisualizerCanvas } from './VisualizerCanvas';
import { globalAudioEngine } from '../services/audioEngine';
import { YouTubeProvider } from '../services/YouTubeProvider';

interface PlaybackScreenProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  currentTrack: AudioTrack;
  positionSec: number;
  onSeek: (positionSec: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  participants: Participant[];
  roomCode: string;
  isHost?: boolean;
  onOpenSourceSelector: () => void;
  onOpenRoomManager: () => void;
  onPullShade: () => void;
}

export const PlaybackScreen: React.FC<PlaybackScreenProps> = ({
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  currentTrack,
  positionSec,
  onSeek,
  volume,
  onVolumeChange,
  participants,
  roomCode,
  isHost = true,
  onOpenSourceSelector,
  onOpenRoomManager,
}) => {
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);

  // ─── YouTube position slider state ────────────────────────────────────────
  // We maintain a local display position that updates from the provider's poll.
  // While the user is dragging, we freeze it at the drag position.
  const [displayPosition, setDisplayPosition] = useState<number>(positionSec);
  const isDraggingRef = useRef<boolean>(false);
  const dragValueRef = useRef<number>(positionSec);

  // ─── YouTube player container ref ─────────────────────────────────────────
  // This ref is attached to the div that becomes the YT.Player container.
  // React guarantees this ref is populated before the useEffect fires.
  const ytContainerRef = useRef<HTMLDivElement | null>(null);

  // ─── Provider state ───────────────────────────────────────────────────────
  const isYouTube = currentTrack.provider === 'youtube';

  // Derive YouTube provider and its state on every render
  const getYtProvider = (): YouTubeProvider | null => {
    const p = globalAudioEngine.getActiveProvider();
    return isYouTube && p instanceof YouTubeProvider ? p : null;
  };

  const [ytError, setYtError] = useState<string | null>(null);
  const [ytAutoplayBlocked, setYtAutoplayBlocked] = useState<boolean>(false);
  const [ytPlayerReady, setYtPlayerReady] = useState<boolean>(false);

  // ─── Attach YouTube container element to provider ─────────────────────────
  // This useEffect fires after the YouTube player container div mounts in DOM.
  // It calls setContainerElement() to give the provider the real DOM element.
  // On cleanup (when track switches away from YouTube), it passes null.
  useEffect(() => {
    if (!isYouTube) return;

    const provider = getYtProvider();
    if (!provider) return;

    const el = ytContainerRef.current;
    if (el) {
      console.log('[PlaybackScreen] Mounting: calling setContainerElement(element)');
      provider.setContainerElement(el);
    }

    return () => {
      console.log('[PlaybackScreen] Unmounting: calling setContainerElement(null)');
      // Only clear if the provider hasn't changed
      const currentProvider = globalAudioEngine.getActiveProvider();
      if (currentProvider instanceof YouTubeProvider) {
        currentProvider.setContainerElement(null);
      }
    };
    // Re-run when track changes (isYouTube changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube, currentTrack.id]);

  // ─── Subscribe to AudioEngine for provider state updates ──────────────────
  useEffect(() => {
    const unsub = globalAudioEngine.subscribe(() => {
      const yt = getYtProvider();
      if (yt) {
        setYtError(yt.getErrorMessage());
        setYtAutoplayBlocked(yt.isAutoplayBlocked());
        setYtPlayerReady(yt.isReady());
      } else {
        setYtError(null);
        setYtAutoplayBlocked(false);
        setYtPlayerReady(false);
      }

      // Update display position from provider unless user is dragging
      if (!isDraggingRef.current) {
        setDisplayPosition(globalAudioEngine.getPosition());
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube]);

  // ─── Sync displayPosition with positionSec prop when not dragging ─────────
  // For non-YouTube (Demo) tracks, positionSec comes from App.tsx AudioEngine sub.
  useEffect(() => {
    if (!isDraggingRef.current && !isYouTube) {
      setDisplayPosition(positionSec);
    }
  }, [positionSec, isYouTube]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const showNonHostNotice = () => {
    setNotice('Only the Room Host can control room playback.');
    setTimeout(() => setNotice(null), 3000);
  };

  // ─── Transport handlers ───────────────────────────────────────────────────
  const handlePlayClick = () => {
    if (roomCode && !isHost) { showNonHostNotice(); return; }
    onTogglePlay();
  };

  const handlePrevClick = () => {
    if (roomCode && !isHost) { showNonHostNotice(); return; }
    onPrevTrack();
  };

  const handleNextClick = () => {
    if (roomCode && !isHost) { showNonHostNotice(); return; }
    onNextTrack();
  };

  const handleSkipBack10 = () => {
    if (roomCode && !isHost) { showNonHostNotice(); return; }
    const target = Math.max(0, displayPosition - 10);
    setDisplayPosition(target);
    onSeek(target);
  };

  const handleSkipForward10 = () => {
    if (roomCode && !isHost) { showNonHostNotice(); return; }
    const max = currentTrack.duration || 100;
    const target = Math.min(max, displayPosition + 10);
    setDisplayPosition(target);
    onSeek(target);
  };

  // ─── Slider drag handlers ─────────────────────────────────────────────────
  // While dragging: show user's selected position without fighting polling.
  // On release: send SEEK to the sync engine, then resume polling.
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (roomCode && !isHost) return; // Non-host cannot seek
    const val = parseFloat(e.target.value);
    dragValueRef.current = val;
    setDisplayPosition(val);
  };

  const handleSliderPointerDown = () => {
    if (roomCode && !isHost) return;
    isDraggingRef.current = true;
  };

  const handleSliderPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const target = dragValueRef.current;
    console.log(`[PlaybackScreen] Slider pointer up at ${target.toFixed(2)}s — sending SEEK`);
    onSeek(target);
  }, [onSeek]);

  const handleTapToSyncAutoplay = () => {
    const yt = getYtProvider();
    if (yt) yt.userInteractAndPlay();
  };

  // Whether SyncWave transport controls should be functionally disabled
  // (YouTube player not yet ready — buttons still visible, but clicking play
  // when player isn't ready would do nothing, so we dim them slightly)
  const isYtControlsDisabled = isYouTube && !ytPlayerReady;

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 text-slate-100 overflow-y-auto relative select-none">
      {/* Non-Host Warning Notice Banner */}
      {notice && (
        <div className="absolute top-14 left-4 right-4 z-40 bg-amber-500 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Bar inside Screen */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
        <button
          onClick={onOpenRoomManager}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold text-indigo-300 hover:border-indigo-500/50 transition-colors shadow-sm"
        >
          <span className={`w-2 h-2 rounded-full ${roomCode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{roomCode ? `Room: ${roomCode}` : 'No Room (Tap to Join)'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {roomCode && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border ${
                isHost
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isHost ? <Crown className="w-3 h-3 text-amber-400" /> : <Lock className="w-3 h-3 text-slate-400" />}
              <span>{isHost ? 'Host' : 'Listener'}</span>
            </span>
          )}

          <button
            onClick={onOpenSourceSelector}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 border ${
              isYouTube
                ? 'bg-red-950/70 border-red-800/80 text-red-200 hover:bg-red-900/50'
                : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/40'
            }`}
            title="Music Provider Selector"
          >
            {isYouTube ? <Youtube className="w-3 h-3 text-red-400" /> : <Radio className="w-3 h-3 text-indigo-400" />}
            <span className="truncate max-w-[110px]">{currentTrack.sourceApp}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Main Player Centerpiece */}
      <div className="flex-1 flex flex-col items-center justify-center my-2 max-w-md mx-auto w-full">
        {isYouTube ? (
          /* ── OFFICIAL YOUTUBE EMBEDDED PLAYER ── */
          <div className="w-full my-2 space-y-2">
            {/* Autoplay User-Action Prompt Banner — ABOVE player, never overlapping */}
            {ytAutoplayBlocked && (
              <div
                onClick={handleTapToSyncAutoplay}
                className="w-full p-3 bg-red-950/80 border border-red-500/50 rounded-2xl cursor-pointer hover:bg-red-900/80 transition-all flex items-center justify-between shadow-lg text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-600/30 text-red-400 shrink-0">
                    <Touchpad className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Tap to Sync & Play YouTube Video</h4>
                    <p className="text-[10px] text-slate-300">
                      User tap required by Android/Browser to start video playback.
                    </p>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md shrink-0">
                  Tap to Start
                </button>
              </div>
            )}

            {/* YouTube Error Banner — ABOVE player, never overlapping */}
            {ytError && (
              <div className="w-full p-3 bg-rose-950/90 border border-rose-800 rounded-2xl flex items-center gap-2.5 text-left">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">YouTube Playback Error</h4>
                  <p className="text-[10px] text-rose-300">{ytError}</p>
                </div>
              </div>
            )}

            {/* YouTube Player Loading indicator (before player ready) */}
            {!ytPlayerReady && !ytError && !ytAutoplayBlocked && (
              <div className="w-full p-2 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                <span>Loading YouTube player…</span>
              </div>
            )}

            {/*
              AUTHORITATIVE YOUTUBE PLAYER CONTAINER
              The ref is attached here. React guarantees this DOM element exists
              before the useEffect fires (which calls setContainerElement).
              YT.Player is instantiated directly on this element — no ID string lookup.
            */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black">
              <div ref={ytContainerRef} className="w-full h-full" />
            </div>

            {/* YouTube Track Title & Channel */}
            <div className="text-center px-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {currentTrack.artist || 'YouTube Channel'}
              </p>
            </div>
          </div>
        ) : (
          /* ── DEMO SYNTH VISUALIZER & VINYL DISC ── */
          <>
            <div className="relative group my-2">
              <div
                className={`absolute top-0 right-0 w-44 sm:w-52 h-44 sm:h-52 rounded-full bg-slate-950 border-4 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-700 ${
                  isPlaying
                    ? 'translate-x-10 sm:translate-x-14 rotate-180 animate-spin [animation-duration:4s]'
                    : 'translate-x-2'
                }`}
              >
                <div className="w-16 h-16 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center">
                  <Disc3 className="w-8 h-8 text-indigo-400" />
                </div>
              </div>

              <div
                onClick={onOpenSourceSelector}
                className={`relative z-10 w-44 sm:w-52 h-44 sm:h-52 rounded-3xl bg-gradient-to-br ${currentTrack.colorGradient} p-4 shadow-2xl border border-white/15 cursor-pointer flex flex-col justify-between overflow-hidden transform transition-transform group-hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/70 font-semibold">
                    SyncWave · Live Feed
                  </span>
                  <span className="text-[10px] bg-black/40 backdrop-blur-md text-white font-mono px-2 py-0.5 rounded-full">
                    {currentTrack.bpm} BPM
                  </span>
                </div>

                <div className="my-auto flex items-center justify-center">
                  <Radio
                    className={`w-16 h-16 text-white/90 drop-shadow-lg transition-transform ${
                      isPlaying ? 'scale-110 animate-pulse' : 'scale-95 opacity-70'
                    }`}
                  />
                </div>

                <div className="text-left bg-black/30 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                  <div className="text-[10px] text-white/80 font-mono uppercase tracking-wider truncate">
                    {currentTrack.sourceApp}
                  </div>
                  <div className="text-xs font-bold text-white truncate">{currentTrack.album}</div>
                </div>
              </div>
            </div>

            {/* Track Title & Artist Info */}
            <div className="text-center mt-3 mb-2 w-full px-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">{currentTrack.artist}</p>
            </div>

            {/* Real-time Spectrum Visualizer */}
            <div className="w-full my-1">
              <VisualizerCanvas isPlaying={isPlaying} theme={currentTrack.coverArtTheme} />
            </div>
          </>
        )}

        {/* ── Scrubber Timeline ── */}
        <div className="w-full px-1 mt-2">
          <input
            type="range"
            min="0"
            max={currentTrack.duration || 100}
            step="0.25"
            value={displayPosition}
            onPointerDown={handleSliderPointerDown}
            onChange={handleSliderChange}
            onPointerUp={handleSliderPointerUp}
            disabled={roomCode ? !isHost : false}
            className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 ${
              isYtControlsDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>{formatTime(displayPosition)}</span>
            <span>{formatTime(currentTrack.duration || 0)}</span>
          </div>
        </div>

        {/* ── Playback Transport Controls ── */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
          {/* Skip -10s */}
          <button
            onClick={handleSkipBack10}
            disabled={isYtControlsDisabled}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              isYtControlsDisabled
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Previous Track */}
          <button
            onClick={handlePrevClick}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            onClick={handlePlayClick}
            disabled={isYtControlsDisabled && !ytAutoplayBlocked}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              roomCode && !isHost
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : isYouTube
                ? isYtControlsDisabled
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
            title={
              roomCode && !isHost
                ? 'Playback controlled by Host'
                : isYtControlsDisabled
                ? 'YouTube player loading…'
                : isPlaying
                ? 'Pause Sync'
                : 'Broadcast Play'
            }
          >
            {isYtControlsDisabled ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={handleNextClick}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Skip +10s */}
          <button
            onClick={handleSkipForward10}
            disabled={isYtControlsDisabled}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              isYtControlsDisabled
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Volume Slider Bar ── */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 my-1.5 flex items-center justify-between gap-3 shadow-sm">
          <button
            onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
            className="p-1 rounded-xl text-slate-400 hover:text-white transition-colors"
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-8 text-right">
              {volume}%
            </span>
          </div>

          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-xl transition-colors ${
              isLooping ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isLooping ? 'Repeat playlist enabled' : 'Repeat disabled'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Synchronized Peers Teaser */}
      <div className="w-full space-y-2 max-w-md mx-auto">
        <div
          onClick={onOpenRoomManager}
          className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors text-xs"
        >
          <div className="flex items-center gap-2">
            {participants.length > 0 && (
              <div className="flex -space-x-1.5 overflow-hidden">
                {participants.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className={`w-6 h-6 rounded-full ${p.avatarColor || 'bg-indigo-600'} ring-2 ring-slate-900 flex items-center justify-center text-[10px] font-bold text-white`}
                  >
                    {p.name.charAt(0)}
                  </div>
                ))}
              </div>
            )}
            <span className="font-medium text-slate-300">
              {roomCode ? `${participants.length} Devices Synced` : 'Not in a Room'}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-400">
            {roomCode ? 'Manage Room \u2192' : 'Create or Join Room \u2192'}
          </span>
        </div>
      </div>
    </div>
  );
};
