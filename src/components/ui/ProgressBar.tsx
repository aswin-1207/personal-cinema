import React from 'react';

interface ProgressBarProps {
  value: number;
  label?: string;
  complete?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, complete, size = 'sm', className = '' }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const h = size === 'xs' ? 'h-1' : size === 'md' ? 'h-2' : 'h-1.5';
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={`w-full ${h} rounded-full bg-white/[0.08] overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${complete ? 'bg-green' : 'bg-gold'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
