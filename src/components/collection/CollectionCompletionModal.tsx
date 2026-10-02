import React, { useEffect, useState } from 'react';
import { Collection } from '../../types/collection';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { tmdbService } from '../../services/tmdbService';
import { CheckCircle2, CheckCircle, Share2, X } from 'lucide-react';
import { soundService } from '../../services/soundService';

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

  useEffect(() => {
    soundService.playCollectionComplete();

    async function loadPosters() {
      const colMovies = await CollectionRepository.getCollectionMovies(collection.id);
      const topIds = colMovies.slice(0, 6).map((m) => m.movieId);
      const movies = await MovieRepository.getByIds(topIds);
      const urls = movies
        .map((m) => (m.posterPath ? tmdbService.getImageUrl(m.posterPath, 'w342') : null))
        .filter((u): u is string => Boolean(u));
      setPosters(urls);
    }

    loadPosters();
  }, [collection.id]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cinema-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-cinema-surface border border-cinema-gold/40 rounded-2xl shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
        {/* Ambient Gold Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-cinema-gold/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-cinema-subtle hover:text-cinema-white transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Icon & Title */}
        <div className="inline-flex p-3 rounded-2xl bg-cinema-gold/15 border border-cinema-gold/30 text-cinema-gold mb-3 shadow-gold">
          <CheckCircle2 size={36} className="text-cinema-gold" />
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cinema-gold mb-1">
          <CheckCircle size={14} />
          <span>Collection Mastered</span>
        </div>

        <h2 className="font-serif text-2xl md:text-3xl font-bold text-cinema-white mb-2">
          {collection.name}
        </h2>

        <p className="text-sm text-cinema-silver mb-5">
          You've watched every movie in this curated collection. Completed on {formattedDate}.
        </p>

        {/* Poster Collage Strip */}
        {posters.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6 p-2 rounded-xl bg-cinema-charcoal/60 border border-white/5">
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
              className="cinema-button-secondary flex items-center gap-2 px-5 py-2.5"
            >
              <Share2 size={16} />
              <span>Share Collection</span>
            </button>
          )}
          <button onClick={onClose} className="cinema-button-primary px-6 py-2.5">
            Continue Journey
          </button>
        </div>
      </div>
    </div>
  );
};
