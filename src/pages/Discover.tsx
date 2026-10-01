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
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : ['Interstellar', 'The Dark Knight', 'Oppenheimer', 'Dune'];
    } catch {
      return ['Interstellar', 'The Dark Knight', 'Oppenheimer', 'Dune'];
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

  // Perform search (Local Catalog + TMDB fallback)
  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    if (debouncedQuery) {
      recordRecentSearch(debouncedQuery);

      // 1. Instant local search (Layer 1)
      UnifiedSearchService.searchLocal(debouncedQuery).then((localMatches) => {
        if (!isCancelled) {
          setSearchResults(localMatches);
          setLocalMatchCount(localMatches.length);
        }
      });

      // 2. Full unified search (Layer 1 + Layer 2)
      setIsSearching(true);
      UnifiedSearchService.searchUnified(debouncedQuery, { signal: controller.signal })
        .then((res) => {
          if (!isCancelled && !controller.signal.aborted) {
            setSearchResults(res.merged);
            setLocalMatchCount(res.localResults.length);
            setIsSearchOffline(res.isOffline);
          }
        })
        .catch(() => {
          // Local results already displayed
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
    }

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [debouncedQuery]);

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

  return (
    <div className="pb-32 space-y-9 select-none animate-cinema-fade">
      {/* Streaming Discovery Header */}
      <CinemaHeader
        badge="STREAMING & DISCOVERY"
        title="Explore World Cinema"
        subtitle="Search across the comprehensive global movie archive, or immerse yourself in curated streaming rails."
      />

      {/* Cinema Search Console */}
      <div className="w-full max-w-2xl space-y-3">
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search by title, director, character, or universe..."
        />

        {/* Recent Search Chips (when query is empty) */}
        {!query && recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#9E9DA5]">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#63626B]">
              <Clock size={12} />
              <span>Recent:</span>
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleSelectRecentSearch(term)}
                className="px-3 py-1 rounded-full bg-[#131319] hover:bg-[#1C1C24] text-[#F5F3EB] border border-white/[0.08] hover:border-[#E0AD52]/40 text-xs transition-all cursor-pointer active:scale-95"
              >
                {term}
              </button>
            ))}
            <button
              onClick={clearRecentSearches}
              className="text-[11px] text-[#63626B] hover:text-[#9E9DA5] hover:underline cursor-pointer border-none bg-transparent ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

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

          {isSearching && searchResults.length === 0 ? (
            <LoadingState count={8} layout="grid" />
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon={Film}
              badge="SEARCH ARCHIVE"
              title="No Films Found"
              description={`We couldn't locate any movies matching "${query}". Try searching by title, franchise, or character.`}
              actionText="Reset Search"
              onAction={() => setQuery('')}
            />
          ) : (
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
          )}
        </section>
      ) : (
        /* =========================================================================
           11 STREAMING RAILS (Confidence of Netflix-style rails, MyCinema soul)
           ========================================================================= */
        <div className="space-y-12">
          {/* 1. TRENDING NOW (with Today / This Week Toggle) */}
          <section className="space-y-3.5 relative group/rail">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-section-title text-[#F5F3EB]">
                    TRENDING NOW
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/20 uppercase tracking-wider">
                    LIVE
                  </span>
                  <span className="text-xs text-[#63626B] font-mono">
                    ({trendingMovies.length})
                  </span>
                </div>
                <p className="text-xs text-[#9E9DA5] mt-0.5">
                  Most discussed and watched worldwide
                </p>
              </div>

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
            subtitle="Films capturing worldwide audiences right now"
            badge="STREAMING"
            items={popularMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 3. SUPERHERO UNIVERSES */}
          <MoviePosterRail
            title="SUPERHERO UNIVERSES"
            subtitle="Iconic pantheons, vigilantes, and cosmic conflicts"
            badge="EXPANDED"
            items={superheroMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 4. MARVEL CINEMATIC & LEGACY */}
          <MoviePosterRail
            title="MARVEL CINEMATIC & LEGACY"
            subtitle="MCU phases, mutant sagas, and multiversal epics"
            badge="MARVEL"
            items={marvelMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 5. DC EXTENDED UNIVERSE */}
          <MoviePosterRail
            title="DC EXTENDED UNIVERSE"
            subtitle="Dark knights, gods among us, and Gotham chronicles"
            badge="DC"
            items={dcMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 6. SCI-FI LANDMARKS */}
          <MoviePosterRail
            title="SCI-FI LANDMARKS"
            subtitle="Distant galaxies, artificial minds, and mind-bending frontiers"
            badge="SCI-FI"
            items={scifiMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 7. HIGH-OCTANE ACTION */}
          <MoviePosterRail
            title="HIGH-OCTANE ACTION"
            subtitle="Visceral combat, death-defying stunts, and adrenaline rushes"
            badge="ACTION"
            items={actionMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 8. ATMOSPHERIC HORROR */}
          <MoviePosterRail
            title="ATMOSPHERIC HORROR"
            subtitle="Psychological dread, cosmic terror, and supernatural thrills"
            badge="HORROR"
            items={horrorMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 9. TAMIL CINEMA */}
          <MoviePosterRail
            title="TAMIL CINEMA"
            subtitle="Uncompromising mass blockbusters, powerhouse craft, and auteur hits"
            badge="KOLLYWOOD"
            items={tamilMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 10. INDIAN CINEMA */}
          <MoviePosterRail
            title="INDIAN CINEMA"
            subtitle="Pan-Indian spectacles, mythological epics, and regional masterpieces"
            badge="SPECTACLE"
            items={indianMovies.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />

          {/* 11. RECENT BLOCKBUSTERS */}
          <MoviePosterRail
            title="RECENT BLOCKBUSTERS"
            subtitle="Modern cinematic achievements defining the contemporary era"
            badge="MODERN HITS"
            items={recentBlockbusters.map((m) => ({
              movie: m,
              userData: userMovieMap.get(m.id),
            }))}
            onMovieClick={(m) => handleMovieClick(m)}
          />
        </div>
      )}
    </div>
  );
};
