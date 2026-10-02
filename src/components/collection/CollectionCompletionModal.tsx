import React, { useEffect, useState } from 'react';
import { Collection } from '../../types/collection';
import { Movie } from '../../types/movie';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { tmdbService } from '../../services/tmdbService';
import { Check, Share2, X, Film } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { hapticsService } from '../../services/hapticsService';

interface CollectionCompletionModalProps {
  collection: Collection;
  onClose: () => void;
  onShare?: () => void;
}

export const CollectionCompletionModal: React.FC<CollectionCompletionModalProps> = ({
  collection,
  onClose,
  onShare,
}) => {
  const [posters, setPosters] = useState<string[]>([]);
  const [finalMovie, setFinalMovie] = useState<Movie | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    soundService.playCollectionTriumph();
    hapticsService.success();

    async function loadData() {
      const colMovies = await CollectionRepository.getCollectionMovies(collection.id);
      setTotalCount(colMovies.length);

      // Load final movie memory if recorded
      if (collection.finalMovieId) {
        const fm = await MovieRepository.getById(collection.finalMovieId);
        if (fm) setFinalMovie(fm);
      } else if (colMovies.length > 0) {
        const lastMovieId = colMovies[colMovies.length - 1].movieId;
        const fm = await MovieRepository.getById(lastMovieId);
        if (fm) setFinalMovie(fm);
      }

      const topIds = colMovies.slice(0, 6).map((m) => m.movieId);
      const movies = await MovieRepository.getByIds(topIds);
      const urls = movies
        .map((m) => (m.posterPath ? tmdbService.getImageUrl(m.posterPath, 'w342') : null))
        .filter((u): u is string => Boolean(u));
      setPosters(urls);
    }

    loadData();
  }, [collection.id, collection.finalMovieId]);

  const formattedDate = collection.completedAt
    ? new Date(collection.completedAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cinema-black/85 backdrop-blur-md animate-cinema-fade"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#131319] border border-[#E0AD52]/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden p-6 sm:p-7 text-center animate-cinema-scale"
      >
        {/* Subtle Ambient Gold Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#E0AD52]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#9E9DA5] hover:text-[#F5F3EB] transition-colors cursor-pointer border-none bg-transparent"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Icon & Title */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#E0AD52]/15 border border-[#E0AD52]/30 text-[#E0AD52] mb-3 shadow-[0_0_20px_rgba(224,173,82,0.25)]">
          <Check size={26} strokeWidth={3} className="text-[#E0AD52]" />
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#E0AD52] mb-1">
          <span>COLLECTION COMPLETE ✓</span>
        </div>

        <h2 className="font-hero-title text-2xl sm:text-3xl text-[#F5F3EB] mb-1.5">
          {collection.name}
        </h2>

        <p className="text-xs sm:text-sm text-[#9E9DA5] mb-5">
          {totalCount} / {totalCount} WATCHED · Concluded on {formattedDate}
        </p>

        {/* The Final Film Memory */}
        {finalMovie && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#09090D] border border-[#E0AD52]/25 flex items-center gap-3.5 text-left shadow-md">
            <div className="w-11 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#171924] border border-white/10">
              {finalMovie.posterPath ? (
                <img
                  src={tmdbService.getImageUrl(finalMovie.posterPath, 'w185') || ''}
                  alt={finalMovie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#E0AD52]">
                  <Film size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-[#E0AD52] block">
                THE FINAL FILM
              </span>
              <h4 className="font-serif font-bold text-sm text-[#F5F3EB] truncate mt-0.5">
                {finalMovie.title}
              </h4>
              <p className="text-[11px] text-[#9E9DA5] mt-0.5 truncate">
                Concluded this cinematic journey
              </p>
            </div>
          </div>
        )}

        {/* Poster Collage Strip */}
        {posters.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6 p-2 rounded-xl bg-[#09090D] border border-white/5">
            {posters.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="aspect-[2/3] object-cover rounded shadow-md border border-white/10"
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-center">
          {onShare && (
            <button
              onClick={() => {
                onClose();
                onShare();
              }}
              className="cinema-button-secondary flex items-center gap-2 px-5 py-2.5 text-xs font-semibold cursor-pointer"
            >
              <Share2 size={15} />
              <span>Share Collection</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="cinema-button-primary px-6 py-2.5 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
