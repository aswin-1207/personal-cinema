import React, { useState, useEffect } from 'react';
import { Movie, UserMovie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { WatchedButton } from '../movie/WatchedButton';
import { X, Volume2, VolumeX, Star, Film } from 'lucide-react';
import { useCinema } from '../../context/CinemaContext';
import { ScrollLockManager } from '../../services/scrollLockManager';

interface CinemaModeModalProps {
  movie: Movie;
  userData?: UserMovie;
  onClose: () => void;
}

export const CinemaModeModal: React.FC<CinemaModeModalProps> = ({
  movie,
  userData,
  onClose,
}) => {
  const { preferences, updatePreference } = useCinema();
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    ScrollLockManager.lock();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      ScrollLockManager.unlock();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  const backdropUrl = tmdbService.getBackdropUrl(movie.backdropPath, 'w1280');
  const posterUrl = tmdbService.getPosterUrl(movie.posterPath, 'w500');

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';

  return (
    <div
      onClick={() => setControlsVisible(!controlsVisible)}
      className="fixed inset-0 z-50 bg-[#050508] flex flex-col justify-between cursor-pointer overflow-hidden animate-fade-in"
    >
      {/* Immersive Atmospheric Backdrop */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0">
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover filter brightness-[0.25] blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/60 to-[#050508]" />
        </div>
      )}

      {/* Top Floating Controls */}
      <div
        className={`relative z-10 flex items-center justify-between px-6 py-5 transition-opacity duration-500 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Film size={18} className="text-cinema-gold" />
          <span className="text-xs uppercase tracking-widest text-cinema-gold font-semibold">
            Cinema Mode
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              updatePreference('soundEnabled', !preferences.soundEnabled)
            }
            className="p-2 rounded-full bg-cinema-surface/80 hover:bg-cinema-surface text-cinema-silver hover:text-cinema-white transition-colors"
            title="Toggle Sound"
            aria-label="Toggle sound"
          >
            {preferences.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-cinema-surface/80 hover:bg-cinema-surface text-cinema-silver hover:text-cinema-white transition-colors"
            title="Exit Cinema Mode"
            aria-label="Exit Cinema Mode"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Centerpiece: Glowing Poster & Title */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poster with Atmospheric Aura */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-cinema-gold/15 rounded-3xl blur-2xl group-hover:bg-cinema-gold/25 transition-all duration-700 pointer-events-none" />
          <div className="relative w-48 sm:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-cinema-gold/30">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-cinema-charcoal text-cinema-subtle">
                <Film size={48} />
              </div>
            )}
          </div>
        </div>

        {/* Title and Metadata */}
        <h2 className="font-bold text-2xl sm:text-3xl text-cinema-white mt-6 mb-1 drop-shadow-lg max-w-xl">
          {movie.title}
        </h2>

        <div className="flex items-center gap-3 text-xs sm:text-sm text-cinema-silver drop-shadow">
          {year && <span>{year}</span>}
          {movie.runtime && <span>• {movie.runtime} min</span>}
          {movie.voteAverage > 0 && (
            <span className="flex items-center gap-1 text-cinema-gold font-semibold">
              <Star size={13} className="fill-cinema-gold" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Bottom Floating Bar: Mark as Watched */}
      <div
        className={`relative z-10 max-w-sm w-full mx-auto pb-8 px-4 transition-opacity duration-500 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <WatchedButton movie={movie} userData={userData} style="prominent" />
      </div>
    </div>
  );
};
