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
import { atmosphereService } from '../services/atmosphereService';
import { ReviewEditorModal } from '../components/review/ReviewEditorModal';
import { ReviewShareModal } from '../components/review/ReviewShareModal';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';
import { ScrollLockManager } from '../services/scrollLockManager';
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
  Layers,
  BookOpen,
  PenLine,
  Quote,
  AlertTriangle,
  EyeOff,
} from 'lucide-react';

interface MovieDetailProps {
  movieId: number;
  onClose: () => void;
}

export const MovieDetail: React.FC<MovieDetailProps> = ({ movieId, onClose }) => {
  const {
    addToWatchlist,
    setWatching,
    removeFromWatchlist,
    toggleFavorite,
    setRating,
    setReviewAndNotes,
    deleteReview,
    removeFromLibrary,
    openMovieDetail,
    openCollectionDetail,
    showToast,
    dataVersion,
  } = useCinema();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [userData, setUserData] = useState<UserMovie | null>(null);
  const [credits, setCredits] = useState<{ cast: any[]; director?: string }>({ cast: [] });
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberCollections, setMemberCollections] = useState<Collection[]>([]);

  // Editing state for personal review & notes
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Modals
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  const [isCinemaModeOpen, setIsCinemaModeOpen] = useState(false);
  const [isReviewEditorOpen, setIsReviewEditorOpen] = useState(false);
  const [isReviewShareOpen, setIsReviewShareOpen] = useState(false);
  const [revealSpoilers, setRevealSpoilers] = useState(false);

  // Lock background scroll while MovieDetail is open and support popstate/escape
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

  useEffect(() => {
    let isMounted = true;

    async function loadMovie() {
      // 1. Check local DB first and render immediately if present
      let m = await MovieRepository.getById(movieId);
      if (m && isMounted) {
        setMovie(m);
      }

      // 2. If missing or partial metadata, fetch full TMDB details
      const isPartial =
        !m ||
        !m.overview ||
        (m.mediaType === 'tv' ? !m.numberOfSeasons : !m.runtime) ||
        !m.credits;
      if (isPartial) {
        try {
          const fresh = await tmdbService.getMovieDetails(movieId);
          if (fresh) {
            m = await MovieRepository.save(fresh);
            if (isMounted) setMovie(m);
          }
        } catch {
          // Fall back to local or curated landmark if offline/network error
        }
      }

      if (!isMounted) return;
      if (m) setMovie(m);

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

      CollectionRepository.getCollectionsForMovie(movieId).then(async (colIds) => {
        if (!isMounted) return;
        const colList = await Promise.all(colIds.map((id) => CollectionRepository.getById(id)));
        setMemberCollections(colList.filter((c): c is Collection => Boolean(c)));
      });
    }

    loadMovie();
    return () => {
      isMounted = false;
    };
  }, [movieId, dataVersion]);

  if (!movie) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#1C1C24] border-t-[#E0AD52] animate-spin" />
          <span className="text-xs text-[#9E9DA5]">Projecting Feature...</span>
        </div>
      </div>
    );
  }

  const backdropUrl = tmdbService.getBackdropUrl(movie.backdropPath, 'w1280');
  const posterUrl = tmdbService.getPosterUrl(movie.posterPath, 'w500');
  const ambientGlow = atmosphereService.getArtworkAtmosphere(movie.backdropPath || movie.posterPath);

  const year = movie.releaseDate
    ? movie.releaseDate.substring(0, 4)
    : movie.firstAirDate
    ? movie.firstAirDate.substring(0, 4)
    : '';

  const handleSaveReviewAndNotes = async () => {
    setIsSavingReview(true);
    try {
      const updated = await setReviewAndNotes(movieId, { review, notes });
      setUserData(updated);
      soundService.playSubtleClick();
      hapticsService.confirm();
      showToast('Screening record saved to vault');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    await CollectionRepository.addMovieToCollection(collectionId, movie.id);
    setIsCollectionPickerOpen(false);
    soundService.playSubtleClick();
    hapticsService.confirm();
    showToast('Movie added to collection');
    // Refresh member collections
    const colIds = await CollectionRepository.getCollectionsForMovie(movie.id);
    const colList = await Promise.all(colIds.map((id) => CollectionRepository.getById(id)));
    setMemberCollections(colList.filter((c): c is Collection => Boolean(c)));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09090B] animate-cinema-fade">
      {/* Dynamic Artwork Atmosphere Ambient Halo (Section 9) */}
      <div
        className="fixed top-0 left-0 right-0 h-[65vh] pointer-events-none z-0 opacity-70 blur-[90px] transition-all duration-700"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${ambientGlow}, transparent 75%)`,
        }}
        aria-hidden="true"
      />

      {/* Top Floating Cinema Navigation Header */}
      <div className="sticky top-0 z-40 px-5 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-center justify-between bg-gradient-to-b from-[#09090B]/95 via-[#09090B]/60 to-transparent backdrop-blur-md">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#131319]/80 hover:bg-[#131319] border border-white/10 text-xs font-semibold text-[#F5F3EB] hover:text-[#E0AD52] transition-all cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Cinema</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Quick Favorite */}
          <button
            onClick={async () => {
              soundService.playFavoritePop();
              hapticsService.confirm();
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

      {/* Hero Backdrop Banner (Motion Level 2: Stagger 1) */}
      <div className="relative h-[32vh] sm:h-[40vh] md:h-[44vh] min-h-[200px] sm:min-h-[280px] max-h-[420px] bg-[#09090D] overflow-hidden motion-stagger-1">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.08]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/50 to-transparent" />
      </div>

      {/* Main Details Body */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 md:px-8 -mt-16 xs:-mt-20 sm:-mt-28 md:-mt-36 pb-28 sm:pb-32 space-y-6 sm:space-y-8">
        
        {/* Top Info Grid (Poster + Core Metadata) (Motion Level 2: Stagger 2) */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 items-start motion-stagger-2">
          {/* Overlapping Poster Artwork with Ambient Halo */}
          <div className="w-28 xs:w-36 sm:w-48 md:w-56 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-[#171924] shadow-[0_16px_40px_rgba(0,0,0,0.9)] border border-white/10 flex-shrink-0">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#5C5B64]">
                No Poster
              </div>
            )}
          </div>

          {/* Details & Actions with Strict Boundary Containment */}
          <div className="flex-grow space-y-4 min-w-0 w-full">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-hero-title break-words leading-tight" title={movie.title}>
                  {movie.title}
                </h1>
                {(movie.mediaType === 'tv' || Boolean(movie.firstAirDate) || Boolean(movie.numberOfSeasons)) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/30 uppercase tracking-wider">
                    TV SERIES
                  </span>
                )}
              </div>
              {movie.tagline && (
                <p className="text-xs sm:text-sm text-[#E0AD52]/90 italic mt-1 break-words font-normal">
                  "{movie.tagline}"
                </p>
              )}
            </div>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9E9DA5]">
              {year && <span>{year}</span>}
              {movie.mediaType === 'tv' || Boolean(movie.firstAirDate) || Boolean(movie.numberOfSeasons) ? (
                <>
                  {movie.numberOfSeasons && (
                    <span>• {movie.numberOfSeasons} {movie.numberOfSeasons === 1 ? 'Season' : 'Seasons'}</span>
                  )}
                  {movie.numberOfEpisodes && <span>• {movie.numberOfEpisodes} Episodes</span>}
                  {movie.createdByName && <span>• Creator: {movie.createdByName}</span>}
                  {movie.networks && movie.networks.length > 0 && (
                    <span>• {movie.networks.map((n) => n.name).join(', ')}</span>
                  )}
                </>
              ) : (
                <>
                  {movie.runtime && <span>• {movie.runtime} min</span>}
                  {credits.director && <span>• Dir: {credits.director}</span>}
                </>
              )}
              {movie.voteAverage > 0 && (
                <span className="flex items-center gap-1 text-[#E0AD52] font-semibold bg-[#E0AD52]/10 px-2 py-0.5 rounded-full border border-[#E0AD52]/20">
                  <Star size={11} className="fill-[#E0AD52]" />
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

            {/* In Collections Membership Chips (Section 31 & 33) */}
            {memberCollections.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#9E9DA5] mr-1">
                  In Collections:
                </span>
                {memberCollections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => {
                      onClose();
                      openCollectionDetail(col.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#171924] border border-white/10 hover:border-[#E0AD52]/50 text-[11px] text-[#F5F3EB] hover:text-[#E0AD52] transition-colors cursor-pointer flex items-center gap-1.5"
                    title={`View ${col.name} collection`}
                  >
                    <Layers size={11} className="text-[#E0AD52]" />
                    <span>{col.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Desktop Action Buttons Row */}
            <div className="hidden sm:flex flex-wrap items-center gap-3 pt-2">
              <WatchedButton movie={movie} userData={userData || undefined} style="prominent" />

              <button
                onClick={async () => {
                  if (userData?.status === 'want_to_watch') {
                    await removeFromWatchlist(movie.id);
                    const updated = await UserMovieRepository.getByMovieId(movie.id);
                    setUserData(updated || null);
                  } else {
                    const updated = await addToWatchlist(movie);
                    setUserData(updated);
                  }
                }}
                className={`cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold ${
                  userData?.status === 'want_to_watch' ? 'border-[#E0AD52] text-[#E0AD52]' : ''
                }`}
                title={userData?.status === 'want_to_watch' ? 'Remove from Watchlist' : 'Add to Watchlist'}
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
                  userData?.status === 'watching' ? 'border-[#E0AD52] text-[#E0AD52]' : ''
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

              <button
                onClick={() => setIsCinemaModeOpen(true)}
                className="cinema-button-secondary px-4 py-3 flex items-center gap-2 text-xs font-semibold text-[#9E9DA5] hover:text-[#E0AD52]"
                title="Atmospheric Cinema Ambient View"
              >
                <Play size={14} className="fill-current" />
                <span>Atmospheric Mode</span>
              </button>
            </div>

            {/* Add to Collection dropdown */}
            {isCollectionPickerOpen && (
              <div className="p-3 rounded-xl bg-[#171924] border border-[#E0AD52]/30 shadow-2xl max-w-sm space-y-2 animate-cinema-scale">
                <span className="text-[11px] uppercase tracking-wider text-[#9E9DA5] block font-bold">
                  Select Collection
                </span>
                {collections.length === 0 ? (
                  <p className="text-xs text-[#5C5B64]">No collections created yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {collections.map((col) => {
                      const isAlreadyInCol = memberCollections.some((mc) => mc.id === col.id);
                      return (
                        <button
                          key={col.id}
                          onClick={() => {
                            if (!isAlreadyInCol) handleAddToCollection(col.id);
                          }}
                          disabled={isAlreadyInCol}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between border-none transition-colors ${
                            isAlreadyInCol
                              ? 'bg-transparent text-[#63626B] cursor-default'
                              : 'hover:bg-[#222534] text-[#9E9DA5] hover:text-[#F5F2F0] cursor-pointer bg-transparent'
                          }`}
                        >
                          <span className="truncate pr-2">{col.name}</span>
                          {isAlreadyInCol ? (
                            <span className="text-[10px] text-[#E0AD52] flex-shrink-0">In Collection</span>
                          ) : (
                            <Plus size={13} className="text-[#E0AD52] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Overview & Synopsis */}
        {movie.overview && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-[#E0AD52] font-bold">
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
              <h3 className="font-semibold text-lg text-[#F5F2F0] flex items-center gap-2">
                <BookOpen size={18} className="text-[#E0AD52]" />
                <span>Personal Screening Record</span>
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

          {/* Written Film Reflection / Review */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold flex items-center gap-1.5">
                <span>Personal Reflection</span>
                {userData?.hasSpoilers && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono flex items-center gap-1">
                    <AlertTriangle size={10} /> Spoilers
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                {userData?.review && (
                  <>
                    <button
                      onClick={() => setIsReviewShareOpen(true)}
                      className="text-xs text-[#9E9DA5] hover:text-[#E0AD52] transition-colors flex items-center gap-1 border-none bg-transparent cursor-pointer"
                      title="Share Review"
                    >
                      <Share2 size={13} />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete this review text? Your watched status and rating will be preserved.')) {
                          await deleteReview(movieId);
                          const u = await UserMovieRepository.getByMovieId(movieId);
                          if (u) {
                            setUserData(u);
                            setReview('');
                          }
                        }
                      }}
                      className="text-xs text-[#9E9DA5] hover:text-red-400 transition-colors flex items-center gap-1 border-none bg-transparent cursor-pointer"
                      title="Delete Review"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsReviewEditorOpen(true)}
                  className="cinema-button-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 font-semibold"
                >
                  <PenLine size={13} className="text-[#E0AD52]" />
                  <span>{userData?.review ? 'Edit Reflection' : 'Write Reflection'}</span>
                </button>
              </div>
            </div>

            {userData?.review ? (
              <div className="p-4 rounded-xl bg-[#10121A] border border-white/[0.06] space-y-2.5">
                {userData.reviewTitle && (
                  <h4 className="font-semibold text-base text-[#F5F2F0] flex items-center gap-2">
                    <Quote size={15} className="text-[#E0AD52] flex-shrink-0" />
                    <span>{userData.reviewTitle}</span>
                  </h4>
                )}

                {userData.hasSpoilers && !revealSpoilers ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <AlertTriangle size={14} />
                      <span>This reflection contains spoilers.</span>
                    </div>
                    <button
                      onClick={() => setRevealSpoilers(true)}
                      className="text-xs font-semibold text-[#E0AD52] hover:underline border-none bg-transparent cursor-pointer flex items-center gap-1"
                    >
                      <Eye size={12} /> Reveal
                    </button>
                  </div>
                ) : (
                  <div>
                    {userData.hasSpoilers && (
                      <div className="flex justify-end mb-1">
                        <button
                          onClick={() => setRevealSpoilers(false)}
                          className="text-[11px] text-[#9E9DA5] hover:text-[#F5F2F0] border-none bg-transparent cursor-pointer flex items-center gap-1"
                        >
                          <EyeOff size={11} /> Hide Spoilers
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-[#F5F2F0]/90 leading-relaxed whitespace-pre-wrap font-normal">
                      {userData.review}
                    </p>
                  </div>
                )}

                {userData.reviewedAt && (
                  <div className="text-[11px] text-[#9E9DA5] pt-1 border-t border-white/[0.04]">
                    Recorded on {new Date(userData.reviewedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5C5B64] italic">
                No written reflection added yet. Click &ldquo;Write Reflection&rdquo; to record your thoughts.
              </p>
            )}
          </div>

          {/* Private Notes (Where watched, with whom, edition, etc.) */}
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
              Private Notes (Screen format, theater, companions)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 4K Blu-ray with Sara, IMAX 70mm screening"
                className="cinema-input flex-1 text-xs"
              />
              <button
                onClick={handleSaveReviewAndNotes}
                disabled={isSavingReview}
                className="cinema-button-secondary px-4 py-2 text-xs font-bold sm:w-auto w-full"
              >
                {isSavingReview ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>

        {/* Cast Section */}
        {credits.cast && credits.cast.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-[#E0AD52] font-bold">
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
            <div className="flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain no-scrollbar pb-2.5 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 scroll-smooth">
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

      {/* MOBILE STICKY ACTION BAR respecting safe-area-inset-bottom */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#09090B]/95 backdrop-blur-2xl border-t border-white/10 flex items-center gap-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 8px))' }}
      >
        <div className="flex-1 min-w-0">
          <WatchedButton movie={movie} userData={userData || undefined} style="prominent" />
        </div>
        <button
          onClick={async () => {
            soundService.playSubtleClick();
            hapticsService.confirm();
            if (userData?.status === 'want_to_watch') {
              await removeFromWatchlist(movie.id);
              const updated = await UserMovieRepository.getByMovieId(movie.id);
              setUserData(updated || null);
            } else {
              const updated = await addToWatchlist(movie);
              setUserData(updated);
            }
          }}
          className={`p-3.5 rounded-xl border active:scale-95 transition-all cursor-pointer flex-shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center ${
            userData?.status === 'want_to_watch'
              ? 'bg-[#E0AD52]/20 border-[#E0AD52] text-[#E0AD52]'
              : 'bg-white/[0.08] border-white/10 text-[#9E9DA5] hover:text-[#F5F3EB]'
          }`}
          title={userData?.status === 'want_to_watch' ? 'In Watchlist' : 'Add to Watchlist'}
          aria-label={userData?.status === 'want_to_watch' ? 'In Watchlist' : 'Add to Watchlist'}
        >
          <Bookmark size={18} className={userData?.status === 'want_to_watch' ? 'fill-[#E0AD52]' : ''} />
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

      {/* Review & Reflection Editor Modal */}
      {isReviewEditorOpen && (
        <ReviewEditorModal
          isOpen={isReviewEditorOpen}
          onClose={() => setIsReviewEditorOpen(false)}
          movie={movie}
          initialUserData={userData}
          onSaved={async () => {
            const u = await UserMovieRepository.getByMovieId(movieId);
            if (u) {
              setUserData(u);
              setReview(u.review || '');
              setNotes(u.notes || '');
            }
          }}
        />
      )}

      {/* Dedicated Review Share Modal */}
      {isReviewShareOpen && (
        <ReviewShareModal
          isOpen={isReviewShareOpen}
          onClose={() => setIsReviewShareOpen(false)}
          item={{ movie, userData: userData || undefined }}
        />
      )}
    </div>
  );
};
