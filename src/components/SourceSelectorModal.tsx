import React, { useState } from 'react';
import { Radio, Music, Youtube, X, Check, AlertCircle, Play } from 'lucide-react';
import { AudioTrack } from '../types';
import { PRESET_TRACKS } from '../services/audioEngine';
import { parseYouTubeVideoId } from '../utils/youtubeParser';

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSourceType: string;
  onSelectTrack: (track: AudioTrack) => void;
}

export const SourceSelectorModal: React.FC<SourceSelectorModalProps> = ({
  isOpen,
  onClose,
  currentSourceType,
  onSelectTrack,
}) => {
  const [youtubeUrlInput, setYoutubeUrlInput] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoadYouTubeUrl = (urlToParse?: string) => {
    setUrlError(null);
    const targetInput = (urlToParse !== undefined ? urlToParse : youtubeUrlInput).trim();
    
    console.log(`[YouTubeInput] rawInput: "${urlToParse !== undefined ? urlToParse : youtubeUrlInput}"`);
    console.log(`[YouTubeInput] normalizedInput: "${targetInput}"`);

    const result = parseYouTubeVideoId(targetInput);

    console.log(`[YouTubeInput] parsedVideoId: ${result.videoId}`);
    console.log(`[YouTubeInput] validationResult: ${result.error ? 'Error' : 'Success'}`);

    if (result.error) {
      setUrlError(result.error);
      return;
    }

    if (result.videoId) {
      const track: AudioTrack = {
        id: `youtube:${result.videoId}`,
        title: `YouTube Video (${result.videoId})`,
        artist: 'YouTube Embedded Player',
        album: 'YouTube Single Video',
        sourceApp: 'YouTube',
        sourceType: 'youtube_sync',
        provider: 'youtube',
        duration: 0,
        colorGradient: 'from-red-600 via-rose-700 to-slate-950',
        coverArtTheme: 'neon',
        bpm: 120,
        sourceId: result.videoId,
      };

      onSelectTrack(track);
      setYoutubeUrlInput('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Select Music Source</h3>
            <p className="text-xs text-slate-400">Choose between Demo synth tracks and YouTube video URLs</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Options List */}
        <div className="overflow-y-auto py-3 space-y-4 flex-1 pr-1">
          {/* Section 1: YouTube Provider (P1-B Active Feature) */}
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-950/20 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-600/20 text-red-400">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">YouTube Video Integration</span>
                  <span className="text-[9px] bg-red-500/20 text-red-300 font-mono px-1.5 py-0.5 rounded border border-red-500/30">
                    P1-B Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste a YouTube video URL to synchronize playback in the official embedded player.
                </p>
              </div>
            </div>

            {/* URL Input Box */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrlInput}
                  onChange={(e) => {
                    setYoutubeUrlInput(e.target.value);
                    setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLoadYouTubeUrl();
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                />
                <button
                  onClick={() => handleLoadYouTubeUrl()}
                  className="px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shrink-0 flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Load Video
                </button>
              </div>

              {/* Sample test URL button */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500">Quick Test:</span>
                <button
                  onClick={() => handleLoadYouTubeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Lofi Beats (jfKfPfyJRdk)
                </button>
                <button
                  onClick={() => handleLoadYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Rick Astley (dQw4w9WgXcQ)
                </button>
              </div>

              {/* Validation & Error Alert */}
              {urlError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Demo Synth Provider */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 px-1">Demo Synthesizer Presets</div>
            <div className="space-y-2">
              {PRESET_TRACKS.map((track) => (
                <div
                  key={track.id}
                  onClick={() => {
                    onSelectTrack(track);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    currentSourceType === track.sourceType && track.provider === 'demo'
                      ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{track.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">{track.artist} · Demo</div>
                      </div>
                    </div>
                    {currentSourceType === track.sourceType && track.provider === 'demo' && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Spotify & Apple Music (Unimplemented) */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-500 px-1">Other Providers (Unimplemented)</div>
            <div className="p-3 rounded-2xl border border-slate-800/50 bg-slate-950/30 opacity-50 cursor-not-allowed flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400">Spotify & Apple Music</div>
                  <div className="text-[10px] text-slate-600">Not implemented in P1-B</div>
                </div>
              </div>
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
