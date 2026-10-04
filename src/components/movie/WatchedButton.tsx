import React, { useState } from 'react';
import { Check, Loader2, RotateCw } from 'lucide-react';
import { Movie, UserMovie } from '../../types/movie';
import { useCinema } from '../../context/CinemaContext';
import { soundService } from '../../services/soundService';
import { hapticsService } from '../../services/hapticsService';

interface WatchedButtonProps {
  movie: Movie;
  userData?: UserMovie;
  style?: 'prominent' | 'pill' | 'icon';
  className?: string;
  onChanged?: (watched: boolean) => void;
}

/**
 * Mark as Watched. The confirmation animation only plays after the IndexedDB
 * write resolves; failures show a retry state instead of a fake success.
 */
export const WatchedButton: React.FC<WatchedButtonProps> = ({ movie, userData, style = 'prominent', className = '', onChanged }) => {
  const { markAsWatched, unmarkWatched } = useCinema();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isWatched = userData?.status === 'watched';
  const watchedDate = userData?.watchedAt
    ? new Date(userData.watchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  const title = movie.title || movie.name || 'this title';

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    setHasError(false);
    try {
      if (isWatched) {
        await unmarkWatched(movie.id);
        soundService.playSubtleClick();
        hapticsService.tap();
        onChanged?.(false);
      } else {
        await markAsWatched(movie);
        soundService.playWatchedChime();
        hapticsService.success();
        setIsConfirming(true);
        window.setTimeout(() => setIsConfirming(false), 700);
        onChanged?.(true);
      }
    } catch (err) {
      console.error('Failed to update watched state:', err);
      soundService.playErrorTone();
      hapticsService.error();
      setHasError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const icon = hasError ? (
    <RotateCw size={style === 'icon' ? 15 : 17} aria-hidden="true" />
  ) : isProcessing ? (
    <Loader2 size={style === 'icon' ? 15 : 17} className="animate-spin" aria-hidden="true" />
  ) : (
    <Check
      size={style === 'icon' ? 16 : 18}
      strokeWidth={3}
      className={isConfirming ? 'animate-check-draw' : ''}
      aria-hidden="true"
    />
  );

  if (style === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        aria-pressed={isWatched}
        aria-label={hasError ? `Retry marking ${title} as watched` : isWatched ? `Unmark ${title} as watched` : `Mark ${title} as watched`}
        title={hasError ? "Couldn't save — tap to retry" : isWatched ? 'Watched — tap to unmark' : 'Mark as watched'}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-200 before:absolute before:-inset-1 before:content-[''] ${
          hasError
            ? 'bg-danger/20 text-[#F0848A] border-danger/60'
            : isWatched
            ? 'bg-gold text-ink border-gold'
            : 'bg-ink/75 text-text border-white/20 hover:border-gold hover:text-gold'
        } ${isConfirming ? 'animate-watched-morph' : ''} ${className}`}
      >
        {icon}
      </button>
    );
  }

  const label = hasError
    ? "Couldn't save · Retry"
    : isProcessing
    ? 'Saving…'
    : isWatched
    ? watchedDate
      ? `Watched · ${watchedDate}`
      : 'Watched'
    : 'Mark as Watched';

  const sizing = style === 'pill' ? 'min-h-10 px-4 text-[13px]' : 'min-h-12 px-6 text-[14px]';
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isProcessing}
      aria-pressed={isWatched}
      title={isWatched ? 'Tap to unmark as watched' : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold uppercase tracking-[0.06em] whitespace-nowrap border transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] ${sizing} ${
        hasError
          ? 'bg-danger/15 text-[#F0848A] border-danger/50'
          : isWatched
          ? 'bg-gold/12 text-gold border-gold/50 hover:bg-gold/20'
          : 'bg-gold text-ink border-gold hover:bg-gold-strong shadow-[0_6px_20px_rgba(224,173,82,0.25)]'
      } ${isConfirming ? 'animate-watched-morph' : ''} ${className}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
};
