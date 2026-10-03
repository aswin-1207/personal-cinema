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
      className={`flex items-center justify-between gap-3 pt-0.5 pb-2 border-b border-white/[0.06] ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {badge && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E0AD52] flex-shrink-0">
              {badge}
            </span>
          )}
          <h1 className="font-bold text-xl sm:text-2xl md:text-[28px] text-[#F5F3EB] tracking-tight truncate leading-tight">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#9E9DA5] truncate mt-1 max-w-xl font-normal">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};
