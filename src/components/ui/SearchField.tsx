import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search by title, director, genre, or keyword...',
  autoFocus = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div
      className={`relative flex items-center w-full h-[52px] sm:h-[56px] rounded-2xl bg-[#131319] border border-white/[0.1] hover:border-white/20 focus-within:border-[#E0AD52] focus-within:ring-2 focus-within:ring-[#E0AD52]/20 focus-within:shadow-[0_0_24px_rgba(224,173,82,0.22)] transition-all duration-300 ${className}`}
    >
      <div className="pl-4 pr-3 text-[#9E9DA5] flex items-center pointer-events-none flex-shrink-0">
        <Search size={20} className="text-[#9E9DA5] group-focus-within:text-[#E0AD52]" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-full pr-12 text-base text-[#F5F3EB] placeholder-[#9E9DA5]/70 bg-transparent border-none outline-none font-normal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />

      {value && (
        <button
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer border-none bg-transparent"
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
