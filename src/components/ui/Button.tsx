import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-strong border border-transparent shadow-[0_6px_20px_rgba(224,173,82,0.22)]',
  secondary: 'bg-surface-2 text-text border border-line hover:bg-surface-3 hover:border-line-strong',
  outline: 'bg-transparent text-text border border-line-strong hover:border-gold/60 hover:text-gold',
  ghost: 'bg-transparent text-muted border border-transparent hover:text-text hover:bg-white/5',
  danger: 'bg-danger/10 text-[#F0848A] border border-danger/35 hover:bg-danger/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-[13px] gap-1.5',
  md: 'min-h-11 px-[18px] text-sm gap-2',
  lg: 'min-h-12 px-6 text-[15px] gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', icon, iconRight, isLoading, fullWidth, className = '', children, disabled, type = 'button', ...rest },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" /> : icon}
      {children != null && <span className="truncate">{children}</span>}
      {iconRight}
    </button>
  )
);
Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'solid' | 'ghost' | 'overlay';
  size?: 'sm' | 'md';
  active?: boolean;
}

/** Square/round icon-only button with a guaranteed 44px touch target and an accessible label. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'solid', size = 'md', active, className = '', children, type = 'button', ...rest }, ref) => {
    const base =
      variant === 'overlay'
        ? 'bg-ink/70 border border-white/10 text-text hover:bg-ink/90 backdrop-blur-sm'
        : variant === 'ghost'
        ? 'bg-transparent border border-transparent text-muted hover:text-text hover:bg-white/5'
        : 'bg-surface-2 border border-line text-text hover:bg-surface-3';
    const dims = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={`relative inline-flex items-center justify-center rounded-full shrink-0 transition-colors duration-150 active:scale-95 disabled:opacity-50 ${base} ${dims} ${
          active ? '!text-gold !border-gold/50' : ''
        } ${size === 'sm' ? "before:absolute before:-inset-1 before:content-['']" : ''} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
