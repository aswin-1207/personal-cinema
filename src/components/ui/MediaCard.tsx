import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Movie, UserMovie, getMediaYear } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import { WatchedButton } from '../movie/WatchedButton';
import { StatusBadge } from './StatusBadge';

export const isSeries = (m: Partial<Movie>) => m.mediaType === 'tv' || Boolean(m.firstAirDate) || Boolean(m.numberOfSeasons);
export const mediaTypeLabel = (m: Partial<Movie>) => (isSeries(m) ? 'Series' : 'Movie');

const FALLBACK_ACCENTS = ['text-gold', 'text-purple', 'text-green'];

/** Figma missing-artwork treatment: dark card with the title in an accent colour. */
export const PosterFallback: React.FC<{ movie: Movie; compact?: boolean }> = ({ movie, compact }) => (
  <div className="absolute inset-0 bg-gradient-to-br from-surface-2 to-ink-2 flex flex-col justify-end p-2.5">
    <span
      className={`font-bold uppercase leading-tight line-clamp-3 break-words ${compact ? 'text-[10px]' : 'text-[12px]'} ${
        FALLBACK_ACCENTS[Math.abs(movie.id) % FALLBACK_ACCENTS.length]
      }`}
    >
      {movie.title || movie.name}
    </span>
    <span className="text-[9px] font-semibold uppercase tracking-wider text-subtle mt-0.5">{mediaTypeLabel(movie)}</span>
  </div>
);

export const PosterImage: React.FC<{
  movie: Movie;
  size?: 'w185' | 'w342' | 'w500';
  priority?: boolean;
  className?: string;
  compact?: boolean;
}> = ({ movie, size = 'w342', priority, className = '', compact }) => {
  const url = tmdbService.getPosterUrl(movie.posterPath, size);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(url ? 'loading' : 'error');
  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-surface ${className}`}>
      {url && state !== 'error' && (
        <>
          {state === 'loading' && <div className="absolute inset-0 cinema-skeleton" aria-hidden="true" />}
          <img
            src={url}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setState('loaded')}
            onError={() => setState('error')}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
      {(!url || state === 'error') && <PosterFallback movie={movie} compact={compact} />}
    </div>
  );
};

export interface MediaCardProps {
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  priority?: boolean;
  className?: string;
  /** Replaces the default "year · type · rating" line. */
  meta?: React.ReactNode;
  showQuickWatch?: boolean;
  /** Extra controls rendered under the card (e.g. reorder buttons). */
  footer?: React.ReactNode;
}

/**
 * The single poster card used across Home, Discover, status pages and collections.
 * The whole card opens the detail page; a visible (not hover-only) quick
 * Mark-as-Watched button sits on the poster for unwatched titles.
 */
export const MediaCard: React.FC<MediaCardProps> = React.memo(
  ({ movie, userData, onClick, priority, className = '', meta, showQuickWatch = true, footer }) => {
    const { openMovieDetail } = useCinema();
    const title = movie.title || movie.name || 'Untitled';
    const year = getMediaYear(movie);
    const type = mediaTypeLabel(movie);
    const status = userData?.status;
    const isWatched = status === 'watched';

    return (
      <div className={`group relative min-w-0 ${className}`}>
        <div className="relative rounded-xl overflow-hidden border border-line bg-surface transition-[border-color,transform] duration-200 group-hover:border-line-strong md:group-hover:-translate-y-0.5">
          <PosterImage movie={movie} priority={priority} />
          {(status && status !== 'none') || userData?.isFavorite ? (
            <div className="absolute top-1.5 left-1.5 pointer-events-none">
              <StatusBadge status={status} favorite={userData?.isFavorite} compact />
            </div>
          ) : null}
          {showQuickWatch && !isWatched && (
            <div className="absolute bottom-1.5 right-1.5 z-10">
              <WatchedButton movie={movie} userData={userData} style="icon" />
            </div>
          )}
        </div>
        <h3 className="mt-2 px-0.5 text-[13px] font-semibold leading-[1.3] text-text line-clamp-2 min-h-[2.6em] break-words">
          <button
            type="button"
            onClick={onClick ?? (() => openMovieDetail(movie.id))}
            className="text-left after:absolute after:inset-0 after:content-[''] after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-gold"
            aria-label={`${title}${year ? `, ${year}` : ''}, ${type}${status && status !== 'none' ? `, ${status === 'want_to_watch' ? 'in watchlist' : status}` : ''}`}
          >
            {title}
          </button>
        </h3>
        <p className="mt-0.5 px-0.5 text-[11.5px] text-muted truncate flex items-center gap-1">
          {meta ?? (
            <>
              <span>{[year, type].filter(Boolean).join(' · ')}</span>
              {movie.voteAverage > 0 && (
                <span className="inline-flex items-center gap-0.5 text-gold ml-auto shrink-0">
                  <Star size={10} className="fill-current" aria-hidden="true" />
                  <span className="sr-only">TMDB rating</span>
                  {movie.voteAverage.toFixed(1)}
                </span>
              )}
            </>
          )}
        </p>
        {footer && <div className="relative z-10 mt-1.5">{footer}</div>}
      </div>
    );
  }
);
MediaCard.displayName = 'MediaCard';

/** Compact row used in search results and pickers. */
export const MediaListRow: React.FC<{
  movie: Movie;
  userData?: UserMovie;
  onClick?: () => void;
  trailing?: React.ReactNode;
}> = ({ movie, userData, onClick, trailing }) => {
  const { openMovieDetail } = useCinema();
  const title = movie.title || movie.name || 'Untitled';
  const year = getMediaYear(movie);
  const genres = (movie.genres || []).slice(0, 2).map((g) => g.name).join(' · ');
  return (
    <div className="relative flex items-center gap-3 p-2 rounded-2xl bg-surface border border-line hover:border-line-strong transition-colors">
      <PosterImage movie={movie} size="w185" className="w-14 sm:w-16 shrink-0 rounded-lg" compact />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onClick ?? (() => openMovieDetail(movie.id))}
          className="text-left text-[14px] font-semibold text-text line-clamp-2 after:absolute after:inset-0 after:content-[''] after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-gold"
        >
          {title}
        </button>
        <p className="text-[12px] text-muted truncate">
          {[year, mediaTypeLabel(movie)].filter(Boolean).join(' · ')}
          {movie.voteAverage > 0 && <span className="text-gold"> · ★ {movie.voteAverage.toFixed(1)}</span>}
        </p>
        {genres && <p className="text-[11px] text-subtle truncate">{genres}</p>}
        {userData?.status && userData.status !== 'none' && (
          <div className="mt-1">
            <StatusBadge status={userData.status} />
          </div>
        )}
      </div>
      {trailing && <div className="relative z-10 shrink-0">{trailing}</div>}
    </div>
  );
};
