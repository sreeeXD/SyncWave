import React from 'react';
import { Radio, Music, Youtube, X, Check } from 'lucide-react';
import { AudioSourceType, AudioTrack } from '../types';
import { PRESET_TRACKS } from '../services/audioEngine';

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSourceType: AudioSourceType;
  onSelectTrack: (track: AudioTrack) => void;
}

export const SourceSelectorModal: React.FC<SourceSelectorModalProps> = ({
  isOpen,
  onClose,
  currentSourceType,
  onSelectTrack,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Select Music Service Source</h3>
            <p className="text-xs text-slate-400">Synchronized control across all connected room devices</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Options List */}
        <div className="overflow-y-auto py-3 space-y-2.5 flex-1 pr-1">
          {/* Option 1: Spotify Connect Remote Sync */}
          <div
            onClick={() => {
              onSelectTrack(PRESET_TRACKS[0]);
              onClose();
            }}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              currentSourceType === 'spotify_sync'
                ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Spotify Connect Remote Sync</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Synchronizes Spotify playback timeline & remote transport controls across devices.
                  </p>
                </div>
              </div>
              {currentSourceType === 'spotify_sync' && <Check className="w-5 h-5 text-indigo-400 shrink-0" />}
            </div>
          </div>

          {/* Option 2: YouTube Music Room Sync */}
          <div
            onClick={() => {
              onSelectTrack(PRESET_TRACKS[2]);
              onClose();
            }}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              currentSourceType === 'youtube_sync'
                ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">YouTube Music Room Sync</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Shared queue & track timeline with millisecond seek alignment.
                  </p>
                </div>
              </div>
              {currentSourceType === 'youtube_sync' && <Check className="w-5 h-5 text-indigo-400 shrink-0" />}
            </div>
          </div>

          {/* Option 3: Cyberwave / Live Synth Stream */}
          <div
            onClick={() => {
              onSelectTrack(PRESET_TRACKS[3]);
              onClose();
            }}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              currentSourceType === 'radio_stream'
                ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Cyberwave / Live Synth Stream</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Broadcasting live synthesized radio with real-time waveform feed.
                  </p>
                </div>
              </div>
              {currentSourceType === 'radio_stream' && <Check className="w-5 h-5 text-indigo-400 shrink-0" />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
