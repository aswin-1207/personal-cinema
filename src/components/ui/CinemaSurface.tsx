import React from 'react';

interface CinemaSurfaceProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass' | 'interactive' | 'gold-border';
  className?: string;
  onClick?: () => void;
}

export const CinemaSurface: React.FC<CinemaSurfaceProps> = ({
  children,
  variant = 'default',
  className = '',
  onClick,
}) => {
  const baseStyles = 'rounded-2xl sm:rounded-3xl transition-all duration-300';

  const variantStyles = {
    default:
      'bg-[#131319] border border-white/[0.07] shadow-[0_8px_30px_rgba(0,0,0,0.6)]',
    elevated:
      'bg-[#1C1C24] border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.75)]',
    glass:
      'bg-[#131319]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.7)]',
    interactive:
      'bg-[#131319] border border-white/[0.07] hover:border-[#E0AD52]/40 shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.85)] cursor-pointer hover:-translate-y-0.5',
    'gold-border':
      'bg-gradient-to-r from-[#131319] to-[#0F0F14] border border-[#E0AD52]/30 shadow-[0_8px_32px_rgba(224,173,82,0.12)]',
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </div>
  );
};
