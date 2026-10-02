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

interface MovieCardTitleProps {
  title: string;
  isCardHovered: boolean;
  reducedMotion: boolean;
}

export const MovieCardTitle: React.FC<MovieCardTitleProps> = ({
  title,
  isCardHovered,
  reducedMotion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const scrollW = textRef.current.scrollWidth;
    const clientW = containerRef.current.clientWidth;
    if (scrollW > clientW + 2) {
      setOverflowDistance(scrollW - clientW);
    } else {
      setOverflowDistance(0);
    }
  }, [title]);

  const shouldSlide = isCardHovered && overflowDistance > 0 && !reducedMotion;
  const slideDuration = Math.max(2, Math.min(5, overflowDistance / 28));

  return (
    <div
      ref={containerRef}
      className="min-h-[2.35rem] h-[2.35rem] max-h-[2.35rem] overflow-hidden w-full min-w-0 relative flex items-start"
      title={title}
      aria-label={title}
    >
      <h4
        ref={textRef}
        className={`font-semibold text-xs text-[#F5F3EB] group-hover:text-[#E0AD52] transition-colors leading-tight ${
          overflowDistance > 0 ? 'whitespace-nowrap inline-block' : 'line-clamp-2 break-words w-full'
        }`}
        style={
          shouldSlide
            ? {
                transform: `translateX(-${overflowDistance}px)`,
                transition: `transform ${slideDuration}s cubic-bezier(0.25, 1, 0.5, 1) 0.35s`,
              }
            : overflowDistance > 0
            ? {
                transform: 'translateX(0px)',
                transition: 'transform 0.4s ease-out',
              }
            : undefined
        }
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
  const { openMovieDetail, toggleFavorite, preferences } = useCinema();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
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
    ? 'w-32 sm:w-36'
    : size === 'lg'
    ? 'w-44 sm:w-56'
    : 'w-36 sm:w-44';
  const shrinkClass = className.includes('w-full') ? 'w-full' : 'flex-shrink-0';

  const isReducedMotion = Boolean(
    preferences?.motionReduced ||
      preferences?.reducedMotion ||
      (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setTimeout(() => setIsHovered(false), 2500)}
      className={`group relative cursor-pointer select-none rounded-2xl overflow-hidden bg-[#131319] transition-all duration-300 ease-out min-w-0 ${
        isWatched
          ? 'border border-[#E0AD52]/40 shadow-[0_4px_24px_rgba(224,173,82,0.18)] hover:border-[#E0AD52]'
          : 'border border-white/[0.07] hover:border-[#E0AD52]/50 shadow-[0_6px_20px_rgba(0,0,0,0.55)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
      } hover:scale-[1.025] active:scale-[0.98] ${shrinkClass} ${widthClass} ${className}`}
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
            className={`w-full h-full object-cover transition-all duration-400 group-hover:scale-105 ${
              isWatched ? 'brightness-95 contrast-105 group-hover:brightness-105' : 'group-hover:brightness-105'
            } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-transparent to-transparent opacity-65 group-hover:opacity-90 transition-opacity duration-300 pointer-events-none" />

        {/* Discreet Corner Status Indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1 z-10 pointer-events-none">
          {isWatched && (
            <span className="w-5 h-5 rounded-full bg-[#E0AD52] text-[#09090B] flex items-center justify-center shadow-[0_2px_10px_rgba(224,173,82,0.4)] backdrop-blur-md">
              <CheckCircle2 size={12} strokeWidth={3} />
            </span>
          )}
          {isWatching && !isWatched && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D19830] text-[#09090B] text-[10px] font-black shadow-md backdrop-blur-md">
              <Eye size={11} strokeWidth={2.5} />
              <span>Watching</span>
            </span>
          )}
          {isWatchlist && !isWatched && !isWatching && (
            <span className="w-5 h-5 rounded-full bg-white/15 text-[#E0AD52] flex items-center justify-center backdrop-blur-md">
              <Bookmark size={11} className="fill-[#E0AD52]" />
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
              ? 'bg-[#B3262E]/90 text-white shadow-md opacity-100'
              : 'bg-[#09090B]/60 text-[#9E9DA5] opacity-0 group-hover:opacity-100 hover:text-[#B3262E] hover:scale-110'
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

      {/* Card Info Container with Controlled Title Region */}
      <div className="p-2.5 sm:p-3 bg-[#131319] flex-grow flex flex-col justify-between w-full min-w-0">
        <MovieCardTitle
          title={movie.title}
          isCardHovered={isHovered}
          reducedMotion={isReducedMotion}
        />
        <div className="flex items-center justify-between text-[11px] text-[#9E9DA5] mt-1 pt-0.5 border-t border-white/[0.04]">
          {isWatched ? (
            <span className="text-[#E0AD52] font-semibold flex items-center gap-1 text-[10px] tracking-wide">
              <span>✓ WATCHED</span>
              {watchedDateStr ? <span>· {watchedDateStr}</span> : null}
            </span>
          ) : (
            <span>{year || '—'}</span>
          )}
          {movie.voteAverage > 0 && !isWatched && (
            <span className="text-[#E0AD52] font-semibold">★ {movie.voteAverage.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
