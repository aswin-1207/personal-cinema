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
      <div className="relative -mx-4 -mt-2 sm:-mx-8 h-[55vh] min-h-[400px] max-h-[580px] bg-[#09090D] rounded-3xl overflow-hidden flex items-center justify-center p-8 text-center border border-white/5">
        <div className="max-w-md space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EDC257]/10 border border-[#EDC257]/20 flex items-center justify-center text-[#EDC257]">
            <Sparkles size={24} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#F5F2F0]">Your Private Cinema Awaits</h2>
          <p className="text-xs text-[#9E9DA5]">
            Discover films and build your personal screening vault to activate the cinematic hero stage.
          </p>
        </div>
      </div>
    );
  }

  const { movie, userData } = movieWithData;
  const backdropUrl = movie.backdropPath
    ? tmdbService.getImageUrl(movie.backdropPath, 'original')
    : movie.posterPath
    ? tmdbService.getImageUrl(movie.posterPath, 'w780')
    : null;

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const topGenres = movie.genres && movie.genres.length > 0 ? movie.genres.slice(0, 2).map((g) => g.name).join(', ') : null;

  return (
    <div className="relative -mx-4 -mt-2 sm:-mx-8 h-[65vh] min-h-[460px] max-h-[640px] bg-[#09090D] rounded-3xl overflow-hidden flex items-end shadow-2xl border border-white/5 group select-none">
      
      {/* LAYER 2: Backdrop Artwork with Ambient Scale */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.08] transform scale-100 group-hover:scale-[1.02] transition-transform duration-1000 ease-out"
            loading="eager"
          />
        </div>
      )}

      {/* LAYER 3: Multi-Stop Layered Readability Gradients */}
      {/* Left dark gradient for readable text placement */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090D] via-[#09090D]/75 to-transparent z-[1] w-full md:w-[70%]" />
      
      {/* Bottom fade melting seamlessly into page rails */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/50 to-transparent z-[2]" />
      
      {/* Top gradient to integrate navigation and Cinema Island */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090D]/80 via-transparent to-transparent z-[2] h-32" />

      {/* LAYER 4: Hero Content in Visually Quiet Zone (Left 8-12%) */}
      <div className="relative z-10 w-full px-6 sm:px-12 pb-8 sm:pb-12 max-w-3xl">
        
        {/* Subtle Greeting / Category Tag */}
        <div className="flex items-center gap-2 text-[#EDC257] text-[11px] font-bold tracking-[0.18em] uppercase mb-2 animate-cinema-fade">
          <Sparkles size={13} className="text-[#EDC257]" />
          <span>FEATURED SCREENING</span>
        </div>

        {/* Hero Title with Clamp Typography */}
        <h1 className="font-hero-title mb-3 drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] animate-cinema-rise">
          {movie.title}
        </h1>

        {/* Hero Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#9E9DA5] mb-4 drop-shadow font-medium">
          {year && <span>{year}</span>}
          {runtime && <span>• {runtime}</span>}
          {topGenres && <span>• {topGenres}</span>}
          {movie.voteAverage > 0 && (
            <span className="flex items-center gap-1 text-[#EDC257] font-semibold bg-[#EDC257]/10 px-2 py-0.5 rounded-full border border-[#EDC257]/20">
              <Star size={11} className="fill-[#EDC257] text-[#EDC257]" />
              <span>{movie.voteAverage.toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* Hero Overview (3-4 lines clamped) */}
        {movie.overview && (
          <p className="text-xs sm:text-sm text-[#F5F2F0]/85 max-w-xl line-clamp-3 mb-6 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {movie.overview}
          </p>
        )}

        {/* LAYER 5: Hero Action System */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary Action: Watch Now / Cinema Mode */}
          <button
            onClick={onWatchNow}
            className="cinema-button-primary px-5 sm:px-7 py-3 text-xs sm:text-sm font-bold shadow-[0_4px_24px_rgba(237,194,87,0.35)]"
          >
            <Play size={15} className="fill-[#09090D]" />
            <span>Watch Now</span>
          </button>

          {/* Contextual Action: Mark as Watched */}
          <WatchedButton
            movie={movie}
            userData={userData}
            style="pill"
          />

          {/* Secondary Action: More Info */}
          <button
            onClick={() => onOpenDetails && onOpenDetails(movie.id)}
            className="cinema-button-secondary px-4 py-3 text-xs sm:text-sm"
          >
            <Info size={15} />
            <span>More Info</span>
          </button>

          {/* Surprise Me Quick Trigger */}
          {onSurpriseMe && (
            <button
              onClick={onSurpriseMe}
              className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[#EDC257] transition-all hover:scale-105"
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
