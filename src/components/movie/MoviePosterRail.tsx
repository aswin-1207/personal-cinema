import React, { useRef } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { MoviePoster } from './MoviePoster';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface MoviePosterRailProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actionLabel?: string;
  onAction?: () => void;
  items: Array<{ movie: Movie; userData?: UserMovie }>;
  onMovieClick?: (movie: Movie) => void;
  emptyState?: React.ReactNode;
}

export const MoviePosterRail: React.FC<MoviePosterRailProps> = ({
  title,
  subtitle,
  badge,
  actionLabel,
  onAction,
  items,
  onMovieClick,
  emptyState,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -560 : 560;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-3.5 relative group/rail">
      {/* Section Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-section-title text-[#F5F3EB]">
              {title}
            </h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/20 uppercase tracking-wider">
                {badge}
              </span>
            )}
            <span className="text-xs text-[#63626B] font-mono">
              ({items.length})
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#9E9DA5] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="cinema-button-ghost text-xs font-semibold flex items-center gap-1 text-[#E0AD52] hover:text-[#D49B35] p-0 cursor-pointer"
          >
            <span>{actionLabel}</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Horizontal Scrolling Poster Track with Edge Fade & Desktop Controls */}
      <div className="relative rail-edge-fade">
        {/* Left Arrow (Desktop) */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#09090B]/90 hover:bg-[#E0AD52] hover:text-[#09090B] text-[#F5F3EB] border border-white/10 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-all duration-300 shadow-xl cursor-pointer -ml-3"
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Poster Track */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain no-scrollbar pb-2.5 pt-1 -mx-3.5 px-3.5 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 scroll-smooth touch-pan-y"
        >
          {items.map((item) => (
            <MoviePoster
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              onClick={onMovieClick ? () => onMovieClick(item.movie) : undefined}
            />
          ))}
        </div>

        {/* Right Arrow (Desktop) */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#09090B]/90 hover:bg-[#E0AD52] hover:text-[#09090B] text-[#F5F3EB] border border-white/10 items-center justify-center opacity-0 group-hover/rail:opacity-100 transition-all duration-300 shadow-xl cursor-pointer -mr-3"
          aria-label="Scroll right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
};
