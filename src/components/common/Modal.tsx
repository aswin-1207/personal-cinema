import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number | string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 540,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#050508]/85 backdrop-blur-xl animate-cinema-fade"
      onClick={onClose}
    >
      {/* Dialog Box: Desktop Centered Glass vs Mobile Bottom Sheet */}
      <div
        className={`w-full bg-[#171924] border border-white/[0.1] shadow-2xl overflow-hidden flex flex-col rounded-t-[24px] sm:rounded-2xl max-h-[88vh] animate-cinema-sheet sm:animate-cinema-scale ${
          typeof maxWidth === 'string' && maxWidth.startsWith('max-w-') ? maxWidth : ''
        }`}
        style={{
          maxWidth: typeof maxWidth === 'number' ? maxWidth : (typeof maxWidth === 'string' && !maxWidth.startsWith('max-w-') ? maxWidth : undefined),
          paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Modal Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
            <h3 className="font-serif font-bold text-base sm:text-lg text-[#F5F2F0]">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/[0.08] text-[#9E9DA5] hover:text-white transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
