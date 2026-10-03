import React from 'react';

interface AndroidDeviceFrameProps {
  children: React.ReactNode;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export const AndroidDeviceFrame: React.FC<AndroidDeviceFrameProps> = ({
  children,
  volume,
  onVolumeChange,
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center sm:p-4">
      {/* Mobile view: edge-to-edge native full-screen. Desktop/Laptop: Sleek Android phone canvas */}
      <div className="relative w-full h-full min-h-screen sm:min-h-0 sm:w-[410px] sm:h-[840px] sm:rounded-[52px] bg-slate-950 sm:border-[10px] sm:border-slate-800/90 sm:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] sm:ring-1 sm:ring-slate-700/60 overflow-hidden flex flex-col">
        {/* Physical Volume Rocker on left side of phone bezel (desktop only) */}
        <div className="hidden sm:flex flex-col gap-3 absolute -left-3.5 top-32 z-20">
          <button
            onClick={() => onVolumeChange(Math.min(100, volume + 10))}
            className="w-2.5 h-12 bg-slate-700 hover:bg-slate-600 rounded-l active:scale-95 transition-all shadow-md"
            title="Hardware Volume Up"
          />
          <button
            onClick={() => onVolumeChange(Math.max(0, volume - 10))}
            className="w-2.5 h-12 bg-slate-700 hover:bg-slate-600 rounded-l active:scale-95 transition-all shadow-md"
            title="Hardware Volume Down"
          />
        </div>

        {/* Screen Content */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative pt-safe-area sm:pt-0">
          {children}
        </div>

        {/* Android Gesture Navigation Bar at bottom (desktop preview only) */}
        <div className="hidden sm:flex w-full h-5 bg-slate-950 items-center justify-center shrink-0 z-30 pb-1">
          <div className="w-32 h-1 rounded-full bg-slate-600/80 hover:bg-slate-400 transition-colors" />
        </div>
      </div>
    </div>
  );
};

