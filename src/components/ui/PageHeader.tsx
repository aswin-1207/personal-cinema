import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProfileButton } from './ProfileButton';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Show the My Cinema avatar on phones (desktop has the sidebar). */
  showProfile?: boolean;
  className?: string;
}

/** Figma page header: bold title, optional one-line subtitle, actions on the right. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  showProfile = true,
  className = '',
}) => (
  <header className={`flex items-center gap-2 min-h-11 ${className}`}>
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="shrink-0 -ml-2.5 w-11 h-11 rounded-full flex items-center justify-center text-text hover:bg-white/5"
      >
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
    )}
    <div className="min-w-0 flex-1">
      <h1 className="font-page-title truncate">{title}</h1>
      {subtitle && <p className="text-[13px] text-muted truncate mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    {showProfile && <ProfileButton className="md:hidden -mr-1.5" />}
  </header>
);
