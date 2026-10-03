
import { ArrowUpDown } from 'lucide-react';

interface SortSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  className?: string;
}

/** Native select (accessible on every platform) styled as a Figma pill. */
export function SortSelect<T extends string>({ value, onChange, options, label = 'Sort by', className = '' }: SortSelectProps<T>) {
  return (
    <label className={`relative inline-flex items-center shrink-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <ArrowUpDown size={14} className="absolute left-3 text-muted pointer-events-none" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none h-11 pl-8 pr-4 rounded-2xl bg-surface border border-line-strong text-[13px] font-semibold text-text outline-none focus:border-gold/60 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-text">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
