import React from 'react';
import { Film, LucideIcon, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  badge?: string;
  title: string;
  description: string;
  actionText?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  badge = 'YOUR CINEMA IS WAITING',
  title,
  description,
  actionText,
  actionLabel,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  const Icon = icon || Film;
  const primaryText = actionLabel || actionText;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 my-6 rounded-3xl bg-gradient-to-b from-[#131319] to-[#09090B] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden ${className}`}
    >
      {/* Ambient background glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E0AD52]/10 rounded-full blur-3xl pointer-events-none" />

      {badge && (
        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#E0AD52] mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E0AD52]/10 border border-[#E0AD52]/20">
          <Sparkles size={12} />
          <span>{badge}</span>
        </span>
      )}

      <div className="w-16 h-16 rounded-2xl bg-[#E0AD52]/15 border border-[#E0AD52]/25 flex items-center justify-center text-[#E0AD52] mb-5 shadow-[0_4px_24px_rgba(224,173,82,0.2)]">
        <Icon size={28} />
      </div>

      <h3 className="font-serif font-black text-xl sm:text-2xl text-[#F5F3EB] mb-2 tracking-tight">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-[#9E9DA5] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        {primaryText && onAction && (
          <button
            onClick={onAction}
            className="px-6 py-3 rounded-xl bg-[#E0AD52] hover:bg-[#D99C33] text-[#09090B] font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_4px_20px_rgba(224,173,82,0.35)] active:scale-95 cursor-pointer"
          >
            {primaryText}
          </button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F3EB] transition-colors cursor-pointer border border-white/10 active:scale-95"
          >
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
};
