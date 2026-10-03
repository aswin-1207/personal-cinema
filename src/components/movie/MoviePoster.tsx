import React, { useState, useRef, useEffect } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { WatchedButton } from './WatchedButton';
import { soundService } from '../../services/soundService';
import { hapticsService } from '../../services/hapticsService';
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

interface MovieCardTitleProps {
  title: string;
}

export const MovieCardTitle: React.FC<MovieCardTitleProps> = ({ title }) => {
  return (
    <div
      className="h-[2.5rem] min-h-[2.5rem] max-h-[2.5rem] w-full min-w-0 overflow-hidden flex items-start"
      title={title}
      aria-label={title}
    >
      <h4
        className="font-medium sm:font-semibold text-[13px] sm:text-[14px] text-[#F5F3EB] group-hover:text-[#E0AD52] transition-colors leading-[1.25rem] line-clamp-2 break-words w-full overflow-hidden text-ellipsis"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {title}
      </h4>
    </div>
  );
};

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

  const watchedDateStr = userData?.watchedAt
    ? new Date(userData.watchedAt)
        .toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
        .toUpperCase()
    : null;

  const hasExplicitWidth = className.includes('w-');
  const widthClass = hasExplicitWidth
    ? ''
    : size === 'sm'
    ? 'w-[120px] sm:w-[140px]'
    : size === 'lg'
    ? 'w-[170px] sm:w-[210px]'
    : 'w-[140px] xs:w-[155px] sm:w-[170px] md:w-[185px]';
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
      className={`group relative cursor-pointer rounded-2xl overflow-hidden bg-[#131319] cinema-card-tactile min-w-0 ${
        isWatched
          ? 'border border-[#E0AD52]/40 shadow-[0_4px_24px_rgba(224,173,82,0.18)] hover:border-[#E0AD52]'
          : 'border border-white/[0.07] hover:border-[#E0AD52]/50 shadow-[0_6px_20px_rgba(0,0,0,0.55)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
      } ${shrinkClass} ${widthClass} ${className}`}
    >
      {/* 2:3 Aspect Ratio Container */}
      <div className="relative aspect-[2/3] w-full bg-[#0F0F14] overflow-hidden">
        {/* Shimmer Skeleton Placeholder */}
        {!imageLoaded && !imageError && posterUrl && (
          <div className="absolute inset-0 cinema-skeleton z-0" />
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
            className={`w-full h-full object-cover transition-all duration-400 group-hover:scale-105 ${
              isWatched ? 'brightness-95 contrast-105 group-hover:brightness-105' : 'group-hover:brightness-105'
            } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1A1D2C] to-[#0F111A]">
            <Film size={26} className="text-[#E0AD52]/60 mb-2" />
            <span className="text-xs text-[#F5F3EB] font-semibold line-clamp-2 px-1">
              {movie.title}
            </span>
            {year && <span className="text-[10px] text-[#9E9DA5] mt-1">{year}</span>}
          </div>
        )}

        {/* Ambient Dark Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-transparent to-transparent opacity-65 group-hover:opacity-90 transition-opacity duration-300 pointer-events-none" />

        {/* Discreet Corner Status Indicator & Series Tag */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
          {isWatched && (
            <span className="w-5 h-5 rounded-full bg-[#E0AD52] text-[#09090B] flex items-center justify-center shadow-[0_2px_10px_rgba(224,173,82,0.4)] backdrop-blur-md">
              <CheckCircle2 size={12} strokeWidth={3} />
            </span>
          )}
          {isWatching && !isWatched && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D19830] text-[#09090B] text-[10px] font-bold shadow-md backdrop-blur-md">
              <Eye size={11} strokeWidth={2.5} />
              <span>Watching</span>
            </span>
          )}
          {isWatchlist && !isWatched && !isWatching && (
            <span className="w-5 h-5 rounded-full bg-white/15 text-[#E0AD52] flex items-center justify-center backdrop-blur-md">
              <Bookmark size={11} className="fill-[#E0AD52]" />
            </span>
          )}
          {(movie.mediaType === 'tv' || Boolean(movie.firstAirDate) || Boolean(movie.numberOfSeasons)) && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#09090B]/85 text-[#E0AD52] border border-[#E0AD52]/40 uppercase tracking-wider backdrop-blur-md shadow-sm">
              TV
            </span>
          )}
        </div>

        {/* Quick Favorite Action */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            soundService.playFavoritePop();
            hapticsService.confirm();
            await toggleFavorite(movie);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 border-none cursor-pointer ${
            isFavorite
              ? 'bg-[#B3262E]/90 text-white shadow-md opacity-100'
              : 'bg-[#09090B]/60 text-[#9E9DA5] opacity-0 group-hover:opacity-100 hover:text-[#B3262E] hover:scale-110'
          }`}
          title={isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={13} className={isFavorite ? 'fill-white' : ''} />
        </button>

        {/* Quick Mark As Watched Action on Hover */}
        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <WatchedButton movie={movie} userData={userData} style="icon" />
        </div>

        {/* Poster Star Rating */}
      </div>

      {/* Card Info Container with Controlled Title Region */}
      <div className="p-2.5 sm:p-3 bg-[#131319] flex-grow flex flex-col justify-between w-full min-w-0 overflow-hidden">
        <MovieCardTitle title={movie.title} />
        <div className="h-5 flex items-center justify-between text-[11px] text-[#9E9DA5] mt-1 pt-1 border-t border-white/[0.04] w-full min-w-0 overflow-hidden">
          {isWatched ? (
            <span className="text-[#E0AD52] font-medium flex items-center gap-1 text-[11px] tracking-wide truncate">
              <span>✓ Watched</span>
              {watchedDateStr ? <span className="hidden xs:inline">· {watchedDateStr}</span> : null}
            </span>
          ) : (
            <span className="truncate">
              {year || '—'}
              {movie.mediaType === 'tv' || Boolean(movie.firstAirDate) || Boolean(movie.numberOfSeasons)
                ? movie.numberOfSeasons
                  ? ` · ${movie.numberOfSeasons}S`
                  : ' · Series'
                : movie.runtime
                ? ` · ${movie.runtime}m`
                : ''}
            </span>
          )}
          {movie.voteAverage > 0 && !isWatched && (
            <span className="text-[#E0AD52] font-medium flex-shrink-0 ml-1.5 flex items-center gap-0.5">
              <Star size={10} className="fill-[#E0AD52] text-[#E0AD52]" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
