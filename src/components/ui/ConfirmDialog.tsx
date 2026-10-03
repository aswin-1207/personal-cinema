import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = true,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={440}
      footer={
        <div className="flex gap-2.5 justify-end w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F3EB] transition-colors cursor-pointer border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                : 'bg-[#E0AD52] hover:bg-[#D99C33] text-[#09090B] shadow-[#E0AD52]/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-left">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDestructive
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/30'
            }`}
          >
            {isDestructive ? <AlertTriangle size={22} /> : <Trash2 size={22} />}
          </div>
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-[#F5F3EB]">
              {title}
            </h3>
            <p className="text-xs text-[#9E9DA5] mt-0.5">Please confirm this action</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#9E9DA5] leading-relaxed">
          {message}
        </p>
      </div>
    </Modal>
  );
};
