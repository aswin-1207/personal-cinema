import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, SearchX, X } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { UnifiedSearchService } from '../services/unifiedSearchService';
import { Movie } from '../types/movie';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchBar } from '../components/ui/SearchBar';
import { ChipGroup } from '../components/ui/ChipGroup';
import { MediaRail } from '../components/ui/MediaRail';
import { MediaCard, MediaListRow, isSeries } from '../components/ui/MediaCard';
import { MediaGrid, MediaGridSkeleton } from '../components/ui/MediaGrid';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useUserDataMap } from '../hooks/useUserDataMap';

const RECENT_SEARCHES_KEY = 'mycinema_recent_searches';
const DISCOVER_SCOPE_KEY = 'mycinema_discover_scope';

type Paged = { results: Movie[]; totalPages: number };
type Scope = 'all' | 'movie' | 'tv';

const fromList = (p: Promise<Movie[]>, page: number): Promise<Paged> =>
  p.then((results) => ({ results, totalPages: results.length ? Math.max(page + 1, 20) : page }));

interface CategoryDef {
  id: string;
  title: string;
  media: 'movie' | 'tv' | 'all';
  fetch: (page: number) => Promise<Paged>;
}

/** Real TMDB queries for every Discover rail (no shared fallback lists). */
export const DISCOVER_CATEGORIES: CategoryDef[] = [
  { id: 'trending', title: 'Trending movies', media: 'movie', fetch: (p) => fromList(tmdbService.getTrending('week', undefined, 'movie', p), p) },
  { id: 'series', title: 'Trending series', media: 'tv', fetch: (p) => fromList(tmdbService.getTrending('week', undefined, 'tv', p), p) },
  { id: 'popular', title: 'Popular', media: 'movie', fetch: (p) => fromList(tmdbService.getPopular(p), p) },
  { id: 'hollywood', title: 'Hollywood', media: 'movie', fetch: (p) => tmdbService.getHollywoodMovies(p) },
  { id: 'tamil', title: 'Tamil cinema', media: 'movie', fetch: (p) => tmdbService.getTamilMovies(p) },
  { id: 'indian', title: 'Indian cinema', media: 'movie', fetch: (p) => tmdbService.getRegionalIndianMovies(p) },
  { id: 'popular-series', title: 'Popular series', media: 'tv', fetch: (p) => tmdbService.getPopularSeries(p) },
  { id: 'marvel', title: 'Marvel', media: 'movie', fetch: (p) => tmdbService.getMarvelMovies(p) },
  { id: 'dc', title: 'DC', media: 'movie', fetch: (p) => tmdbService.getDCMovies(p) },
  { id: 'sony', title: 'Sony Pictures', media: 'movie', fetch: (p) => tmdbService.getSonyMovies(p) },
  { id: 'disney', title: 'Disney', media: 'movie', fetch: (p) => tmdbService.getDisneyMovies(p) },
  { id: 'fox', title: '20th Century', media: 'movie', fetch: (p) => tmdbService.getFoxMovies(p) },
  { id: 'top-series', title: 'Top rated series', media: 'tv', fetch: (p) => fromList(tmdbService.getTopRated('tv', p), p) },
  { id: 'action', title: 'Action', media: 'movie', fetch: (p) => tmdbService.getGenreMovies(28, p) },
  { id: 'horror', title: 'Horror', media: 'movie', fetch: (p) => tmdbService.getGenreMovies(27, p) },
  { id: 'scifi', title: 'Sci-Fi', media: 'movie', fetch: (p) => tmdbService.getSciFiMovies(p) },
  { id: 'crime-series', title: 'Crime & mystery series', media: 'tv', fetch: (p) => tmdbService.getCrimeThrillerSeries(p) },
  { id: 'anime', title: 'Anime series', media: 'tv', fetch: (p) => tmdbService.getAnimeSeries(p) },
];

type DiscoverParams = Parameters<typeof tmdbService.discoverPaged>[0];

interface BrowseDef {
  id: string;
  label: string;
  movie?: DiscoverParams;
  tv?: DiscoverParams;
}

/** Figma "Screening moods": each mood is a real TMDB genre query for movies and series. */
const MOODS: BrowseDef[] = [
  { id: 'mood-feel-good', label: 'Feel good', movie: { genreIds: [35], withoutGenreIds: [27, 53] }, tv: { genreIds: [35], withoutGenreIds: [80] } },
  { id: 'mood-dark', label: 'Dark', movie: { genreIds: [53, 80] }, tv: { genreIds: [80, 18] } },
  { id: 'mood-mind-bending', label: 'Mind-bending', movie: { genreIds: [878, 9648] }, tv: { genreIds: [10765, 9648] } },
  { id: 'mood-heartfelt', label: 'Heartfelt', movie: { genreIds: [18, 10749] }, tv: { genreIds: [18, 10751] } },
  { id: 'mood-epic', label: 'Epic adventure', movie: { genreIds: [12, 14] }, tv: { genreIds: [10759] } },
];

