import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Users,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Disc3,
  ChevronDown,
  Repeat
} from 'lucide-react';
import { AudioTrack, Participant } from '../types';
import { VisualizerCanvas } from './VisualizerCanvas';

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
  onOpenSourceSelector,
  onOpenRoomManager,
  onPullShade,
}) => {
  const [isLooping, setIsLooping] = useState<boolean>(true);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, (positionSec / (currentTrack.duration || 1)) * 100);

  const handleSkipBack10 = () => {
    onSeek(Math.max(0, positionSec - 10));
  };

  const handleSkipForward10 = () => {
    onSeek(Math.min(currentTrack.duration, positionSec + 10));
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 text-slate-100 overflow-y-auto relative select-none">
      {/* Top Bar inside Screen */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
        <button
          onClick={onOpenRoomManager}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold text-indigo-300 hover:border-indigo-500/50 transition-colors shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Room: {roomCode}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSourceSelector}
            className="px-2.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-[11px] font-medium text-indigo-200 hover:bg-indigo-900/40 transition-colors flex items-center gap-1"
            title="Change Audio Source"
          >
            <Radio className="w-3 h-3 text-indigo-400" />
            <span className="truncate max-w-[120px]">
              {currentTrack.sourceType === 'system_capture' ? 'Any App Capture' : currentTrack.sourceApp}
            </span>
            <ChevronDown className="w-3 h-3 text-indigo-400" />
          </button>
        </div>
      </div>

      {/* Main Player Centerpiece */}
      <div className="flex-1 flex flex-col items-center justify-center my-3 max-w-md mx-auto w-full">
        {/* Album Art with peaking Vinyl Disc animation */}
        <div className="relative group my-2">
          {/* Peaking Spinning Vinyl Disc */}
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

          {/* Main Album Artwork Sleeve */}
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

        {/* Scrubber Timeline */}
        <div className="w-full px-1 mt-2">
          <input
            type="range"
            min="0"
            max={currentTrack.duration || 100}
            value={positionSec}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
            <span>{formatTime(positionSec)}</span>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Playback Transport Controls */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
          {/* Skip -10s */}
          <button
            onClick={handleSkipBack10}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Previous Track */}
          <button
            onClick={onPrevTrack}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all"
            title={isPlaying ? 'Pause Sync' : 'Broadcast Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={onNextTrack}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Skip +10s */}
          <button
            onClick={handleSkipForward10}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
            title="Forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Clean, Dedicated Volume & Audio Listening Bar */}
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 my-1.5 flex items-center justify-between gap-3 shadow-sm">
          {/* Mute / Unmute Button */}
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

          {/* Volume Slider */}
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

          {/* Loop / Repeat Toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-xl transition-colors ${
              isLooping
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isLooping ? 'Repeat playlist enabled' : 'Repeat disabled'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Synchronized Peers Teaser */}
      <div className="w-full space-y-2 max-w-md mx-auto">
        {/* Room participants preview banner */}
        <div
          onClick={onOpenRoomManager}
          className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors text-xs"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 overflow-hidden">
              {participants.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className={`w-6 h-6 rounded-full ${p.avatarColor} ring-2 ring-slate-900 flex items-center justify-center text-[10px] font-bold text-white`}
                >
                  {p.name.charAt(0)}
                </div>
              ))}
            </div>
            <span className="font-medium text-slate-300">
              {participants.length} Devices Synced
            </span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-400">Manage Room &rarr;</span>
        </div>
      </div>
    </div>
  );
};
