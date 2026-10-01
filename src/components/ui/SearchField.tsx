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
      className={`relative flex items-center w-full rounded-2xl bg-[#131319] border border-white/[0.08] focus-within:border-[#E0AD52]/60 focus-within:shadow-[0_0_20px_rgba(224,173,82,0.2)] transition-all duration-300 ${className}`}
    >
      <div className="pl-4 pr-2 text-[#9E9DA5] flex items-center pointer-events-none">
        <Search size={18} />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full py-3.5 pr-10 text-xs sm:text-sm text-[#F5F3EB] placeholder-[#9E9DA5]/70 bg-transparent border-none outline-none"
      />

      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 p-1 rounded-full text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
