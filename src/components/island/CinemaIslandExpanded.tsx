import React from 'react';
import { CinemaNextMovieResult } from '../../services/cinemaIslandResolver';
import { tmdbService } from '../../services/tmdbService';
import { Play, Sparkles, X, Compass, Layers, Star } from 'lucide-react';

interface CinemaIslandExpandedProps {
  data: CinemaNextMovieResult;
  onWatchNow: () => void;
  onDiscover: () => void;
  onClose: () => void;
  className?: string;
}

export const CinemaIslandExpanded: React.FC<CinemaIslandExpandedProps> = ({
  data,
  onWatchNow,
  onDiscover,
  onClose,
  className = '',
}) => {
  const isMovie = data.type === 'movie' && data.movie;
  const movie = data.movie;

  const posterUrl = movie?.posterPath
    ? tmdbService.getImageUrl(movie.posterPath, 'w342')
    : null;

  const year = movie?.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const runtime = movie?.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';

  return (
    <div
      role="dialog"
      aria-label="Cinema Island: Recommended Next Movie"
      aria-modal="false"
      className={`relative w-[calc(100vw-32px)] max-w-md bg-cinema-black/95 border border-cinema-gold/30 rounded-3xl p-5 shadow-[0_16px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden animate-scale-in transition-all ${className}`}
    >
      {/* Ambient background glow derived from theme */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-cinema-gold/10 rounded-full blur-3xl pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Collapse Cinema Island"
        className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-cinema-subtle hover:text-cinema-white hover:bg-white/5 transition-colors"
      >
        <X size={16} />
      </button>

      {isMovie && movie ? (
        <div className="flex gap-4 items-start">
          {/* Hero Poster */}
          <div
            onClick={onWatchNow}
            className="w-24 sm:w-28 aspect-[2/3] rounded-2xl overflow-hidden bg-cinema-charcoal shadow-2xl border border-white/10 flex-shrink-0 cursor-pointer group hover:scale-[1.03] transition-transform"
          >
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-cinema-subtle">
                No Poster
              </div>
            )}
          </div>

          {/* Details & Action */}
          <div className="flex-1 flex flex-col justify-between min-w-0 pr-4">
            <div>
              {/* Context Tag & Collection Progress */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cinema-gold mb-1">
                <Sparkles size={11} className="text-cinema-gold flex-shrink-0" />
                <span className="truncate">YOUR NEXT MOVIE</span>
              </div>

              {/* Movie Title */}
              <h3
                onClick={onWatchNow}
                className="font-serif font-bold text-base sm:text-lg text-cinema-white line-clamp-1 cursor-pointer hover:text-cinema-gold transition-colors"
              >
                {movie.title}
              </h3>

              {/* Metadata */}
              <div className="flex items-center gap-2 text-xs text-cinema-silver mt-0.5">
                {year && <span>{year}</span>}
                {runtime && <span>· {runtime}</span>}
                {movie.voteAverage > 0 && (
                  <span className="flex items-center gap-0.5 text-cinema-gold font-medium">
                    <Star size={11} className="fill-cinema-gold text-cinema-gold" />
                    <span>{movie.voteAverage.toFixed(1)}</span>
                  </span>
                )}
              </div>

              {/* Collection Context (if movie belongs to active collection) */}
              {data.collection && data.collectionProgress && (
                <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-cinema-silver font-medium">
                    <span className="flex items-center gap-1 text-cinema-subtle truncate">
                      <Layers size={11} className="text-cinema-gold flex-shrink-0" />
                      <span className="truncate">{data.collection.name}</span>
                    </span>
                    <span className="text-cinema-gold flex-shrink-0 ml-1">
                      {data.collectionProgress.watched} / {data.collectionProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-cinema-charcoal rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cinema-amber to-cinema-gold rounded-full"
                      style={{ width: `${data.collectionProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Fallback context label when not in collection */}
              {(!data.collection || !data.collectionProgress) && data.contextDetails && (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-cinema-subtle">
                  {data.contextDetails}
                </div>
              )}
            </div>

            {/* WATCH NOW CTA */}
            <div className="mt-4 pt-2">
              <button
                type="button"
                onClick={onWatchNow}
                className="cinema-button-primary w-full py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-gold"
              >
                <Play size={13} className="fill-cinema-black" />
                <span>WATCH NOW →</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="py-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cinema-gold/10 border border-cinema-gold/20 flex items-center justify-center text-cinema-gold mx-auto shadow-gold">
            <Compass size={24} />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-cinema-white">
              BUILD YOUR CINEMA
            </h4>
            <p className="text-xs text-cinema-subtle mt-0.5 max-w-xs mx-auto">
              Add your first movie to your watchlist or import your collection.
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscover}
            className="cinema-button-primary px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <span>DISCOVER →</span>
          </button>
        </div>
      )}
    </div>
  );
};
