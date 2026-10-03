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
  badge,
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
      className={`flex flex-col items-center justify-center text-center p-5 sm:p-7 my-3 sm:my-4 max-w-md mx-auto rounded-2xl bg-[#131319]/80 border border-white/[0.07] shadow-xl relative overflow-hidden ${className}`}
    >
      {badge && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E0AD52] mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E0AD52]/10 border border-[#E0AD52]/20">
          <Sparkles size={11} />
          <span>{badge}</span>
        </span>
      )}

      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#E0AD52]/10 border border-[#E0AD52]/20 flex items-center justify-center text-[#E0AD52] mb-3 shadow-[0_2px_12px_rgba(224,173,82,0.15)]">
        <Icon size={20} />
      </div>

      <h3 className="font-semibold text-sm sm:text-base text-[#F5F3EB] mb-1 tracking-tight">
        {title}
      </h3>

      <p className="text-xs text-[#9E9DA5] max-w-xs mb-4 leading-relaxed">
        {description}
      </p>

      <div className="flex gap-2.5 flex-wrap justify-center">
        {primaryText && onAction && (
          <button
            onClick={onAction}
            className="cinema-button-primary px-4 py-2 text-xs font-bold rounded-xl min-h-[44px] shadow-[0_4px_16px_rgba(224,173,82,0.25)] active:scale-95 cursor-pointer"
          >
            {primaryText}
          </button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="cinema-button-secondary px-3.5 py-2 text-xs font-semibold rounded-xl min-h-[44px] cursor-pointer"
          >
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
};
