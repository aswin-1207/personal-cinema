import React from 'react';
import { useCinema } from '../../context/CinemaContext';

export const getInitials = (name?: string) => {
  const n = (name || '').trim();
  if (!n) return 'MC';
  const parts = n.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase();
};

/** "My Cinema" avatar — opens Profile. Used in mobile page headers. */
export const ProfileButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { preferences, setActiveTab, activeTab } = useCinema();
  const active = activeTab === 'profile' || activeTab === 'reviews';
  return (
    <button
      type="button"
      onClick={() => setActiveTab('profile')}
      aria-label="My Cinema — profile and settings"
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${className}`}
    >
      <span
        className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold border ${
          active ? 'bg-gold text-ink border-gold' : 'bg-surface-2 text-gold border-gold/30'
        }`}
      >
        {getInitials(preferences.displayName)}
      </span>
    </button>
  );
};
