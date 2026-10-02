import React, { useState, useEffect, useMemo } from 'react';
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
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const latestSequenceRef = React.useRef<number>(0);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Discovery feeds
  const [trendingTime, setTrendingTime] = useState<'day' | 'week'>('week');
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'trending').slice(0, 20)
  );
  const [popularMovies, setPopularMovies] = useState<Movie[]>(() =>
    SEED_MOVIES.filter((m) => m.seedCategory === 'recent_popular').slice(0, 20)
  );

  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // User movie tracking map for library status
  const [userMovieMap, setUserMovieMap] = useState<Map<number, UserMovie>>(new Map());

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

  // Load live Trending and Popular data with SWR
  const loadDiscoveryData = async () => {
    setFetchError(null);
    setIsLoadingTrending(true);

    // SWR Trending
    tmdbService
      .getTrending(trendingTime, (fresh) => {
        if (fresh && fresh.length > 0) {
          setTrendingMovies(fresh);
        }
        setIsLoadingTrending(false);
      })
      .then((cachedOrFresh) => {
        if (cachedOrFresh && cachedOrFresh.length > 0) {
          setTrendingMovies(cachedOrFresh);
        }
        setIsLoadingTrending(false);
      })
      .catch((err: any) => {
        console.warn('Trending fetch warning:', err);
        setFetchError('Unable to sync live TMDB feeds. Showing cached vault.');
        setIsLoadingTrending(false);
      });

    // SWR Popular
    tmdbService
      .getPopular(1, (fresh) => {
        if (fresh && fresh.length > 0) {
          setPopularMovies(fresh);
        }
      })
      .then((cachedOrFresh) => {
        if (cachedOrFresh && cachedOrFresh.length > 0) {
          setPopularMovies(cachedOrFresh);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadDiscoveryData();
  }, [trendingTime, isOnline]);

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

  // Perform search (Local Catalog + TMDB fallback with race protection)
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

      // 2. Full unified search (Layer 1 + Layer 2)
      UnifiedSearchService.searchUnified(debouncedQuery, { signal: controller.signal })
        .then((res) => {
          if (isCancelled || controller.signal.aborted) return;
          // Discard response if a newer query was issued
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

  // Pagination: Load next page of TMDB results
  const handleLoadMore = async () => {
    if (isLoadingMore || searchPage >= searchTotalPages || !debouncedQuery) return;
    setIsLoadingMore(true);

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
      setIsLoadingMore(false);
    }
  };

  const handleMovieClick = async (movie: Movie) => {
    await UnifiedSearchService.ensureCanonicalMovie(movie);
    openMovieDetail(movie.id);
  };

  const handleSelectRecentSearch = (term: string) => {
    setQuery(term);
  };

  // =========================================================================
  // PRE-FILTERED STREAMING RAILS (Derived from SEED_MOVIES - Instant Render)
  // =========================================================================

  // 3. SUPERHERO UNIVERSES (133 movies)
  const superheroMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      [
        'marvel',
        'fox_marvel',
        'sony_spiderman',
        'marvel_legacy',
        'dc',
        'disney_superhero',
        'other_superhero',
      ].includes(m.seedCategory || '')
    ).sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
  }, []);

  // 4. MARVEL CINEMATIC & LEGACY (75 movies)
  const marvelMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      ['marvel', 'fox_marvel', 'sony_spiderman', 'marvel_legacy'].includes(m.seedCategory || '')
    ).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  }, []);

  // 5. DC EXTENDED UNIVERSE (32 movies)
  const dcMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.seedCategory === 'dc').sort(
      (a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)
    );
  }, []);

  // 6. SCI-FI LANDMARKS (104 movies)
  const scifiMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.genres?.some((g) => g.id === 878)).sort(
      (a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)
    );
  }, []);

  // 7. HIGH-OCTANE ACTION (177 movies)
  const actionMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.genres?.some((g) => g.id === 28)).sort(
      (a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)
    );
  }, []);

  // 8. ATMOSPHERIC HORROR (24 movies)
  const horrorMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.genres?.some((g) => g.id === 27)).sort(
      (a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)
    );
  }, []);

  // 9. TAMIL CINEMA (16 blockbusters)
  const tamilMovies = useMemo(() => {
    return SEED_MOVIES.filter(
      (m) =>
        m.seedCategory === 'indian_cinema' &&
        m.franchiseTags?.some((t) => t.toLowerCase() === 'tamil') &&
        m.title !== 'Drunken Master Su Qier'
    ).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  }, []);

  // 10. INDIAN CINEMA (49 movies)
  const indianMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.seedCategory === 'indian_cinema').sort(
      (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')
    );
  }, []);

  // 11. RECENT BLOCKBUSTERS (28 movies)
  const recentBlockbusters = useMemo(() => {
    return SEED_MOVIES.filter((m) => m.seedCategory === 'recent_popular').sort(
      (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')
    );
  }, []);

  const topRatedMovies = useMemo(() => {
    return [...SEED_MOVIES].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
  }, []);

  const nolanMovies = useMemo(() => {
    const titles = ['Oppenheimer', 'Interstellar', 'Inception', 'The Dark Knight', 'Tenet', 'Dunkirk', 'Memento', 'The Prestige', 'Batman Begins', 'The Dark Knight Rises'];
    return SEED_MOVIES.filter((m) => titles.includes(m.title));
  }, []);

  const vijayMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      ['Leo', 'Master', 'Varisu', 'Beast', 'Mersal', 'Sarkar', 'Theri', 'Ghilli', 'Pokkiri'].some((t) => m.title.includes(t)) ||
      m.credits?.cast?.some((c: any) => c.name?.toLowerCase().includes('vijay'))
    );
  }, []);

  const rajiniMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      ['Jailer', 'Kabali', 'Petta', 'Darbar', 'Enthiran', 'Sivaji', 'Baashha', 'Vettaiyan'].some((t) => m.title.includes(t)) ||
      m.credits?.cast?.some((c: any) => c.name?.toLowerCase().includes('rajinikanth'))
    );
  }, []);

  const kamalMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      ['Vikram', 'Indian', 'Nayagan', 'Anbe Sivam', 'Hey Ram', 'Kalki'].some((t) => m.title.includes(t)) ||
      m.credits?.cast?.some((c: any) => c.name?.toLowerCase().includes('kamal haasan'))
    );
  }, []);

  const ajithMovies = useMemo(() => {
    return SEED_MOVIES.filter((m) =>
      ['Thunivu', 'Valimai', 'Viswasam', 'Mankatha', 'Billa', 'Vedalam', 'Vivegam'].some((t) => m.title.includes(t)) ||
      m.credits?.cast?.some((c: any) => c.name?.toLowerCase().includes('ajith'))
    );
  }, []);

  const [categoryTab, setCategoryTab] = useState<'all' | 'regional' | 'genres' | 'franchises' | 'stars'>('all');
  const [viewAllRail, setViewAllRail] = useState<{ title: string; movies: Movie[] } | null>(null);

  return (
    <div className="pb-6 space-y-4 sm:space-y-6 select-none animate-cinema-fade">
      {/* Streaming Discovery Header */}
      <CinemaHeader
        badge="DISCOVERY"
        title="Discover"
      />

      {/* Cinema Search Console */}
      <div className="w-full max-w-2xl space-y-2.5">
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search movies, directors, characters, or universes..."
        />

        {/* Recent Search Chips (when query is empty) */}
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

      {/* Category Switcher Pills (when not searching) */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All Feeds' },
            { id: 'regional', label: 'Regional Cinema' },
            { id: 'genres', label: 'Genres' },
            { id: 'franchises', label: 'Franchises' },
            { id: 'stars', label: 'Stars & Auteurs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryTab(tab.id as any)}
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

      {/* Network Alert (if sync error occurs) */}
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
              onClick={loadDiscoveryData}
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

      {/* ACTIVE SEARCH RESULTS VIEW */}
      {query ? (
        <section className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="font-section-title text-[#F5F3EB]">
                Results for "{query}"
              </h2>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                {isSearching
                  ? 'Searching curated local vault & TMDB global archive...'
                  : searchError && searchResults.length === 0
                  ? 'Connection error reaching movie archive'
                  : `${searchResults.length} films found ${
                      localMatchCount > 0
                        ? `(${localMatchCount} local vault · ${Math.max(0, searchResults.length - localMatchCount)} TMDB)`
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
                  ? 'TMDB rate limit reached. Showing local catalog.'
                  : searchErrorCode === 'AUTH_ERROR'
                  ? 'TMDB authentication failed. Check credentials.'
                  : 'Unable to sync with TMDB global archive. Showing local vault.'}
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
                title="Unable to Reach Movie Archive"
                description={`We could not connect to the global movie archive to search for "${query}". Please verify your network connection or tap retry.`}
                actionText="Retry Search"
                onAction={() => setDebouncedQuery(query.trim())}
              />
            ) : (
              <EmptyState
                icon={Film}
                badge="SEARCH ARCHIVE"
                title="No Films Found"
                description={`We couldn't locate any movies matching "${query}". Try searching by title, franchise, or character.`}
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
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading More Films...' : 'Load More Films'}
                  </CinemaButton>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {/* ALL FEEDS TAB */}
          {categoryTab === 'all' && (
            <>
              {/* 1. TRENDING NOW */}
              <section className="space-y-3 relative group/rail">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-section-title text-[#F5F3EB]">TRENDING NOW</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/20 uppercase tracking-wider">
                        LIVE
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setViewAllRail({ title: 'Trending Films', movies: trendingMovies })}
                      className="text-xs text-[#E0AD52] font-semibold hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      View All
                    </button>
                    <CinemaSegmentedControl
                      size="sm"
                      options={[
                        { id: 'day', label: 'Today' },
                        { id: 'week', label: 'This Week' },
                      ]}
                      value={trendingTime}
                      onChange={(val) => setTrendingTime(val as 'day' | 'week')}
                    />
                  </div>
                </div>

                {isLoadingTrending ? (
                  <LoadingState count={5} layout="rail" />
                ) : (
                  <MoviePosterRail
                    title=""
                    items={trendingMovies.map((m) => ({
                      movie: m,
                      userData: userMovieMap.get(m.id),
                    }))}
                    onMovieClick={(m) => handleMovieClick(m)}
                  />
                )}
              </section>

              {/* 2. POPULAR RIGHT NOW */}
              <MoviePosterRail
                title="POPULAR RIGHT NOW"
                badge="POPULAR"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Popular Right Now', movies: popularMovies })}
                items={popularMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* 3. TAMIL CINEMA */}
              <MoviePosterRail
                title="TAMIL CINEMA"
                badge="KOLLYWOOD"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Tamil Cinema Spotlight', movies: tamilMovies })}
                items={tamilMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* 4. SUPERHERO & FRANCHISES */}
              <MoviePosterRail
                title="SUPERHERO UNIVERSES"
                badge="FRANCHISES"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Superhero Universes', movies: superheroMovies })}
                items={superheroMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* 5. SCI-FI LANDMARKS */}
              <MoviePosterRail
                title="SCI-FI LANDMARKS"
                badge="SCI-FI"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Sci-Fi Landmarks', movies: scifiMovies })}
                items={scifiMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* 6. HIGH-OCTANE ACTION */}
              <MoviePosterRail
                title="HIGH-OCTANE ACTION"
                badge="ACTION"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Action Cinema', movies: actionMovies })}
                items={actionMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              {/* 7. CRITICALLY ACCLAIMED */}
              <MoviePosterRail
                title="CRITICALLY ACCLAIMED"
                badge="TOP RATED"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Critically Acclaimed Masterpieces', movies: topRatedMovies })}
                items={topRatedMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* REGIONAL TAB */}
          {categoryTab === 'regional' && (
            <>
              <MoviePosterRail
                title="TAMIL CINEMA (KOLLYWOOD)"
                badge="TAMIL"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Tamil Cinema', movies: tamilMovies })}
                items={tamilMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="INDIAN PAN-CINEMA"
                badge="INDIAN"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Indian Pan-Cinema', movies: indianMovies })}
                items={indianMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="HOLLYWOOD & GLOBAL BLOCKBUSTERS"
                badge="HOLLYWOOD"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Hollywood Hits', movies: recentBlockbusters })}
                items={recentBlockbusters.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* GENRES TAB */}
          {categoryTab === 'genres' && (
            <>
              <MoviePosterRail
                title="HIGH-OCTANE ACTION"
                badge="ACTION"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Action Cinema', movies: actionMovies })}
                items={actionMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="SCI-FI & SPECULATIVE"
                badge="SCI-FI"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Sci-Fi Landmarks', movies: scifiMovies })}
                items={scifiMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="ATMOSPHERIC HORROR"
                badge="HORROR"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Atmospheric Horror', movies: horrorMovies })}
                items={horrorMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="TOP RATED MASTERPIECES"
                badge="CLASSICS"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Top Rated Masterpieces', movies: topRatedMovies })}
                items={topRatedMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* FRANCHISES TAB */}
          {categoryTab === 'franchises' && (
            <>
              <MoviePosterRail
                title="MARVEL CINEMATIC & LEGACY"
                badge="MARVEL"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Marvel Cinematic & Legacy', movies: marvelMovies })}
                items={marvelMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="DC EXTENDED UNIVERSE"
                badge="DC"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'DC Extended Universe', movies: dcMovies })}
                items={dcMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />

              <MoviePosterRail
                title="SUPERHERO UNIVERSES"
                badge="SUPERHERO"
                actionLabel="View All"
                onAction={() => setViewAllRail({ title: 'Superhero Universes', movies: superheroMovies })}
                items={superheroMovies.map((m) => ({
                  movie: m,
                  userData: userMovieMap.get(m.id),
                }))}
                onMovieClick={(m) => handleMovieClick(m)}
              />
            </>
          )}

          {/* STARS & AUTEURS TAB */}
          {categoryTab === 'stars' && (
            <>
              {nolanMovies.length > 0 && (
                <MoviePosterRail
                  title="CHRISTOPHER NOLAN"
                  badge="AUTEUR"
                  actionLabel="View All"
                  onAction={() => setViewAllRail({ title: 'Christopher Nolan Filmography', movies: nolanMovies })}
                  items={nolanMovies.map((m) => ({
                    movie: m,
                    userData: userMovieMap.get(m.id),
                  }))}
                  onMovieClick={(m) => handleMovieClick(m)}
                />
              )}

              {vijayMovies.length > 0 && (
                <MoviePosterRail
                  title="THALAPATHY VIJAY"
                  badge="STAR"
                  actionLabel="View All"
                  onAction={() => setViewAllRail({ title: 'Thalapathy Vijay Spotlight', movies: vijayMovies })}
                  items={vijayMovies.map((m) => ({
                    movie: m,
                    userData: userMovieMap.get(m.id),
                  }))}
                  onMovieClick={(m) => handleMovieClick(m)}
                />
              )}

              {rajiniMovies.length > 0 && (
                <MoviePosterRail
                  title="SUPERSTAR RAJINIKANTH"
                  badge="ICON"
                  actionLabel="View All"
                  onAction={() => setViewAllRail({ title: 'Superstar Rajinikanth Highlights', movies: rajiniMovies })}
                  items={rajiniMovies.map((m) => ({
                    movie: m,
                    userData: userMovieMap.get(m.id),
                  }))}
                  onMovieClick={(m) => handleMovieClick(m)}
                />
              )}

              {kamalMovies.length > 0 && (
                <MoviePosterRail
                  title="ULAGANAYAGAN KAMAL HAASAN"
                  badge="LEGEND"
                  actionLabel="View All"
                  onAction={() => setViewAllRail({ title: 'Kamal Haasan Classics', movies: kamalMovies })}
                  items={kamalMovies.map((m) => ({
                    movie: m,
                    userData: userMovieMap.get(m.id),
                  }))}
                  onMovieClick={(m) => handleMovieClick(m)}
                />
              )}

              {ajithMovies.length > 0 && (
                <MoviePosterRail
                  title="THALA AJITH KUMAR"
                  badge="ACTION"
                  actionLabel="View All"
                  onAction={() => setViewAllRail({ title: 'Ajith Kumar Action Films', movies: ajithMovies })}
                  items={ajithMovies.map((m) => ({
                    movie: m,
                    userData: userMovieMap.get(m.id),
                  }))}
                  onMovieClick={(m) => handleMovieClick(m)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* View All Category Modal */}
      {viewAllRail && (
        <Modal
          isOpen={Boolean(viewAllRail)}
          onClose={() => setViewAllRail(null)}
          title={viewAllRail.title}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-3.5">
            <div className="text-xs text-[#9E9DA5]">
              {viewAllRail.movies.length} {viewAllRail.movies.length === 1 ? 'film' : 'films'} in this collection
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
          </div>
        </Modal>
      )}
    </div>
  );
};
