import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  isDanger = true,
  isLoading = false,
}) => {
  if (!isOpen) return null;

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

        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40'
                : 'bg-[#EBF3EF] dark:bg-[#172D23] text-[#1E4D36] dark:text-[#3B8563] border border-[#C9DFD3] dark:border-[#1E4D36]'
            }`}
          >
            {isDanger ? <Trash2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          </div>
          <h3 className="text-xs font-semibold text-[#111213] dark:text-[#EDEDEA]">{title}</h3>
        </div>

        <p className="text-[11px] text-[#52534F] dark:text-[#B1B2AC] leading-relaxed mb-5">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium text-[#52534F] dark:text-[#B1B2AC] hover:text-[#111213] dark:hover:text-[#EDEDEA] bg-[#FAFAF7] dark:bg-[#212224] hover:bg-[#F3F3EE] dark:hover:bg-[#2B2C2F] border border-[#E6E6E1] dark:border-[#2B2C2E] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[#1E4D36] hover:bg-[#163B29] text-white'
            }`}
          >
            {isDanger && <Trash2 className="w-3 h-3" />}
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
