import { Film, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
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
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--cinema-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--cinema-border)',
        margin: '24px 0',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: 'rgba(237, 194, 87, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cinema-gold)',
          marginBottom: 18,
        }}
      >
        <Icon size={30} />
      </div>

      <h4
        className="title-display"
        style={{ fontSize: 18, color: 'var(--cinema-white)', marginBottom: 8 }}
      >
        {title}
      </h4>

      <p
        style={{
          fontSize: 14,
          color: 'var(--cinema-silver)',
          maxWidth: 380,
          marginBottom: 24,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {primaryText && onAction && (
          <button className="btn-primary" onClick={onAction}>
            {primaryText}
          </button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <button className="btn-secondary" onClick={onSecondaryAction}>
            {secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
};
