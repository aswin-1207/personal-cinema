import React, { useState } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { WatchedButton } from './WatchedButton';
import { Star, Heart, CheckCircle2, Eye, Bookmark } from 'lucide-react';

interface MoviePosterProps {
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  priority?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
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

  const widthClass = size === 'sm' ? 'w-32 sm:w-36' : size === 'lg' ? 'w-44 sm:w-56' : 'w-36 sm:w-44';

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
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-[14px] overflow-hidden bg-[#171924] border border-white/[0.07] hover:border-[#EDC257]/40 shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85)] hover:scale-[1.04] active:scale-[0.97] transition-all duration-300 ease-out ${widthClass} ${className}`}
    >
      {/* 2:3 Aspect Ratio Container */}
      <div className="relative aspect-[2/3] w-full bg-[#12141D] overflow-hidden">
        
        {/* Shimmer Skeleton Placeholder while loading */}
        {!imageLoaded && posterUrl && (
          <div className="absolute inset-0 cinema-skeleton z-0" />
        )}

        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-[#5C5B64] font-serif">
            {movie.title}
          </div>
        )}

        {/* Ambient Dark Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

        {/* Non-intrusive Status Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {isWatched && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EDC257] text-[#09090D] text-[10px] font-bold shadow-[0_2px_10px_rgba(237,194,87,0.3)] backdrop-blur-md">
              <CheckCircle2 size={11} strokeWidth={2.8} />
              <span>Watched</span>
            </span>
          )}
          {isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-[#09090D] text-[10px] font-bold shadow-md backdrop-blur-md">
              <Eye size={11} strokeWidth={2.5} />
              <span>Watching</span>
            </span>
          )}
          {isWatchlist && !isWatched && !isWatching && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#09090D]/80 border border-white/10 text-[#9E9DA5] text-[10px] font-medium backdrop-blur-md">
              <Bookmark size={10} />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        {/* Quick Favorite Action (Progressive Disclosure) */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await toggleFavorite(movie);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
            isFavorite
              ? 'bg-[#B81C28]/90 text-white shadow-md opacity-100'
              : 'bg-[#09090D]/60 text-[#9E9DA5] opacity-0 group-hover:opacity-100 hover:text-[#B81C28] hover:scale-110'
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
          <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none flex items-center gap-1 text-[11px] font-bold text-[#EDC257] drop-shadow">
            <Star size={11} className="fill-[#EDC257] text-[#EDC257]" />
            <span>{movie.voteAverage.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Card Info (Title & Year) */}
      <div className="p-2.5 bg-[#171924]/90 flex-grow flex flex-col justify-between">
        <h4 className="font-semibold text-xs text-[#F5F2F0] line-clamp-1 group-hover:text-[#EDC257] transition-colors">
          {movie.title}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-[#9E9DA5] mt-0.5">
          <span>{year}</span>
          {movie.runtime && <span>{movie.runtime}m</span>}
        </div>
      </div>
    </div>
  );
};
