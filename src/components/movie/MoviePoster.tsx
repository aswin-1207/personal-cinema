import React, { useState, useRef, useEffect } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { WatchedButton } from './WatchedButton';
import { Star, Heart, CheckCircle2, Eye, Bookmark, Film } from 'lucide-react';

export interface MoviePosterProps {
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  priority?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'compact';
  aspect?: 'portrait' | 'compact';
}

export const MoviePoster: React.FC<MoviePosterProps> = ({
  movie,
  userData,
  onClick,
  priority = false,
  className = '',
  size = 'md',
}) => {
  const { openMovieDetail, toggleFavorite } = useCinema();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = () => {
    if (onClick) onClick();
    else openMovieDetail(movie.id);
  };

  const tmdbSize = size === 'sm' ? 'w185' : size === 'lg' ? 'w500' : 'w342';
  const posterUrl = tmdbService.getPosterUrl(movie.posterPath, tmdbSize);

  useEffect(() => {
    setImageError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, [posterUrl]);

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const isWatched = userData?.status === 'watched';
  const isWatching = userData?.status === 'watching';
  const isWatchlist = userData?.status === 'want_to_watch';
  const isFavorite = userData?.isFavorite;

  const hasExplicitWidth = className.includes('w-');
  const widthClass = hasExplicitWidth
    ? ''
    : size === 'sm'
    ? 'w-32 sm:w-36'
    : size === 'lg'
    ? 'w-44 sm:w-56'
    : 'w-36 sm:w-44';
  const shrinkClass = className.includes('w-full') ? 'w-full' : 'flex-shrink-0';

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
      className={`group relative cursor-pointer select-none rounded-2xl overflow-hidden bg-[#131319] border border-white/[0.07] hover:border-[#E0AD52]/40 shadow-[0_6px_20px_rgba(0,0,0,0.55)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85)] hover:scale-[1.025] active:scale-[0.98] transition-all duration-300 ease-out min-w-0 ${shrinkClass} ${widthClass} ${className}`}
    >
      {/* 2:3 Aspect Ratio Container */}
      <div className="relative aspect-[2/3] w-full bg-[#0F0F14] overflow-hidden">
        {/* Shimmer Skeleton Placeholder */}
        {!imageLoaded && !imageError && posterUrl && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#131319] via-white/5 to-[#131319] animate-pulse z-0" />
        )}

        {posterUrl && !imageError ? (
          <img
            ref={imgRef}
            src={posterUrl}
            alt={movie.title}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-all duration-400 group-hover:scale-105 group-hover:brightness-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1A1D2C] to-[#0F111A]">
            <Film size={26} className="text-[#E0AD52]/60 mb-2" />
            <span className="text-xs text-[#F5F3EB] font-serif font-bold line-clamp-2 px-1">
              {movie.title}
            </span>
            {year && <span className="text-[10px] text-[#9E9DA5] mt-1">{year}</span>}
          </div>
        )}

        {/* Ambient Dark Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300 pointer-events-none" />

        {/* Status Indicators & Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {isWatched && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E0AD52] text-[#09090B] text-[10px] font-black shadow-[0_2px_10px_rgba(224,173,82,0.35)] backdrop-blur-md">
              <CheckCircle2 size={11} strokeWidth={2.8} />
              <span>Watched</span>
            </span>
          )}
          {isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D19830] text-[#09090B] text-[10px] font-black shadow-md backdrop-blur-md">
              <Eye size={11} strokeWidth={2.5} />
              <span>Watching</span>
            </span>
          )}
          {isWatchlist && !isWatched && !isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#09090B]/85 border border-white/10 text-[#9E9DA5] text-[10px] font-medium backdrop-blur-md">
              <Bookmark size={10} />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        {/* Quick Favorite Action */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await toggleFavorite(movie);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 border-none cursor-pointer ${
            isFavorite
              ? 'bg-[#B81C28]/90 text-white shadow-md opacity-100'
              : 'bg-[#09090B]/60 text-[#9E9DA5] opacity-0 group-hover:opacity-100 hover:text-[#B81C28] hover:scale-110'
          }`}
          title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
        >
          <Heart size={13} className={isFavorite ? 'fill-white' : ''} />
        </button>

        {/* Quick Mark As Watched Action on Hover */}
        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <WatchedButton movie={movie} userData={userData} style="icon" />
        </div>

        {/* Poster Star Rating */}
        {movie.voteAverage > 0 && (
          <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none flex items-center gap-1 text-[11px] font-bold text-[#E0AD52] drop-shadow">
            <Star size={11} className="fill-[#E0AD52] text-[#E0AD52]" />
            <span>{movie.voteAverage.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Card Info Container with Strict Containment */}
      <div className="p-2.5 sm:p-3 bg-[#131319] flex-grow flex flex-col justify-between w-full min-w-0">
        <div className="min-h-[2.35rem] flex items-start w-full min-w-0">
          <h4
            className="font-semibold text-xs text-[#F5F3EB] line-clamp-2 break-words leading-tight group-hover:text-[#E0AD52] transition-colors w-full"
            title={movie.title}
          >
            {movie.title}
          </h4>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#9E9DA5] mt-1 pt-0.5 border-t border-white/[0.04]">
          <span>{year || '—'}</span>
          {movie.runtime ? (
            <span>{movie.runtime}m</span>
          ) : movie.voteAverage > 0 ? (
            <span className="text-[#E0AD52] font-semibold">★ {movie.voteAverage.toFixed(1)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
