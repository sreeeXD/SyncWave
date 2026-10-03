import React, { useRef, useEffect } from 'react';
import { globalAudioEngine } from '../services/audioEngine';

interface VisualizerCanvasProps {
  isPlaying: boolean;
  theme?: 'neon' | 'sunset' | 'forest' | 'cyan' | 'amber';
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ isPlaying, theme = 'neon' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const analyser = globalAudioEngine.getAnalyser();

    // Data buffers
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    const timeArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeArray);
      } else {
        // Subtle resting idle wave
        const time = performance.now() / 800;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.max(8, Math.sin(time + i * 0.15) * 18 + 20);
        }
      }

      // Draw mirrored frequency spectrum bars
      const barCount = 28;
      const barWidth = (width / barCount) * 0.65;
      const barSpacing = (width / barCount) * 0.35;

      // Color palettes according to theme
      let primaryColor = '#818cf8'; // indigo
      let secondaryColor = '#c084fc'; // purple
      if (theme === 'sunset') {
        primaryColor = '#fb923c';
        secondaryColor = '#f43f5e';
      } else if (theme === 'forest') {
        primaryColor = '#34d399';
        secondaryColor = '#2dd4bf';
      } else if (theme === 'cyan') {
        primaryColor = '#38bdf8';
        secondaryColor = '#60a5fa';
      }

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, `${primaryColor}22`);
      gradient.addColorStop(0.5, primaryColor);
      gradient.addColorStop(1, secondaryColor);

      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        // Average a chunk of frequencies
        const freqIndex = Math.floor((i / barCount) * (bufferLength / 2));
        const val = dataArray[freqIndex] || 0;
        const normalized = val / 255;
        const barHeight = Math.max(4, normalized * (height * 0.85));

        const x = i * (barWidth + barSpacing) + barSpacing / 2;
        const y = height - barHeight;

        // Rounded pill bars
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, height);
        ctx.lineTo(x, height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      // Draw smooth stereo phase line over the top
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `${secondaryColor}88`;
      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = (timeArray[i] || 128) / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, theme]);

  return (
    <div className="w-full h-24 relative overflow-hidden rounded-2xl bg-slate-950/40 border border-slate-800/60 p-2 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={360}
        height={90}
        className="w-full h-full block"
      />
      <div className="absolute top-2 right-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 select-none">
        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
        <span>{isPlaying ? 'PCM 48kHz Stereo' : 'Audio Standby'}</span>
      </div>
    </div>
  );
};
