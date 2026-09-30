import React from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { WatchedButton } from './WatchedButton';
import { Star, Heart, Bookmark, Eye, CheckCircle2 } from 'lucide-react';

interface PosterCardProps {
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  priority?: boolean;
  className?: string;
}

export const PosterCard: React.FC<PosterCardProps> = ({
  movie,
  userData,
  onClick,
  priority = false,
  className = '',
}) => {
  const { openMovieDetail, toggleFavorite } = useCinema();

  const handleClick = () => {
    if (onClick) onClick();
    else openMovieDetail(movie.id);
  };

  const posterUrl = movie.posterPath
    ? tmdbService.getImageUrl(movie.posterPath, 'w342')
    : null;

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const isWatched = userData?.status === 'watched';
  const isWatching = userData?.status === 'watching';
  const isWatchlist = userData?.status === 'want_to_watch';
  const isFavorite = userData?.isFavorite;

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group relative flex flex-col cursor-pointer select-none rounded-2xl overflow-hidden bg-cinema-surface/40 border border-white/5 hover:border-cinema-gold/40 shadow-md hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 ${className}`}
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full bg-cinema-charcoal overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading={priority ? 'eager' : 'lazy'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-cinema-subtle">
            {movie.title}
          </div>
        )}

        {/* Ambient Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

        {/* Status Indicators & Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {isWatched && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cinema-gold text-cinema-black text-[10px] font-bold shadow-gold backdrop-blur-md">
              <CheckCircle2 size={11} strokeWidth={3} />
              <span>Watched</span>
            </span>
          )}
          {isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-cinema-black text-[10px] font-bold shadow-md backdrop-blur-md">
              <Eye size={11} strokeWidth={2.5} />
              <span>Watching</span>
            </span>
          )}
          {isWatchlist && !isWatched && !isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cinema-black/80 border border-white/10 text-cinema-silver text-[10px] font-medium backdrop-blur-md">
              <Bookmark size={10} />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        {/* Quick Favorite Toggle */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await toggleFavorite(movie);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
            isFavorite
              ? 'bg-cinema-crimson/90 text-cinema-white shadow-md'
              : 'bg-cinema-black/60 text-cinema-subtle opacity-0 group-hover:opacity-100 hover:text-cinema-crimson'
          }`}
          title={isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
        >
          <Heart size={13} className={isFavorite ? 'fill-cinema-white' : ''} />
        </button>

        {/* Hover Quick Action Overlay */}
        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <WatchedButton movie={movie} userData={userData} style="icon" />
        </div>

        {/* Poster Bottom Info */}
        <div className="absolute bottom-2 left-2 right-12 z-10 pointer-events-none">
          {movie.voteAverage > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-cinema-gold drop-shadow">
              <Star size={11} className="fill-cinema-gold text-cinema-gold" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Info (Title & Year with Guaranteed Containment) */}
      <div className="p-3 bg-cinema-surface/70 flex-grow flex flex-col justify-between w-full min-w-0">
        <div className="min-h-[2.5rem] flex items-start w-full min-w-0">
          <h4
            className="font-semibold text-xs text-cinema-white line-clamp-2 break-words leading-snug group-hover:text-cinema-gold transition-colors w-full"
            title={movie.title}
          >
            {movie.title}
          </h4>
        </div>
        <div className="flex items-center justify-between text-[11px] text-cinema-subtle mt-1 pt-0.5 border-t border-white/[0.04]">
          <span>{year || '—'}</span>
          {movie.runtime ? <span>{movie.runtime}m</span> : movie.voteAverage > 0 ? <span className="text-cinema-gold">★ {movie.voteAverage.toFixed(1)}</span> : null}
        </div>
      </div>
    </div>
  );
};
