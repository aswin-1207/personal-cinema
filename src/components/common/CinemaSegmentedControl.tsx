export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface CinemaSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function CinemaSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: CinemaSegmentedControlProps<T>) {
  const padClass = size === 'sm' ? 'p-0.5' : 'p-1';
  const itemPadClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm';

  return (
    <div
      role="tablist"
      className={`inline-flex items-center bg-[#10121A] border border-white/[0.08] rounded-xl ${padClass} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.id)}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer select-none border-none outline-none ${itemPadClass} ${
              isSelected
                ? 'bg-[#EDC257] text-[#09090D] shadow-[0_2px_12px_rgba(237,194,87,0.3)] font-bold'
                : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F2F0] hover:bg-white/[0.04]'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected
                    ? 'bg-[#09090D]/20 text-[#09090D]'
                    : 'bg-white/10 text-[#9E9DA5]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
