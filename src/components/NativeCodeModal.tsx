import React, { useState } from 'react';
import { Download, Copy, Check, FileCode, Folder, X, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';
import { NATIVE_ANDROID_PROJECT, AndroidCodeFile } from '../data/nativeAndroidCode';

interface NativeCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NativeCodeModal: React.FC<NativeCodeModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<AndroidCodeFile>(NATIVE_ANDROID_PROJECT[1]); // Default to AudioCaptureService.kt
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add readme
      zip.file(
        'README.md',
        `# SyncWave - Universal Multi-Device Audio Sync for Android

## Overview
This is a native Android project written in Kotlin with Jetpack Compose, implementing real-time synchronized music streaming from any installed app (Spotify, YouTube Music, SoundCloud, Netflix, local files) using Android 10+ AudioPlaybackCapture API and Christian's NTP Clock Synchronization.

## Requirements
- Android Studio Iguana / Jellyfish or newer
- Android SDK 34 (Android 14)
- Minimum SDK 29 (Android 10)
- NDK (optional, for custom libopus build)

## How to Run
1. Open this directory in Android Studio.
2. Allow Gradle sync to complete.
3. Run on physical Android device (API 29+). Note: Android Emulators do not support AudioPlaybackCapture loopback.
`
      );

      // Add each source file
      NATIVE_ANDROID_PROJECT.forEach((file) => {
        zip.file(file.path, file.code);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SyncWave-Android-Native-Project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('ZIP generation error:', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Native Android Studio Source Bundle</h3>
              <p className="text-xs text-slate-400">Complete Kotlin + Jetpack Compose Architecture</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? 'Bundling ZIP...' : 'Download Android Studio Project (.ZIP)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content: File list sidebar + Code viewer */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* File sidebar */}
          <div className="w-full md:w-72 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800 p-3 space-y-1.5 overflow-y-auto shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 py-1 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>Project Files</span>
            </div>

            {NATIVE_ANDROID_PROJECT.map((file) => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left p-2.5 rounded-xl text-xs flex flex-col transition-all ${
                  selectedFile.filename === file.filename
                    ? 'bg-indigo-950/60 border border-indigo-500/50 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold truncate">{file.filename}</span>
                  <span className="text-[10px] font-mono uppercase text-slate-500">{file.language}</span>
                </div>
                <span className="text-[10px] text-slate-500 truncate mt-0.5">{file.path}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950/90 overflow-hidden">
            {/* File info bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 text-xs">
              <div className="min-w-0 pr-2">
                <span className="font-mono text-indigo-400 font-semibold">{selectedFile.path}</span>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{selectedFile.description}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Code editor pane */}
            <div className="flex-1 overflow-auto p-4 text-[12px] font-mono leading-relaxed text-slate-200">
              <pre className="whitespace-pre">
                <code>{selectedFile.code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
