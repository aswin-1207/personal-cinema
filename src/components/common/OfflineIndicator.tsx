import React from 'react';
import { useCinema } from '../../context/CinemaContext';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = useCinema();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 80,
        backgroundColor: 'rgba(217, 64, 72, 0.92)',
        backdropFilter: 'blur(8px)',
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 16px',
        letterSpacing: '0.04em',
      }}
    >
      <WifiOff size={14} />
      <span>Offline Mode — Your personal cinema library is safely stored on this device.</span>
    </div>
  );
};
