import React, { useState, useEffect } from 'react';
import { Edit2, X, Check } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newTitle: string) => void;
  currentTitle: string;
  isFileType?: boolean;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentTitle,
  isFileType,
}) => {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    setTitle(currentTitle);
  }, [currentTitle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onRename(title.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#18191A] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded-lg max-w-sm w-full p-5 shadow-lg relative text-xs">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7E8079] hover:text-[#111213] dark:hover:text-[#EDEDEA] p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Edit2 className="w-4 h-4 text-[#1E4D36] dark:text-[#3B8563]" />
          <h3 className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">
            Rename {isFileType ? 'File' : 'Snippet'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[#52534F] dark:text-[#B1B2AC] mb-1">
              Title or Filename
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#FAFAF7] dark:bg-[#121314] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded px-2.5 py-1.5 text-xs text-[#111213] dark:text-[#EDEDEA] focus:outline-hidden focus:border-[#1E4D36]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-medium text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] rounded border border-[#E6E6E1] dark:border-[#2B2C2E] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || title === currentTitle}
              className="px-3 py-1 text-xs font-semibold text-white bg-[#1E4D36] hover:bg-[#163B29] rounded transition-colors flex items-center gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
