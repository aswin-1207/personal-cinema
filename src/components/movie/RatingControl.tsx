import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticsService } from '../../services/hapticsService';

interface RatingControlProps {
  value: number | null | undefined;
  onChange: (rating: number) => void;
  size?: number | 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}

export const RatingControl: React.FC<RatingControlProps> = ({
  value = 0,
  onChange,
  size = 28,
  readOnly = false,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 16
      : size === 'lg'
      ? 32
      : 24;

  const displayValue = hoverValue !== null ? hoverValue : (value || 0);

  const handleStarClick = (starIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    const newRating = isLeftHalf ? starIndex - 0.5 : starIndex;

    soundService.playSubtleClick();
    hapticsService.tap();
    onChange(newRating);
  };

  const handleMouseMove = (starIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    setHoverValue(isLeftHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, displayValue - (starIndex - 1)));

        return (
          <div
            key={starIndex}
            onClick={(e) => handleStarClick(starIndex, e)}
            onMouseMove={(e) => handleMouseMove(starIndex, e)}
            style={{
              position: 'relative',
              cursor: readOnly ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              transition: 'transform var(--transition-fast)',
            }}
          >
            {/* Background empty star */}
            <Star
              size={numericSize}
              color="var(--cinema-surface-elevated)"
              fill="rgba(255, 255, 255, 0.08)"
              strokeWidth={1}
            />

            {/* Filled gold star overlay with clip-path for half-stars */}
            {fillAmount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 2,
                  overflow: 'hidden',
                  width: `${fillAmount * 100}%`,
                  pointerEvents: 'none',
                }}
              >
                <Star
                  size={numericSize}
                  color="var(--cinema-gold)"
                  fill="var(--cinema-gold)"
                  strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 0 6px var(--cinema-gold-glow))' }}
                />
              </div>
            )}
          </div>
        );
      })}

      {displayValue > 0 && (
        <span
          style={{
            marginLeft: 8,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--cinema-gold)',
            minWidth: 28,
          }}
        >
          {displayValue.toFixed(1)}
        </span>
      )}
    </div>
  );
};
