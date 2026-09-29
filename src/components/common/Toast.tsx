import React, { useEffect } from 'react';
import { useCinema } from '../../context/CinemaContext';
import { CheckCircle2, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, dismissToast } = useCinema();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(74px + env(safe-area-inset-bottom, 12px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        width: 'calc(100% - 32px)',
        maxWidth: 420,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: 'var(--cinema-surface-elevated)',
          border: '1px solid var(--cinema-gold)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
          animation: 'slideUpToast 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <CheckCircle2 size={18} color="var(--cinema-gold)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cinema-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {toast.message}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => {
                toast.onAction!();
                dismissToast();
              }}
              style={{
                background: 'rgba(237, 194, 87, 0.15)',
                border: 'none',
                color: 'var(--cinema-gold)',
                fontWeight: 700,
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              {toast.actionLabel}
            </button>
          )}

          <button
            onClick={dismissToast}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--cinema-subtle)',
              cursor: 'pointer',
              display: 'flex',
              padding: 2,
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpToast {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
