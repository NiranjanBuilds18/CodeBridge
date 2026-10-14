import React, { useState, useEffect, useRef } from 'react';
import { useCodeBridgeRoom } from './hooks/useCodeBridgeRoom.js';
import { Header } from './components/Header.js';
import { DesktopDashboard } from './components/DesktopDashboard.js';
import { MobileCompanion } from './components/MobileCompanion.js';
import { InviteQRModal } from './components/InviteQRModal.js';
import { CreateJoinRoomModal } from './components/CreateJoinRoomModal.js';
import { SecurityInfoModal } from './components/SecurityInfoModal.js';
import { RenameModal } from './components/RenameModal.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { isMobileDevice } from './utils/device.js';
import { Plus, ArrowRight, Hash, ShieldCheck, AlertCircle } from 'lucide-react';
import type { TransferItem } from './types.js';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('codebridge_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('codebridge_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('codebridge_theme', 'light');
    }
  }, [isDarkMode]);

  const [role, setRole] = useState<'laptop' | 'phone'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room') || params.get('session') || params.get('code')) {
      return 'phone';
    }
    return isMobileDevice() ? 'phone' : 'laptop';
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateJoinModalOpen, setIsCreateJoinModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<TransferItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete_item' | 'clear_all' | 'delete_room';
    item?: TransferItem;
  } | null>(null);

  // Quick join state on landing
  const [landingJoinCode, setLandingJoinCode] = useState('');
  const initialMountRef = useRef(false);

  const {
    room,
    items,
    peers,
    isConnected,
    isConnecting,
    error,
    setError,
    uploadProgress,
    networkInfo,
    createRoom,
    joinRoom,
    leaveRoom,
    sendSnippet,
    uploadFiles,
    renameItem,
    deleteItem,
    clearAllItems,
    deleteRoom,
  } = useCodeBridgeRoom({ role });

  useEffect(() => {
    if (initialMountRef.current) return;
    initialMountRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('room') || params.get('session') || params.get('code');

    if (urlCode) {
      joinRoom(urlCode);
    } else {
      const savedCode = localStorage.getItem('codebridge_active_room_code');
      if (savedCode) {
        joinRoom(savedCode);
      }
    }
  }, [joinRoom]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete_item' && confirmAction.item) {
      await deleteItem(confirmAction.item.id);
    } else if (confirmAction.type === 'clear_all') {
      await clearAllItems();
    } else if (confirmAction.type === 'delete_room') {
      await deleteRoom();
    }

    setConfirmAction(null);
  };

  const handleLandingJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingJoinCode.trim()) return;
    joinRoom(landingJoinCode.trim());
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#111213] text-[#111213] dark:text-[#EDEDEA] flex flex-col font-sans transition-colors duration-100">
      {/* Top Navigation */}
      <Header
        room={room}
        peers={peers}
        isConnected={isConnected}
        activeRole={role}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSwitchRole={(newRole) => setRole(newRole)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenCreateJoinModal={() => setIsCreateJoinModalOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onRequestClearAll={() => setConfirmAction({ type: 'clear_all' })}
        onRequestDeleteRoom={() => setConfirmAction({ type: 'delete_room' })}
        onLeaveRoom={leaveRoom}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-4 py-2 text-center text-xs text-red-700 dark:text-red-300 flex items-center justify-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2.5 underline hover:text-red-950 dark:hover:text-red-100 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {room ? (
          role === 'laptop' ? (
            <DesktopDashboard
              room={room}
              items={items}
              peers={peers}
              uploadProgress={uploadProgress}
              onSendSnippet={sendSnippet}
              onUploadFiles={uploadFiles}
              onRenameItem={(item) => setItemToRename(item)}
              onDeleteItem={(item) => setConfirmAction({ type: 'delete_item', item })}
              onOpenInviteModal={() => setIsInviteModalOpen(true)}
            />
          ) : (
            <MobileCompanion
              room={room}
              items={items}
              peers={peers}
              uploadProgress={uploadProgress}
              onSendSnippet={sendSnippet}
              onUploadFiles={uploadFiles}
              onRenameItem={(item) => setItemToRename(item)}
              onDeleteItem={(item) => setConfirmAction({ type: 'delete_item', item })}
              onOpenInviteModal={() => setIsInviteModalOpen(true)}
              onLeaveRoom={leaveRoom}
            />
          )
        ) : role === 'phone' ? (
          /* Mobile-First Dedicated Onboarding: Joining with a code is the first obvious action */
          <div className="max-w-sm mx-auto px-4 py-8 space-y-5">
            <div className="text-center space-y-1.5 pt-4">
              <div className="w-9 h-9 rounded-md bg-[#1E4D36] text-white flex items-center justify-center mx-auto shadow-xs">
                <svg
                  className="w-4 h-4"
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
              <h2 className="text-sm font-bold text-[#111213] dark:text-[#EDEDEA] tracking-tight">
                Connect to Laptop
              </h2>
              <p className="text-xs text-[#7E8079]">
                Enter the room code displayed on your computer screen.
              </p>
            </div>

            {/* Prominent Code Input Box */}
            <form onSubmit={handleLandingJoin} className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg p-4 space-y-3 shadow-2xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#52534F] dark:text-[#B1B2AC] mb-1.5">
                  Room Code
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7E8079]" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. CB-9482-XR7"
                    value={landingJoinCode}
                    onChange={(e) => setLandingJoinCode(e.target.value)}
                    className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-md pl-9 pr-3 py-2.5 text-xs font-mono font-bold tracking-wider text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!landingJoinCode.trim() || isConnecting}
                className="w-full min-h-[48px] px-4 py-2 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40"
              >
                <span>{isConnecting ? 'Connecting...' : 'Join Room'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Secondary Action: Create Room on mobile */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => createRoom()}
                disabled={isConnecting}
                className="text-xs font-medium text-[#1E4D36] dark:text-[#3B8563] hover:underline"
              >
                + Or create a new permanent room
              </button>
            </div>

            <div className="pt-6 border-t border-[#E6E6E1] dark:border-[#2B2C2E] flex items-center justify-center gap-2 text-[11px] text-[#7E8079]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E4D36]" />
              <span>Real binary disk transfers · No auto-expiry</span>
            </div>
          </div>
        ) : (
          /* Desktop Clean Utility Onboarding */
          <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
            <div className="space-y-1.5">
              <div className="w-9 h-9 rounded-md bg-[#1E4D36] text-white flex items-center justify-center mx-auto shadow-xs mb-3">
                <svg
                  className="w-4 h-4"
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
              <h1 className="text-lg font-bold text-[#111213] dark:text-[#EDEDEA] tracking-tight">
                CodeBridge
              </h1>
              <p className="text-xs text-[#7E8079] max-w-sm mx-auto">
                Permanent peer-to-peer code and file transfer utility.
                Saved securely on server disk without cloud logins.
              </p>
            </div>

            {/* Practical Utility Card */}
            <div className="max-w-md mx-auto bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg p-5 shadow-2xs space-y-4 text-left">
              <form onSubmit={handleLandingJoin} className="space-y-2">
                <label className="block text-[11px] font-semibold text-[#52534F] dark:text-[#B1B2AC]">
                  Join Existing Room
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7E8079]" />
                    <input
                      type="text"
                      placeholder="e.g. CB-9482-XR7"
                      value={landingJoinCode}
                      onChange={(e) => setLandingJoinCode(e.target.value)}
                      className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded pl-8 pr-2.5 py-1.5 text-xs font-mono font-medium text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!landingJoinCode.trim() || isConnecting}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-3 py-1 text-xs text-[#7E8079]">
                <div className="flex-1 border-t border-[#E6E6E1] dark:border-[#2B2C2E]" />
                <span className="text-[10px] uppercase font-mono">or</span>
                <div className="flex-1 border-t border-[#E6E6E1] dark:border-[#2B2C2E]" />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => createRoom()}
                  disabled={isConnecting}
                  className="w-full py-2 px-3 text-xs font-semibold text-[#111213] dark:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] hover:bg-[#F3F3EE] dark:hover:bg-[#2B2C2F] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
                  <span>Create New Permanent Room</span>
                </button>
              </div>
            </div>

            {/* Utility Footnotes */}
            <div className="pt-4 flex items-center justify-center gap-4 text-[11px] text-[#7E8079]">
              <span>No 10-minute expiry</span>
              <span>·</span>
              <span>Local server disk storage</span>
              <span>·</span>
              <span>Zero accounts</span>
            </div>
          </div>
        )}
      </main>

      {/* Invite & QR Modal */}
      {room && (
        <InviteQRModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          room={room}
          networkInfo={networkInfo}
        />
      )}

      {/* Create / Join Modal */}
      <CreateJoinRoomModal
        isOpen={isCreateJoinModalOpen}
        onClose={() => setIsCreateJoinModalOpen(false)}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        isLoading={isConnecting}
      />

      {/* Security & Storage Modal */}
      <SecurityInfoModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        supabaseConfig={networkInfo?.supabase || undefined}
      />

      {/* Rename Modal */}
      {itemToRename && (
        <RenameModal
          isOpen={!!itemToRename}
          onClose={() => setItemToRename(null)}
          onRename={(newTitle) => renameItem(itemToRename.id, newTitle)}
          currentTitle={itemToRename.title || itemToRename.filename || ''}
          isFileType={itemToRename.type === 'file'}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === 'delete_item'
            ? 'Delete Item?'
            : confirmAction?.type === 'clear_all'
            ? 'Clear All Room Items?'
            : 'Delete Room Permanently?'
        }
        description={
          confirmAction?.type === 'delete_item'
            ? `Delete "${confirmAction.item?.title || confirmAction.item?.filename}" from server disk?`
            : confirmAction?.type === 'clear_all'
            ? 'Delete all files and code snippets in this room from server disk? The room code will remain active.'
            : 'Permanently destroy this room and unlink all stored files from server disk? This cannot be undone.'
        }
        confirmLabel={
          confirmAction?.type === 'delete_item'
            ? 'Delete'
            : confirmAction?.type === 'clear_all'
            ? 'Clear All'
            : 'Delete Room'
        }
        isDanger={true}
      />

      {/* Footer */}
      <footer className="border-t border-[#E6E6E1] dark:border-[#2B2C2E] bg-[#FAFAF7] dark:bg-[#111213] px-4 py-2.5 text-center text-[11px] text-[#7E8079]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span>CodeBridge · Developer transfer utility</span>
          <span className="font-mono">Server disk storage · WebSockets</span>
        </div>
      </footer>
    </div>
  );
}
