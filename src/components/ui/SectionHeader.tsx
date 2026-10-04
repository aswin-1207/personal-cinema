import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  right?: React.ReactNode;
  id?: string;
  className?: string;
}

/** Figma section label: small uppercase title with an optional "View all" action. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count, actionLabel, onAction, right, id, className = '' }) => (
  <div className={`flex items-center justify-between gap-3 min-h-9 ${className}`}>
    <h2 id={id} className="font-section-title truncate">
      {title}
      {count != null && <span className="ml-2 text-subtle tabular-nums">{count}</span>}
    </h2>
    {right}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 inline-flex items-center gap-0.5 min-h-9 -mr-2 px-2 rounded-full text-[12px] font-semibold text-gold hover:text-gold-strong"
        aria-label={`${actionLabel}: ${title}`}
      >
        {actionLabel}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    )}
  </div>
);
