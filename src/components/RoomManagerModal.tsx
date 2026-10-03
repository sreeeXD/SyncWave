import React, { useState, useEffect } from 'react';
import { Users, Copy, Check, QrCode, Smartphone, Volume2, VolumeX, Trash2, X, Plus, LogIn, AlertCircle, Server, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Participant } from '../types';
import { socketService } from '../services/socketService';

interface RoomManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  participants: Participant[];
  currentUserId: string;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => Promise<boolean>;
  onLeaveRoom: () => void;
  onRemoveParticipant: (id: string) => void;
  onUpdateVolume: (id: string, volume: number) => void;
  onToggleMute: (id: string) => void;
}

export const RoomManagerModal: React.FC<RoomManagerModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  participants,
  currentUserId,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onRemoveParticipant,
  onUpdateVolume,
  onToggleMute,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Join Room Input state
  const [joinInputCode, setJoinInputCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Server IP & Connection state
  const [serverUrl, setServerUrl] = useState(socketService.getServerUrl());
  const [isConnected, setIsConnected] = useState(socketService.getIsConnected());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [editingServerUrl, setEditingServerUrl] = useState(socketService.getServerUrl());

  useEffect(() => {
    const unsubscribe = socketService.subscribeConnectionStatus((connected) => {
      setIsConnected(connected);
      setServerUrl(socketService.getServerUrl());
    });
    const unsubscribeErr = socketService.onError((err) => {
      setJoinError(err);
    });
    return () => {
      unsubscribe();
      unsubscribeErr();
    };
  }, []);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInputCode.trim()) return;
    setJoinError('');
    setIsJoining(true);

    try {
      const success = await onJoinRoom(joinInputCode.trim());
      if (!success) {
        setJoinError(`Room "${joinInputCode.trim().toUpperCase()}" does not exist.`);
      } else {
        setJoinInputCode('');
        setShowQr(false);
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    socketService.setServerUrl(editingServerUrl);
    setShowServerConfig(false);
  };

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : `https://syncwave.app?room=${roomCode}`;

  const currentParticipant = participants.find((p) => p.id === currentUserId);
  const isHost = currentParticipant?.isHost ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">SyncWave Live Jam Room</h3>
              <p className="text-xs text-slate-400">Real-Time WebSocket Room Presence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Connection Host Indicator Bar */}
        <div className="mt-3 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Server:</span>
            <span className="font-mono text-slate-200 truncate">{serverUrl}</span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
              title={isConnected ? 'Connected to WebSocket Server' : 'Disconnected'}
            />
          </div>
          <button
            onClick={() => {
              setEditingServerUrl(serverUrl);
              setShowServerConfig(!showServerConfig);
            }}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 ml-2 shrink-0 underline"
          >
            {showServerConfig ? 'Close' : 'Edit Server IP'}
          </button>
        </div>

        {/* Edit Server Host Input Drawer */}
        {showServerConfig && (
          <form onSubmit={handleSaveServerUrl} className="mt-2 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2 animate-in slide-in-from-top-2 duration-150">
            <label className="text-[11px] font-medium text-indigo-200 block">
              Enter Backend Server Host IP (e.g. http://192.168.0.102:3001)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editingServerUrl}
                onChange={(e) => setEditingServerUrl(e.target.value)}
                placeholder="http://192.168.x.x:3001"
                className="flex-1 bg-slate-900 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Connect</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Ensure both Android devices and host PC running <code className="text-slate-300">node server/index.js</code> are on the same Wi-Fi network.
            </p>
          </form>
        )}

        {/* Current Active Room Info Card */}
        {roomCode ? (
          <div className="my-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Active Room Code
              </span>
              <div className="text-xl font-bold font-mono tracking-wider text-indigo-400 flex items-center gap-2">
                <span>{roomCode}</span>
                {isHost && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-sans font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
                    You are Host
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setShowQr(!showQr)}
                className={`p-2 rounded-xl border transition-colors ${
                  showQr
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                }`}
                title="Show QR Code to join room"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="my-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-xs text-amber-200 font-medium">You are not in a room yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Create a room or enter a code below to join.</p>
          </div>
        )}

        {/* QR Code Expansion */}
        {showQr && roomCode && (
          <div className="p-4 mb-3 rounded-2xl bg-white text-slate-900 flex flex-col items-center justify-center animate-in zoom-in-95 duration-150 shadow-xl">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
              <QRCodeSVG value={joinUrl} size={160} level="M" />
            </div>
            <p className="text-xs font-bold mt-2 text-slate-900">Scan to Join Room {roomCode}</p>
            <p className="text-[10px] text-slate-500 truncate max-w-[260px]">{joinUrl}</p>
          </div>
        )}

        {/* Join or Create Room Control Bar */}
        <div className="my-1 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
          <form onSubmit={handleJoinSubmit} className="flex gap-2">
            <input
              type="text"
              value={joinInputCode}
              onChange={(e) => {
                setJoinInputCode(e.target.value.toUpperCase());
                setJoinError('');
              }}
              placeholder="Enter Room Code (e.g. SW-7821)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isJoining || !joinInputCode.trim()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isJoining ? 'Joining...' : 'Join'}</span>
            </button>
          </form>

          {joinError && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[11px] bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{joinError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <button
              onClick={onCreateRoom}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Room</span>
            </button>

            {roomCode && (
              <button
                onClick={onLeaveRoom}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
              >
                Leave Current Room
              </button>
            )}
          </div>
        </div>

        {/* Connected Real Participants List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
            <span>Connected Devices ({participants.length})</span>
            <span>Volume</span>
          </div>

          {participants.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No participants connected.</div>
          ) : (
            participants.map((p) => {
              const isCurrentUser = p.id === currentUserId;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                    isCurrentUser
                      ? 'bg-indigo-950/40 border-indigo-500/40'
                      : 'bg-slate-950/50 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${p.avatarColor || 'bg-indigo-600'} flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm`}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white truncate">
                          {isCurrentUser ? 'You' : p.name}
                        </span>
                        {p.isHost && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-1.5 py-0.2 rounded">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                        <Smartphone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{p.deviceModel || 'Android Device'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 font-mono text-[10px]">Connected</span>
                      </div>
                    </div>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => onToggleMute(p.id)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {p.isMuted || p.volume === 0 ? (
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={p.isMuted ? 0 : p.volume}
                        onChange={(e) => onUpdateVolume(p.id, parseInt(e.target.value))}
                        className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    {isHost && !p.isHost && (
                      <button
                        onClick={() => onRemoveParticipant(p.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Disconnect device"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            Share room code <strong className="text-indigo-300 font-mono">{roomCode || '---'}</strong> with friends. Real devices synchronize automatically via WebSocket.
          </p>
        </div>
      </div>
    </div>
  );
};
