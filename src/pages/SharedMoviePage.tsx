import React, { useState, useEffect } from 'react';
import { ShareService } from '../services/shareService';
import { MovieSharePayload, CollectionSharePayload } from '../types/share';
import { Star, ArrowRight, Film } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';

interface SharedMoviePageProps {
  hash: string;
  onDismiss: () => void;
}

export const SharedMoviePage: React.FC<SharedMoviePageProps> = ({ hash, onDismiss }) => {
  const { openMovieDetail, addToWatchlist, showToast } = useCinema();

  const [moviePayload, setMoviePayload] = useState<MovieSharePayload | null>(null);
  const [collectionPayload, setCollectionPayload] = useState<CollectionSharePayload | null>(null);

  useEffect(() => {
    if (hash.startsWith('#share-movie=')) {
      const decoded = ShareService.decodeMovieShareUrl(hash);
      setMoviePayload(decoded);
    } else if (hash.startsWith('#share-col=')) {
      const decoded = ShareService.decodeCollectionShareUrl(hash);
      setCollectionPayload(decoded);
    }
  }, [hash]);

  const handleAddSharedMovieToWatchlist = async () => {
    if (!moviePayload) return;
    try {
      const movie = await tmdbService.getMovieDetails(moviePayload.movieId);
      if (movie) {
        await addToWatchlist(movie);
        showToast(`Added "${movie.title}" to your Watchlist!`);
      }
      onDismiss();
      openMovieDetail(moviePayload.movieId);
    } catch {
      showToast('Could not load movie details.');
    }
  };

  if (!moviePayload && !collectionPayload) {
    return (
      <div className="fixed inset-0 z-50 bg-cinema-black flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-cinema-silver text-sm">Invalid or expired share link.</p>
          <button onClick={onDismiss} className="cinema-button-primary px-5 py-2 text-xs">
            Enter MyCinema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-cinema-black/95 backdrop-blur-xl overflow-y-auto flex items-center justify-center p-4">
      {/* Movie Share Card */}
      {moviePayload && (
        <div className="w-full max-w-md bg-cinema-surface border border-cinema-gold/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
          <div className="text-xs uppercase tracking-widest text-cinema-gold font-semibold mb-3">
            Shared from MyCinema
          </div>

          <div className="aspect-[2/3] w-48 mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-4 bg-cinema-charcoal">
            {moviePayload.posterUrl ? (
              <img
                src={moviePayload.posterUrl}
                alt={moviePayload.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cinema-subtle">
                <Film size={36} />
              </div>
            )}
          </div>

          <h2 className="font-serif font-bold text-2xl text-cinema-white mb-1">
            {moviePayload.title}
          </h2>

          <div className="flex items-center justify-center gap-2 text-xs text-cinema-silver mb-3">
            {moviePayload.year && <span>{moviePayload.year}</span>}
            {moviePayload.runtime && <span>• {moviePayload.runtime}</span>}
            {moviePayload.genres && <span>• {moviePayload.genres.join(', ')}</span>}
          </div>

          {/* Shared User Data (Status, Rating, Review) */}
          <div className="bg-cinema-charcoal/60 rounded-xl p-3 mb-5 border border-white/5 space-y-1.5 text-xs text-left">
            {moviePayload.status && (
              <div className="flex justify-between text-cinema-silver">
                <span className="text-cinema-subtle">Status:</span>
                <span className="font-semibold text-cinema-gold capitalize">
                  {moviePayload.status.replace('_', ' ')}
                </span>
              </div>
            )}

            {moviePayload.rating !== null && moviePayload.rating !== undefined && (
              <div className="flex justify-between items-center text-cinema-silver">
                <span className="text-cinema-subtle">Personal Rating:</span>
                <div className="flex items-center gap-1 text-cinema-gold font-bold">
                  <Star size={12} className="fill-cinema-gold" />
                  <span>{moviePayload.rating.toFixed(1)} / 5</span>
                </div>
              </div>
            )}

            {moviePayload.review && (
              <div className="pt-1.5 border-t border-white/5 text-cinema-silver italic">
                "{moviePayload.review}"
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAddSharedMovieToWatchlist}
              className="cinema-button-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Add to My Watchlist</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onDismiss}
              className="cinema-button-secondary py-2.5 text-xs"
            >
              Open MyCinema
            </button>
          </div>
        </div>
      )}

      {/* Collection Share Card */}
      {collectionPayload && (
        <div className="w-full max-w-md bg-cinema-surface border border-cinema-gold/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
          <div className="inline-flex p-2.5 rounded-xl bg-cinema-gold/15 text-cinema-gold mb-2 shadow-gold">
            <Film size={24} />
          </div>

          <div className="text-xs uppercase tracking-widest text-cinema-gold font-semibold mb-1">
            Curated Collection
          </div>

          <h2 className="font-serif font-bold text-2xl text-cinema-white mb-2">
            {collectionPayload.name}
          </h2>

          {collectionPayload.description && (
            <p className="text-xs text-cinema-silver mb-4 line-clamp-2">
              {collectionPayload.description}
            </p>
          )}

          {/* Progress */}
          <div className="bg-cinema-charcoal/50 p-3 rounded-xl border border-white/5 mb-4 text-xs">
            <div className="flex justify-between text-cinema-silver mb-1">
              <span>Progress: {collectionPayload.watchedMovies} / {collectionPayload.totalMovies} watched</span>
              <span className="font-semibold text-cinema-gold">{collectionPayload.completionPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-cinema-charcoal rounded-full overflow-hidden">
              <div
                className="h-full bg-cinema-gold rounded-full"
                style={{ width: `${collectionPayload.completionPercent}%` }}
              />
            </div>
          </div>

          {/* Posters collage */}
          {collectionPayload.posters && collectionPayload.posters.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-6">
              {collectionPayload.posters.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="aspect-[2/3] object-cover rounded shadow"
                />
              ))}
            </div>
          )}

          <button
            onClick={onDismiss}
            className="cinema-button-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <span>Explore in MyCinema</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
