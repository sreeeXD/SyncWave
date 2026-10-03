import React, { useState, useEffect } from 'react';
import { Wifi, Signal, Battery, Radio, ShieldCheck } from 'lucide-react';

interface AndroidStatusBarProps {
  isBroadcasting?: boolean;
  onPullShade?: () => void;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = ({ isBroadcasting, onPullShade }) => {
  const [currentTime, setCurrentTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      onClick={onPullShade}
      className="w-full h-8 px-6 flex items-center justify-between text-xs font-medium text-slate-300 select-none cursor-pointer z-30 transition-colors hover:bg-white/5 active:bg-white/10"
      title="Tap to pull down Android Notification Shade"
    >
      {/* Left: Clock & App Notification Dot */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[13px] tracking-tight text-white">{currentTime}</span>
        {isBroadcasting && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium animate-pulse">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Broadcasting</span>
          </span>
        )}
      </div>

      {/* Center: Camera punch-hole spacer */}
      <div className="w-4 h-4 rounded-full bg-black border border-slate-800 shadow-inner flex items-center justify-center pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-900/80"></div>
      </div>

      {/* Right: Network, 5G, Battery */}
      <div className="flex items-center gap-2 text-slate-200">
        <span title="Security & MediaProjection Active" className="flex items-center">
          <ShieldCheck className="w-3 h-3 text-indigo-400" />
        </span>
        <Wifi className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold text-slate-300">5G</span>
        <Signal className="w-3.5 h-3.5" />
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] font-mono tabular-nums text-slate-300">92%</span>
          <Battery className="w-4 h-4 fill-slate-200 text-slate-200" />
        </div>
      </div>
    </div>
  );
};
