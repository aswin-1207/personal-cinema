import React from 'react';
import { CinemaNextMovieResult } from '../../services/cinemaIslandResolver';
import { tmdbService } from '../../services/tmdbService';
import { Film, ChevronDown } from 'lucide-react';

interface CinemaIslandCollapsedProps {
  data: CinemaNextMovieResult;
  onClick: () => void;
  className?: string;
}

export const CinemaIslandCollapsed: React.FC<CinemaIslandCollapsedProps> = ({
  data,
  onClick,
  className = '',
}) => {
  const isMovie = data.type === 'movie' && data.movie;
  const posterUrl = isMovie && data.movie?.posterPath
    ? tmdbService.getImageUrl(data.movie.posterPath, 'w92')
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        isMovie
          ? `Cinema Island: Next movie is ${data.movie?.title}. Tap to expand.`
          : 'Cinema Island: Build your cinema. Tap to discover movies.'
      }
      aria-expanded="false"
      className={`group relative flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-cinema-black/90 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl hover:border-cinema-gold/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ${className}`}
    >
      {/* Ambient subtle glow when hovering */}
      <div className="absolute inset-0 rounded-full bg-cinema-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Tiny Poster Thumbnail or Film Icon */}
      <div className="w-5 h-7 rounded-[4px] overflow-hidden bg-cinema-charcoal flex-shrink-0 flex items-center justify-center border border-white/15 shadow-sm">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <Film size={12} className="text-cinema-gold" />
        )}
      </div>

      {/* Content Label */}
      <div className="flex items-center gap-1.5 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cinema-white/90 group-hover:text-cinema-gold transition-colors">
          {data.contextTag || 'NEXT FOR YOU'}
        </span>
        {isMovie && (
          <span className="text-[10px] text-cinema-subtle hidden sm:inline-block max-w-[130px] truncate">
            · {data.movie?.title}
          </span>
        )}
      </div>

      {/* Subtle Expansion Indicator */}
      <ChevronDown
        size={13}
        className="text-cinema-subtle group-hover:text-cinema-gold transition-transform duration-300 group-hover:translate-y-0.5"
      />
    </button>
  );
};
