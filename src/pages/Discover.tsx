import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { Movie, UserMovie } from '../types/movie';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { UnifiedSearchService } from '../services/unifiedSearchService';
import { SEED_MOVIES } from '../data/seedCatalog';
import { MoviePoster } from '../components/movie/MoviePoster';
import { MoviePosterRail } from '../components/movie/MoviePosterRail';
import { CinemaSegmentedControl } from '../components/common/CinemaSegmentedControl';
import { CinemaButton } from '../components/common/CinemaButton';
import { CinemaHeader } from '../components/ui/CinemaHeader';
import { SearchField } from '../components/ui/SearchField';
import { MovieGrid } from '../components/ui/MovieGrid';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Film, RefreshCw, KeyRound, WifiOff, Clock } from 'lucide-react';

const RECENT_SEARCHES_KEY = 'mycinema_recent_searches';

type CategoryTab = 'all' | 'movies' | 'series' | 'hollywood' | 'marvel_dc' | 'studios' | 'genres';

interface ViewAllState {
  title: string;
  badge?: string;
  movies: Movie[];
  page: number;
  totalPages: number;
  fetcher: (page: number) => Promise<{ results: Movie[]; totalPages: number }>;
}

export const Discover: React.FC = () => {
  const { openMovieDetail, isOnline, dataVersion, setActiveTab } = useCinema();

  // Search State
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [localMatchCount, setLocalMatchCount] = useState(0);
  const [isSearchOffline, setIsSearchOffline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchErrorCode, setSearchErrorCode] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchTotalPages, setSearchTotalPages] = useState<number>(1);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState<boolean>(false);
  const latestSequenceRef = useRef<number>(0);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // User movie tracking map for library status
  const [userMovieMap, setUserMovieMap] = useState<Map<number, UserMovie>>(new Map());

  // Navigation Filter Pill Tab
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('all');

  // View All Modal State
  const [viewAllRail, setViewAllRail] = useState<ViewAllState | null>(null);
  const [isLoadingMoreViewAll, setIsLoadingMoreViewAll] = useState(false);

  // Discovery Feeds State
  const [trendingTime, setTrendingTime] = useState<'day' | 'week'>('week');
  const [trendingMedia, setTrendingMedia] = useState<'movie' | 'tv'>('movie');
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'trending').slice(0, 20)
  );
  const [trendingSeries, setTrendingSeries] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'recent_popular').slice(0, 20)
  );

  // Category Feed States
  const [hollywoodMovies, setHollywoodMovies] = useState<Movie[]>([]);
  const [hollywoodSeries, setHollywoodSeries] = useState<Movie[]>([]);
  const [marvelMovies, setMarvelMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => ['marvel', 'fox_marvel', 'sony_spiderman'].includes(m.seedCategory || '')).slice(0, 20)
  );
  const [marvelSeries, setMarvelSeries] = useState<Movie[]>([]);
  const [sonyMovies, setSonyMovies] = useState<Movie[]>([]);
  const [sonySeries, setSonySeries] = useState<Movie[]>([]);
  const [dcMovies, setDCMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'dc').slice(0, 20)
  );
  const [dcSeries, setDCSeries] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>(() =>
    [...SEED_MOVIES].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)).slice(0, 20)
  );
  const [topRatedSeries, setTopRatedSeries] = useState<Movie[]>([]);
  const [scifiMovies, setScifiMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.genres?.some((g) => g.id === 878)).slice(0, 20)
  );
  const [crimeSeries, setCrimeSeries] = useState<Movie[]>([]);
  const [animeSeries, setAnimeSeries] = useState<Movie[]>([]);
  const [regionalMovies, setRegionalMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'indian_cinema').slice(0, 20)
  );
  const [tamilMovies, setTamilMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.franchiseTags?.some((t) => t.toLowerCase() === 'tamil')).slice(0, 20)
  );

  const [isLoadingPrimary, setIsLoadingPrimary] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 240);
    return () => clearTimeout(timer);
  }, [query]);

  // Load user data map for library badges
  useEffect(() => {
    UserMovieRepository.getAll().then((list) => {
      const map = new Map(list.map((um) => [um.movieId, um]));
      setUserMovieMap(map);
    });
  }, [dataVersion]);

  // Progressive Feed Loading
  const loadDiscoveryFeeds = useCallback(async () => {
    setFetchError(null);
    setIsLoadingPrimary(true);

    try {
      // 1. Trending Movies / Series
      if (trendingMedia === 'movie') {
        tmdbService.getTrending(trendingTime, (fresh) => {
          if (fresh && fresh.length > 0) setTrendingMovies(fresh);
        }, 'movie').then((list) => {
          if (list && list.length > 0) setTrendingMovies(list);
        }).catch(() => {});
      } else {
        tmdbService.getTrending(trendingTime, (fresh) => {
          if (fresh && fresh.length > 0) setTrendingSeries(fresh);
        }, 'tv').then((list) => {
          if (list && list.length > 0) setTrendingSeries(list);
        }).catch(() => {});
      }

      // 2. Primary Hollywood Movies & Series (Sections 6 & 7)
      tmdbService.getHollywoodMovies(1).then((res) => {
        if (res.results.length > 0) setHollywoodMovies(res.results);
      }).catch(() => {});

      tmdbService.getHollywoodSeries(1).then((res) => {
        if (res.results.length > 0) setHollywoodSeries(res.results);
      }).catch(() => {});

      // 3. Marvel Movies & Marvel Series (Sections 8 & 9)
      tmdbService.getMarvelMovies(1).then((res) => {
        if (res.results.length > 0) setMarvelMovies(res.results);
      }).catch(() => {});

      tmdbService.getMarvelSeries(1).then((res) => {
        if (res.results.length > 0) setMarvelSeries(res.results);
      }).catch(() => {});

      // 4. Sony Movies & Series (Section 10)
      tmdbService.getSonyMovies(1).then((res) => {
        if (res.results.length > 0) setSonyMovies(res.results);
      }).catch(() => {});

      tmdbService.getSonySeries(1).then((res) => {
        if (res.results.length > 0) setSonySeries(res.results);
      }).catch(() => {});

      // 5. Popular Movies
      tmdbService.getPopular(1, (fresh) => {
        if (fresh && fresh.length > 0) setPopularMovies(fresh);
      }, 'movie').then((list) => {
        if (list && list.length > 0) setPopularMovies(list);
      }).catch(() => {});

      // 6. DC Universe Movies & Series
      tmdbService.getDCMovies(1).then((res) => {
        if (res.results.length > 0) setDCMovies(res.results);
      }).catch(() => {});

      tmdbService.getDCSeries(1).then((res) => {
        if (res.results.length > 0) setDCSeries(res.results);
      }).catch(() => {});

      // 7. Top Rated Masterpieces (Movies & Series)
      tmdbService.getTopRated('movie', 1).then((list) => {
        if (list.length > 0) setTopRatedMovies(list);
      }).catch(() => {});

      tmdbService.getTopRated('tv', 1).then((list) => {
        if (list.length > 0) setTopRatedSeries(list);
      }).catch(() => {});

      // 8. Specialized Rails: Crime, Anime, Sci-Fi, Regional
      tmdbService.getCrimeThrillerSeries(1).then((res) => {
        if (res.results.length > 0) setCrimeSeries(res.results);
      }).catch(() => {});

      tmdbService.getAnimeSeries(1).then((res) => {
        if (res.results.length > 0) setAnimeSeries(res.results);
      }).catch(() => {});

      tmdbService.getSciFiMovies(1).then((res) => {
        if (res.results.length > 0) setScifiMovies(res.results);
      }).catch(() => {});

      tmdbService.getRegionalIndianMovies(1).then((res) => {
        if (res.results.length > 0) setRegionalMovies(res.results);
      }).catch(() => {});

      tmdbService.getTamilMovies(1).then((res) => {
        if (res.results.length > 0) setTamilMovies(res.results);
      }).catch(() => {});

    } catch (err) {
      console.warn('Discovery feeds background sync notice:', err);
      setFetchError('Unable to sync live TMDB feeds. Showing cached vault.');
    } finally {
      setIsLoadingPrimary(false);
    }
  }, [trendingTime, trendingMedia]);

  useEffect(() => {
    loadDiscoveryFeeds();
  }, [loadDiscoveryFeeds, isOnline]);

  // Save query to recent searches
  const recordRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Perform multi-search (Both Movies and TV Series with canonical deduplication)
  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    if (debouncedQuery) {
      recordRecentSearch(debouncedQuery);
      setIsSearching(true);
      setSearchError(null);
      setSearchErrorCode(null);
      setSearchPage(1);

      // 1. Instant local search preview
      UnifiedSearchService.searchLocal(debouncedQuery).then((localMatches) => {
        if (!isCancelled && !controller.signal.aborted) {
          setSearchResults(localMatches);
          setLocalMatchCount(localMatches.length);
        }
      });

      // 2. Full unified search (Both Movies & TV Series)
      UnifiedSearchService.searchUnified(debouncedQuery, { signal: controller.signal })
        .then((res) => {
          if (isCancelled || controller.signal.aborted) return;
          if (res.sequenceId < latestSequenceRef.current) return;
          latestSequenceRef.current = res.sequenceId;

          setSearchResults(res.merged);
          setLocalMatchCount(res.localResults.length);
          setIsSearchOffline(res.isOffline);
          setSearchTotalPages(res.totalPages);
          if (res.tmdbError) {
            setSearchError(res.tmdbError);
            setSearchErrorCode(res.errorCode);
          }
        })
        .catch((err: any) => {
          if (!isCancelled && !controller.signal.aborted) {
            setSearchError(err?.message || 'Search request failed');
            setSearchErrorCode('NETWORK_ERROR');
          }
        })
        .finally(() => {
          if (!isCancelled && !controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    } else {
      setSearchResults([]);
      setLocalMatchCount(0);
      setIsSearching(false);
      setIsSearchOffline(false);
      setSearchError(null);
      setSearchErrorCode(null);
      setSearchPage(1);
      setSearchTotalPages(1);
    }

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [debouncedQuery]);

  // Pagination for search results
  const handleLoadMoreSearch = async () => {
    if (isLoadingMoreSearch || searchPage >= searchTotalPages || !debouncedQuery) return;
    setIsLoadingMoreSearch(true);

    try {
      const nextPage = searchPage + 1;
      const res = await UnifiedSearchService.searchTMDB(debouncedQuery, { page: nextPage });
      if (res.results.length > 0) {
        setSearchResults((prev) => {
          const map = new Map<number, Movie>();
          prev.forEach((m) => map.set(m.id, m));
          res.results.forEach((m) => {
            if (!map.has(m.id)) map.set(m.id, m);
          });
          return Array.from(map.values());
        });
        setSearchPage(nextPage);
        setSearchTotalPages(res.totalPages);
      }
    } catch (err: any) {
      console.warn('Load more search failed:', err);
    } finally {
      setIsLoadingMoreSearch(false);
    }
  };

  // Pagination for "View All" modal
  const handleLoadMoreViewAll = async () => {
    if (!viewAllRail || isLoadingMoreViewAll || viewAllRail.page >= viewAllRail.totalPages) return;
    setIsLoadingMoreViewAll(true);

    try {
      const nextPage = viewAllRail.page + 1;
      const res = await viewAllRail.fetcher(nextPage);
      if (res.results.length > 0) {
        setViewAllRail((prev) => {
          if (!prev) return null;
          const map = new Map<number, Movie>();
          prev.movies.forEach((m) => map.set(m.id, m));
          res.results.forEach((m) => {
            if (!map.has(m.id)) map.set(m.id, m);
          });
          return {
            ...prev,
            movies: Array.from(map.values()),
            page: nextPage,
            totalPages: res.totalPages,
          };
        });
      }
    } catch (err) {
      console.warn('View all pagination failed:', err);
    } finally {
      setIsLoadingMoreViewAll(false);
    }
  };

  const handleMovieClick = async (movie: Movie) => {
    await UnifiedSearchService.ensureCanonicalMovie(movie);
    openMovieDetail(movie.id);
  };

  const handleSelectRecentSearch = (term: string) => {
    setQuery(term);
  };

  // Helper to open View All with full pagination capability
  const openViewAll = (
    title: string,
    badge: string,
    initialItems: Movie[],
    fetcher: (page: number) => Promise<{ results: Movie[]; totalPages: number }>
  ) => {
    setViewAllRail({
      title,
      badge,
      movies: initialItems,
      page: 1,
      totalPages: 10,
      fetcher,
    });
  };

  // Deduping filter across consecutive rails to eliminate repeat movies
  const dedupeRails = useMemo(() => {
    const seen = new Set<number>();
    const filterSeen = (items: Movie[]) => {
      return items.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    };

    return {
      trending: filterSeen(trendingMedia === 'movie' ? trendingMovies : trendingSeries),
      hollywoodMovies: filterSeen(hollywoodMovies),
      hollywoodSeries: filterSeen(hollywoodSeries),
      marvelMovies: filterSeen(marvelMovies),
      marvelSeries: filterSeen(marvelSeries),
      sonyMovies: filterSeen(sonyMovies),
      sonySeries: filterSeen(sonySeries),
      dcMovies: filterSeen(dcMovies),
      dcSeries: filterSeen(dcSeries),
      topRatedMovies: filterSeen(topRatedMovies),
      topRatedSeries: filterSeen(topRatedSeries),
      popularMovies: filterSeen(popularMovies),
      crimeSeries: filterSeen(crimeSeries),
      animeSeries: filterSeen(animeSeries),
      scifiMovies: filterSeen(scifiMovies),
      regionalMovies: filterSeen(regionalMovies),
      tamilMovies: filterSeen(tamilMovies),
    };
  }, [
    trendingMedia,
    trendingMovies,
    trendingSeries,
    hollywoodMovies,
    hollywoodSeries,
    marvelMovies,
    marvelSeries,
    sonyMovies,
    sonySeries,
    dcMovies,
    dcSeries,
    topRatedMovies,
    topRatedSeries,
    popularMovies,
    crimeSeries,
    animeSeries,
    scifiMovies,
    regionalMovies,
    tamilMovies,
  ]);

  return (
    <div className="pb-6 space-y-4 sm:space-y-6 animate-cinema-fade">
      {/* Streaming Discovery Header */}
      <CinemaHeader
        badge="DISCOVERY"
        title="Discover"
      />

      {/* Cinema Search Console */}
      <div className="w-full space-y-2.5">
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search movies, TV series, Marvel, anime, directors..."
        />

        {/* Recent Search Chips */}
        {!query && recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-[#9E9DA5]">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#63626B]">
              <Clock size={11} />
              <span>Recent:</span>
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleSelectRecentSearch(term)}
                className="px-2.5 py-0.5 rounded-full bg-[#131319] hover:bg-[#1C1C24] text-[#F5F3EB] border border-white/[0.08] hover:border-[#E0AD52]/40 text-xs transition-all cursor-pointer active:scale-95"
              >
                {term}
              </button>
            ))}
            <button
              onClick={clearRecentSearches}
              className="text-[10px] text-[#63626B] hover:text-[#9E9DA5] hover:underline cursor-pointer border-none bg-transparent ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Category Navigation Pills (when not actively searching) */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-y py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All Feeds' },
            { id: 'movies', label: 'Movies' },
            { id: 'series', label: 'TV Series' },
            { id: 'hollywood', label: 'Hollywood' },
            { id: 'marvel_dc', label: 'Marvel & DC' },
            { id: 'studios', label: 'Studios' },
            { id: 'genres', label: 'Genres' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryTab(tab.id as CategoryTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border min-h-[36px] ${
                categoryTab === tab.id
                  ? 'bg-[#E0AD52] text-[#09090B] border-[#E0AD52] shadow-[0_2px_12px_rgba(224,173,82,0.3)] font-bold'
                  : 'bg-[#131319] text-[#9E9DA5] hover:text-[#F5F3EB] border-white/[0.08] hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Network Notice */}
      {fetchError && !query && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div>
            <div className="font-bold text-amber-300">TMDB Connection Notice</div>
            <p className="text-[11px] text-amber-200/80 mt-0.5">{fetchError}</p>
          </div>
          <div className="flex gap-2">
            <CinemaButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={12} />}
              onClick={loadDiscoveryFeeds}
            >
              Retry
            </CinemaButton>
            <CinemaButton
              variant="ghost"
              size="sm"
              icon={<KeyRound size={12} />}
              onClick={() => setActiveTab('profile')}
            >
              Settings
            </CinemaButton>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ACTIVE SEARCH RESULTS VIEW */}
      {/* ===================================================================== */}
      {query ? (
        <section className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="font-section-title text-[#F5F3EB]">
                Results for "{query}"
              </h2>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                {isSearching
                  ? 'Searching movies and TV series across archive...'
                  : searchError && searchResults.length === 0
                  ? 'Connection error reaching catalog'
                  : `${searchResults.length} titles found ${
                      localMatchCount > 0
                        ? `(${localMatchCount} local · ${Math.max(0, searchResults.length - localMatchCount)} TMDB)`
                        : ''
                    }`}
              </p>
            </div>

            <button
              onClick={() => setQuery('')}
              className="text-xs text-[#E0AD52] hover:text-[#D49B35] font-semibold cursor-pointer border-none bg-transparent self-start sm:self-auto"
            >
              Clear Search
            </button>
          </div>

          {isSearchOffline && (
            <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-[#9E9DA5]">
              <WifiOff size={14} className="text-amber-400" />
              <span>Offline mode active — showing results from your local catalog vault</span>
            </div>
          )}

          {searchError && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-2 text-xs text-red-300">
              <span className="truncate">
                {searchErrorCode === 'RATE_LIMITED'
                  ? 'TMDB request limit reached. Try again shortly.'
                  : searchErrorCode === 'AUTH_ERROR'
                  ? 'TMDB configuration needs attention.'
                  : isSearchOffline
                  ? 'You are offline. Showing local vault.'
                  : 'TMDB is temporarily unavailable. Showing local vault.'}
              </span>
              <button
                onClick={() => setDebouncedQuery(query.trim())}
                className="text-[11px] font-semibold text-[#E0AD52] hover:underline cursor-pointer bg-transparent border-none p-0 flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {isSearching && searchResults.length === 0 ? (
            <LoadingState count={8} layout="grid" />
          ) : searchResults.length === 0 ? (
            searchError ? (
              <EmptyState
                icon={Film}
                badge="CONNECTION NOTICE"
                title="Unable to Reach Archive"
                description={`We could not connect to search for "${query}". Please verify your network connection or tap retry.`}
                actionText="Retry Search"
                onAction={() => setDebouncedQuery(query.trim())}
              />
            ) : (
              <EmptyState
                icon={Film}
                badge="SEARCH ARCHIVE"
                title="No Titles Found"
                description={`We couldn't locate any movies or series matching "${query}". Try searching by title, actor, or creator.`}
                actionText="Reset Search"
                onAction={() => setQuery('')}
              />
            )
          ) : (
            <>
              <MovieGrid>
                {searchResults.map((movie) => (
                  <MoviePoster
                    key={movie.id}
                    movie={movie}
                    userData={userMovieMap.get(movie.id)}
                    className="w-full"
                    onClick={() => handleMovieClick(movie)}
                  />
                ))}
              </MovieGrid>

              {searchPage < searchTotalPages && (
                <div className="flex justify-center pt-4">
                  <CinemaButton
                    variant="secondary"
                    size="md"
                    onClick={handleLoadMoreSearch}
                    disabled={isLoadingMoreSearch}
                  >
                    {isLoadingMoreSearch ? 'Loading More Titles...' : 'Load More Titles'}
                  </CinemaButton>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        /* ===================================================================== */
        /* CATEGORY RAILS BROWSING VIEW */
        /* ===================================================================== */
        <div className="space-y-8 sm:space-y-10">
          {/* TAB 1: ALL FEEDS */}
          {categoryTab === 'all' && (
            <>
              {/* TRENDING NOW (Movies or TV Series Switcher) */}
              <section className="space-y-3 relative group/rail">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-section-title text-[#F5F3EB]">TRENDING NOW</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/20 uppercase tracking-wider">
                      LIVE
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Media Type Switcher: Movies vs TV */}
                    <CinemaSegmentedControl
                      size="sm"
                      options={[
                        { id: 'movie', label: 'Movies' },
                        { id: 'tv', label: 'Series' },
                      ]}
                      value={trendingMedia}
                      onChange={(val) => setTrendingMedia(val as 'movie' | 'tv')}
                    />

                    {/* Time Window Switcher: Today vs Week */}
                    <CinemaSegmentedControl
                      size="sm"
                      options={[
                        { id: 'day', label: 'Today' },
                        { id: 'week', label: 'This Week' },
                      ]}
                      value={trendingTime}
                      onChange={(val) => setTrendingTime(val as 'day' | 'week')}
                    />

                    <button
                      onClick={() =>
                        openViewAll(
                          `Trending ${trendingMedia === 'movie' ? 'Movies' : 'Series'} (${trendingTime === 'day' ? 'Today' : 'This Week'})`,
                          'TRENDING',
                          trendingMedia === 'movie' ? trendingMovies : trendingSeries,
                          (p) =>
                            tmdbService
                              .getTrending(trendingTime, undefined, trendingMedia, p)
                              .then((r) => ({ results: r, totalPages: 10 }))
                        )
                      }
                      className="text-xs text-[#E0AD52] font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 ml-1"
                    >
                      View All
                    </button>
                  </div>
                </div>

                {isLoadingPrimary && (trendingMedia === 'movie' ? trendingMovies.length === 0 : trendingSeries.length === 0) ? (
                  <LoadingState count={5} layout="rail" />
                ) : (
                  <MoviePosterRail
                    title=""
                    items={(trendingMedia === 'movie' ? dedupeRails.trending : trendingSeries).map((m) => ({
                      movie: m,
                      userData: userMovieMap.get(m.id),
                    }))}
                    onMovieClick={(m) => handleMovieClick(m)}
                  />
                )}
              </section>

              {/* HOLLYWOOD MOVIES (Section 6) */}
              <MoviePosterRail
                title="HOLLYWOOD MOVIES"
                badge="HOLLYWOOD"
                subtitle="Top releases & iconic cinematic features"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Hollywood Movies',
                    'HOLLYWOOD',
                    hollywoodMovies,
                    (p) => tmdbService.getHollywoodMovies(p)
                  )
                }
                items={dedupeRails.hollywoodMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* HOLLYWOOD SERIES (Section 7) */}
              <MoviePosterRail
                title="HOLLYWOOD SERIES"
                badge="SERIES"
                subtitle="Acclaimed television & streaming productions"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Hollywood Series',
                    'SERIES',
                    hollywoodSeries,
                    (p) => tmdbService.getHollywoodSeries(p)
                  )
                }
                items={dedupeRails.hollywoodSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* MARVEL MOVIES (Section 8) */}
              <MoviePosterRail
                title="MARVEL MOVIES"
                badge="MARVEL"
                subtitle="Marvel Cinematic Universe, Sony, & legacy comic adaptations"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Marvel Movies',
                    'MARVEL',
                    marvelMovies,
                    (p) => tmdbService.getMarvelMovies(p)
                  )
                }
                items={dedupeRails.marvelMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* MARVEL SERIES (Section 9) */}
              <MoviePosterRail
                title="MARVEL SERIES"
                badge="SERIES"
                subtitle="Disney+, Netflix Marvel, animation & television sagas"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Marvel Series',
                    'MARVEL SERIES',
                    marvelSeries,
                    (p) => tmdbService.getMarvelSeries(p)
                  )
                }
                items={dedupeRails.marvelSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* SONY MOVIES (Section 10) */}
              <MoviePosterRail
                title="SONY PICTURES & COLUMBIA"
                badge="SONY"
                subtitle="Sony Pictures, Columbia, TriStar, & animation"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Sony Pictures Movies',
                    'SONY',
                    sonyMovies,
                    (p) => tmdbService.getSonyMovies(p)
                  )
                }
                items={dedupeRails.sonyMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* TOP RATED SERIES */}
              <MoviePosterRail
                title="TOP RATED TV SERIES"
                badge="CRITICS CHOICE"
                subtitle="Highest rated television & mini-series masterpieces"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Top Rated Series',
                    'CRITICS CHOICE',
                    topRatedSeries,
                    (p) => tmdbService.getTopRated('tv', p).then((r) => ({ results: r, totalPages: 10 }))
                  )
                }
                items={dedupeRails.topRatedSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* REGIONAL INDIAN PAN-CINEMA */}
              <MoviePosterRail
                title="INDIAN PAN-CINEMA"
                badge="INDIAN"
                subtitle="Blockbusters across Hindi, Tamil, Telugu, and Malayalam"
                actionLabel="View All"
                onAction={() =>
                  openViewAll(
                    'Indian Pan-Cinema',
                    'INDIAN',
                    regionalMovies,
                    (p) => tmdbService.getRegionalIndianMovies(p)
                  )
                }
                items={dedupeRails.regionalMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 2: MOVIES */}
          {categoryTab === 'movies' && (
            <>
              <MoviePosterRail
                title="HOLLYWOOD MOVIES"
                badge="HOLLYWOOD"
                subtitle="Broad cinematic releases from major American studios"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Hollywood Movies', 'HOLLYWOOD', hollywoodMovies, (p) =>
                    tmdbService.getHollywoodMovies(p)
                  )
                }
                items={dedupeRails.hollywoodMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="POPULAR RIGHT NOW"
                badge="POPULAR"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Popular Right Now', 'POPULAR', popularMovies, (p) =>
                    tmdbService.getPopular(p, undefined, 'movie').then((r) => ({ results: r, totalPages: 10 }))
                  )
                }
                items={dedupeRails.popularMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="MARVEL MOVIES"
                badge="MARVEL"
                subtitle="MCU, Spider-Verse, & Marvel superhero features"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Marvel Movies', 'MARVEL', marvelMovies, (p) => tmdbService.getMarvelMovies(p))
                }
                items={dedupeRails.marvelMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="SONY PICTURES"
                badge="SONY"
                subtitle="Columbia Pictures & Sony Pictures films"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Sony Pictures', 'SONY', sonyMovies, (p) => tmdbService.getSonyMovies(p))
                }
                items={dedupeRails.sonyMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC EXTENDED UNIVERSE"
                badge="DC"
                subtitle="Batman, Superman, and DC Comics features"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('DC Universe Movies', 'DC', dcMovies, (p) => tmdbService.getDCMovies(p))
                }
                items={dedupeRails.dcMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="SCI-FI LANDMARKS"
                badge="SCI-FI"
                subtitle="Mind-bending science fiction milestones"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Sci-Fi Landmarks', 'SCI-FI', scifiMovies, (p) => tmdbService.getSciFiMovies(p))
                }
                items={dedupeRails.scifiMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="CRITICALLY ACCLAIMED"
                badge="TOP RATED"
                subtitle="Highest rated films of all time"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Critically Acclaimed', 'TOP RATED', topRatedMovies, (p) =>
                    tmdbService.getTopRated('movie', p).then((r) => ({ results: r, totalPages: 10 }))
                  )
                }
                items={dedupeRails.topRatedMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 3: TV SERIES */}
          {categoryTab === 'series' && (
            <>
              <MoviePosterRail
                title="HOLLYWOOD SERIES"
                badge="SERIES"
                subtitle="Drama, crime, thriller & flagship television series"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Hollywood Series', 'SERIES', hollywoodSeries, (p) =>
                    tmdbService.getHollywoodSeries(p)
                  )
                }
                items={dedupeRails.hollywoodSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="MARVEL SERIES"
                badge="SERIES"
                subtitle="Marvel Studios television & animated shows"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Marvel Series', 'SERIES', marvelSeries, (p) => tmdbService.getMarvelSeries(p))
                }
                items={dedupeRails.marvelSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="CRIME & MYSTERY THRILLERS"
                badge="CRIME"
                subtitle="Gripping investigative police procedurals & whodunits"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Crime & Mystery Series', 'CRIME', crimeSeries, (p) =>
                    tmdbService.getCrimeThrillerSeries(p)
                  )
                }
                items={dedupeRails.crimeSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="ANIME & ANIMATION SERIES"
                badge="ANIME"
                subtitle="Acclaimed Japanese anime and international animation"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Anime Series', 'ANIME', animeSeries, (p) => tmdbService.getAnimeSeries(p))
                }
                items={dedupeRails.animeSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC UNIVERSE SERIES"
                badge="DC SERIES"
                subtitle="DC television adaptations & animated universes"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('DC Series', 'DC SERIES', dcSeries, (p) => tmdbService.getDCSeries(p))
                }
                items={dedupeRails.dcSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="TOP RATED TV SERIES"
                badge="TOP RATED"
                subtitle="Critically celebrated television sagas"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Top Rated Series', 'TOP RATED', topRatedSeries, (p) =>
                    tmdbService.getTopRated('tv', p).then((r) => ({ results: r, totalPages: 10 }))
                  )
                }
                items={dedupeRails.topRatedSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 4: HOLLYWOOD */}
          {categoryTab === 'hollywood' && (
            <>
              <MoviePosterRail
                title="HOLLYWOOD MOVIES"
                badge="HOLLYWOOD"
                subtitle="The broad world of American cinema across all genres"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Hollywood Movies', 'HOLLYWOOD', hollywoodMovies, (p) =>
                    tmdbService.getHollywoodMovies(p)
                  )
                }
                items={dedupeRails.hollywoodMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="HOLLYWOOD TV SERIES"
                badge="HOLLYWOOD SERIES"
                subtitle="Premier drama, comedy, and streaming sagas"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Hollywood Series', 'HOLLYWOOD SERIES', hollywoodSeries, (p) =>
                    tmdbService.getHollywoodSeries(p)
                  )
                }
                items={dedupeRails.hollywoodSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="SCI-FI LANDMARKS"
                badge="SCI-FI"
                subtitle="Hollywood science-fiction spectacles"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Sci-Fi Movies', 'SCI-FI', scifiMovies, (p) => tmdbService.getSciFiMovies(p))
                }
                items={dedupeRails.scifiMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 5: MARVEL & DC */}
          {categoryTab === 'marvel_dc' && (
            <>
              <MoviePosterRail
                title="MARVEL MOVIES"
                badge="MARVEL"
                subtitle="MCU, Spider-Man, Avengers, and legacy adaptations"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Marvel Movies', 'MARVEL', marvelMovies, (p) => tmdbService.getMarvelMovies(p))
                }
                items={dedupeRails.marvelMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="MARVEL SERIES"
                badge="MARVEL SERIES"
                subtitle="Loki, WandaVision, Daredevil, and animated Marvel sagas"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Marvel Series', 'MARVEL SERIES', marvelSeries, (p) => tmdbService.getMarvelSeries(p))
                }
                items={dedupeRails.marvelSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC MOVIES"
                badge="DC"
                subtitle="The Dark Knight, Man of Steel, and DC cinematic universe"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('DC Movies', 'DC', dcMovies, (p) => tmdbService.getDCMovies(p))
                }
                items={dedupeRails.dcMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC SERIES"
                badge="DC SERIES"
                subtitle="DC television universes and animated shows"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('DC Series', 'DC SERIES', dcSeries, (p) => tmdbService.getDCSeries(p))
                }
                items={dedupeRails.dcSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 6: STUDIOS */}
          {categoryTab === 'studios' && (
            <>
              <MoviePosterRail
                title="SONY PICTURES & COLUMBIA"
                badge="SONY"
                subtitle="Columbia Pictures, TriStar, and Sony Animation"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Sony Pictures Movies', 'SONY', sonyMovies, (p) => tmdbService.getSonyMovies(p))
                }
                items={dedupeRails.sonyMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="MARVEL STUDIOS"
                badge="MARVEL"
                subtitle="Marvel comic adaptations & cinematic universe"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Marvel Studios', 'MARVEL', marvelMovies, (p) => tmdbService.getMarvelMovies(p))
                }
                items={dedupeRails.marvelMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC ENTERTAINMENT"
                badge="DC"
                subtitle="DC Universe productions"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('DC Entertainment', 'DC', dcMovies, (p) => tmdbService.getDCMovies(p))
                }
                items={dedupeRails.dcMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* TAB 7: GENRES */}
          {categoryTab === 'genres' && (
            <>
              <MoviePosterRail
                title="SCI-FI LANDMARKS"
                badge="SCI-FI"
                subtitle="Interstellar, Dune, The Matrix, and speculative futures"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Sci-Fi Movies', 'SCI-FI', scifiMovies, (p) => tmdbService.getSciFiMovies(p))
                }
                items={dedupeRails.scifiMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="CRIME & MYSTERY SERIES"
                badge="CRIME"
                subtitle="Dark thrillers, detectives, and suspense sagas"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Crime Series', 'CRIME', crimeSeries, (p) => tmdbService.getCrimeThrillerSeries(p))
                }
                items={dedupeRails.crimeSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="ANIME & ANIMATION"
                badge="ANIME"
                subtitle="Epic Japanese series and stylized animation"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Anime Series', 'ANIME', animeSeries, (p) => tmdbService.getAnimeSeries(p))
                }
                items={dedupeRails.animeSeries.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="INDIAN PAN-CINEMA"
                badge="REGIONAL"
                subtitle="Action spectacles and cinematic epics from India"
                actionLabel="View All"
                onAction={() =>
                  openViewAll('Indian Cinema', 'REGIONAL', regionalMovies, (p) =>
                    tmdbService.getRegionalIndianMovies(p)
                  )
                }
                items={dedupeRails.regionalMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW ALL CATEGORY MODAL WITH PROGRESSIVE LOAD MORE PAGINATION */}
      {/* ===================================================================== */}
      {viewAllRail && (
        <Modal
          isOpen={Boolean(viewAllRail)}
          onClose={() => setViewAllRail(null)}
          title={viewAllRail.title}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#9E9DA5] pb-1 border-b border-white/[0.06]">
              <span>
                {viewAllRail.movies.length} {viewAllRail.movies.length === 1 ? 'title' : 'titles'} discovered
              </span>
              {viewAllRail.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/30 uppercase tracking-wider">
                  {viewAllRail.badge}
                </span>
              )}
            </div>

            <MovieGrid>
              {viewAllRail.movies.map((movie) => (
                <MoviePoster
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  className="w-full"
                  onClick={() => {
                    setViewAllRail(null);
                    handleMovieClick(movie);
                  }}
                />
              ))}
            </MovieGrid>

            {viewAllRail.page < viewAllRail.totalPages && (
              <div className="flex justify-center pt-3 pb-2">
                <CinemaButton
                  variant="secondary"
                  size="md"
                  onClick={handleLoadMoreViewAll}
                  disabled={isLoadingMoreViewAll}
                >
                  {isLoadingMoreViewAll ? 'Discovering More Titles...' : 'Discover More Titles'}
                </CinemaButton>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
