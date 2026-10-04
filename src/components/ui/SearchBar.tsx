import React, { forwardRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';

interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  label: string;
  isLoading?: boolean;
  size?: 'md' | 'lg';
  onClear?: () => void;
}

/** Full-width search field: 52px on phones (lg) / 44px for in-page filters (md), with clear button. */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, label, isLoading, size = 'md', onClear, className = '', placeholder, ...rest }, ref) => (
    <div className={`relative w-full ${className}`} role="search">
      <Search
        size={size === 'lg' ? 20 : 17}
        className={`absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none ${size === 'lg' ? 'left-4' : 'left-3.5'}`}
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder ?? label}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className={`w-full bg-surface border border-line-strong text-text placeholder:text-subtle rounded-2xl outline-none transition-colors focus:border-gold/60 focus:bg-surface-2 [&::-webkit-search-cancel-button]:hidden ${
          size === 'lg' ? 'h-[52px] pl-12 pr-12 text-[16px]' : 'h-11 pl-10 pr-11 text-[15px]'
        }`}
        {...rest}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
        {isLoading && <Loader2 size={16} className="animate-spin text-gold mr-1" aria-hidden="true" />}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            aria-label="Clear search"
            className={`rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/5 ${size === 'lg' ? 'w-11 h-11' : 'w-9 h-9'}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
);
SearchBar.displayName = 'SearchBar';
