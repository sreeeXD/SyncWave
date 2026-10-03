import React, { useState, useEffect } from 'react';
import { Activity, Clock, ShieldCheck, Zap } from 'lucide-react';
import { globalClockSync, SyncStats } from '../services/clockSync';

interface AudioLatencyMeterProps {
  isPlaying: boolean;
  participantCount: number;
}

export const AudioLatencyMeter: React.FC<AudioLatencyMeterProps> = ({ isPlaying, participantCount }) => {
  const [stats, setStats] = useState<SyncStats>(globalClockSync.getStats());

  useEffect(() => {
    const timer = setInterval(() => {
      // Simulate periodic high-accuracy NTP ping-pong exchanges with random low-variance network noise
      const now = Date.now();
      const t0 = now;
      const t1 = now + 12 + (Math.random() * 4 - 2);
      const t2 = t1 + 2;
      const t3 = t2 + 13 + (Math.random() * 4 - 2);

      const updated = globalClockSync.processNtpExchange(t0, t1, t2, t3);
      setStats({ ...updated });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  const isTightSync = Math.abs(stats.offsetMs) < 15;

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-300">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/70">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>Christian’s Algorithm Synchronization Engine</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${isTightSync ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-medium text-emerald-400">
            {isTightSync ? 'Phase-Locked (<15ms)' : 'Catching Up'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {/* Metric 1: Clock Offset */}
        <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 mb-0.5 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>Offset (Δt)</span>
          </div>
          <div className="text-sm font-bold font-mono text-white tabular-nums">
            {stats.offsetMs > 0 ? `+${stats.offsetMs}` : stats.offsetMs}ms
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">Reference Clock</div>
        </div>

        {/* Metric 2: Round Trip Delay */}
        <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 mb-0.5 flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>RTT</span>
          </div>
          <div className="text-sm font-bold font-mono text-white tabular-nums">
            {stats.roundTripDelayMs}ms
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">Ping-Pong RTT</div>
        </div>

        {/* Metric 3: Jitter StdDev */}
        <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 mb-0.5 flex items-center justify-center gap-1">
            <Activity className="w-3 h-3 text-fuchsia-400" />
            <span>Jitter</span>
          </div>
          <div className="text-sm font-bold font-mono text-white tabular-nums">
            ±{stats.jitterMs}ms
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">Variance</div>
        </div>

        {/* Metric 4: Buffer Safety */}
        <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 mb-0.5 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Buffer</span>
          </div>
          <div className="text-sm font-bold font-mono text-white tabular-nums">
            20ms
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">Opus Frame</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>Audio Codec: <strong className="text-slate-200">Opus 48kHz Stereo</strong></span>
        <span>Active Peers: <strong className="text-slate-200">{participantCount} Devices</strong></span>
      </div>
    </div>
  );
};
