import React, { useState, useEffect } from 'react';
import { Collection, CollectionProgress } from '../../types/collection';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { Trophy, Layers } from 'lucide-react';
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

      // Top 4 movies for universe collage
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

  const isComplete = progress.total > 0 && progress.watched === progress.total;

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer select-none rounded-2xl overflow-hidden bg-[#171924] border border-white/[0.08] hover:border-[#EDC257]/45 shadow-[0_6px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.85)] hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Visual Collage representing a Movie Universe (2x2 with depth shifts) */}
      <div className="relative aspect-[16/10] bg-[#10121A] overflow-hidden">
        {collection.coverType === 'hero' && heroPosterUrl ? (
          <img
            src={heroPosterUrl}
            alt={collection.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : posterUrls.length >= 4 ? (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5 bg-[#09090D] p-0.5">
            {/* Poster 0: Top Left */}
            <div className="overflow-hidden relative shadow-md transition-transform duration-500 ease-out group-hover:-translate-x-1 group-hover:-translate-y-1">
              <img src={posterUrls[0]} alt="" className="w-full h-full object-cover" />
            </div>
            {/* Poster 1: Top Right */}
            <div className="overflow-hidden relative shadow-md transition-transform duration-500 ease-out group-hover:translate-x-1 group-hover:-translate-y-1">
              <img src={posterUrls[1]} alt="" className="w-full h-full object-cover" />
            </div>
            {/* Poster 2: Bottom Left */}
            <div className="overflow-hidden relative shadow-md transition-transform duration-500 ease-out group-hover:-translate-x-1 group-hover:translate-y-1">
              <img src={posterUrls[2]} alt="" className="w-full h-full object-cover" />
            </div>
            {/* Poster 3: Bottom Right */}
            <div className="overflow-hidden relative shadow-md transition-transform duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1">
              <img src={posterUrls[3]} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : posterUrls.length > 0 ? (
          <div className="flex w-full h-full bg-[#09090D]">
            {posterUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="flex-1 h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#5C5B64] gap-2">
            <Layers size={32} />
            <span className="text-xs font-serif">Curated Saga</span>
          </div>
        )}

        {/* Ambient Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/40 to-transparent group-hover:opacity-85 transition-opacity" />

        {/* Completion Badge */}
        {isComplete && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EDC257] text-[#09090D] text-[10px] font-black shadow-[0_2px_12px_rgba(237,194,87,0.4)] backdrop-blur-md">
            <Trophy size={12} strokeWidth={2.5} />
            <span>COMPLETE</span>
          </div>
        )}
      </div>

      {/* Collection Metadata & Integrated Thin Progress Bar */}
      <div className="p-4 bg-[#171924] flex-grow flex flex-col justify-between space-y-3">
        <div>
          <h4 className="font-serif font-bold text-sm sm:text-base text-[#F5F2F0] line-clamp-1 group-hover:text-[#EDC257] group-hover:-translate-y-0.5 transition-all duration-200">
            {collection.name}
          </h4>
          {collection.description && (
            <p className="text-xs text-[#9E9DA5] line-clamp-1 mt-0.5">
              {collection.description}
            </p>
          )}
        </div>

        {/* Cinematic Universe Progress */}
        <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-[11px] text-[#9E9DA5]">
            <span>
              {progress.total} {progress.total === 1 ? 'Movie' : 'Movies'} · {progress.watched} Watched
            </span>
            <span className={`font-bold ${isComplete ? 'text-[#EDC257]' : 'text-[#F5F2F0]'}`}>
              {progress.percent}%
            </span>
          </div>

          {/* Thin Cinematic Progress Bar */}
          <div className="w-full h-1.5 bg-[#09090D] rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#EDC257] to-[#D99C33] transition-all duration-700 ease-out shadow-[0_0_8px_rgba(237,194,87,0.3)]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
