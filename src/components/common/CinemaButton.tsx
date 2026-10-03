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
    sm: 'text-xs px-3.5 py-1.5 rounded-xl min-h-[36px] gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2.5 rounded-xl min-h-[44px] gap-2',
    lg: 'text-sm sm:text-base px-5 py-3 rounded-2xl min-h-[48px] gap-2.5',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#E0AD52] hover:bg-[#D49B35] text-[#09090B] font-semibold shadow-[0_2px_12px_rgba(224,173,82,0.25)] active:scale-[0.98]',
    secondary:
      'bg-[#131319] hover:bg-[#1C1C24] text-[#F5F3EB] border border-white/10 hover:border-white/20 active:scale-[0.98]',
    ghost:
      'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/[0.05] active:scale-[0.98]',
    danger:
      'bg-[#B81C28]/15 border border-[#B81C28]/40 text-[#D94048] hover:bg-[#B81C28]/25 active:scale-[0.98]',
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