const GENRES: BrowseDef[] = [
  { id: 'genre-action', label: 'Action', movie: { genreIds: [28] }, tv: { genreIds: [10759] } },
  { id: 'genre-drama', label: 'Drama', movie: { genreIds: [18] }, tv: { genreIds: [18] } },
  { id: 'genre-comedy', label: 'Comedy', movie: { genreIds: [35] }, tv: { genreIds: [35] } },
  { id: 'genre-thriller', label: 'Thriller', movie: { genreIds: [53] } },
  { id: 'genre-horror', label: 'Horror', movie: { genreIds: [27] } },
  { id: 'genre-scifi', label: 'Sci-Fi', movie: { genreIds: [878] }, tv: { genreIds: [10765] } },
  { id: 'genre-romance', label: 'Romance', movie: { genreIds: [10749] } },
  { id: 'genre-crime', label: 'Crime', movie: { genreIds: [80] }, tv: { genreIds: [80] } },
  { id: 'genre-animation', label: 'Animation', movie: { genreIds: [16] }, tv: { genreIds: [16] } },
  { id: 'genre-documentary', label: 'Documentary', movie: { genreIds: [99] }, tv: { genreIds: [99] } },
];

const browseSupports = (b: BrowseDef, scope: Scope) => (scope === 'all' ? true : Boolean(b[scope]));

/** Builds a View-all category for a mood/genre, limited to the active Movies/Series scope. */
const toBrowseCategory = (b: BrowseDef, scope: Scope): CategoryDef => {
  const useMovie = Boolean(b.movie) && scope !== 'tv';
  const useTv = Boolean(b.tv) && scope !== 'movie';
  const media: CategoryDef['media'] = useMovie && useTv ? 'all' : useTv ? 'tv' : 'movie';
  return {
    id: b.id,
    title: b.label,
    media,
    fetch: async (page) => {
      const requests: Promise<Paged>[] = [];
      if (useMovie) requests.push(tmdbService.discoverPaged({ ...b.movie, mediaType: 'movie', voteCountGte: 200, page }));
      if (useTv) requests.push(tmdbService.discoverPaged({ ...b.tv, mediaType: 'tv', voteCountGte: 100, page }));
      const settled = await Promise.allSettled(requests);
      const ok = settled.filter((r): r is PromiseFulfilledResult<Paged> => r.status === 'fulfilled').map((r) => r.value);
      if (ok.length === 0) throw (settled[0] as PromiseRejectedResult).reason;
      const merged: Movie[] = [];
      const longest = Math.max(...ok.map((r) => r.results.length));
      for (let i = 0; i < longest; i++) ok.forEach((r) => r.results[i] && merged.push(r.results[i]));
      return { results: merged, totalPages: Math.max(...ok.map((r) => r.totalPages)) };
    },
  };
};

