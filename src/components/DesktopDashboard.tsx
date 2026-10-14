import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload,
  FileCode,
  Search,
  X,
  Share2,
  FolderOpen,
  Send,
  Clipboard,
  Smartphone,
  Check,
  Copy,
  Plus,
} from 'lucide-react';
import { ItemCard } from './ItemCard.js';
import { formatBytes } from '../utils/format.js';
import { copyToClipboard } from '../utils/device.js';
import type { RoomMetadata, TransferItem, PeerInfo } from '../types.js';

interface DesktopDashboardProps {
  room: RoomMetadata;
  items: TransferItem[];
  peers: PeerInfo[];
  uploadProgress: number | null;
  onSendSnippet: (content: string, title?: string, language?: string) => Promise<boolean>;
  onUploadFiles: (files: FileList | File[]) => Promise<boolean>;
  onRenameItem: (item: TransferItem) => void;
  onDeleteItem: (item: TransferItem) => void;
  onOpenInviteModal: () => void;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  room,
  items,
  peers,
  uploadProgress,
  onSendSnippet,
  onUploadFiles,
  onRenameItem,
  onDeleteItem,
  onOpenInviteModal,
}) => {
  const [activeComposerTab, setActiveComposerTab] = useState<'code' | 'files'>('code');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'code' | 'file' | 'image'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size' | 'name'>('newest');
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Composer state
  const [codeContent, setCodeContent] = useState('');
  const [codeTitle, setCodeTitle] = useState('');
  const [codeLang, setCodeLang] = useState('auto');
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Files state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Global drag-and-drop listener
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget || (e.relatedTarget as HTMLElement).nodeName === 'HTML') {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onUploadFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onUploadFiles]);

  // Keyboard shortcut Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && codeContent.trim()) {
        e.preventDefault();
        handleSendCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [codeContent]);

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(room.code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleSendCode = async () => {
    if (!codeContent.trim() || isSendingCode) return;
    setIsSendingCode(true);
    const ok = await onSendSnippet(
      codeContent,
      codeTitle.trim() || undefined,
      codeLang === 'auto' ? undefined : codeLang
    );
    setIsSendingCode(false);
    if (ok) {
      setCodeContent('');
      setCodeTitle('');
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setCodeContent(text);
          setActiveComposerTab('code');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arr = Array.from(e.target.files);
      setStagedFiles((prev) => [...prev, ...arr]);
      e.target.value = '';
    }
  };

  const handleUploadStaged = async () => {
    if (stagedFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    const ok = await onUploadFiles(stagedFiles);
    setIsUploading(false);
    if (ok) {
      setStagedFiles([]);
    }
  };

  const displayedItems = useMemo(() => {
    return items
      .filter((item) => {
        const isFile = item.type === 'file';
        const isImg = isFile && (item.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(item.filename || ''));

        if (activeFilter === 'code' && isFile) return false;
        if (activeFilter === 'file' && !isFile) return false;
        if (activeFilter === 'image' && !isImg) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchFilename = item.filename?.toLowerCase().includes(q);
        const matchContent = item.content?.toLowerCase().includes(q);
        const matchLang = item.language?.toLowerCase().includes(q);
        return matchTitle || matchFilename || matchContent || matchLang;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (sortBy === 'size') {
          const sizeA = a.fileSize || a.content?.length || 0;
          const sizeB = b.fileSize || b.content?.length || 0;
          return sizeB - sizeA;
        }
        if (sortBy === 'name') {
          return (a.title || a.filename || '').localeCompare(b.title || b.filename || '');
        }
        return 0;
      });
  }, [items, activeFilter, searchQuery, sortBy]);

  const connectedPhones = peers.filter((p) => p.role === 'phone');
  const totalBytes = items.reduce((acc, i) => acc + (i.fileSize || i.content?.length || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Global Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-[#1E4D36]/10 backdrop-blur-2xs border-2 border-dashed border-[#1E4D36] flex flex-col items-center justify-center p-6 pointer-events-none">
          <div className="bg-white dark:bg-[#18191A] p-5 rounded-lg shadow-xl flex flex-col items-center gap-2 border border-[#E6E6E1] dark:border-[#2B2C2E]">
            <Upload className="w-8 h-8 text-[#1E4D36] animate-bounce" />
            <span className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
              Drop files anywhere to upload directly to disk
            </span>
          </div>
        </div>
      )}

      {/* Workspace Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[#E6E6E1] dark:border-[#2B2C2E] bg-white dark:bg-[#18191A] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#52534F] dark:text-[#B1B2AC]">
            <span>Room Code:</span>
            <button
              onClick={handleCopyCode}
              className="font-semibold text-[#111213] dark:text-[#EDEDEA] hover:text-[#1E4D36] flex items-center gap-1"
            >
              <span>{room.code}</span>
              {copiedCode ? <Check className="w-3 h-3 text-[#1E4D36]" /> : <Copy className="w-3 h-3 text-[#7E8079]" />}
            </button>
          </div>

          <span className="text-[#E6E6E1] dark:text-[#2B2C2E]">|</span>

          <div className="flex items-center gap-1 text-[11px] text-[#7E8079]">
            <Smartphone className="w-3.5 h-3.5 text-[#1E4D36] dark:text-[#3B8563]" />
            <span>
              {connectedPhones.length > 0
                ? `${connectedPhones.length} mobile companion${connectedPhones.length === 1 ? '' : 's'} paired`
                : 'No phone connected yet'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#7E8079]">
          <span className="font-mono tabular-nums">{items.length} items ({formatBytes(totalBytes)})</span>
          <button
            onClick={onOpenInviteModal}
            className="ml-2 font-medium text-[#1E4D36] dark:text-[#3B8563] hover:underline flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" />
            <span>Show QR & Link</span>
          </button>
        </div>
      </div>

      {/* Quick Input / Composer Area */}
      <div className="border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg bg-white dark:bg-[#18191A] overflow-hidden">
        {/* Composer Tabs */}
        <div className="flex items-center border-b border-[#E6E6E1] dark:border-[#2B2C2E] bg-[#FAFAF7] dark:bg-[#151617] text-xs">
          <button
            type="button"
            onClick={() => setActiveComposerTab('code')}
            className={`px-3.5 py-2 font-medium flex items-center gap-1.5 border-r border-[#E6E6E1] dark:border-[#2B2C2E] transition-colors ${
              activeComposerTab === 'code'
                ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Code / Text Snippet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveComposerTab('files')}
            className={`px-3.5 py-2 font-medium flex items-center gap-1.5 border-r border-[#E6E6E1] dark:border-[#2B2C2E] transition-colors ${
              activeComposerTab === 'files'
                ? 'bg-white dark:bg-[#18191A] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Files</span>
            {stagedFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded bg-[#1E4D36] text-white">
                {stagedFiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Code / Text */}
        {activeComposerTab === 'code' && (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Optional title or filename (e.g. server.ts, SQL query)"
                value={codeTitle}
                onChange={(e) => setCodeTitle(e.target.value)}
                className="flex-1 bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1 text-xs text-[#111213] dark:text-[#EDEDEA] placeholder-[#7E8079] focus:outline-hidden focus:border-[#1E4D36]"
              />
              <select
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                className="bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2 py-1 text-xs text-[#52534F] dark:text-[#B1B2AC] focus:outline-hidden focus:border-[#1E4D36]"
              >
                <option value="auto">Auto-Detect</option>
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Python">Python</option>
                <option value="JSON">JSON</option>
                <option value="SQL">SQL</option>
                <option value="HTML/XML">HTML / XML</option>
                <option value="CSS">CSS</option>
                <option value="Bash">Bash</option>
                <option value="Markdown">Markdown</option>
                <option value="Plain Text">Plain Text</option>
              </select>
            </div>

            <textarea
              rows={5}
              placeholder="Paste code or type notes here... (Press Cmd+Enter to send)"
              value={codeContent}
              onChange={(e) => setCodeContent(e.target.value)}
              className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded p-2.5 text-xs font-mono text-[#111213] dark:text-[#EDEDEA] leading-relaxed placeholder-[#7E8079] focus:outline-hidden focus:border-[#1E4D36]"
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-3 text-[#7E8079] text-[11px]">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="hover:text-[#111213] dark:hover:text-[#EDEDEA] flex items-center gap-1 font-medium transition-colors"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Paste Clipboard</span>
                </button>
                {codeContent && (
                  <span className="font-mono tabular-nums">
                    {codeContent.length} chars · {codeContent.split('\n').length} lines
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSendCode}
                disabled={!codeContent.trim() || isSendingCode}
                className="px-3.5 py-1 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                <span>{isSendingCode ? 'Sending...' : 'Send Snippet'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Files */}
        {activeComposerTab === 'files' && (
          <div className="p-3.5 space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#D3D3CB] dark:border-[#3D3E42] hover:border-[#1E4D36] bg-[#FAFAF7] dark:bg-[#121314] rounded p-5 flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-[#1E4D36] dark:text-[#3B8563] mb-1.5" />
              <p className="text-xs font-medium text-[#111213] dark:text-[#EDEDEA]">
                Click to browse files or drop them anywhere
              </p>
              <p className="text-[11px] text-[#7E8079] mt-0.5">
                Saved directly as binary files on server disk (Max 50MB per file)
              </p>
            </div>

            {stagedFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] flex items-center justify-between">
                  <span>Selected ({stagedFiles.length} files)</span>
                  <span className="font-mono tabular-nums">
                    {formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {stagedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] flex items-center justify-between text-xs"
                    >
                      <span className="truncate pr-2 font-medium">{file.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#7E8079] font-mono">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          onClick={() => setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-[#7E8079] hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleUploadStaged}
                    disabled={isUploading}
                    className="px-3.5 py-1 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isUploading ? 'Uploading...' : `Upload ${stagedFiles.length} File(s)`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Progress Bar if active */}
      {uploadProgress !== null && (
        <div className="p-3 bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-md space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[#52534F] dark:text-[#B1B2AC]">
            <span>Streaming file to server disk...</span>
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

      {/* Central File & Code Activity Area: Refined File Manager */}
      <div className="space-y-3">
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 p-0.5 rounded border border-[#E6E6E1] dark:border-[#2B2C2E] bg-white dark:bg-[#18191A] text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-[#FAFAF7] dark:bg-[#212224] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setActiveFilter('code')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'code'
                  ? 'bg-[#FAFAF7] dark:bg-[#212224] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              Code & Text ({items.filter((i) => i.type !== 'file').length})
            </button>
            <button
              onClick={() => setActiveFilter('file')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'file'
                  ? 'bg-[#FAFAF7] dark:bg-[#212224] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              Files ({items.filter((i) => i.type === 'file').length})
            </button>
            <button
              onClick={() => setActiveFilter('image')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'image'
                  ? 'bg-[#FAFAF7] dark:bg-[#212224] text-[#111213] dark:text-[#EDEDEA] font-semibold'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              Images (
              {
                items.filter(
                  (i) =>
                    i.type === 'file' &&
                    (i.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(i.filename || ''))
                ).length
              }
              )
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7E8079]" />
              <input
                type="text"
                placeholder="Filter files (/)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded pl-7 pr-6 py-1 text-xs text-[#111213] dark:text-[#EDEDEA] placeholder-[#7E8079] focus:outline-hidden focus:border-[#1E4D36]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2 py-1 text-xs text-[#52534F] dark:text-[#B1B2AC] focus:outline-hidden"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="size">Size</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Item Rows */}
        {displayedItems.length === 0 ? (
          <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-md p-10 text-center space-y-2">
            <FolderOpen className="w-7 h-7 text-[#7E8079] mx-auto opacity-40 mb-1" />
            <h4 className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
              {items.length === 0 ? 'No files or snippets yet' : 'No items match your filter'}
            </h4>
            <p className="text-[11px] text-[#7E8079] max-w-sm mx-auto">
              {items.length === 0
                ? 'Drop files anywhere on screen, paste code above, or pair your phone to transfer instantly.'
                : 'Try adjusting your search query or switching filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedItems.map((item) => (
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
