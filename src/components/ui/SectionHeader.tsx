import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  count,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-lg sm:text-xl text-[#F5F3EB] tracking-tight">
            {title}
          </h3>
          {count !== undefined && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/25">
              {count}
            </span>
          )}
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/25 uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-[#9E9DA5]">{subtitle}</p>}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-xs font-semibold flex items-center gap-1 text-[#E0AD52] hover:text-[#D99C33] transition-colors p-0 cursor-pointer bg-transparent border-none flex-shrink-0"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};