const BrowseChips: React.FC<{ label: string; items: BrowseDef[]; scope: Scope; size: 'lg' | 'sm'; onPick: (id: string) => void }> = ({
  label,
  items,
  scope,
  size,
  onPick,
}) => {
  const id = `discover-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="space-y-2.5">
      <h2 id={id} className="font-section-title">
        {label}
      </h2>
      <ul className="flex gap-2 overflow-x-auto no-scrollbar bleed-x rail-x pb-0.5">
        {items
          .filter((b) => browseSupports(b, scope))
          .map((b) => (
            <li key={b.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(b.id)}
                className={
                  size === 'lg'
                    ? 'min-h-11 px-4 rounded-full bg-surface-2 border border-line text-[12px] font-bold uppercase tracking-wider text-text hover:border-gold/60 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold'
                    : 'min-h-9 px-3.5 rounded-full border border-line text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-text hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold'
                }
              >
                {b.label}
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
};

const MIN_RAIL = 8;

/**
 * A rail that fetches when it nears the viewport. Titles already shown by an
 * earlier rail are skipped (registry = id → rail index) to limit repetition.
 */
const LazyRail: React.FC<{
  def: CategoryDef;
  index: number;
  registry: Map<number, number>;
  userDataMap: ReturnType<typeof useUserDataMap>;
  offline: boolean;
  eager?: boolean;
}> = ({ def, index, registry, userDataMap, offline, eager }) => {
  const { setActiveSub } = useCinema();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(Boolean(eager));
  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const unique: Movie[] = [];
        const take = (list: Movie[]) => {
          for (const m of list) {
            const owner = registry.get(m.id);
            if ((owner === undefined || owner === index) && !unique.some((u) => u.id === m.id)) unique.push(m);
          }
        };
        const first = await def.fetch(1);
        take(first.results);
        if (unique.length < MIN_RAIL && first.totalPages > 1) take((await def.fetch(2)).results);
        const final = unique.length >= 4 ? unique : first.results;
        final.forEach((m) => registry.set(m.id, index));
        if (alive) setItems(final.slice(0, 20));
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, def, index, registry, attempt]);

  return (
    <div ref={ref} className="min-h-[60px]">
      <MediaRail
        title={def.title}
        items={items}
        userDataMap={userDataMap}
        loading={loading}
        error={error}
        offline={offline}
        onRetry={() => setAttempt((a) => a + 1)}
        onViewAll={() => setActiveSub(def.id)}
        hideWhenEmpty={!loading && !error}
        priority={eager}
      />
    </div>
  );
};

/** "View all" page for a single category, with explicit Load more paging. */
const CategoryPage: React.FC<{ def: CategoryDef }> = ({ def }) => {
  const { goBack, dataVersion, isOnline } = useCinema();
  const userDataMap = useUserDataMap(dataVersion);
  const [items, setItems] = useState<Movie[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      setError(false);
      try {
        const res = await def.fetch(next);
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...res.results.filter((m) => !seen.has(m.id))];
        });
        setPage(next);
        setTotalPages(res.totalPages);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [def]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title={def.title}
        subtitle={def.media === 'tv' ? 'Series' : def.media === 'all' ? 'Movies & series' : 'Movies'}
        onBack={goBack}
        backLabel="Back to Discover"
      />
      {items.length === 0 && loading ? (
        <MediaGridSkeleton />
      ) : items.length === 0 && error ? (
        <ErrorState offline={!isOnline} onRetry={() => load(1)} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" description="TMDB returned no titles for this category." />
      ) : (
        <>
          <MediaGrid>
            {items.map((m, i) => (
              <MediaCard key={m.id} movie={m} userData={userDataMap.get(m.id)} priority={i < 6} />
            ))}
          </MediaGrid>
          {error && <ErrorState compact offline={!isOnline} onRetry={() => load(page + 1)} />}
          {page < totalPages && !error && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" isLoading={loading} onClick={() => load(page + 1)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const Discover: React.FC = () => {
  const { isOnline, dataVersion, activeSub, setActiveSub } = useCinema();
  const userDataMap = useUserDataMap(dataVersion);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  // Discover remounts on every route change; keep the Movies/Series choice for the tab session.
  const [scope, setScopeState] = useState<Scope>(() => {
    const saved = sessionStorage.getItem(DISCOVER_SCOPE_KEY);
    return saved === 'movie' || saved === 'tv' ? saved : 'all';
  });
  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    try {
      sessionStorage.setItem(DISCOVER_SCOPE_KEY, next);
    } catch {
      /* storage disabled */
    }
  }, []);
  const [results, setResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOffline, setSearchOffline] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const latestSeq = useRef(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const remember = useCallback((term: string) => {
    if (term.length < 2) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        /* storage full or disabled */
      }
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setSearchOffline(false);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setSearching(true);
    setSearchError(null);
    setSearchPage(1);
    UnifiedSearchService.searchLocal(debounced)
      .then((local) => alive && setResults(local))
      .catch(() => {});
    UnifiedSearchService.searchUnified(debounced, { signal: controller.signal })
      .then((res) => {
        if (!alive || res.sequenceId < latestSeq.current) return;
        latestSeq.current = res.sequenceId;
        setResults(res.merged);
        setSearchOffline(res.isOffline);
        setSearchTotal(res.totalPages);
        setSearchError(res.tmdbError ? res.tmdbError : null);
        remember(debounced);
      })
      .catch(() => alive && setSearchError('Search failed'))
      .finally(() => alive && setSearching(false));
    return () => {
      alive = false;
      controller.abort();
    };
  }, [debounced, retryKey, remember]);

  useEffect(() => {
    if (isOnline && searchOffline) setRetryKey((k) => k + 1);
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreResults = async () => {
    if (loadingMore || searchPage >= searchTotal) return;
    setLoadingMore(true);
    try {
      const next = searchPage + 1;
      const res = await UnifiedSearchService.searchTMDB(debounced, { page: next });
      setResults((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...res.results.filter((m) => !seen.has(m.id))];
      });
      setSearchPage(next);
      setSearchTotal(res.totalPages);
    } catch {
      setSearchError('Could not load more results');
    } finally {
      setLoadingMore(false);
    }
  };

  const scopedResults = useMemo(
    () => (scope === 'all' ? results : results.filter((m) => (scope === 'tv' ? isSeries(m) : !isSeries(m)))),
    [results, scope]
  );
  const resultCounts = useMemo(() => {
    const tv = results.filter(isSeries).length;
    return { all: results.length, movie: results.length - tv, tv };
  }, [results]);

  const visibleCategories = useMemo(
    () => DISCOVER_CATEGORIES.filter((c) => scope === 'all' || c.media === scope),
    [scope]
  );
  // A fresh registry per scope so dedupe follows the visible rail order.
  const registry = useMemo(() => new Map<number, number>(), [scope]);

  const category = useMemo(() => {
    if (!activeSub) return undefined;
    const rail = DISCOVER_CATEGORIES.find((c) => c.id === activeSub);
    if (rail) return rail;
    // Browse routes carry their scope ("genre-drama~movie") because the page remounts on navigation.
    const [browseId, browseScope = 'all'] = activeSub.split('~') as [string, Scope?];
    const browse = [...MOODS, ...GENRES].find((b) => b.id === browseId);
    return browse ? toBrowseCategory(browse, browseSupports(browse, browseScope) ? browseScope : 'all') : undefined;
  }, [activeSub]);
  const openBrowse = (id: string) => setActiveSub(scope === 'all' ? id : `${id}~${scope}`);
  if (category) return <CategoryPage def={category} />;

  const isSearchMode = query.trim().length > 0;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Discover" subtitle="Find your next movie or series." />

      <SearchBar
        size="lg"
        value={query}
        onChange={setQuery}
        label="Search movies and series"
        placeholder="Search movies & series"
        isLoading={searching}
      />

      <ChipGroup<Scope>
        label="Show"
        value={scope}
        onChange={setScope}
        options={
          isSearchMode && debounced
            ? [
                { value: 'all', label: 'All', count: resultCounts.all },
                { value: 'movie', label: 'Movies', count: resultCounts.movie },
                { value: 'tv', label: 'Series', count: resultCounts.tv },
              ]
            : [
                { value: 'all', label: 'All' },
                { value: 'movie', label: 'Movies' },
                { value: 'tv', label: 'Series' },
              ]
        }
      />

      {!isSearchMode && recent.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bleed-x rail-x">
          <Clock size={14} className="text-subtle shrink-0" aria-hidden="true" />
          {recent.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className="shrink-0 min-h-9 px-3 rounded-full bg-surface border border-line text-[12px] text-muted hover:text-text"
            >
              {term}
            </button>
          ))}
          <button
            type="button"
            onClick={clearRecent}
            aria-label="Clear recent searches"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-subtle hover:text-text"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {!isSearchMode && (
        <>
          <BrowseChips label="Screening moods" items={MOODS} scope={scope} size="lg" onPick={openBrowse} />
          <BrowseChips label="Genres" items={GENRES} scope={scope} size="sm" onPick={openBrowse} />
        </>
      )}

      {isSearchMode ? (
        <section aria-label="Search results" aria-busy={searching} className="space-y-3">
          {searchOffline && results.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted">Offline — showing titles saved on this device.</p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="shrink-0 min-h-9 px-3 rounded-full text-[12px] font-semibold text-gold hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Retry
              </button>
            </div>
          )}
          {searchError && results.length === 0 && !searching ? (
            <ErrorState
              title="Search failed"
              description={!isOnline ? 'You are offline. Saved titles are still searchable.' : 'Check your connection and try again.'}
              offline={!isOnline}
              onRetry={() => setRetryKey((k) => k + 1)}
            />
          ) : scopedResults.length === 0 && (searching || query.trim() !== debounced) ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[100px] rounded-2xl cinema-skeleton" />
              ))}
            </div>
          ) : scopedResults.length === 0 ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title={`No results for “${debounced}”`}
              description={scope === 'all' ? 'Check the spelling or try another title.' : 'Try switching to All.'}
            />
          ) : (
            <>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {scopedResults.map((m) => (
                  <li key={m.id}>
                    <MediaListRow movie={m} userData={userDataMap.get(m.id)} />
                  </li>
                ))}
              </ul>
              {searchPage < searchTotal && !searchOffline && (
                <div className="flex justify-center pt-1">
                  <Button variant="secondary" isLoading={loadingMore} onClick={loadMoreResults}>
                    More results
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div key={scope} className="space-y-7 sm:space-y-9">
          {visibleCategories.map((def, i) => (
            <LazyRail
              key={def.id}
              def={def}
              index={i}
              registry={registry}
              userDataMap={userDataMap}
              offline={!isOnline}
              eager={i < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
};
