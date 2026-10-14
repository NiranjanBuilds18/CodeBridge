import React, { useState } from 'react';
import { Plus, ArrowRight, X, Hash } from 'lucide-react';

interface CreateJoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (customCode?: string, name?: string) => Promise<any>;
  onJoinRoom: (code: string) => Promise<any>;
  isLoading: boolean;
}

export const CreateJoinRoomModal: React.FC<CreateJoinRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  onJoinRoom,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [roomName, setRoomName] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const ok = await onCreateRoom(customCode.trim() || undefined, roomName.trim() || undefined);
    if (ok) onClose();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || isLoading) return;
    const ok = await onJoinRoom(joinCode.trim());
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg max-w-sm w-full p-5 shadow-lg relative text-xs">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-3.5 right-3.5 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 bg-[#FAFAF7] dark:bg-[#212224] rounded border border-[#E6E6E1] dark:border-[#2B2C2E] mb-4 font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1 rounded text-[11px] transition-colors ${
              activeTab === 'create'
                ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            Create Permanent Room
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-1 rounded text-[11px] transition-colors ${
              activeTab === 'join'
                ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            Join with Code
          </button>
        </div>

        {activeTab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] mb-1">
                Room Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Work Laptop, Mobile Sync"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1.5 text-xs text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] mb-1">
                Custom Code (Leave blank for random unique code)
              </label>
              <input
                type="text"
                placeholder="e.g. dev-bridge"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1.5 text-xs font-mono text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
              />
              <span className="text-[10px] text-[#7E8079] mt-1 block">
                Saved permanently on server disk. Survives restarts.
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Creating Room...' : 'Create & Open Room'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] mb-1">
                Enter Room Code
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7E8079]" />
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. CB-9482-XR7"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded pl-8 pr-3 py-2 text-xs font-mono font-semibold text-[#111213] dark:text-[#EDEDEA] tracking-wider focus:outline-hidden focus:border-[#1E4D36]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!joinCode.trim() || isLoading}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center justify-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-50"
              >
                <span>{isLoading ? 'Connecting...' : 'Connect to Room'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
