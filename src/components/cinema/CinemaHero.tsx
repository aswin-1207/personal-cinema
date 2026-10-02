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
      <div className="relative w-full h-[32vh] min-h-[240px] max-h-[360px] bg-[#09090B] rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center p-6 text-center border border-white/5 shadow-2xl">
        <div className="max-w-md space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[#E0AD52]/10 border border-[#E0AD52]/20 flex items-center justify-center text-[#E0AD52]">
            <Sparkles size={20} />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F5F3EB]">Featured Screening</h2>
          <p className="text-xs text-[#9E9DA5] leading-relaxed">
            Discover extraordinary films and build your personal collection to activate the hero stage.
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
    <div className="relative w-full h-[36vh] sm:h-[42vh] md:h-[46vh] min-h-[280px] sm:min-h-[340px] md:min-h-[380px] max-h-[460px] bg-[#09090B] rounded-2xl sm:rounded-3xl overflow-hidden flex items-end shadow-2xl border border-white/5 group select-none">
      
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
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/85 to-transparent z-[1] w-full md:w-[70%]" />
      
      {/* Bottom fade melting seamlessly into page rails */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent z-[2]" />
      
      {/* Top subtle vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/70 via-transparent to-transparent z-[2] h-20" />

      {/* LAYER 4: Hero Content with Guaranteed Boundary Containment */}
      <div className="relative z-10 w-full px-4 sm:px-8 md:px-10 pb-4 sm:pb-6 md:pb-7 max-w-3xl min-w-0">
        
        {/* Subtle Greeting / Category Tag */}
        <div className="flex items-center gap-1.5 text-[#E0AD52] text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5 animate-cinema-fade">
          <Sparkles size={12} className="text-[#E0AD52]" />
          <span>FEATURED SCREENING</span>
        </div>

        {/* Hero Title with Clamp Typography & Overflow Protection */}
        <h1
          className="font-hero-title mb-1.5 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] animate-cinema-rise break-words line-clamp-2"
          title={movie.title}
        >
          {movie.title}
        </h1>

        {/* Hero Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-[#9E9DA5] mb-2 sm:mb-2.5 drop-shadow font-medium">
          {year && <span>{year}</span>}
          {runtime && <span>• {runtime}</span>}
          {topGenres && <span className="hidden xs:inline">• {topGenres}</span>}
          {movie.voteAverage > 0 && (
            <span className="flex items-center gap-1 text-[#E0AD52] font-semibold bg-[#E0AD52]/10 px-1.5 py-0.5 rounded-full border border-[#E0AD52]/20">
              <Star size={10} className="fill-[#E0AD52] text-[#E0AD52]" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* Hero Overview (Clamped, hidden on very short screens if necessary) */}
        {movie.overview && (
          <p className="text-xs text-[#F5F3EB]/85 max-w-xl line-clamp-2 mb-3 sm:mb-4 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {movie.overview}
          </p>
        )}

        {/* LAYER 5: Hero Action System - Primary action MARK AS WATCHED (Section 11) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
              className="cinema-button-secondary px-3.5 sm:px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
              title="Enter Atmospheric Cinema Mode"
            >
              <Play size={14} className="fill-current text-[#E0AD52]" />
              <span>Cinema Mode</span>
            </button>
          )}

          {/* Info Action */}
          {onOpenDetails && (
            <button
              onClick={() => onOpenDetails(movie.id)}
              className="cinema-button-ghost px-3 py-2.5 text-xs border border-white/10 hover:border-white/20 rounded-xl min-h-[44px] min-w-[44px]"
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
              className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[#E0AD52] transition-all hover:scale-105 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
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
