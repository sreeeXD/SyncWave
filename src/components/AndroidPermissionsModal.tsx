import React from 'react';
import { ShieldAlert, Mic, Bell, Radio, Check, X } from 'lucide-react';
import { AndroidPermissionState } from '../types';

interface AndroidPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: AndroidPermissionState;
  onTogglePermission: (key: keyof AndroidPermissionState) => void;
}

export const AndroidPermissionsModal: React.FC<AndroidPermissionsModalProps> = ({
  isOpen,
  onClose,
  permissions,
  onTogglePermission,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Android System Permissions</h3>
              <p className="text-xs text-slate-400">Required for universal audio capture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission items list */}
        <div className="py-4 space-y-3">
          {/* Permission 1: MediaProjection */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white">MediaProjection Audio Capture</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Captures system audio mixer without root</div>
              </div>
            </div>
            <button
              onClick={() => onTogglePermission('captureAudioOutput')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                permissions.captureAudioOutput
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {permissions.captureAudioOutput ? 'Granted' : 'Grant'}
            </button>
          </div>

          {/* Permission 2: RECORD_AUDIO */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white">Record Audio (AudioRecord API)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Used by AudioPlaybackCapture buffer</div>
              </div>
            </div>
            <button
              onClick={() => onTogglePermission('recordAudio')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                permissions.recordAudio
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {permissions.recordAudio ? 'Granted' : 'Grant'}
            </button>
          </div>

          {/* Permission 3: Notification Listener */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white">Notification Listener Service</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Reads title & artist from Spotify/YouTube</div>
              </div>
            </div>
            <button
              onClick={() => onTogglePermission('notificationAccess')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                permissions.notificationAccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {permissions.notificationAccess ? 'Granted' : 'Grant'}
            </button>
          </div>

          {/* Android Security Notice Box */}
          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-200 leading-relaxed">
            <strong>Android 14 Sandbox:</strong> AudioPlaybackCapture only captures apps that allow sharing (AudioAttributes.USAGE_MEDIA). Private phone calls and voice notes are hardware-isolated by Android OS.
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
