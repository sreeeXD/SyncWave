import React, { useState } from 'react';
import { ShieldAlert, Cpu, Radio, Clock, Code, X, CheckCircle2, AlertTriangle, Layers, ArrowRight } from 'lucide-react';
import { APP_REQUIREMENTS, ARCHITECTURE_PHASES } from '../data/requirementsData';

interface RequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNativeCode: () => void;
}

export const RequirementsModal: React.FC<RequirementsModalProps> = ({
  isOpen,
  onClose,
  onOpenNativeCode,
}) => {
  const [activeTab, setActiveTab] = useState<'requirements' | 'architecture' | 'solutions'>('requirements');
  const [selectedPhase, setSelectedPhase] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Engineering Specification</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded">Android 10+ (API 29–35)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              Universal Multi-Device Music Sync on Android
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'requirements'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            1. App Requirements & Permissions
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            2. How We Achieve This (Architecture)
          </button>
          <button
            onClick={() => setActiveTab('solutions')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'solutions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            3. Deep-Dive Edge Cases & Solutions
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 text-xs text-indigo-200 leading-relaxed">
                <strong>Executive Summary:</strong> To enable 2 or more Android phones to listen together to any audio stream (Spotify, YouTube Music, SoundCloud, Netflix, local files) in tight synchronization (&lt;15ms drift), the app requires a specific combination of Android 10+ APIs, user consent tokens, low-latency networking, and clock drift compensation algorithms.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {APP_REQUIREMENTS.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between text-xs space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider">
                          {req.category}
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{req.title}</h4>
                      <p className="text-slate-300 leading-relaxed">{req.requirement}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/70 space-y-1.5 text-[11px]">
                      <div className="text-slate-400">
                        <strong className="text-slate-300">Why Needed:</strong> {req.whyNeeded}
                      </div>
                      <div className="text-emerald-400/90 bg-emerald-950/30 p-2 rounded-xl border border-emerald-800/30">
                        <strong className="text-emerald-300">Implementation:</strong> {req.mitigationOrSolution}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ARCHITECTURE PIPELINE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              {/* Architecture Phase Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ARCHITECTURE_PHASES.map((p) => (
                  <button
                    key={p.phase}
                    onClick={() => setSelectedPhase(p.phase)}
                    className={`p-3 rounded-2xl text-left border transition-all text-xs ${
                      selectedPhase === p.phase
                        ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-mono text-[10px] text-indigo-400 font-bold">STAGE 0{p.phase}</div>
                    <div className="font-semibold text-white truncate mt-0.5">{p.title}</div>
                  </button>
                ))}
              </div>

              {/* Selected Phase Detail Card */}
              {(() => {
                const phase = ARCHITECTURE_PHASES.find((p) => p.phase === selectedPhase) || ARCHITECTURE_PHASES[0];
                return (
                  <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-indigo-400">STAGE {phase.phase} OF 4</span>
                      <h3 className="text-lg font-bold text-white mt-0.5">{phase.headline}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{phase.description}</p>
                    </div>

                    {/* Technical Components */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Key Android SDK & Architecture Elements:
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.technicalComponents.map((item, i) => (
                          <span
                            key={i}
                            className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-1 rounded-xl"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Ascii Flow */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Data Flow:
                      </h4>
                      <pre className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-[11px] font-mono text-indigo-300 overflow-x-auto whitespace-pre">
                        {phase.diagramAscii}
                      </pre>
                    </div>

                    {/* Kotlin Code snippet */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Kotlin Implementation:
                      </h4>
                      <pre className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre">
                        {phase.codeHighlight}
                      </pre>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: EDGE CASES & DEEP DIVE SOLUTIONS */}
          {activeTab === 'solutions' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Challenge 1: The Human Hearing Comb-Filtering Problem (&lt;15ms)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  When two phones in the same room play the exact same audio with a 25ms difference, the listener perceives a metallic "phasing" or hollow echo sound (comb filtering). To fix this, <strong>Christian’s Clock Synchronization Algorithm</strong> calculates the crystal oscillator drift of each phone relative to the host. If a phone is drifting behind by 12ms, we do NOT skip frames; instead, we slightly increase the AudioTrack playback speed to 1.01x until phase delta drops under 5ms, then lock back to 1.00x.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Cpu className="w-4 h-4" />
                  <span>Challenge 2: Widevine DRM & Apps That Forbid Capture</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Some paid streaming apps or DRM video players declare <code className="text-indigo-300 font-mono">AudioAttributes.ALLOW_CAPTURE_BY_NONE</code>.
                  In our app, we employ a <strong>Hybrid Fallback Architecture</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  <li><strong>Mode A (System Capture):</strong> Intercepts 95% of audio (Spotify free, YouTube, SoundCloud, games, browser, local audio) via <code className="text-indigo-300 font-mono">AudioPlaybackCapture</code>.</li>
                  <li><strong>Mode B (Shared State Sync):</strong> For DRM-locked apps, our NotificationListenerService & MediaSessionCompat sync the exact track ID and seek position so each phone streams its own legitimate copy with millisecond synchronized start triggers!</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Radio className="w-4 h-4" />
                  <span>Challenge 3: Bluetooth Headphone Latency Compensation</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Friend A is listening through phone speakers (5ms DAC latency), while Friend B is using Bluetooth earbuds (180ms A2DP latency). Android 10+ exposes <code className="text-indigo-300 font-mono">AudioTrack.getPlaybackHeadPosition()</code> and Bluetooth audio latency APIs. SyncWave automatically subtracts the Bluetooth latency buffer from Friend B’s presentation schedule, ensuring both listeners hear every drum hit in unison!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Ready to review native Kotlin implementation?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenNativeCode();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Inspect Native Kotlin Project</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
