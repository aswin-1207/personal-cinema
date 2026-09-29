import React, { useState, useEffect } from 'react';
import { Collection, CollectionProgress } from '../../types/collection';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { CheckCircle2, Film } from 'lucide-react';
import { tmdbService } from '../../services/tmdbService';

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  className?: string;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick, className = '' }) => {
  const [progress, setProgress] = useState<CollectionProgress>({
    total: 0,
    watched: 0,
    watching: 0,
    unwatched: 0,
    percent: 0,
    isComplete: false,
  });
  const [posterUrls, setPosterUrls] = useState<string[]>([]);
  const [heroPosterUrl, setHeroPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const prog = await CollectionRepository.calculateProgress(collection.id);
      if (!isMounted) return;
      setProgress(prog);

      const colMovies = await CollectionRepository.getCollectionMovies(collection.id);
      if (colMovies.length === 0) {
        setPosterUrls([]);
        return;
      }

      // If hero cover or custom cover specified
      if (collection.coverType === 'hero' || collection.customCoverMovieId) {
        const coverMovieId = collection.customCoverMovieId || colMovies[0]?.movieId;
        if (coverMovieId) {
          const m = await MovieRepository.getById(coverMovieId);
          if (m?.backdropPath) {
            setHeroPosterUrl(tmdbService.getImageUrl(m.backdropPath, 'w780'));
          } else if (m?.posterPath) {
            setHeroPosterUrl(tmdbService.getImageUrl(m.posterPath, 'w500'));
          }
        }
      }

      // Top 4 movies for collage
      const topMovieIds = colMovies.slice(0, 4).map((cm) => cm.movieId);
      const movies = await MovieRepository.getByIds(topMovieIds);
      const posters = movies
        .map((m) => (m.posterPath ? tmdbService.getImageUrl(m.posterPath, 'w342') : null))
        .filter((url): url is string => Boolean(url));

      if (isMounted) {
        setPosterUrls(posters);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [collection.id, collection.coverType, collection.customCoverMovieId, collection.updatedAt]);

  return (
    <div
      onClick={onClick}
      className={`cinema-card group cursor-pointer flex flex-col overflow-hidden transition-all duration-300 hover:border-gold-500/40 hover:-translate-y-1 ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Cover / Collage Container */}
      <div className="relative aspect-[16/10] bg-cinema-surface overflow-hidden">
        {collection.coverType === 'hero' && heroPosterUrl ? (
          <img
            src={heroPosterUrl}
            alt={collection.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : posterUrls.length >= 4 ? (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5 bg-cinema-charcoal">
            {posterUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                loading="lazy"
              />
            ))}
          </div>
        ) : posterUrls.length > 0 ? (
          <div className="w-full h-full relative">
            <img
              src={posterUrls[0]}
              alt={collection.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            {posterUrls.length > 1 && (
              <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-cinema-black/40 to-transparent flex items-end p-2">
                <span className="text-xs text-cinema-silver font-medium">+{progress.total - 1} movies</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-cinema-subtle p-4">
            <Film size={36} className="mb-2 opacity-40 text-cinema-gold" />
            <span className="text-xs">Empty Collection</span>
          </div>
        )}

        {/* Completion Gold Badge */}
        {progress.isComplete && progress.total > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cinema-gold/90 text-cinema-black text-xs font-semibold shadow-gold backdrop-blur-sm animate-pulse-glow">
            <CheckCircle2 size={13} className="text-cinema-black" />
            <span>Complete</span>
          </div>
        )}

        {/* Movie Count Pill */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-cinema-black/80 backdrop-blur-sm text-[11px] font-medium text-cinema-silver border border-white/5">
          {progress.total} {progress.total === 1 ? 'movie' : 'movies'}
        </div>
      </div>

      {/* Card Info & Progress */}
      <div className="p-4 flex flex-col flex-grow justify-between bg-cinema-surface/60">
        <div>
          <h3 className="font-semibold text-cinema-white text-base line-clamp-1 group-hover:text-cinema-gold transition-colors">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-xs text-cinema-subtle line-clamp-2 mt-1 leading-relaxed">
              {collection.description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex justify-between items-center text-xs mb-1.5 text-cinema-silver">
            <span>
              {progress.watched} of {progress.total} watched
            </span>
            <span className={`font-medium ${progress.isComplete ? 'text-cinema-gold' : 'text-cinema-silver'}`}>
              {progress.percent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-cinema-charcoal rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                progress.isComplete
                  ? 'bg-gradient-to-r from-cinema-amber to-cinema-gold shadow-gold'
                  : 'bg-cinema-gold/80'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
