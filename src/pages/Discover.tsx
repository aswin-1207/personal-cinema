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

type Paged = { results: Movie[]; totalPages: number };
type Scope = 'all' | 'movie' | 'tv';

const fromList = (p: Promise<Movie[]>, page: number): Promise<Paged> =>
  p.then((results) => ({ results, totalPages: results.length ? Math.max(page + 1, 20) : page }));

interface CategoryDef {
  id: string;
  title: string;
  media: 'movie' | 'tv';
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
      <PageHeader title={def.title} subtitle={def.media === 'tv' ? 'Series' : 'Movies'} onBack={goBack} backLabel="Back to Discover" />
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
  const { isOnline, dataVersion, activeSub } = useCinema();
  const userDataMap = useUserDataMap(dataVersion);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scope, setScope] = useState<Scope>('all');
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

  const category = activeSub ? DISCOVER_CATEGORIES.find((c) => c.id === activeSub) : undefined;
  if (category) return <CategoryPage def={category} />;

  const isSearchMode = query.trim().length > 0;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Discover" />

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

      {isSearchMode ? (
        <section aria-label="Search results" aria-busy={searching} className="space-y-3">
          {searchOffline && results.length > 0 && (
            <p className="text-[12px] text-muted">Offline — showing titles saved on this device.</p>
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
