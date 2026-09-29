import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionText,
  actionLabel,
  onAction,
  className = '',
}) => {
  const primaryText = actionLabel || actionText;
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 14,
        padding: '0 4px',
      }}
    >
      <div>
        <h3
          className="title-display"
          style={{
            fontSize: 18,
            color: 'var(--cinema-white)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--cinema-subtle)', marginTop: 2 }}>
            {subtitle}
          </p>
        )}
      </div>

      {primaryText && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--cinema-gold)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          {primaryText} →
        </button>
      )}
    </div>
  );
};
