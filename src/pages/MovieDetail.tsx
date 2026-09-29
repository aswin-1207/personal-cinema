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
import { MovieCard } from '../components/movie/MovieCard';
import { CinemaModeModal } from '../components/cinema/CinemaModeModal';
import {
  ArrowLeft,
  Share2,
  Heart,
  Bookmark,
  Eye,
  Star,
  Plus,
  Trash2,
  FolderPlus,
  Play,
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
      <div className="fixed inset-0 z-50 bg-cinema-black/95 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mb-3" />
      </div>
    );
  }

  const handleSaveReviewAndNotes = async () => {
    setIsSavingReview(true);
    try {
      const updated = await setReviewAndNotes(movieId, { review, notes });
      setUserData(updated);
      showToast('Review and notes saved.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    await CollectionRepository.addMovieToCollection(collectionId, movieId);
    showToast('Movie added to collection.');
    setIsCollectionPickerOpen(false);
  };

  const handleRemoveFromCinema = async () => {
    if (confirm(`Remove "${movie.title}" from your library?`)) {
      await removeFromLibrary(movieId);
      showToast('Movie removed from library.');
      onClose();
    }
  };

  const backdropUrl = movie.backdropPath
    ? tmdbService.getImageUrl(movie.backdropPath, 'original')
    : null;
  const posterUrl = movie.posterPath
    ? tmdbService.getImageUrl(movie.posterPath, 'w500')
    : null;
  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';

  return (
    <div className="fixed inset-0 z-50 bg-cinema-black overflow-y-auto no-scrollbar animate-fade-in">
      {/* Top Floating Navigation */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-cinema-black/70 backdrop-blur-md border-b border-white/5">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-xs font-semibold text-cinema-silver hover:text-cinema-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {movie && (
            <button
              onClick={() => setIsShareOpen(true)}
              className="p-2 rounded-xl bg-cinema-surface/70 hover:bg-cinema-surface border border-white/10 text-cinema-silver hover:text-cinema-white transition-colors"
              title="Share Movie Card"
            >
              <Share2 size={16} />
            </button>
          )}

          {movie && (
            <button
              onClick={async () => {
                const updated = await toggleFavorite(movie);
                setUserData(updated);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                userData?.isFavorite
                  ? 'bg-cinema-crimson/20 border-cinema-crimson/50 text-cinema-crimson'
                  : 'bg-cinema-surface/70 hover:bg-cinema-surface border-white/10 text-cinema-silver hover:text-cinema-white'
              }`}
              title="Favorite"
            >
              <Heart size={16} className={userData?.isFavorite ? 'fill-cinema-crimson' : ''} />
            </button>
          )}

          {userData && (
            <button
              onClick={handleRemoveFromCinema}
              className="p-2 rounded-xl bg-cinema-surface/70 hover:bg-cinema-surface border border-white/10 text-cinema-subtle hover:text-cinema-crimson transition-colors"
              title="Remove from Library"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Hero Backdrop Banner */}
      <div className="relative h-[48vh] min-h-[340px] max-h-[500px] bg-cinema-black overflow-hidden">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-cinema-black/40 to-transparent" />
      </div>

      {/* Main Details Body */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 -mt-36 sm:-mt-48 pb-20 space-y-10">
        {/* Top Info Grid (Poster + Core Metadata) */}
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          {/* Poster */}
          <div className="w-44 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-cinema-charcoal shadow-2xl border border-white/10 flex-shrink-0">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-cinema-subtle">
                No Poster
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex-grow space-y-4">
            <div>
              <h1 className="font-serif font-extrabold text-3xl sm:text-4xl text-cinema-white tracking-tight">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-xs sm:text-sm text-cinema-gold italic mt-1 font-serif">
                  "{movie.tagline}"
                </p>
              )}
            </div>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-cinema-silver">
              {year && <span>{year}</span>}
              {movie.runtime && <span>• {movie.runtime} min</span>}
              {credits.director && <span>• Dir: {credits.director}</span>}
              {movie.voteAverage > 0 && (
                <span className="flex items-center gap-1 text-cinema-gold font-semibold">
                  <Star size={13} className="fill-cinema-gold" />
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
                    className="px-2.5 py-0.5 rounded-full bg-cinema-surface border border-white/5 text-[11px] text-cinema-silver"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setIsCinemaModeOpen(true)}
                className="cinema-button-primary px-4 py-3 flex items-center gap-2 text-xs font-semibold shadow-gold"
                title="Enter Atmospheric Cinema Mode"
              >
                <Play size={15} className="fill-cinema-black" />
                <span>Cinema Mode</span>
              </button>

              <WatchedButton movie={movie} userData={userData || undefined} style="prominent" />

              <button
                onClick={async () => {
                  const updated = await addToWatchlist(movie);
                  setUserData(updated);
                }}
                className={`cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold ${
                  userData?.status === 'want_to_watch' ? 'border-cinema-gold text-cinema-gold' : ''
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
                  userData?.status === 'watching' ? 'border-cinema-gold text-cinema-gold' : ''
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
                <span>Add to Collection</span>
              </button>
            </div>

            {/* Add to Collection dropdown */}
            {isCollectionPickerOpen && (
              <div className="p-3 rounded-xl bg-cinema-surface border border-cinema-gold/30 shadow-2xl max-w-sm space-y-2 animate-scale-in">
                <span className="text-[11px] uppercase tracking-wider text-cinema-subtle block font-semibold">
                  Select Collection
                </span>
                {collections.length === 0 ? (
                  <p className="text-xs text-cinema-subtle">No collections created yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {collections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleAddToCollection(col.id)}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cinema-charcoal text-xs text-cinema-silver hover:text-cinema-white flex items-center justify-between"
                      >
                        <span>{col.name}</span>
                        <Plus size={13} className="text-cinema-gold" />
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
            <h3 className="text-xs uppercase tracking-wider text-cinema-subtle font-semibold">
              Synopsis
            </h3>
            <p className="text-sm text-cinema-silver leading-relaxed max-w-3xl">
              {movie.overview}
            </p>
          </div>
        )}

        {/* Personal Cinema Journal Card (Rating, Notes, Review, Rewatches) */}
        <div className="p-6 rounded-2xl bg-cinema-surface/60 border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-cinema-white">
                Personal Screening Record
              </h3>
              <p className="text-xs text-cinema-subtle">
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
              <span className="text-xs text-cinema-subtle">Your Score:</span>
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
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle font-medium">
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
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle font-medium">
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
              className="cinema-button-primary px-5 py-2 text-xs font-semibold"
            >
              {isSavingReview ? 'Saving...' : 'Save Screening Record'}
            </button>
          </div>
        </div>

        {/* Cast Section */}
        {credits.cast && credits.cast.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider text-cinema-subtle font-semibold">
              Top Cast
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {credits.cast.slice(0, 6).map((actor: any) => (
                <div
                  key={actor.id}
                  className="p-3 rounded-xl bg-cinema-surface/40 border border-white/5 flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-cinema-charcoal mb-2 border border-white/10">
                    {actor.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                        alt={actor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-cinema-subtle">
                        {actor.name[0]}
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-cinema-white text-xs line-clamp-1">
                    {actor.name}
                  </span>
                  <span className="text-[10px] text-cinema-subtle line-clamp-1">{actor.character}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Films */}
        {similarMovies.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-xs uppercase tracking-wider text-cinema-subtle font-semibold">
              Films You Might Also Like
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {similarMovies.map((sim) => (
                <MovieCard key={sim.id} movie={sim} onClick={() => openMovieDetail(sim.id)} />
              ))}
            </div>
          </div>
        )}
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
