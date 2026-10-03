import React, { useState, useEffect } from 'react';
import { ShareService } from '../services/shareService';
import { MovieSharePayload, CollectionSharePayload } from '../types/share';
import { Star, ArrowRight, Film, CheckCircle2, Sparkles, X } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadShareContent = async () => {
      // 1. Check Movie Share
      if (hash.includes('share-movie')) {
        const decoded = ShareService.decodeMovieShareUrl(hash);
        if (decoded) {
          setMoviePayload(decoded);
          return;
        }

        // Check if raw movie ID passed (e.g. #share-movie=157336)
        const idMatch = hash.match(/share-movie=(\d+)/);
        if (idMatch) {
          setIsLoading(true);
          try {
            const movieId = parseInt(idMatch[1], 10);
            const m = await tmdbService.getMovieDetails(movieId);
            if (m) {
              setMoviePayload(ShareService.buildMovieSharePayload(m));
            }
          } catch (err) {
            console.error('Failed to load shared movie by ID:', err);
          } finally {
            setIsLoading(false);
          }
        }
      }
      // 2. Check Collection Share
      else if (hash.includes('share-col')) {
        const decoded = ShareService.decodeCollectionShareUrl(hash);
        if (decoded) {
          setCollectionPayload(decoded);
        }
      }
    };

    loadShareContent();
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#E0AD52] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#9E9DA5] uppercase tracking-wider font-semibold">
            Loading Shared Cinema...
          </p>
        </div>
      </div>
    );
  }

  if (!moviePayload && !collectionPayload) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm bg-[#131319] p-6 rounded-2xl border border-white/10 shadow-2xl">
          <Film size={32} className="text-[#9E9DA5] mx-auto opacity-60" />
          <h3 className="font-semibold text-lg text-[#F5F3EB]">Shared Content Unavailable</h3>
          <p className="text-xs text-[#9E9DA5] leading-relaxed">
            This share link could not be loaded or may have expired.
          </p>
          <button
            onClick={onDismiss}
            className="cinema-button-primary w-full py-2.5 text-xs font-semibold cursor-pointer"
          >
            Enter MyCinema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B]/95 backdrop-blur-xl overflow-y-auto flex items-center justify-center p-4">
      {/* MOVIE SHARE VIEW */}
      {moviePayload && (
        <div className="w-full max-w-md bg-[#131319] border border-[#E0AD52]/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-scale-in relative">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-[#9E9DA5] hover:text-[#F5F3EB] p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close share preview"
          >
            <X size={18} />
          </button>

          <div className="text-[11px] uppercase tracking-widest text-[#E0AD52] font-semibold mb-3 flex items-center justify-center gap-1.5">
            <Sparkles size={12} />
            <span>Shared via MyCinema</span>
          </div>

          <div className="aspect-[2/3] w-44 mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-4 bg-black">
            {moviePayload.posterUrl ? (
              <img
                src={moviePayload.posterUrl}
                alt={moviePayload.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#9E9DA5]">
                <Film size={36} />
              </div>
            )}
          </div>

          <h2 className="font-bold text-2xl text-[#F5F3EB] mb-1 line-clamp-2">
            {moviePayload.title}
          </h2>

          <div className="flex items-center justify-center gap-2 text-xs text-[#9E9DA5] mb-4">
            {moviePayload.year && <span>{moviePayload.year}</span>}
            {moviePayload.runtime && <span>• {moviePayload.runtime}</span>}
            {moviePayload.genres && moviePayload.genres.length > 0 && (
              <span>• {moviePayload.genres.join(', ')}</span>
            )}
          </div>

          {/* Shared User Privacy-Guarded Details */}
          {(moviePayload.status || moviePayload.rating !== null || moviePayload.review) && (
            <div className="bg-[#1E1E26]/80 rounded-2xl p-3.5 mb-5 border border-white/5 space-y-2 text-xs text-left">
              {moviePayload.status && (
                <div className="flex justify-between items-center text-[#F5F3EB]">
                  <span className="text-[#9E9DA5]">Viewer Status:</span>
                  <span className="font-semibold text-[#E0AD52] capitalize">
                    {moviePayload.status.replace('_', ' ')}
                  </span>
                </div>
              )}

              {moviePayload.rating !== null && moviePayload.rating !== undefined && (
                <div className="flex justify-between items-center text-[#F5F3EB]">
                  <span className="text-[#9E9DA5]">Viewer Rating:</span>
                  <div className="flex items-center gap-1 text-[#E0AD52] font-bold">
                    <Star size={13} className="fill-[#E0AD52]" />
                    <span>{moviePayload.rating.toFixed(1)} / 5</span>
                  </div>
                </div>
              )}

              {moviePayload.review && (
                <div className="pt-2 border-t border-white/5 text-[#B7B5B3] italic leading-relaxed">
                  "{moviePayload.review}"
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleAddSharedMovieToWatchlist}
              className="cinema-button-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-gold min-h-[44px]"
            >
              <span>Add to My Watchlist</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onDismiss}
              className="cinema-button-secondary py-2.5 text-xs cursor-pointer min-h-[44px]"
            >
              Open in MyCinema
            </button>
          </div>
        </div>
      )}

      {/* COLLECTION SHARE VIEW */}
      {collectionPayload && (
        <div className="w-full max-w-md bg-[#131319] border border-[#E0AD52]/40 rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-scale-in relative">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-[#9E9DA5] hover:text-[#F5F3EB] p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close share preview"
          >
            <X size={18} />
          </button>

          <div className="text-[11px] uppercase tracking-widest text-[#E0AD52] font-semibold mb-2 flex items-center justify-center gap-1.5">
            <Sparkles size={12} />
            <span>Curated Collection</span>
          </div>

          {/* Complete Status Banner */}
          {collectionPayload.isComplete && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E0AD52]/20 border border-[#E0AD52]/40 text-[#E0AD52] text-xs font-semibold mb-3">
              <CheckCircle2 size={14} />
              <span>COLLECTION COMPLETE ✓</span>
            </div>
          )}

          <h2 className="font-bold text-2xl text-[#F5F3EB] mb-1 line-clamp-2">
            {collectionPayload.name}
          </h2>

          {collectionPayload.description && (
            <p className="text-xs text-[#9E9DA5] mb-4 line-clamp-2">
              {collectionPayload.description}
            </p>
          )}

          {/* Progress */}
          <div className="bg-[#1E1E26]/80 p-3.5 rounded-2xl border border-white/5 mb-4 text-xs">
            <div className="flex justify-between text-[#F5F3EB] mb-1.5">
              <span>
                Progress: {collectionPayload.watchedMovies} / {collectionPayload.totalMovies} watched
              </span>
              <span className="font-semibold text-[#E0AD52]">{collectionPayload.completionPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#09090B] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D99C33] to-[#E0AD52] rounded-full"
                style={{ width: `${collectionPayload.completionPercent}%` }}
              />
            </div>
          </div>

          {/* THE FINAL FILM Memory Card if complete */}
          {collectionPayload.isComplete && collectionPayload.finalMovieTitle && (
            <div className="mb-4 p-3 rounded-2xl bg-black/40 border border-[#E0AD52]/30 text-left">
              <div className="text-[10px] uppercase tracking-wider text-[#E0AD52] font-bold">
                The Final Film
              </div>
              <div className="text-sm font-semibold text-[#F5F3EB]">
                {collectionPayload.finalMovieTitle}
              </div>
              {collectionPayload.completedAt && (
                <div className="text-[10px] text-[#9E9DA5] mt-0.5">
                  Completed {new Date(collectionPayload.completedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Posters collage */}
          {collectionPayload.posters && collectionPayload.posters.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-5">
              {collectionPayload.posters.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="aspect-[2/3] object-cover rounded-xl shadow border border-white/5"
                />
              ))}
            </div>
          )}

          <button
            onClick={onDismiss}
            className="cinema-button-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-gold min-h-[44px]"
          >
            <span>Explore in MyCinema</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
