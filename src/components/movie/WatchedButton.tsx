import React, { useState } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { useCinema } from '../../context/CinemaContext';
import { soundService } from '../../services/soundService';
import { hapticsService } from '../../services/hapticsService';

interface WatchedButtonProps {
  movie: Movie;
  userData?: UserMovie;
  style?: 'prominent' | 'pill' | 'icon';
  className?: string;
}

export const WatchedButton: React.FC<WatchedButtonProps> = ({
  movie,
  userData,
  style = 'prominent',
  className = '',
}) => {
  const { markAsWatched, unmarkWatched } = useCinema();
  const [isPressing, setIsPressing] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isWatched = userData?.status === 'watched';
  const watchedDate = userData?.watchedAt
    ? new Date(userData.watchedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    setIsProcessing(true);
    setIsPressing(true);
    setIsMorphing(true);

    setTimeout(() => setIsPressing(false), 160);
    // 750ms signature sequence (600-900ms requirement in Section 12)
    setTimeout(() => setIsMorphing(false), 750);

    try {
      if (isWatched) {
        soundService.playSubtleClick();
        hapticsService.tap();
        await unmarkWatched(movie.id);
      } else {
        soundService.playWatchedChime();
        hapticsService.success();
        await markAsWatched(movie);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Icon Style (for cards, lists, rails)
  if (style === 'icon') {
    return (
      <button
        onClick={handleToggle}
        disabled={isProcessing}
        title={isWatched ? `Watched ${watchedDate ? `(${watchedDate})` : ''} — Click to unmark` : 'Mark as Watched'}
        aria-label={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
        aria-pressed={isWatched}
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ease-out border ${
          isProcessing
            ? 'bg-[#E0AD52]/20 text-[#E0AD52] border-[#E0AD52] animate-pulse'
            : isWatched
            ? 'bg-[#E0AD52]/20 text-[#E0AD52] border-[#E0AD52]/60 shadow-[0_0_14px_rgba(224,173,82,0.35)]'
            : 'bg-[#131319]/90 text-[#F5F3EB] border-white/10 hover:border-[#E0AD52] hover:scale-105'
        } ${isPressing ? 'scale-[0.97]' : isMorphing ? 'animate-watched-morph' : 'scale-100'} ${className}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={isWatched ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isMorphing ? 'animate-check-draw' : ''}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    );
  }

  // 2. Pill Style (for headers, chips, modal bars)
  if (style === 'pill') {
    return (
      <button
        onClick={handleToggle}
        disabled={isProcessing}
        title={isWatched ? `Watched on ${watchedDate || 'archive'} — Click to undo` : 'Mark as Watched'}
        aria-pressed={isWatched}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-300 ease-out border backdrop-blur-md ${
          isProcessing
            ? 'bg-[#E0AD52]/15 text-[#E0AD52] border-[#E0AD52] animate-pulse'
            : isWatched
            ? 'bg-[#E0AD52]/15 text-[#E0AD52] border-[#E0AD52]/50 shadow-[0_0_16px_rgba(224,173,82,0.25)]'
            : 'bg-white/[0.06] text-[#9E9DA5] border-white/10 hover:text-[#F5F3EB] hover:border-[#E0AD52]/40 hover:bg-white/[0.1]'
        } ${isPressing ? 'scale-[0.97]' : isMorphing ? 'animate-watched-morph' : 'scale-100'} ${className}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isMorphing ? 'animate-check-draw text-[#E0AD52]' : isWatched ? 'text-[#E0AD52]' : 'text-[#9E9DA5]'}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>
          {isProcessing
            ? 'RECORDING...'
            : isWatched
            ? watchedDate
              ? `✓ WATCHED · ${watchedDate}`
              : '✓ WATCHED'
            : 'MARK AS WATCHED'}
        </span>
      </button>
    );
  }

  // 3. Prominent CTA (Movie Detail & Hero primary action)
  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      aria-pressed={isWatched}
      title={isWatched ? `Watched on ${watchedDate || 'vault'} — Click to unmark` : 'Mark as Watched'}
      className={`h-[48px] px-6 rounded-2xl font-bold text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 ease-out flex items-center justify-center gap-2.5 cursor-pointer border ${
        isProcessing
          ? 'bg-[#131319] text-[#E0AD52] border-[#E0AD52] shadow-[0_0_20px_rgba(224,173,82,0.35)] animate-pulse'
          : isWatched
          ? 'bg-[#E0AD52]/15 text-[#E0AD52] border-[#E0AD52]/60 shadow-[0_0_24px_rgba(224,173,82,0.35)] hover:bg-[#E0AD52]/25'
          : 'bg-[#E0AD52] hover:bg-[#D49B35] text-[#09090B] border-transparent shadow-[0_4px_24px_rgba(224,173,82,0.35)] hover:shadow-[0_6px_28px_rgba(224,173,82,0.5)] active:scale-[0.97]'
      } ${isPressing ? 'scale-[0.97]' : isMorphing ? 'animate-watched-morph' : 'scale-100'} ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isMorphing ? 'animate-check-draw text-[#E0AD52]' : ''}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="truncate">
        {isProcessing
          ? 'RECORDING...'
          : isWatched
          ? watchedDate
            ? `✓ WATCHED · ${watchedDate}`
            : '✓ WATCHED'
          : 'MARK AS WATCHED'}
      </span>
    </button>
  );
};
