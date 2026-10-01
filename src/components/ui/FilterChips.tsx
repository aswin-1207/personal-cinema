import React from 'react';

export interface FilterOption {
  id: string | number;
  label: string;
  badge?: string | number;
}

interface FilterChipsProps {
  options: FilterOption[];
  selectedId: string | number | null;
  onSelect: (id: any) => void;
  className?: string;
  variant?: 'gold' | 'purple';
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  options,
  selectedId,
  onSelect,
  className = '',
  variant = 'gold',
}) => {
  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth ${className}`}
    >
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;

        const activeStyles =
          variant === 'purple'
            ? 'bg-[#8C7AD0]/20 text-[#8C7AD0] border-[#8C7AD0]/40 shadow-[0_0_12px_rgba(140,122,208,0.25)]'
            : 'bg-[#E0AD52]/20 text-[#E0AD52] border-[#E0AD52]/40 shadow-[0_0_12px_rgba(224,173,82,0.25)]';

        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 border flex items-center gap-1.5 active:scale-95 ${
              isSelected
                ? `${activeStyles} font-bold`
                : 'bg-[#131319] text-[#9E9DA5] border-white/[0.06] hover:text-[#F5F3EB] hover:border-white/15'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? 'bg-black/40 text-current'
                    : 'bg-white/5 text-[#9E9DA5]'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
