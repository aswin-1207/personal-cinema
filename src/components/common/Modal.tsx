import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ScrollLockManager } from '../../services/scrollLockManager';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: number | string;
  /** Prevent closing via backdrop/Escape (e.g. while an import is running). */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog primitive: bottom sheet on phones, centered dialog from 640px.
 * Fixed header → scrollable body → fixed footer. Locks page scroll, traps focus,
 * closes on Escape/backdrop and restores focus + page scroll on close.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
  maxWidth = 540,
  dismissible = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ScrollLockManager.lock();

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const autofocus = dialog.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      const body = dialog.querySelector<HTMLElement>('[data-modal-body]');
      const firstInBody = body?.querySelector<HTMLElement>(FOCUSABLE);
      (autofocus || firstInBody || dialog).focus({ preventScroll: true });
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handlePopState = () => onCloseRef.current();

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.clearTimeout(focusTimer);
      ScrollLockManager.unlock();
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClass = typeof maxWidth === 'string' && maxWidth.startsWith('max-w-') ? `sm:${maxWidth}` : '';
  const widthStyle =
    typeof maxWidth === 'number'
      ? { ['--modal-max' as string]: `${maxWidth}px` }
      : typeof maxWidth === 'string' && !maxWidth.startsWith('max-w-')
      ? { ['--modal-max' as string]: maxWidth }
      : undefined;

  const content = (
    <>
      {(title || !footer) && (
        <div className="flex items-start justify-between gap-3 pl-5 pr-3 sm:pl-6 pt-3 sm:pt-4 pb-3 border-b border-line shrink-0">
          <div className="min-w-0 pt-1.5">
            {title && (
              <h2 id={titleId} className="text-[17px] font-semibold text-text leading-snug line-clamp-2">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-0.5 text-[13px] text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 rounded-full text-muted hover:text-text hover:bg-white/5 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      <div data-modal-body className="px-5 sm:px-6 py-4 sm:py-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
        {children}
      </div>

      {footer && (
        <div className="shrink-0 px-5 sm:px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3 border-t border-line bg-surface flex items-center justify-end gap-2.5 flex-wrap">
          {footer}
        </div>
      )}
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/75 animate-cinema-fade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={widthStyle}
        className={`relative w-full sm:max-w-[var(--modal-max,540px)] ${widthClass} bg-surface border border-line-strong shadow-[0_24px_64px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden outline-none rounded-t-[20px] sm:rounded-[20px] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-24px)] sm:max-h-[min(88dvh,820px)] animate-cinema-sheet sm:animate-cinema-scale`}
      >
        <div className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" aria-hidden="true" />
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>
    ,
    document.body
  );
};
