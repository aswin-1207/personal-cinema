import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Compass, Info, Star } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { tmdbService } from '../services/tmdbService';
import { Movie, MovieWithUserData, getMediaYear } from '../types/movie';
import { BrandLogo } from '../components/common/BrandLogo';
import { ProfileButton } from '../components/ui/ProfileButton';
import { MediaRail, RAIL_ITEM_WIDTH } from '../components/ui/MediaRail';
import { SectionHeader } from '../components/ui/SectionHeader';
import { CollectionCard } from '../components/ui/CollectionCard';
import { EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { WatchedButton } from '../components/movie/WatchedButton';
import { mediaTypeLabel } from '../components/ui/MediaCard';
import { useCollectionsOverview } from '../hooks/useCollectionsOverview';
import { useUserDataMap } from '../hooks/useUserDataMap';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Compact featured card: the single best answer to "what should I watch?". */
const FeaturedCard: React.FC<{ label: string; item: MovieWithUserData }> = ({ label, item }) => {
  const { openMovieDetail, addToWatchlist } = useCinema();
  const { movie, userData } = item;
  const backdrop = tmdbService.getBackdropUrl(movie.backdropPath, 'w780');
  const poster = tmdbService.getPosterUrl(movie.posterPath, 'w342');
  const status = userData?.status;
  const meta = [getMediaYear(movie), mediaTypeLabel(movie), movie.genres?.[0]?.name].filter(Boolean).join(' · ');

  return (
    <section aria-label={label} className="relative overflow-hidden rounded-[20px] border border-line bg-surface">
      {backdrop && (
        <img src={backdrop} alt="" {...({ fetchpriority: "high" } as object)} decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-45" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" aria-hidden="true" />
      <div className="relative flex gap-4 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => openMovieDetail(movie.id)}
          className="shrink-0 w-[92px] sm:w-[120px] aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-surface-2"
          aria-label={`Open ${movie.title}`}
        >
          {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
        </button>
        <div className="min-w-0 flex-1 flex flex-col">
          <span className="font-caps-label text-gold">{label}</span>
          <h2 className="mt-1 text-[20px] sm:text-[24px] font-bold leading-tight text-text line-clamp-2">{movie.title}</h2>
          <p className="mt-1 text-[12px] text-muted truncate">
            {meta}
            {movie.voteAverage > 0 && (
              <span className="text-gold">
                {' · '}
                <Star size={11} className="inline -mt-0.5 fill-current" aria-hidden="true" /> {movie.voteAverage.toFixed(1)}
              </span>
            )}
          </p>
          {movie.overview && <p className="hidden sm:block mt-2 text-[13px] text-muted line-clamp-2 max-w-xl">{movie.overview}</p>}
          <div className="mt-auto pt-3 flex flex-wrap gap-2">
            <WatchedButton movie={movie} userData={userData} style="pill" />
            {!status || status === 'none' ? (
              <Button size="sm" variant="secondary" className="min-h-10" icon={<Bookmark size={15} aria-hidden="true" />} onClick={() => addToWatchlist(movie)}>
                Watchlist
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="min-h-10" icon={<Info size={15} aria-hidden="true" />} onClick={() => openMovieDetail(movie.id)}>
                Details
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const Home: React.FC = () => {
  const { preferences, dataVersion, setActiveTab, openCollectionDetail, isOnline } = useCinema();
  const userDataMap = useUserDataMap(dataVersion);
  const { overviews } = useCollectionsOverview(dataVersion);

  const [library, setLibrary] = useState<MovieWithUserData[] | null>(null);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<Movie[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState(false);

  useEffect(() => {
    let alive = true;
    UserMovieRepository.getAllWithMovies()
      .then((rows) => alive && setLibrary(rows))
      .catch((err) => {
        console.error('Failed to load library:', err);
        if (alive) setLibrary([]);
      });
    return () => {
      alive = false;
    };
  }, [dataVersion]);

  const loadDiscovery = useCallback(() => {
    let alive = true;
    setDiscoverLoading(true);
    setDiscoverError(false);
    Promise.allSettled([tmdbService.getTrending('week', undefined, 'movie'), tmdbService.getTrending('week', undefined, 'tv')]).then(
      ([movies, series]) => {
        if (!alive) return;
        if (movies.status === 'fulfilled') setTrending(movies.value);
        if (series.status === 'fulfilled') setTrendingSeries(series.value);
        setDiscoverError(movies.status === 'rejected' && series.status === 'rejected');
        setDiscoverLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => loadDiscovery(), [loadDiscovery]);

  const sections = useMemo(() => {
    const rows = library ?? [];
    const byRecent = (key: 'watchingAt' | 'addedAt' | 'watchedAt') => (a: MovieWithUserData, b: MovieWithUserData) =>
      (b.userData?.[key] || b.userData?.addedAt || '').localeCompare(a.userData?.[key] || a.userData?.addedAt || '');
    const watching = rows.filter((r) => r.userData?.status === 'watching').sort(byRecent('watchingAt'));
    const watchlist = rows.filter((r) => r.userData?.status === 'want_to_watch').sort(byRecent('addedAt'));
    const watched = rows.filter((r) => r.userData?.status === 'watched').sort(byRecent('watchedAt'));
    return { watching, watchlist, watched };
  }, [library]);

  const featured = useMemo((): { label: string; item: MovieWithUserData } | null => {
    if (sections.watching[0]) return { label: 'Continue watching', item: sections.watching[0] };
    if (sections.watchlist[0]) return { label: 'Up next from your watchlist', item: sections.watchlist[0] };
    const pick = trending.find((m) => !userDataMap.get(m.id) || userDataMap.get(m.id)?.status === 'none');
    return pick ? { label: 'Trending this week', item: { movie: pick, userData: userDataMap.get(pick.id) } } : null;
  }, [sections, trending, userDataMap]);

  const featuredId = featured?.item.movie.id;
  const libraryIds = useMemo(() => new Set((library ?? []).map((r) => r.movie.id)), [library]);
  const freshTrending = useMemo(
    () => trending.filter((m) => m.id !== featuredId && !libraryIds.has(m.id)).slice(0, 18),
    [trending, featuredId, libraryIds]
  );
  const freshSeries = useMemo(
    () => trendingSeries.filter((m) => m.id !== featuredId && !libraryIds.has(m.id)).slice(0, 18),
    [trendingSeries, featuredId, libraryIds]
  );
  const activeCollections = useMemo(
    () => overviews.filter((o) => o.progress.total > 0).sort((a, b) => Number(a.progress.isComplete) - Number(b.progress.isComplete)).slice(0, 8),
    [overviews]
  );

  const name = preferences.displayName?.trim().split(/\s+/)[0];
  const libraryEmpty = library !== null && library.length === 0;

  return (
    <div className="space-y-7 sm:space-y-9 pb-4">
      <header className="flex items-center justify-between gap-3 md:hidden -mt-1">
        <BrandLogo variant="inside" size={24} alt="MyCinema" />
        <ProfileButton className="-mr-1.5" />
      </header>

      <div className="space-y-4">
        <h1 className="font-page-title">
          {greeting()}
          {name ? `, ${name}` : ''}.
        </h1>
        {featured ? (
          <FeaturedCard label={featured.label} item={featured.item} />
        ) : library === null || discoverLoading ? (
          <div className="h-[178px] sm:h-[220px] rounded-[20px] cinema-skeleton" aria-hidden="true" />
        ) : null}
      </div>

      {libraryEmpty && (
        <EmptyState
          compact
          icon={<Compass size={20} />}
          title="Your cinema is waiting"
          description="Save a few titles to build your watchlist."
          action={{ label: 'Discover', onClick: () => setActiveTab('discover') }}
        />
      )}

      <MediaRail
        title="Watching"
        items={sections.watching.filter((r) => r.movie.id !== featuredId).map((r) => r.movie)}
        userDataMap={userDataMap}
        onViewAll={() => setActiveTab('watchlist', 'watching')}
      />

      <MediaRail
        title="Next in your watchlist"
        items={sections.watchlist.filter((r) => r.movie.id !== featuredId).slice(0, 20).map((r) => r.movie)}
        userDataMap={userDataMap}
        onViewAll={() => setActiveTab('watchlist')}
        priority
      />

      <MediaRail
        title="Trending movies"
        items={freshTrending}
        userDataMap={userDataMap}
        loading={discoverLoading}
        error={discoverError}
        offline={!isOnline}
        onRetry={loadDiscovery}
        onViewAll={() => setActiveTab('discover')}
        hideWhenEmpty={!discoverLoading && !discoverError}
      />

      {activeCollections.length > 0 && (
        <section aria-labelledby="home-collections">
          <SectionHeader id="home-collections" title="Your collections" actionLabel="View all" onAction={() => setActiveTab('collections')} />
          <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory bleed-x rail-x pb-1">
            {activeCollections.map((o) => (
              <CollectionCard
                key={o.collection.id}
                overview={o}
                onOpen={() => openCollectionDetail(o.collection.id)}
                className="shrink-0 snap-start w-[64vw] max-w-[240px] sm:w-[240px]"
              />
            ))}
          </div>
        </section>
      )}

      <MediaRail title="Trending series" items={freshSeries} userDataMap={userDataMap} onViewAll={() => setActiveTab('discover', 'series')} />

      <MediaRail
        title="Recently watched"
        items={sections.watched.slice(0, 18).map((r) => r.movie)}
        userDataMap={userDataMap}
        onViewAll={() => setActiveTab('watched')}
      />

      <span className={`hidden ${RAIL_ITEM_WIDTH}`} aria-hidden="true" />
    </div>
  );
};
