

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** Single-select pill chips (Figma filter chips). Scrolls horizontally on narrow screens. */
export function ChipGroup<T extends string>({ options, value, onChange, label, className = '', size = 'md' }: ChipGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors duration-150 ${
              size === 'sm' ? 'min-h-9 px-3.5 text-[12px]' : 'min-h-10 px-4 text-[13px]'
            } ${
              selected
                ? 'bg-gold text-ink border-gold'
                : 'bg-surface border-line text-muted hover:text-text hover:border-line-strong'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span className={`tabular-nums text-[11px] ${selected ? 'text-ink/70' : 'text-subtle'}`}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
