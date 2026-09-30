import React, { useState } from 'react';
import { Check, CheckCircle2, Circle } from 'lucide-react';
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

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    setIsProcessing(true);
    setIsPressing(true);
    setIsMorphing(true);

    setTimeout(() => setIsPressing(false), 180);
    setTimeout(() => setIsMorphing(false), 650);

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

  if (style === 'icon') {
    return (
      <button
        onClick={handleToggle}
        title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ease-out border ${
          isWatched
            ? 'bg-[#EDC257] text-[#09090D] border-[#EDC257] shadow-[0_2px_12px_rgba(237,194,87,0.4)]'
            : 'bg-[#181A24]/90 text-[#F5F2F0] border-white/10 hover:border-[#EDC257] hover:scale-105'
        } ${isPressing ? 'scale-90' : isMorphing ? 'scale-110' : 'scale-100'} ${className}`}
      >
        <Check
          size={16}
          strokeWidth={isWatched ? 3 : 2}
          className={isMorphing ? 'animate-bounce' : ''}
        />
      </button>
    );
  }

  if (style === 'pill') {
    return (
      <button
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all duration-300 ease-out border backdrop-blur-md ${
          isWatched
            ? 'bg-[#EDC257]/15 text-[#EDC257] border-[#EDC257]/30 shadow-[0_0_12px_rgba(237,194,87,0.2)]'
            : 'bg-white/[0.06] text-[#9E9DA5] border-white/10 hover:text-[#F5F2F0] hover:border-[#EDC257]/40 hover:bg-white/[0.1]'
        } ${isPressing ? 'scale-95' : isMorphing ? 'scale-[1.03]' : 'scale-100'} ${className}`}
      >
        {isWatched ? (
          <CheckCircle2 size={14} className="text-[#EDC257]" />
        ) : (
          <Circle size={14} className="text-[#5C5B64]" />
        )}
        <span>{isWatched ? '✓ Watched' : 'Mark as Watched'}</span>
      </button>
    );
  }

  // Prominent CTA (Movie Detail & Hero)
  return (
    <button
      onClick={handleToggle}
      className={`h-[48px] px-6 rounded-xl font-bold text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 ease-out flex items-center justify-center gap-2 cursor-pointer border ${
        isWatched
          ? 'bg-[rgba(237,194,87,0.12)] text-[#EDC257] border-[#EDC257]/40 shadow-[0_0_20px_rgba(237,194,87,0.2)]'
          : 'bg-gradient-to-r from-[#EDC257] to-[#D99C33] text-[#09090D] border-transparent shadow-[0_4px_24px_rgba(237,194,87,0.35)] hover:shadow-[0_6px_28px_rgba(237,194,87,0.5)]'
      } ${isPressing ? 'scale-[0.97]' : isMorphing ? 'scale-[1.02]' : 'scale-100'} ${className}`}
    >
      <Check
        size={17}
        strokeWidth={3}
        className={isMorphing ? 'animate-cinema-watched' : ''}
      />
      <span>{isWatched ? '✓ Watched' : 'Mark as Watched'}</span>
    </button>
  );
};
