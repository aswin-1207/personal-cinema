import React from 'react';

export type CinemaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type CinemaButtonSize = 'sm' | 'md' | 'lg';

interface CinemaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CinemaButtonVariant;
  size?: CinemaButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const CinemaButton: React.FC<CinemaButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2.5 rounded-xl gap-2',
    lg: 'text-sm sm:text-base px-5 py-3 rounded-2xl gap-2.5',
  }[size];

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-[#E0AD52] to-[#D99C33] text-[#09090B] font-bold shadow-[0_4px_20px_rgba(224,173,82,0.3)] hover:shadow-[0_6px_28px_rgba(224,173,82,0.45)] hover:scale-[1.02] active:scale-[0.98]',
    secondary:
      'bg-white/[0.07] text-[#F5F3EB] border border-white/10 hover:border-[#E0AD52]/50 hover:bg-white/[0.12] active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/[0.05] active:scale-[0.98]',
    danger:
      'bg-[#B81C28]/15 border border-[#B81C28]/40 text-[#D94048] hover:bg-[#B81C28]/30 active:scale-[0.98]',
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#E0AD52] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
