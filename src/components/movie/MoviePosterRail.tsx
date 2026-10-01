import React from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { MoviePoster } from './MoviePoster';
import { ChevronRight } from 'lucide-react';

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
  if (items.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return null; // As mandated by Section 41: "Do not blindly render empty rails. If a rail has no meaningful content, hide it."
  }

  return (
    <section className="space-y-3.5 relative">
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

      {/* Horizontal Scrolling Poster Track with Edge Fade */}
      <div className="relative rail-edge-fade">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:-mx-8 sm:px-8 scroll-smooth">
          {items.map((item) => (
            <MoviePoster
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              onClick={onMovieClick ? () => onMovieClick(item.movie) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
