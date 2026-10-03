import React, { useEffect } from 'react';
import { useCinema } from '../../context/CinemaContext';
import { CheckCircle2, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, dismissToast } = useCinema();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, toast.actionLabel ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[120] left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[440px] bottom-[calc(var(--cinema-nav-height-mobile)+env(safe-area-inset-bottom,0px)+12px)] md:bottom-6 md:ml-[calc(var(--cinema-sidebar-width)/2)] pointer-events-none"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 pl-4 pr-1.5 py-1.5 min-h-[52px] rounded-2xl bg-surface-2 border border-line-strong shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-cinema-toast"
        >
          <CheckCircle2 size={18} className="text-gold shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-[13px] font-medium text-text line-clamp-2">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction!();
                dismissToast();
              }}
              className="shrink-0 min-h-10 px-3 rounded-full text-[13px] font-bold text-gold hover:bg-gold/10"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss"
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-subtle hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
