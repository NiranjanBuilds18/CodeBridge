import React, { useState, useMemo } from 'react';
import {
  FileCode,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  WrapText,
  Eye,
  X,
} from 'lucide-react';
import { formatBytes, formatRelativeTime, detectLanguage, getFileCategory } from '../utils/format.js';
import { copyToClipboard } from '../utils/device.js';
import { highlightCode } from '../utils/highlight.js';
import type { TransferItem } from '../types.js';

interface ItemCardProps {
  item: TransferItem;
  onRename: (item: TransferItem) => void;
  onDelete: (item: TransferItem) => void;
  defaultExpanded?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onRename,
  onDelete,
  defaultExpanded = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [wrapCode, setWrapCode] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  const isFile = item.type === 'file';
  const category = getFileCategory(item.filename || item.title, item.mimeType);
  const isImage = category.iconType === 'image';

  const detectedLang = useMemo(() => {
    if (isFile) return category.label;
    return item.language || detectLanguage(item.content || '');
  }, [isFile, category.label, item.language, item.content]);

  const highlightedHtml = useMemo(() => {
    if (isFile || !item.content) return '';
    return highlightCode(item.content, detectedLang);
  }, [isFile, item.content, detectedLang]);

  const lineCount = useMemo(() => {
    if (isFile || !item.content) return 0;
    return item.content.split('\n').length;
  }, [isFile, item.content]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = isFile ? window.location.origin + (item.downloadUrl || '') : item.content || '';
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFile && item.downloadUrl) {
      const a = document.createElement('a');
      a.href = item.downloadUrl;
      a.download = item.filename || item.title || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const ext =
        detectedLang.toLowerCase() === 'python' ? 'py'
        : detectedLang.toLowerCase() === 'typescript' ? 'ts'
        : detectedLang.toLowerCase() === 'javascript' ? 'js'
        : detectedLang.toLowerCase() === 'json' ? 'json'
        : detectedLang.toLowerCase() === 'sql' ? 'sql'
        : detectedLang.toLowerCase() === 'markdown' ? 'md'
        : detectedLang.toLowerCase() === 'html/xml' ? 'html'
        : 'txt';

      const filename = `${(item.title || 'snippet').replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      const blob = new Blob([item.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] hover:border-[#D3D3CB] dark:hover:border-[#3D3E42] rounded-md transition-colors overflow-hidden">
      {/* File Manager Compact Row */}
      <div
        onClick={() => !isFile && setIsExpanded(!isExpanded)}
        className={`px-3 py-2.5 flex items-center justify-between gap-3 text-xs ${
          !isFile ? 'cursor-pointer hover:bg-[#FAFAF7] dark:hover:bg-[#202123]' : ''
        }`}
      >
        {/* Left: Icon, Name & Type */}
        <div className="flex items-center gap-2.5 min-w-0">
          {!isFile ? (
            <button
              type="button"
              className="text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-0.5"
              aria-label={isExpanded ? 'Collapse code' : 'Expand code'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : isImage && item.downloadUrl ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowFullImage(true);
              }}
              className="w-7 h-7 rounded border border-[#E6E6E1] dark:border-[#2B2C2E] overflow-hidden shrink-0 cursor-pointer bg-[#F3F3EE] dark:bg-[#212224] flex items-center justify-center group/thumb"
              title="Click to view image"
            >
              <img
                src={item.downloadUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-7 h-7 rounded bg-[#FAFAF7] dark:bg-[#212224] border border-[#E6E6E1] dark:border-[#2B2C2E] flex items-center justify-center text-[#1E4D36] dark:text-[#3B8563] shrink-0">
              {category.iconType === 'archive' ? (
                <FileArchive className="w-3.5 h-3.5" />
              ) : category.iconType === 'code' ? (
                <FileCode className="w-3.5 h-3.5" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#111213] dark:text-[#EDEDEA] truncate">
                {item.title || item.filename}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded border border-[#E6E6E1] dark:border-[#2B2C2E] text-[#52534F] dark:text-[#B1B2AC] bg-[#FAFAF7] dark:bg-[#212224] shrink-0">
                {detectedLang}
              </span>
            </div>
          </div>
        </div>

        {/* Center / Metadata: Size, Lines, Sender, Time */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#7E8079] font-mono shrink-0">
          <span className="tabular-nums">
            {formatBytes(item.fileSize || item.content?.length)}
          </span>
          <span aria-hidden="true">·</span>
          {!isFile && (
            <>
              <span className="tabular-nums">{lineCount}L</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="font-sans text-[11px] max-w-[100px] truncate">{item.senderDevice || 'Device'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-sans text-[11px]">{formatRelativeTime(item.createdAt)}</span>
        </div>

        {/* Right: Contextual Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            onClick={handleCopy}
            className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors flex items-center gap-1 ${
              isCopied
                ? 'bg-[#EBF3EF] dark:bg-[#172D23] text-[#1E4D36] dark:text-[#3B8563] border-[#C9DFD3] dark:border-[#1E4D36]'
                : 'bg-white dark:bg-[#18191A] text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] border-[#E6E6E1] dark:border-[#2B2C2E] hover:bg-[#FAFAF7] dark:hover:bg-[#212224]'
            }`}
            title={isFile ? 'Copy download link' : 'Copy code to clipboard'}
          >
            {isCopied ? <Check className="w-3 h-3 text-[#1E4D36] dark:text-[#3B8563]" /> : <Copy className="w-3 h-3 text-[#7E8079]" />}
            <span>{isCopied ? 'Copied' : isFile ? 'Link' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            title={isFile ? 'Download file' : 'Save as file'}
            className="p-1 text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] rounded border border-transparent hover:border-[#E6E6E1] dark:hover:border-[#2B2C2E] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(item);
            }}
            title="Rename"
            className="p-1 text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] hover:bg-[#F3F3EE] dark:hover:bg-[#212224] rounded border border-transparent hover:border-[#E6E6E1] dark:hover:border-[#2B2C2E] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            title="Delete item"
            className="p-1 text-[#7E8079] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded border border-transparent hover:border-red-200 dark:hover:border-red-900/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Code Inspector */}
      {!isFile && isExpanded && (
        <div className="border-t border-[#E6E6E1] dark:border-[#2B2C2E] bg-[#FAFAF7] dark:bg-[#121314] text-xs">
          <div className="px-3 py-1.5 border-b border-[#E6E6E1] dark:border-[#2B2C2E] flex items-center justify-between text-[11px] text-[#7E8079]">
            <div className="flex items-center gap-2">
              <span className="font-mono">{lineCount} lines</span>
              <span>·</span>
              <span className="font-mono">{formatBytes(item.content?.length)}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWrapCode(!wrapCode);
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                wrapCode
                  ? 'bg-[#EBF3EF] text-[#1E4D36] font-medium'
                  : 'text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA]'
              }`}
            >
              <WrapText className="w-3 h-3" />
              <span>{wrapCode ? 'Wrapped' : 'No Wrap'}</span>
            </button>
          </div>
          <div className="p-3 overflow-x-auto max-h-80 select-text">
            <pre
              className={`font-mono text-xs text-[#111213] dark:text-[#EDEDEA] leading-relaxed ${
                wrapCode ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
              }`}
            >
              <code
                dangerouslySetInnerHTML={{
                  __html: highlightedHtml || item.content || '',
                }}
              />
            </pre>
          </div>
        </div>
      )}

      {/* Full Lightbox Image Modal */}
      {showFullImage && item.downloadUrl && (
        <div
          onClick={() => setShowFullImage(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-2xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-md max-w-4xl w-full p-4 relative max-h-[90vh] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E1] dark:border-[#2B2C2E] text-xs">
              <span className="font-medium text-[#111213] dark:text-[#EDEDEA] truncate">{item.title}</span>
              <button
                onClick={() => setShowFullImage(false)}
                className="text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-3 flex items-center justify-center overflow-auto flex-1">
              <img
                src={item.downloadUrl}
                alt={item.title}
                className="max-h-[75vh] max-w-full rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
