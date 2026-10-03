import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Eye,
  EyeOff,
  FolderPlus,
  Heart,
  Layers,
  PenLine,
  Share2,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { tmdbService } from '../services/tmdbService';
import { Movie, UserMovie, getMediaYear } from '../types/movie';
import { Collection } from '../types/collection';
import { WatchedButton } from '../components/movie/WatchedButton';
import { RatingControl } from '../components/movie/RatingControl';
import { ShareModal } from '../components/share/ShareModal';
import { ReviewEditorModal } from '../components/review/ReviewEditorModal';
import { ReviewShareModal } from '../components/review/ReviewShareModal';
import { CollectionPickerModal } from '../components/collection/CollectionPickerModal';
import { MediaRail } from '../components/ui/MediaRail';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ErrorState, Spinner } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { isSeries } from '../components/ui/MediaCard';
import { useUserDataMap } from '../hooks/useUserDataMap';

interface MovieDetailProps {
  movieId: number;
  onClose: () => void;
}

interface CastMember {
  id: number;
  name: string;
  character?: string;
  profilePath?: string | null;
}

const formatRuntime = (min?: number | null) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Secondary action tile (Watchlist / Watching / Favorite / Share). */
const ActionTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}> = ({ icon, label, active, onClick, ariaLabel, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    aria-label={ariaLabel}
    className={`min-h-[60px] flex flex-col items-center justify-center gap-1 rounded-2xl border text-[11.5px] font-semibold transition-colors disabled:opacity-50 ${
      active ? 'bg-gold/10 border-gold/45 text-gold' : 'bg-surface border-line text-muted hover:text-text hover:border-line-strong'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export const MovieDetail: React.FC<MovieDetailProps> = ({ movieId, onClose }) => {
  const {
    addToWatchlist,
    setWatching,
    removeFromWatchlist,
    toggleFavorite,
    setRating,
    deleteReview,
    removeFromLibrary,
    openCollectionDetail,
    dataVersion,
    isOnline,
  } = useCinema();
  const userDataMap = useUserDataMap(dataVersion);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [userData, setUserData] = useState<UserMovie | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [director, setDirector] = useState<string | undefined>();
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [memberCollections, setMemberCollections] = useState<Collection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isReviewEditorOpen, setIsReviewEditorOpen] = useState(false);
  const [isReviewShareOpen, setIsReviewShareOpen] = useState(false);
  const [revealSpoilers, setRevealSpoilers] = useState(false);

  // Title metadata: local first, then TMDB when incomplete.
  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    (async () => {
      let m = await MovieRepository.getById(movieId);
      if (m && alive) setMovie(m);
      const partial = !m || !m.overview || (m.mediaType === 'tv' ? !m.numberOfSeasons : !m.runtime) || !m.credits;
      if (partial) {
        try {
          const fresh = await tmdbService.getDetails(movieId);
          if (fresh) {
            m = await MovieRepository.save(fresh);
            if (alive) setMovie(m);
          }
        } catch {
          if (alive && !m) setLoadFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [movieId, attempt]);

  // User state + collection membership refresh after every data change.
  useEffect(() => {
    let alive = true;
    UserMovieRepository.getByMovieId(movieId).then((u) => alive && setUserData(u || null));
    CollectionRepository.getCollectionsForMovie(movieId).then(async (ids) => {
      const cols = await Promise.all(ids.map((id) => CollectionRepository.getById(id)));
      if (alive) setMemberCollections(cols.filter((c): c is Collection => Boolean(c)));
    });
    return () => {
      alive = false;
    };
  }, [movieId, dataVersion]);

  // Credits + similar titles (network only; failures simply hide the sections).
  useEffect(() => {
    let alive = true;
    setSimilarLoading(true);
    tmdbService
      .getCredits(movieId)
      .then((c: any) => {
        if (!alive) return;
        setCast(
          (c?.cast || []).slice(0, 15).map((x: any) => ({
            id: x.id,
            name: x.name,
            character: x.character,
            profilePath: x.profile_path ?? x.profilePath ?? null,
          }))
        );
        setDirector(c?.director);
      })
      .catch(() => {});
    tmdbService
      .getSimilar(movieId)
      .then((sim: Movie[]) => alive && setSimilar(sim.filter((s) => s.posterPath).slice(0, 15)))
      .catch(() => alive && setSimilar([]))
      .finally(() => alive && setSimilarLoading(false));
    return () => {
      alive = false;
    };
  }, [movieId, attempt]);

  if (!movie) {
    return loadFailed ? (
      <div className="space-y-4 pt-2">
        <Button variant="ghost" icon={<ArrowLeft size={18} aria-hidden="true" />} onClick={onClose} className="-ml-3">
          Back
        </Button>
        <ErrorState
          title="Couldn't load this title"
          offline={!isOnline}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      </div>
    ) : (
      <Spinner label="Loading title" />
    );
  }

  const series = isSeries(movie);
  const status = userData?.status;
  const year = getMediaYear(movie);
  const backdropUrl = tmdbService.getBackdropUrl(movie.backdropPath, 'w1280');
  const posterUrl = tmdbService.getPosterUrl(movie.posterPath, 'w500');
  const seriesInfo = series
    ? [
        movie.numberOfSeasons ? `${movie.numberOfSeasons} season${movie.numberOfSeasons === 1 ? '' : 's'}` : '',
        movie.numberOfEpisodes ? `${movie.numberOfEpisodes} episodes` : '',
      ].filter(Boolean)
    : [];
  const metaParts = [year, series ? 'Series' : 'Movie', ...(series ? seriesInfo : [formatRuntime(movie.runtime)])].filter(Boolean);
  const genres = (movie.genres || []).filter((g) => g.name);
  const creditLine = series
    ? [
        movie.createdByName ? { label: 'Created by', value: movie.createdByName } : null,
        movie.networks?.length ? { label: 'Network', value: movie.networks.map((n) => n.name).join(', ') } : null,
      ]
    : [director ? { label: 'Director', value: director } : null];
  const credits = creditLine.filter((c): c is { label: string; value: string } => Boolean(c));
  const hasReview = Boolean(userData?.review?.trim());

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch {
      /* context shows the error toast */
    } finally {
      setBusy(null);
    }
  };

  const toggleWatchlist = () =>
    run('watchlist', () => (status === 'want_to_watch' ? removeFromWatchlist(movie.id) : addToWatchlist(movie)));
  const toggleWatching = () => run('watching', () => (status === 'watching' ? addToWatchlist(movie) : setWatching(movie)));

  return (
    <article className="pb-6">
      {/* Hero */}
      <div className="relative bleed-x -mt-[calc(env(safe-area-inset-top,0px)+12px)] md:-mt-8">
        <div className="relative h-[240px] xs:h-[280px] sm:h-[340px] lg:h-[420px] overflow-hidden bg-surface">
          {backdropUrl ? (
            <img src={backdropUrl} alt="" {...({ fetchpriority: "high" } as object)} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          ) : posterUrl ? (
            <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent hidden lg:block" aria-hidden="true" />
        </div>
        <div className="absolute top-0 inset-x-0 page-x pt-[calc(env(safe-area-inset-top,0px)+10px)] md:pt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="w-11 h-11 rounded-full bg-ink/70 border border-white/10 text-text flex items-center justify-center hover:bg-ink/90"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            aria-label={`Share ${movie.title}`}
            className="w-11 h-11 rounded-full bg-ink/70 border border-white/10 text-text flex items-center justify-center hover:bg-ink/90"
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative -mt-24 sm:-mt-32 lg:-mt-48 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        {/* Poster + title block */}
        <div className="flex gap-4 items-end lg:block">
          <div className="shrink-0 w-[108px] xs:w-[120px] sm:w-[150px] lg:w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
            {posterUrl ? (
              <img src={posterUrl} alt={`${movie.title} poster`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-end p-3 text-[13px] font-bold uppercase text-gold">{movie.title}</div>
            )}
          </div>
          <div className="min-w-0 pb-1 lg:hidden">
            <TitleBlock movie={movie} metaParts={metaParts} status={status} favorite={userData?.isFavorite} />
          </div>
        </div>

        <div className="min-w-0 space-y-7">
          <div className="hidden lg:block pt-8">
            <TitleBlock movie={movie} metaParts={metaParts} status={status} favorite={userData?.isFavorite} large />
          </div>

          {/* Primary + secondary actions */}
          <div className="space-y-2.5 max-w-xl">
            <WatchedButton movie={movie} userData={userData ?? undefined} style="prominent" className="w-full" />
            <div className="grid grid-cols-4 gap-2">
              <ActionTile
                icon={<Bookmark size={18} className={status === 'want_to_watch' ? 'fill-current' : ''} aria-hidden="true" />}
                label="Watchlist"
                active={status === 'want_to_watch'}
                disabled={busy === 'watchlist'}
                onClick={toggleWatchlist}
                ariaLabel={status === 'want_to_watch' ? 'Remove from Watchlist' : 'Add to Watchlist'}
              />
              <ActionTile
                icon={<Eye size={18} aria-hidden="true" />}
                label="Watching"
                active={status === 'watching'}
                disabled={busy === 'watching'}
                onClick={toggleWatching}
                ariaLabel={status === 'watching' ? 'Stop watching (move to Watchlist)' : 'Mark as Watching'}
              />
              <ActionTile
                icon={<Heart size={18} className={userData?.isFavorite ? 'fill-current' : ''} aria-hidden="true" />}
                label="Favorite"
                active={Boolean(userData?.isFavorite)}
                disabled={busy === 'favorite'}
                onClick={() => run('favorite', () => toggleFavorite(movie))}
                ariaLabel={userData?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              />
              <ActionTile icon={<FolderPlus size={18} aria-hidden="true" />} label="Collect" onClick={() => setIsPickerOpen(true)} ariaLabel="Add to collection" />
            </div>
          </div>

          {movie.tagline && <p className="text-[14px] italic text-muted">“{movie.tagline}”</p>}

          {movie.overview && (
            <section aria-labelledby="detail-overview" className="space-y-2 max-w-3xl">
              <SectionHeader id="detail-overview" title="Overview" />
              <p className="text-[14px] sm:text-[15px] leading-relaxed text-text/90">{movie.overview}</p>
            </section>
          )}

          {(genres.length > 0 || credits.length > 0) && (
            <div className="space-y-3">
              {genres.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Genres">
                  {genres.map((g) => (
                    <li key={g.id} className="px-3 h-8 inline-flex items-center rounded-full bg-surface border border-line text-[12px] font-medium text-muted">
                      {g.name}
                    </li>
                  ))}
                </ul>
              )}
              {credits.length > 0 && (
                <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 max-w-2xl">
                  {credits.map((c) => (
                    <div key={c.label} className="flex gap-2 min-w-0">
                      <dt className="text-subtle shrink-0">{c.label}</dt>
                      <dd className="text-text truncate">{c.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/* Your rating + review */}
          <section aria-labelledby="detail-yours" className="rounded-2xl bg-surface border border-line p-4 sm:p-5 space-y-4 max-w-3xl">
            <SectionHeader id="detail-yours" title={series ? 'Your series' : 'Your movie'} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-muted mb-1">Your rating</p>
                <RatingControl
                  value={userData?.personalRating ?? 0}
                  onChange={(r) => run('rating', () => setRating(movie.id, r === userData?.personalRating ? null : r))}
                  size={26}
                />
              </div>
              {status && status !== 'none' && (
                <button
                  type="button"
                  onClick={() => run('remove', () => removeFromLibrary(movie.id))}
                  className="min-h-10 px-3 -mr-2 rounded-full text-[12px] font-semibold text-subtle hover:text-[#F0848A] inline-flex items-center gap-1.5"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove from my lists
                </button>
              )}
            </div>

            {hasReview ? (
              <div className="rounded-xl bg-surface-2 border border-line p-3.5 space-y-2">
                {userData?.reviewTitle && <p className="text-[14px] font-semibold text-text">{userData.reviewTitle}</p>}
                {userData?.hasSpoilers && !revealSpoilers ? (
                  <button
                    type="button"
                    onClick={() => setRevealSpoilers(true)}
                    className="w-full min-h-11 rounded-lg border border-dashed border-line-strong text-[13px] text-muted inline-flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={14} className="text-gold" aria-hidden="true" />
                    Contains spoilers — tap to reveal
                  </button>
                ) : (
                  <p className="text-[14px] leading-relaxed text-text/90 whitespace-pre-line">{userData?.review}</p>
                )}
                {userData?.hasSpoilers && revealSpoilers && (
                  <button type="button" onClick={() => setRevealSpoilers(false)} className="text-[12px] text-muted inline-flex items-center gap-1 min-h-9">
                    <EyeOff size={13} aria-hidden="true" /> Hide spoilers
                  </button>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="secondary" icon={<PenLine size={14} aria-hidden="true" />} onClick={() => setIsReviewEditorOpen(true)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Share2 size={14} aria-hidden="true" />} onClick={() => setIsReviewShareOpen(true)}>
                    Share review
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => run('review', () => deleteReview(movie.id))}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" icon={<PenLine size={16} aria-hidden="true" />} onClick={() => setIsReviewEditorOpen(true)}>
                Write a review
              </Button>
            )}

            {userData?.notes && userData.notes !== userData.review && (
              <div>
                <p className="text-[12px] text-muted mb-1">Private notes</p>
                <p className="text-[13px] text-text/85 whitespace-pre-line">{userData.notes}</p>
              </div>
            )}
          </section>

          {memberCollections.length > 0 && (
            <section aria-labelledby="detail-collections" className="space-y-2">
              <SectionHeader id="detail-collections" title="In your collections" actionLabel="Manage" onAction={() => setIsPickerOpen(true)} />
              <ul className="flex flex-wrap gap-2">
                {memberCollections.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openCollectionDetail(c.id)}
                      className="min-h-10 px-3.5 rounded-full bg-surface border border-line text-[13px] font-semibold text-text hover:border-gold/50 inline-flex items-center gap-2"
                    >
                      <Layers size={14} className="text-gold" aria-hidden="true" />
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cast.length > 0 && (
            <section aria-labelledby="detail-cast" className="space-y-2 min-w-0">
              <SectionHeader id="detail-cast" title="Cast" />
              <ul className="flex gap-3 overflow-x-auto no-scrollbar bleed-x rail-x lg:mx-0 lg:px-0 pb-1">
                {cast.map((p) => {
                  const img = p.profilePath ? `https://image.tmdb.org/t/p/w185${p.profilePath}` : null;
                  return (
                    <li key={`${p.id}-${p.character}`} className="shrink-0 w-[84px] text-center">
                      <div className="w-[72px] h-[72px] mx-auto rounded-full overflow-hidden bg-surface-2 border border-line flex items-center justify-center">
                        {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" /> : <User size={24} className="text-subtle" aria-hidden="true" />}
                      </div>
                      <p className="mt-1.5 text-[12px] font-semibold text-text line-clamp-2 leading-tight">{p.name}</p>
                      {p.character && <p className="text-[11px] text-muted line-clamp-1">{p.character}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      <MediaRail
        className="mt-9"
        title={series ? 'Similar series' : 'Similar movies'}
        items={similar}
        userDataMap={userDataMap}
        loading={similarLoading}
      />

      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} movie={movie} userData={userData ?? undefined} />
      <CollectionPickerModal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} movie={movie} />
      <ReviewEditorModal
        isOpen={isReviewEditorOpen}
        onClose={() => setIsReviewEditorOpen(false)}
        movie={movie}
        initialUserData={userData}
        onSaved={() => setIsReviewEditorOpen(false)}
      />
      {userData && (
        <ReviewShareModal isOpen={isReviewShareOpen} onClose={() => setIsReviewShareOpen(false)} item={{ movie, userData }} />
      )}
    </article>
  );
};

const TitleBlock: React.FC<{
  movie: Movie;
  metaParts: string[];
  status?: UserMovie['status'];
  favorite?: boolean;
  large?: boolean;
}> = ({ movie, metaParts, status, favorite, large }) => (
  <div className="space-y-1.5">
    <h1 className={`font-bold leading-[1.1] text-text break-words ${large ? 'text-[36px] xl:text-[42px]' : 'text-[22px] xs:text-[24px] sm:text-[30px]'}`}>
      {movie.title}
    </h1>
    <p className="text-[13px] text-muted">{metaParts.join(' · ')}</p>
    <div className="flex flex-wrap items-center gap-2">
      {movie.voteAverage > 0 && (
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold">
          <Star size={13} className="fill-current" aria-hidden="true" />
          {movie.voteAverage.toFixed(1)}
          <span className="text-subtle font-normal text-[11px]">TMDB</span>
        </span>
      )}
      <StatusBadge status={status} favorite={favorite} />
    </div>
  </div>
);
