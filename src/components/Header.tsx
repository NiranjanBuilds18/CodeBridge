import React, { useState } from 'react';
import {
  Share2,
  Trash2,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  FolderX,
  MoreVertical,
  Check,
  Copy,
  Plus,
} from 'lucide-react';
import { copyToClipboard } from '../utils/device.js';
import type { RoomMetadata, PeerInfo } from '../types.js';

interface HeaderProps {
  room: RoomMetadata | null;
  peers: PeerInfo[];
  isConnected: boolean;
  activeRole: 'laptop' | 'phone';
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSwitchRole: (role: 'laptop' | 'phone') => void;
  onOpenInviteModal: () => void;
  onOpenCreateJoinModal: () => void;
  onOpenSecurityModal: () => void;
  onRequestClearAll: () => void;
  onRequestDeleteRoom: () => void;
  onLeaveRoom: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  peers,
  isConnected,
  activeRole,
  isDarkMode,
  onToggleDarkMode,
  onSwitchRole,
  onOpenInviteModal,
  onOpenCreateJoinModal,
  onOpenSecurityModal,
  onRequestClearAll,
  onRequestDeleteRoom,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCopyCode = async () => {
    if (!room) return;
    const ok = await copyToClipboard(room.code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  return (
    <header className="border-b border-[#E6E6E1] dark:border-[#2B2C2E] bg-white dark:bg-[#18191A] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-3">
        {/* Left: Brand & Room Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Minimal Geometric Bridge Mark */}
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-2 group text-left shrink-0"
            title="CodeBridge Home"
          >
            <div className="w-7 h-7 rounded-md bg-[#1E4D36] flex items-center justify-center text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
                <path d="M2 19h20" />
                <path d="M9 19a3 3 0 0 0 6 0" />
              </svg>
            </div>
            <span className="font-bold text-[13px] tracking-tight text-[#111213] dark:text-[#EDEDEA] group-hover:text-[#1E4D36] dark:group-hover:text-[#3B8563] transition-colors">
              CodeBridge
            </span>
          </button>

          {room && (
            <div className="flex items-center gap-1.5 min-w-0 pl-1 border-l border-[#E6E6E1] dark:border-[#2B2C2E]">
              <button
                onClick={handleCopyCode}
                title="Click to copy room code"
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#E6E6E1] dark:border-[#2B2C2E] bg-[#FAFAF7] dark:bg-[#212224] hover:bg-[#F3F3EE] dark:hover:bg-[#2B2C2F] text-xs font-mono font-medium text-[#111213] dark:text-[#EDEDEA] transition-colors truncate"
              >
                <span className="truncate">{room.code}</span>
                {copiedCode ? (
                  <Check className="w-3 h-3 text-[#1E4D36] dark:text-[#3B8563] shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-[#7E8079] shrink-0" />
                )}
              </button>

              {/* Status Indicator */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-[#52534F] dark:text-[#B1B2AC]"
                title={isConnected ? 'Connected to real-time sync' : 'Reconnecting to server...'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-[#1E4D36] dark:bg-[#3B8563]' : 'bg-[#B45309] animate-pulse'
                  }`}
                />
                <span className="truncate">
                  {isConnected
                    ? `${peers.length} active device${peers.length === 1 ? '' : 's'}`
                    : 'Reconnecting...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Essential Utility Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Desktop/Mobile preview toggle */}
          <div className="hidden sm:flex items-center p-0.5 rounded border border-[#E6E6E1] dark:border-[#2B2C2E] bg-[#FAFAF7] dark:bg-[#212224] text-xs">
            <button
              type="button"
              onClick={() => onSwitchRole('laptop')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeRole === 'laptop'
                  ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] shadow-[0_1px_1px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchRole('phone')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeRole === 'phone'
                  ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] shadow-[0_1px_1px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>Mobile</span>
            </button>
          </div>

          {room ? (
            <>
              <button
                type="button"
                onClick={onOpenInviteModal}
                className="px-2.5 py-1 text-xs font-medium text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              >
                <Share2 className="w-3 h-3" />
                <span className="hidden sm:inline">Pair / QR</span>
              </button>

              {/* Room Actions Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] rounded border border-transparent hover:border-[#E6E6E1] dark:hover:border-[#2B2C2E] transition-colors"
                  aria-label="Room options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <div
                    className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-md shadow-md py-1 z-50 text-xs animate-in fade-in duration-75"
                    onClick={() => setShowMenu(false)}
                  >
                    <button
                      onClick={onOpenSecurityModal}
                      className="w-full px-3 py-1.5 text-left text-[#52534F] dark:text-[#B1B2AC] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] flex items-center gap-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                      <span>Security & Storage</span>
                    </button>
                    <button
                      onClick={onOpenCreateJoinModal}
                      className="w-full px-3 py-1.5 text-left text-[#52534F] dark:text-[#B1B2AC] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Switch / Join Room</span>
                    </button>
                    <div className="border-t border-[#E6E6E1] dark:border-[#2B2C2E] my-1" />
                    <button
                      onClick={onRequestClearAll}
                      className="w-full px-3 py-1.5 text-left text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 flex items-center gap-2"
                    >
                      <FolderX className="w-3.5 h-3.5" />
                      <span>Clear All Items</span>
                    </button>
                    <button
                      onClick={onRequestDeleteRoom}
                      className="w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Room Permanently</span>
                    </button>
                    <div className="border-t border-[#E6E6E1] dark:border-[#2B2C2E] my-1" />
                    <button
                      onClick={onLeaveRoom}
                      className="w-full px-3 py-1.5 text-left text-[#7E8079] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Leave Room</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={onOpenCreateJoinModal}
              className="px-2.5 py-1 text-xs font-medium text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <Plus className="w-3 h-3" />
              <span>Rooms</span>
            </button>
          )}

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] rounded border border-transparent hover:border-[#E6E6E1] dark:hover:border-[#2B2C2E] transition-colors"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#B45309]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
