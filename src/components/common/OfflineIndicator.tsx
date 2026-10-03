import React from 'react';
import { useCinema } from '../../context/CinemaContext';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = useCinema();
  if (isOnline) return null;
  return (
    <div
      role="status"
      className="relative z-20 flex items-center justify-center gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+6px)] pb-1.5 bg-surface-2 border-b border-line text-[12px] text-muted"
    >
      <WifiOff size={13} className="text-gold shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold text-text">Offline.</span> Your saved titles are still available.
      </span>
    </div>
  );
};
