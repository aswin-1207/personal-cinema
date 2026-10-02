import React from 'react';
import { MovieWithUserData } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { WatchedButton } from '../movie/WatchedButton';
import { Sparkles, Star, Info } from 'lucide-react';

interface CinemaHeroProps {
  movieWithData: MovieWithUserData | null;
  onOpenDetails?: (movieId: number) => void;
}

export const CinemaHero: React.FC<CinemaHeroProps> = ({
  movieWithData,
  onOpenDetails,
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
    <div className="relative w-full h-[32vh] xs:h-[35vh] sm:h-[40vh] min-h-[240px] max-h-[380px] bg-[#09090B] rounded-2xl sm:rounded-3xl overflow-hidden flex items-end shadow-2xl border border-white/5 group select-none">
      
      {/* LAYER 2: Backdrop Artwork with Ambient Scale */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.70] contrast-[1.08] transform scale-100 group-hover:scale-[1.02] transition-transform duration-1000 ease-out"
            loading="eager"
            decoding="async"
          />
        </div>
      )}

      {/* LAYER 3: Multi-Stop Layered Readability Gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/85 to-transparent z-[1] w-full md:w-[70%]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent z-[2]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/70 via-transparent to-transparent z-[2] h-16" />

      {/* LAYER 4: Hero Content with Guaranteed Boundary Containment */}
      <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 pb-3.5 sm:pb-5 max-w-2xl min-w-0">
        
        {/* Subtle Category Tag */}
        <div className="flex items-center gap-1.5 text-[#E0AD52] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
          <Sparkles size={11} className="text-[#E0AD52]" />
          <span>FEATURED SPOTLIGHT</span>
        </div>

        {/* Hero Title with Clamp Typography & Overflow Protection */}
        <h1
          className="font-serif font-black text-lg sm:text-2xl md:text-3xl text-[#F5F3EB] mb-1 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] line-clamp-2 break-words leading-tight"
          title={movie.title}
        >
          {movie.title}
        </h1>

        {/* Hero Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-[#9E9DA5] mb-2 drop-shadow font-medium">
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

        {/* Hero Overview */}
        {movie.overview && (
          <p className="text-xs text-[#F5F3EB]/80 max-w-xl line-clamp-2 mb-2.5 sm:mb-3 leading-relaxed hidden xs:block">
            {movie.overview}
          </p>
        )}

        {/* LAYER 5: Hero Action System */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Primary Action: Mark as Watched */}
          <WatchedButton
            movie={movie}
            userData={userData}
            style="prominent"
          />

          {/* Details Action */}
          {onOpenDetails && (
            <button
              onClick={() => onOpenDetails(movie.id)}
              className="cinema-button-secondary px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              title="View Movie Details"
            >
              <Info size={14} />
              <span>Details</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
