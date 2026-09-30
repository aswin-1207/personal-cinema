import React from 'react';
import { MovieWithUserData } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { WatchedButton } from '../movie/WatchedButton';
import { Play, Sparkles, Star, Info } from 'lucide-react';

interface CinemaHeroProps {
  movieWithData: MovieWithUserData | null;
  onWatchNow?: () => void;
  onOpenDetails?: (movieId: number) => void;
  onSurpriseMe?: () => void;
}

export const CinemaHero: React.FC<CinemaHeroProps> = ({
  movieWithData,
  onWatchNow,
  onOpenDetails,
  onSurpriseMe,
}) => {
  if (!movieWithData) {
    return (
      <div className="relative -mx-4 mt-0 sm:-mx-8 h-[50vh] min-h-[380px] max-h-[520px] bg-[#09090B] rounded-3xl overflow-hidden flex items-center justify-center p-8 text-center border border-white/5 shadow-2xl">
        <div className="max-w-md space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#E0AD52]/10 border border-[#E0AD52]/20 flex items-center justify-center text-[#E0AD52]">
            <Sparkles size={24} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#F5F3EB]">Your Private Cinema Awaits</h2>
          <p className="text-xs text-[#9E9DA5] leading-relaxed">
            Discover films and build your personal screening vault to activate the cinematic hero stage.
          </p>
        </div>
      </div>
    );
  }

  const { movie, userData } = movieWithData;
  const backdropUrl = movie.backdropPath
    ? tmdbService.getBackdropUrl(movie.backdropPath, 'w1280')
    : movie.posterPath
    ? tmdbService.getPosterUrl(movie.posterPath, 'w780')
    : null;

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const topGenres = movie.genres && movie.genres.length > 0 ? movie.genres.slice(0, 2).map((g) => g.name).join(', ') : null;

  return (
    <div className="relative -mx-4 mt-0 sm:-mx-8 h-[60vh] min-h-[440px] max-h-[600px] bg-[#09090B] rounded-3xl overflow-hidden flex items-end shadow-2xl border border-white/5 group select-none">
      
      {/* LAYER 2: Backdrop Artwork with Ambient Scale */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.08] transform scale-100 group-hover:scale-[1.02] transition-transform duration-1000 ease-out"
            loading="eager"
            decoding="async"
          />
        </div>
      )}

      {/* LAYER 3: Multi-Stop Layered Readability Gradients */}
      {/* Left dark gradient for readable text placement */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/80 to-transparent z-[1] w-full md:w-[70%]" />
      
      {/* Bottom fade melting seamlessly into page rails */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/55 to-transparent z-[2]" />
      
      {/* Top subtle vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/70 via-transparent to-transparent z-[2] h-28" />

      {/* LAYER 4: Hero Content with Guaranteed Boundary Containment */}
      <div className="relative z-10 w-full px-5 sm:px-12 pb-6 sm:pb-10 max-w-3xl min-w-0">
        
        {/* Subtle Greeting / Category Tag */}
        <div className="flex items-center gap-2 text-[#E0AD52] text-[11px] font-bold tracking-[0.18em] uppercase mb-2 animate-cinema-fade">
          <Sparkles size={13} className="text-[#E0AD52]" />
          <span>FEATURED SCREENING</span>
        </div>

        {/* Hero Title with Clamp Typography & Overflow Protection */}
        <h1
          className="font-hero-title mb-2.5 drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)] animate-cinema-rise break-words line-clamp-3"
          title={movie.title}
        >
          {movie.title}
        </h1>

        {/* Hero Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#9E9DA5] mb-3 drop-shadow font-medium">
          {year && <span>{year}</span>}
          {runtime && <span>• {runtime}</span>}
          {topGenres && <span>• {topGenres}</span>}
          {movie.voteAverage > 0 && (
            <span className="flex items-center gap-1 text-[#E0AD52] font-semibold bg-[#E0AD52]/10 px-2 py-0.5 rounded-full border border-[#E0AD52]/20">
              <Star size={11} className="fill-[#E0AD52] text-[#E0AD52]" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* Hero Overview (3 lines clamped, responsive) */}
        {movie.overview && (
          <p className="text-xs sm:text-sm text-[#F5F3EB]/85 max-w-xl line-clamp-2 sm:line-clamp-3 mb-5 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {movie.overview}
          </p>
        )}

        {/* LAYER 5: Hero Action System - Primary action MARK AS WATCHED (Section 11) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Primary Action: Mark as Watched */}
          <WatchedButton
            movie={movie}
            userData={userData}
            style="prominent"
          />

          {/* Secondary Action: Cinema Mode Watch Now */}
          {onWatchNow && (
            <button
              onClick={onWatchNow}
              className="cinema-button-secondary px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
              title="Enter Atmospheric Cinema Mode"
            >
              <Play size={15} className="fill-current text-[#E0AD52]" />
              <span>Cinema Mode</span>
            </button>
          )}

          {/* Info Action */}
          {onOpenDetails && (
            <button
              onClick={() => onOpenDetails(movie.id)}
              className="cinema-button-ghost px-3 py-3 text-xs sm:text-sm border border-white/10 hover:border-white/20 rounded-xl"
              title="View Movie Details"
            >
              <Info size={15} />
              <span className="hidden sm:inline">Details</span>
            </button>
          )}

          {/* Surprise Me Quick Trigger */}
          {onSurpriseMe && (
            <button
              onClick={onSurpriseMe}
              className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[#E0AD52] transition-all hover:scale-105 active:scale-95"
              title="Surprise Selection"
            >
              <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
