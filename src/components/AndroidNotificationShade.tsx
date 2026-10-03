import React from 'react';
import { Play, Pause, SkipForward, Radio, Wifi, ShieldCheck, ChevronUp, Users } from 'lucide-react';
import { AudioTrack, Participant } from '../types';

interface AndroidNotificationShadeProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  currentTrack: AudioTrack;
  positionSec: number;
  participants: Participant[];
  isLowLatencyMode: boolean;
  onToggleLowLatency: () => void;
  isWifiDirect: boolean;
  onToggleWifiDirect: () => void;
}

export const AndroidNotificationShade: React.FC<AndroidNotificationShadeProps> = ({
  isOpen,
  onClose,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  currentTrack,
  positionSec,
  participants,
  isLowLatencyMode,
  onToggleLowLatency,
  isWifiDirect,
  onToggleWifiDirect,
}) => {
  if (!isOpen) return null;

  const progressPercent = Math.min(100, (positionSec / (currentTrack.duration || 1)) * 100);

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col p-5 animate-in slide-in-from-top-6 duration-200 text-slate-100 overflow-y-auto">
      {/* Top Handle */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Radio className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-slate-200">Android System Notifications</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Close shade"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Settings Grid (Active Network & Sync Toggles) */}
      <div className="grid grid-cols-2 gap-2.5 my-4">
        {/* Quick Setting Tile 1: Wi-Fi Direct */}
        <button
          onClick={onToggleWifiDirect}
          className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
            isWifiDirect ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-900 border border-slate-800 text-slate-300'
          }`}
        >
          <div className={`p-2 rounded-xl ${isWifiDirect ? 'bg-indigo-700' : 'bg-slate-800'}`}>
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold leading-tight">Wi-Fi Direct</div>
            <div className="text-[10px] text-slate-300/80">{isWifiDirect ? 'P2P Active' : 'Off'}</div>
          </div>
        </button>

        {/* Quick Setting Tile 2: Low-Latency Mode */}
        <button
          onClick={onToggleLowLatency}
          className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
            isLowLatencyMode ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-900 border border-slate-800 text-slate-300'
          }`}
        >
          <div className={`p-2 rounded-xl ${isLowLatencyMode ? 'bg-emerald-700' : 'bg-slate-800'}`}>
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold leading-tight">Ultra-Sync</div>
            <div className="text-[10px] text-slate-300/80">{isLowLatencyMode ? 'Low Latency (20ms)' : 'Standard Buffer'}</div>
          </div>
        </button>
      </div>

      {/* Android 14 Media Player Card Notification */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 shadow-xl my-2">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>AudioPlaybackCapture · Foreground Service</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <Users className="w-3 h-3" />
            <span>{participants.length} Devices Synced</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dynamic Cover Artwork Thumb */}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentTrack.colorGradient} flex items-center justify-center shadow-md shrink-0 border border-white/10`}>
            <Radio className="w-6 h-6 text-white/80 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
            <p className="text-xs text-slate-400 truncate">{currentTrack.artist}</p>
            <p className="text-[10px] text-indigo-400/90 font-mono mt-0.5 truncate">{currentTrack.sourceApp}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-slate-900" /> : <Play className="w-4 h-4 fill-slate-900 translate-x-0.5" />}
            </button>
            <button
              onClick={onNextTrack}
              className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Swipe up hint */}
      <div className="mt-auto pt-4 flex flex-col items-center justify-center text-xs text-slate-500">
        <button onClick={onClose} className="w-12 h-1.5 rounded-full bg-slate-700 hover:bg-slate-500 transition-colors my-2" />
        <span>Tap or swipe up to dismiss</span>
      </div>
    </div>
  );
};
