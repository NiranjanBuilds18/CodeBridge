import React, { useState, useRef } from 'react';
import {
  Send,
  Upload,
  FileCode,
  File,
  Clipboard,
  CheckCircle2,
  Share2,
  X,
  Copy,
  Check,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { ItemCard } from './ItemCard.js';
import { formatBytes } from '../utils/format.js';
import { copyToClipboard } from '../utils/device.js';
import type { RoomMetadata, TransferItem, PeerInfo } from '../types.js';

interface MobileCompanionProps {
  room: RoomMetadata;
  items: TransferItem[];
  peers: PeerInfo[];
  uploadProgress: number | null;
  onSendSnippet: (content: string, title?: string, language?: string) => Promise<boolean>;
  onUploadFiles: (files: FileList | File[]) => Promise<boolean>;
  onRenameItem: (item: TransferItem) => void;
  onDeleteItem: (item: TransferItem) => void;
  onOpenInviteModal: () => void;
  onLeaveRoom: () => void;
}

export const MobileCompanion: React.FC<MobileCompanionProps> = ({
  room,
  items,
  peers,
  uploadProgress,
  onSendSnippet,
  onUploadFiles,
  onRenameItem,
  onDeleteItem,
  onOpenInviteModal,
  onLeaveRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'files'>('code');

  // Code form
  const [codeContent, setCodeContent] = useState('');
  const [codeTitle, setCodeTitle] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);

  // Files form
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [fileSuccess, setFileSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(room.code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setCodeContent(text);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeContent.trim() || isSendingCode) return;

    setIsSendingCode(true);
    const ok = await onSendSnippet(
      codeContent,
      codeTitle.trim() || undefined,
      selectedLanguage === 'auto' ? undefined : selectedLanguage
    );
    setIsSendingCode(false);

    if (ok) {
      setCodeContent('');
      setCodeTitle('');
      setCodeSuccess(true);
      setTimeout(() => setCodeSuccess(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...arr]);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0 || isUploadingFiles) return;

    setIsUploadingFiles(true);
    const ok = await onUploadFiles(selectedFiles);
    setIsUploadingFiles(false);

    if (ok) {
      setSelectedFiles([]);
      setFileSuccess(true);
      setTimeout(() => setFileSuccess(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-3 space-y-4 pb-20">
      {/* Top Mobile Sticky Bar */}
      <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg p-3 flex items-center justify-between text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded bg-[#1E4D36] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
            CB
          </div>
          <div className="min-w-0">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 font-mono font-semibold text-[#111213] dark:text-[#EDEDEA] hover:text-[#1E4D36]"
            >
              <span>{room.code}</span>
              {copiedCode ? <Check className="w-3 h-3 text-[#1E4D36]" /> : <Copy className="w-3 h-3 text-[#7E8079]" />}
            </button>
            <div className="text-[10px] text-[#7E8079] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E4D36]" />
              <span>{peers.length} online</span>
              <span>·</span>
              <span>{items.length} files</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenInviteModal}
            className="p-2 text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] rounded border border-[#E6E6E1] dark:border-[#2B2C2E]"
            title="Invite / QR"
            aria-label="Invite or QR"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLeaveRoom}
            className="p-2 text-[#7E8079] hover:text-red-600 bg-[#FAFAF7] dark:bg-[#212224] rounded border border-[#E6E6E1] dark:border-[#2B2C2E]"
            title="Leave Room"
            aria-label="Leave room"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Segmented Mode Switcher */}
      <div className="grid grid-cols-2 p-1 bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`py-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'code'
              ? 'bg-[#1E4D36] text-white font-semibold'
              : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Paste Code</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`py-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'files'
              ? 'bg-[#1E4D36] text-white font-semibold'
              : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Send Files</span>
        </button>
      </div>

      {/* Tab 1: Code Mode */}
      {activeTab === 'code' && (
        <form
          onSubmit={handleSendCode}
          className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg p-3.5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#52534F] dark:text-[#B1B2AC] uppercase tracking-wider">
              Code or Note
            </span>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="text-xs text-[#1E4D36] dark:text-[#3B8563] font-medium flex items-center gap-1 px-2 py-1 bg-[#EBF3EF] dark:bg-[#172D23] rounded border border-[#C9DFD3] dark:border-[#1E4D36]"
            >
              <Clipboard className="w-3 h-3" />
              <span>Paste Clipboard</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Title or filename (optional)"
              value={codeTitle}
              onChange={(e) => setCodeTitle(e.target.value)}
              className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1.5 text-xs text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
            />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1.5 text-xs text-[#52534F] dark:text-[#B1B2AC] focus:outline-hidden focus:border-[#1E4D36]"
            >
              <option value="auto">Auto-Detect</option>
              <option value="TypeScript">TypeScript</option>
              <option value="JavaScript">JavaScript</option>
              <option value="Python">Python</option>
              <option value="JSON">JSON</option>
              <option value="SQL">SQL</option>
              <option value="HTML/XML">HTML / XML</option>
              <option value="CSS">CSS</option>
              <option value="Markdown">Markdown</option>
              <option value="Plain Text">Plain Text</option>
            </select>
          </div>

          <textarea
            required
            rows={7}
            placeholder="Type or paste code here..."
            value={codeContent}
            onChange={(e) => setCodeContent(e.target.value)}
            className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded p-2.5 text-xs font-mono text-[#111213] dark:text-[#EDEDEA] leading-relaxed focus:outline-hidden focus:border-[#1E4D36]"
          />

          <button
            type="submit"
            disabled={!codeContent.trim() || isSendingCode}
            className="w-full min-h-[48px] px-4 py-2 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-all flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40 active:scale-98"
          >
            {codeSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Transferred to Laptop!</span>
              </>
            ) : isSendingCode ? (
              <span>Sending...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send to Computer</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Tab 2: Files Mode */}
      {activeTab === 'files' && (
        <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg p-3.5 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="mobile-picker"
          />

          <label
            htmlFor="mobile-picker"
            className="border border-dashed border-[#D3D3CB] dark:border-[#3D3E42] hover:border-[#1E4D36] bg-[#FAFAF7] dark:bg-[#121314] rounded p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
          >
            <Upload className="w-6 h-6 text-[#1E4D36] dark:text-[#3B8563] mb-1.5" />
            <p className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
              Tap to choose files
            </p>
            <p className="text-[11px] text-[#7E8079] mt-0.5">
              Photos, documents, archives, or code files (Max 50MB)
            </p>
          </label>

          {selectedFiles.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] flex items-center justify-between">
                <span>Selected ({selectedFiles.length} files)</span>
                <span className="font-mono tabular-nums">
                  {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1">
                {selectedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="p-2 bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded flex items-center justify-between text-xs"
                  >
                    <span className="truncate pr-2">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-[#7E8079] hover:text-red-600 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex items-center justify-between text-[#52534F] dark:text-[#B1B2AC] text-[11px]">
                    <span>Uploading...</span>
                    <span className="font-mono tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#FAFAF7] dark:bg-[#212224] rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-[#1E4D36] h-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleUploadFiles}
                disabled={isUploadingFiles}
                className="w-full min-h-[48px] px-4 py-2 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-all flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40 active:scale-98"
              >
                {fileSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Files Sent to Computer!</span>
                  </>
                ) : isUploadingFiles ? (
                  <span>Uploading to Disk...</span>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload {selectedFiles.length} File(s)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Room Items Activity Feed on Mobile */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#52534F] dark:text-[#B1B2AC] uppercase tracking-wider text-[11px]">
            Room Items ({items.length})
          </span>
          <span className="text-[10px] text-[#1E4D36] dark:text-[#3B8563] font-mono">
            Synced
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg space-y-1">
            <FolderOpen className="w-5 h-5 text-[#7E8079] mx-auto opacity-40 mb-1" />
            <p className="text-xs text-[#52534F] dark:text-[#B1B2AC]">No items in this room yet</p>
            <p className="text-[11px] text-[#7E8079]">
              Paste code or upload files above to beam them to your laptop.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onRename={onRenameItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
