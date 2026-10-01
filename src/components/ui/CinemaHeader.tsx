import React from 'react';

interface CinemaHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CinemaHeader: React.FC<CinemaHeaderProps> = ({
  badge,
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-3 border-b border-white/[0.06] ${className}`}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        {badge && (
          <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.24em] text-[#E0AD52] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E0AD52]" />
            <span>{badge}</span>
          </div>
        )}
        <h1 className="font-serif font-black text-2xl sm:text-3xl text-[#F5F3EB] tracking-tight leading-tight break-words">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#9E9DA5] leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="flex-shrink-0 flex items-center gap-2.5">{action}</div>}
    </div>
  );
};
