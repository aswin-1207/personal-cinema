import React from 'react';
import { AlertCircle, RotateCw, WifiOff } from 'lucide-react';
import { Button } from './Button';

interface StateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: StateAction;
  secondaryAction?: StateAction;
  compact?: boolean;
  className?: string;
}

/** Figma "Your cinema is waiting" card. Short title, optional one-line description, one clear action. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, secondaryAction, compact, className = '' }) => (
  <div
    className={`rounded-2xl bg-surface border border-line ${compact ? 'p-4' : 'p-6 sm:p-8'} flex ${
      compact ? 'flex-row items-center text-left gap-4' : 'flex-col items-center text-center gap-3'
    } ${className}`}
  >
    {icon && (
      <div className={`shrink-0 rounded-full bg-gold/10 text-gold flex items-center justify-center ${compact ? 'w-11 h-11' : 'w-12 h-12'}`} aria-hidden="true">
        {icon}
      </div>
    )}
    <div className={`min-w-0 ${compact ? 'flex-1' : ''}`}>
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {description && <p className="mt-1 text-[13px] text-muted max-w-sm mx-auto">{description}</p>}
    </div>
    {(action || secondaryAction) && (
      <div className={`flex flex-wrap gap-2 ${compact ? 'shrink-0' : 'justify-center pt-1'}`}>
        {action && (
          <Button variant="primary" size={compact ? 'sm' : 'md'} icon={action.icon} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="secondary" size={compact ? 'sm' : 'md'} icon={secondaryAction.icon} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    )}
  </div>
);

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, description, onRetry, offline, compact, className = '' }) => (
  <div
    role="alert"
    className={`rounded-2xl bg-surface border border-line flex items-center gap-3 ${compact ? 'p-3.5' : 'p-5'} ${className}`}
  >
    <div className="shrink-0 w-10 h-10 rounded-full bg-white/5 text-muted flex items-center justify-center" aria-hidden="true">
      {offline ? <WifiOff size={18} /> : <AlertCircle size={18} />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-semibold text-text">{title || (offline ? "You're offline" : "Couldn't load this")}</p>
      <p className="text-[12px] text-muted">
        {description || (offline ? 'Connect to the internet to load new titles.' : 'Check your connection and try again.')}
      </p>
    </div>
    {onRetry && (
      <Button size="sm" variant="secondary" icon={<RotateCw size={14} aria-hidden="true" />} onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading', className = '' }) => (
  <div role="status" className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-gold animate-spin" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

export const PosterSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`min-w-0 ${className}`} aria-hidden="true">
    <div className="aspect-[2/3] rounded-xl cinema-skeleton" />
    <div className="mt-2 h-3 w-4/5 rounded cinema-skeleton" />
    <div className="mt-1.5 h-2.5 w-1/2 rounded cinema-skeleton" />
  </div>
);
