import React, { useState } from 'react';
import { Check, CheckCircle2, Circle } from 'lucide-react';
import { Movie, UserMovie } from '../../types/movie';
import { useCinema } from '../../context/CinemaContext';

interface WatchedButtonProps {
  movie: Movie;
  userData?: UserMovie;
  style?: 'prominent' | 'pill' | 'icon';
}

export const WatchedButton: React.FC<WatchedButtonProps> = ({
  movie,
  userData,
  style = 'prominent',
}) => {
  const { markAsWatched, unmarkWatched } = useCinema();
  const [isPressing, setIsPressing] = useState(false);

  const isWatched = userData?.status === 'watched';

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPressing(true);
    setTimeout(() => setIsPressing(false), 200);

    if (isWatched) {
      await unmarkWatched(movie.id);
    } else {
      await markAsWatched(movie);
    }
  };

  if (style === 'icon') {
    return (
      <button
        onClick={handleToggle}
        title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: isWatched ? '1px solid var(--cinema-gold)' : '1px solid var(--cinema-border)',
          backgroundColor: isWatched ? 'var(--cinema-gold)' : 'rgba(26, 28, 36, 0.8)',
          color: isWatched ? 'var(--cinema-black)' : 'var(--cinema-white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transform: isPressing ? 'scale(0.9)' : 'scale(1)',
          transition: 'all var(--transition-fast)',
          boxShadow: isWatched ? '0 2px 10px var(--cinema-gold-glow)' : 'none',
        }}
      >
        <Check size={16} strokeWidth={isWatched ? 3 : 2} />
      </button>
    );
  }

  if (style === 'pill') {
    return (
      <button
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 'var(--radius-pill)',
          border: isWatched ? '1px solid var(--cinema-gold)' : '1px solid var(--cinema-border)',
          backgroundColor: isWatched ? 'rgba(237, 194, 87, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          color: isWatched ? 'var(--cinema-gold)' : 'var(--cinema-silver)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transform: isPressing ? 'scale(0.96)' : 'scale(1)',
          transition: 'all var(--transition-fast)',
        }}
      >
        {isWatched ? (
          <CheckCircle2 size={14} color="var(--cinema-gold)" />
        ) : (
          <Circle size={14} color="var(--cinema-subtle)" />
        )}
        <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
      </button>
    );
  }

  // Prominent full-width CTA (for Movie Detail)
  return (
    <button
      onClick={handleToggle}
      className={isWatched ? 'btn-secondary' : 'btn-primary'}
      style={{
        width: '100%',
        height: 52,
        fontSize: 15,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transform: isPressing ? 'scale(0.98)' : 'scale(1)',
        backgroundColor: isWatched ? 'rgba(237, 194, 87, 0.12)' : 'var(--cinema-gold)',
        border: isWatched ? '1px solid var(--cinema-gold)' : 'none',
        color: isWatched ? 'var(--cinema-gold)' : 'var(--cinema-black)',
      }}
    >
      <Check size={18} strokeWidth={isWatched ? 3 : 2.5} />
      <span>{isWatched ? '✓ WATCHED (TAP TO UNDO)' : '✓ MARK AS WATCHED'}</span>
    </button>
  );
};
