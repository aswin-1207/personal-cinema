import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ScrollLockManager } from '../../services/scrollLockManager';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: number | string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  onSubmit,
  maxWidth = 540,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    ScrollLockManager.lock();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      ScrollLockManager.unlock();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <>
      {/* Modal Header (Fixed) */}
      {title && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/[0.08] flex-shrink-0 bg-[#131319]">
          <h3 className="font-semibold text-base sm:text-lg text-[#F5F3EB] line-clamp-1">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.08] text-[#9E9DA5] hover:text-white transition-colors flex items-center justify-center cursor-pointer border-none bg-transparent"
            title="Close"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Content Body (Scrollable) */}
      <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
        {children}
      </div>

      {/* Modal Footer (Fixed, Never Clipped) */}
      {footer && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-white/[0.08] bg-[#131319] flex items-center justify-between sm:justify-end gap-3 z-10">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] bg-[#050508]/85 backdrop-blur-xl animate-cinema-fade"
      onClick={onClose}
    >
      {/* Dialog Box: Fully Contained, Elevated, Never trapped at bottom edge */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={`w-full bg-[#131319] border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col rounded-2xl max-h-[calc(100dvh-max(env(safe-area-inset-top,0px),0.75rem)-max(env(safe-area-inset-bottom,0px),0.75rem)-1rem)] sm:max-h-[88dvh] my-auto animate-cinema-scale ${
          typeof maxWidth === 'string' && maxWidth.startsWith('max-w-') ? maxWidth : ''
        }`}
        style={{
          maxWidth: typeof maxWidth === 'number' ? maxWidth : (typeof maxWidth === 'string' && !maxWidth.startsWith('max-w-') ? maxWidth : undefined),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>
  );
};
