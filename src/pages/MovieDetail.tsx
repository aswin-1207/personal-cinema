import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { tmdbService } from '../services/tmdbService';
import { Movie, UserMovie } from '../types/movie';
import { Collection } from '../types/collection';
import { WatchedButton } from '../components/movie/WatchedButton';
import { RatingControl } from '../components/movie/RatingControl';
import { ShareModal } from '../components/share/ShareModal';
import { MoviePoster } from '../components/movie/MoviePoster';
import { CinemaModeModal } from '../components/cinema/CinemaModeModal';
import {
  ArrowLeft,
  Share2,
  Bookmark,
  Eye,
  Star,
  Plus,
  Trash2,
  FolderPlus,
  Play,
  Heart,
} from 'lucide-react';

interface MovieDetailProps {
  movieId: number;
  onClose: () => void;
}

export const MovieDetail: React.FC<MovieDetailProps> = ({ movieId, onClose }) => {
  const {
    addToWatchlist,
    setWatching,
    toggleFavorite,
    setRating,
    setReviewAndNotes,
    removeFromLibrary,
    openMovieDetail,
    showToast,
    dataVersion,
  } = useCinema();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [userData, setUserData] = useState<UserMovie | null>(null);
  const [credits, setCredits] = useState<{ cast: any[]; director?: string }>({ cast: [] });
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Editing state for personal review & notes
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Modals
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  const [isCinemaModeOpen, setIsCinemaModeOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMovie() {
      // Check local DB first
      let m = await MovieRepository.getById(movieId);
      if (!m) {
        m = await tmdbService.getMovieDetails(movieId);
        if (m) await MovieRepository.save(m);
      }

      if (!isMounted) return;
      setMovie(m || null);

      // Load user data
      const u = await UserMovieRepository.getByMovieId(movieId);
      if (isMounted) {
        setUserData(u || null);
        setNotes(u?.notes || '');
        setReview(u?.review || '');
      }

      // Load credits and similar
      tmdbService.getCredits(movieId).then((c: any) => {
        if (isMounted) setCredits(c);
      });

      tmdbService.getSimilar(movieId).then((sim: any) => {
        if (isMounted) setSimilarMovies(sim.slice(0, 10));
      });

      CollectionRepository.getAll().then((cols) => {
        if (isMounted) setCollections(cols);
      });
    }

    loadMovie();
    return () => {
      isMounted = false;
    };
  }, [movieId, dataVersion]);

  if (!movie) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#1E2029] border-t-[#EDC257] animate-spin" />
          <span className="text-xs text-[#9E9DA5] font-serif">Projecting Feature...</span>
        </div>
      </div>
    );
  }

  const backdropUrl = movie.backdropPath
    ? tmdbService.getImageUrl(movie.backdropPath, 'original')
    : null;
  const posterUrl = movie.posterPath
    ? tmdbService.getImageUrl(movie.posterPath, 'w500')
    : null;

  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';

  const handleSaveReviewAndNotes = async () => {
    setIsSavingReview(true);
    try {
      const updated = await setReviewAndNotes(movieId, { review, notes });
      setUserData(updated);
      showToast('Screening record saved to vault');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    await CollectionRepository.addMovieToCollection(collectionId, movie.id);
    setIsCollectionPickerOpen(false);
    showToast('Movie added to curated saga');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090D] select-none animate-cinema-fade">
      {/* Top Floating Cinema Navigation Header */}
      <div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-[#09090D]/90 via-[#09090D]/40 to-transparent backdrop-blur-md">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171924]/80 hover:bg-[#171924] border border-white/10 text-xs font-semibold text-[#F5F2F0] hover:text-[#EDC257] transition-all"
        >
          <ArrowLeft size={16} />
          <span>Back to Cinema</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Quick Favorite */}
          <button
            onClick={async () => {
              const updated = await toggleFavorite(movie);
              setUserData(updated);
            }}
            className={`p-2.5 rounded-xl border transition-all ${
              userData?.isFavorite
                ? 'bg-[#B81C28]/20 border-[#B81C28]/40 text-[#B81C28]'
                : 'bg-[#171924]/80 border-white/10 text-[#9E9DA5] hover:text-white'
            }`}
            title={userData?.isFavorite ? 'Favorited' : 'Favorite'}
          >
            <Heart size={16} className={userData?.isFavorite ? 'fill-[#B81C28]' : ''} />
          </button>

          {/* Share Movie Card */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="p-2.5 rounded-xl bg-[#171924]/80 hover:bg-[#171924] border border-white/10 text-[#9E9DA5] hover:text-white transition-all"
            title="Share Movie"
          >
            <Share2 size={16} />
          </button>

          {/* Remove from library if tracked */}
          {userData && (
            <button
              onClick={async () => {
                if (window.confirm(`Remove "${movie.title}" from your cinema library?`)) {
                  await removeFromLibrary(movie.id);
                  onClose();
                }
              }}
              className="p-2.5 rounded-xl bg-[#171924]/80 hover:bg-red-950/40 border border-white/10 text-[#9E9DA5] hover:text-red-400 transition-all"
              title="Remove from Library"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Hero Backdrop Banner */}
      <div className="relative h-[50vh] min-h-[360px] max-h-[540px] bg-[#09090D] overflow-hidden">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.08]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/50 to-transparent" />
      </div>

      {/* Main Details Body */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 -mt-36 sm:-mt-48 pb-32 space-y-10">
        
        {/* Top Info Grid (Poster + Core Metadata) */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          {/* Overlapping Poster Artwork with Ambient Halo */}
          <div className="w-44 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-[#171924] shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10 flex-shrink-0">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#5C5B64]">
                No Poster
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex-grow space-y-4">
            <div>
              <h1 className="font-hero-title">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-xs sm:text-sm text-[#EDC257] italic mt-1 font-serif">
                  "{movie.tagline}"
                </p>
              )}
            </div>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9E9DA5]">
              {year && <span>{year}</span>}
              {movie.runtime && <span>• {movie.runtime} min</span>}
              {credits.director && <span>• Dir: {credits.director}</span>}
              {movie.voteAverage > 0 && (
                <span className="flex items-center gap-1 text-[#EDC257] font-semibold bg-[#EDC257]/10 px-2 py-0.5 rounded-full border border-[#EDC257]/20">
                  <Star size={11} className="fill-[#EDC257]" />
                  <span>{movie.voteAverage.toFixed(1)} TMDB</span>
                </span>
              )}
            </div>

            {/* Genre Chips */}
            {movie.genres && (
              <div className="flex flex-wrap gap-1.5">
                {movie.genres.map((g) => (
                  <span
                    key={g.id}
                    className="px-2.5 py-0.5 rounded-full bg-[#171924] border border-white/5 text-[11px] text-[#9E9DA5]"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Desktop Action Buttons Row */}
            <div className="hidden sm:flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setIsCinemaModeOpen(true)}
                className="cinema-button-primary px-5 py-3 flex items-center gap-2 text-xs font-bold shadow-[0_4px_20px_rgba(237,194,87,0.35)]"
                title="Enter Atmospheric Cinema Mode"
              >
                <Play size={15} className="fill-[#09090D]" />
                <span>Cinema Mode</span>
              </button>

              <WatchedButton movie={movie} userData={userData || undefined} style="prominent" />

              <button
                onClick={async () => {
                  const updated = await addToWatchlist(movie);
                  setUserData(updated);
                }}
                className={`cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold ${
                  userData?.status === 'want_to_watch' ? 'border-[#EDC257] text-[#EDC257]' : ''
                }`}
              >
                <Bookmark size={15} />
                <span>
                  {userData?.status === 'want_to_watch' ? 'In Watchlist' : 'Add to Watchlist'}
                </span>
              </button>

              <button
                onClick={async () => {
                  const updated = await setWatching(movie);
                  setUserData(updated);
                }}
                className={`cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold ${
                  userData?.status === 'watching' ? 'border-[#EDC257] text-[#EDC257]' : ''
                }`}
                title="Mark as Currently Watching"
              >
                <Eye size={15} />
                <span>{userData?.status === 'watching' ? 'Watching Now' : 'Watching'}</span>
              </button>

              <button
                onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
                className="cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold"
              >
                <FolderPlus size={15} />
                <span>Add to Saga</span>
              </button>
            </div>

            {/* Add to Collection dropdown */}
            {isCollectionPickerOpen && (
              <div className="p-3 rounded-xl bg-[#171924] border border-[#EDC257]/30 shadow-2xl max-w-sm space-y-2 animate-cinema-scale">
                <span className="text-[11px] uppercase tracking-wider text-[#9E9DA5] block font-bold">
                  Select Collection
                </span>
                {collections.length === 0 ? (
                  <p className="text-xs text-[#5C5B64]">No collections created yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {collections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleAddToCollection(col.id)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#222534] text-xs text-[#9E9DA5] hover:text-[#F5F2F0] flex items-center justify-between cursor-pointer border-none bg-transparent"
                      >
                        <span>{col.name}</span>
                        <Plus size={13} className="text-[#EDC257]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overview & Synopsis */}
        {movie.overview && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-[#EDC257] font-bold">
              SYNOPSIS
            </h3>
            <p className="text-sm text-[#F5F2F0]/85 leading-relaxed max-w-3xl">
              {movie.overview}
            </p>
          </div>
        )}

        {/* Personal Cinema Journal Card (Score, Notes, Review) */}
        <div className="p-6 rounded-2xl bg-[#171924]/70 border border-white/[0.08] space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-[#F5F2F0]">
                Personal Screening Record
              </h3>
              <p className="text-xs text-[#9E9DA5]">
                {userData?.watchedAt
                  ? `Watched on ${new Date(userData.watchedAt).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}`
                  : 'Track your personal thoughts and score for this film.'}
              </p>
            </div>

            {/* Personal Rating */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9E9DA5]">Your Score:</span>
              <RatingControl
                value={userData?.personalRating || null}
                onChange={async (r) => {
                  const updated = await setRating(movieId, r);
                  setUserData(updated);
                }}
                size="md"
              />
            </div>
          </div>

          {/* Personal Review */}
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
              Personal Review
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="What did you think of the cinematography, performances, or direction?"
              className="cinema-input w-full h-24 text-xs leading-relaxed"
            />
          </div>

          {/* Private Notes */}
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
              Private Notes (Where watched, with whom, edition, etc.)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 4K Blu-ray with Sara, IMAX 70mm screening"
              className="cinema-input w-full text-xs"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveReviewAndNotes}
              disabled={isSavingReview}
              className="cinema-button-primary px-5 py-2.5 text-xs font-bold"
            >
              {isSavingReview ? 'Saving...' : 'Save Screening Record'}
            </button>
          </div>
        </div>

        {/* Cast Section */}
        {credits.cast && credits.cast.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-[#EDC257] font-bold">
              PRINCIPAL CAST
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {credits.cast.slice(0, 6).map((actor: any) => (
                <div
                  key={actor.id}
                  className="p-3 rounded-xl bg-[#171924]/50 border border-white/5 flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[#10121A] mb-2 border border-white/10">
                    {actor.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                        alt={actor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[#5C5B64]">
                        {actor.name[0]}
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-[#F5F2F0] text-xs line-clamp-1">
                    {actor.name}
                  </span>
                  <span className="text-[10px] text-[#9E9DA5] line-clamp-1">{actor.character}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Films Section */}
        {similarMovies.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-white/[0.06]">
            <h3 className="font-section-title text-[#F5F2F0]">
              Films You Might Also Like
            </h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-6 px-6 scroll-smooth">
              {similarMovies.map((sim) => (
                <MoviePoster
                  key={sim.id}
                  movie={sim}
                  onClick={() => openMovieDetail(sim.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE STICKY ACTION BAR (Section 40) respecting safe-area-inset-bottom */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#09090D]/95 backdrop-blur-2xl border-t border-white/10 flex items-center gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 8px))' }}
      >
        <div className="flex-1">
          <WatchedButton movie={movie} userData={userData || undefined} style="prominent" />
        </div>
        <button
          onClick={() => setIsCinemaModeOpen(true)}
          className="p-3.5 rounded-xl bg-white/[0.08] border border-white/10 text-[#EDC257] active:scale-95 transition-transform"
          title="Cinema Mode"
        >
          <Play size={18} className="fill-[#EDC257]" />
        </button>
      </div>

      {/* Share Modal */}
      {isShareOpen && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          movie={movie}
          userData={userData || undefined}
        />
      )}

      {/* Atmospheric Cinema Mode Modal */}
      {isCinemaModeOpen && (
        <CinemaModeModal
          movie={movie}
          userData={userData || undefined}
          onClose={() => setIsCinemaModeOpen(false)}
        />
      )}
    </div>
  );
};
