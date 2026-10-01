import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { Movie, Genre } from '../types/movie';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { UnifiedSearchService } from '../services/unifiedSearchService';
import { MoviePoster } from '../components/movie/MoviePoster';
import { MoviePosterRail } from '../components/movie/MoviePosterRail';
import { CinemaSegmentedControl } from '../components/common/CinemaSegmentedControl';
import { CinemaButton } from '../components/common/CinemaButton';
import { CinemaHeader } from '../components/ui/CinemaHeader';
import { SearchField } from '../components/ui/SearchField';
import { FilterChips, FilterOption } from '../components/ui/FilterChips';
import { MovieGrid } from '../components/ui/MovieGrid';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Film, RefreshCw, KeyRound, Sparkles, WifiOff } from 'lucide-react';

const SCREENING_MOODS: Array<{ label: string; genreId: number }> = [
  { label: 'FEEL GOOD', genreId: 35 },
  { label: 'DARK & GRITTY', genreId: 53 },
  { label: 'EPIC & GRAND', genreId: 12 },
  { label: 'MIND-BENDING', genreId: 878 },
  { label: 'DEEP DRAMA', genreId: 18 },
  { label: 'CHILLING', genreId: 27 },
  { label: 'HIGH OCTANE', genreId: 28 },
];

export const Discover: React.FC = () => {
  const { openMovieDetail, isOnline, dataVersion, setActiveTab } = useCinema();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearchOffline, setIsSearchOffline] = useState(false);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);

  const [trendingTime, setTrendingTime] = useState<'day' | 'week'>('week');
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);

  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [userMovieMap, setUserMovieMap] = useState<Map<number, any>>(new Map());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Load user data map for library badges
  useEffect(() => {
    UserMovieRepository.getAll().then((list) => {
      const map = new Map(list.map((um) => [um.movieId, um]));
      setUserMovieMap(map);
    });
  }, [dataVersion]);

  // Load discovery data (Trending, Popular, Genres) with SWR
  const loadDiscoveryData = async () => {
    setFetchError(null);
    setIsLoadingTrending(true);
    setIsLoadingPopular(true);

    // Fetch genres
    tmdbService.getGenres().then(setGenres).catch(() => {});

    // SWR Trending
    tmdbService
      .getTrending(trendingTime, (fresh) => {
        setTrendingMovies(fresh);
        setIsLoadingTrending(false);
      })
      .then((cachedOrFresh) => {
        setTrendingMovies(cachedOrFresh);
        setIsLoadingTrending(false);
      })
      .catch((err: any) => {
        console.warn('Trending fetch error:', err);
        setFetchError('Unable to sync live TMDB feeds. Showing cached vault.');
        setIsLoadingTrending(false);
      });

    // SWR Popular
    tmdbService
      .getPopular(1, (fresh) => {
        setPopularMovies(fresh);
        setIsLoadingPopular(false);
      })
      .then((cachedOrFresh) => {
        setPopularMovies(cachedOrFresh);
        setIsLoadingPopular(false);
      })
      .catch(() => {
        setIsLoadingPopular(false);
      });
  };

  useEffect(() => {
    loadDiscoveryData();
  }, [trendingTime, isOnline]);

  // Perform search (Local Catalog + TMDB fallback) or genre discover
  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    if (debouncedQuery) {
      // 1. Instant local search (Layer 1)
      UnifiedSearchService.searchLocal(debouncedQuery).then((localMatches) => {
        if (!isCancelled) {
          setSearchResults(localMatches);
        }
      });

      // 2. Full unified search (Layer 1 + Layer 2)
      setIsSearching(true);
      UnifiedSearchService.searchUnified(debouncedQuery, { signal: controller.signal })
        .then((res) => {
          if (!isCancelled && !controller.signal.aborted) {
            setSearchResults(res.merged);
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
    } else if (selectedGenreId) {
      setIsSearching(true);
      setIsSearchOffline(false);
      tmdbService
        .discoverMovies({ with_genres: String(selectedGenreId), sort_by: 'popularity.desc' })
        .then((res: any) => {
          if (!controller.signal.aborted && !isCancelled) {
            const list = Array.isArray(res) ? res : res.results || [];
            setSearchResults(list);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && !isCancelled) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && !isCancelled) {
            setIsSearching(false);
          }
        });
    } else {
      setSearchResults([]);
      setIsSearching(false);
      setIsSearchOffline(false);
    }

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, selectedGenreId]);

  const handleMovieClick = async (movie: Movie) => {
    await UnifiedSearchService.ensureCanonicalMovie(movie);
    openMovieDetail(movie.id);
  };

  const handleSelectMood = (genreId: number) => {
    if (selectedGenreId === genreId && !query) {
      setSelectedGenreId(null);
    } else {
      setQuery('');
      setSelectedGenreId(genreId);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedGenreId(null);
  };

  const isFiltering = Boolean(query.trim() || selectedGenreId !== null);

  const genreOptions: FilterOption[] = [
    { id: 'all', label: 'ALL GENRES' },
    ...genres.map((g) => ({ id: g.id, label: g.name.toUpperCase() })),
  ];

  return (
    <div className="pb-28 space-y-8 select-none animate-cinema-fade">
      {/* Cinematic Header */}
      <CinemaHeader
        badge="DISCOVERY CONSOLE"
        title="Find your next film."
        subtitle="Search across landmark world cinema, explore curated genres, or browse trending screenings."
      />

      {/* Unified Search Console */}
      <div className="w-full max-w-2xl">
        <SearchField
          value={query}
          onChange={(val) => {
            setQuery(val);
            if (val.trim()) setSelectedGenreId(null);
          }}
          onClear={clearFilters}
          placeholder="Search by title, director, actor, or genre..."
        />
      </div>

      {/* Screening Moods */}
      {!query && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#8C7AD0]" />
              <span>Exploration Moods</span>
            </h3>
            {selectedGenreId && (
              <button
                onClick={clearFilters}
                className="text-xs text-[#E0AD52] hover:underline cursor-pointer border-none bg-transparent font-semibold"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {SCREENING_MOODS.map((mood) => {
              const isSelected = selectedGenreId === mood.genreId;
              return (
                <button
                  key={mood.genreId}
                  onClick={() => handleSelectMood(mood.genreId)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border active:scale-95 ${
                    isSelected
                      ? 'bg-[#E0AD52] text-[#09090B] border-[#E0AD52] shadow-[0_2px_14px_rgba(224,173,82,0.35)] scale-[1.02] font-bold'
                      : 'bg-[#131319] text-[#F5F3EB] border-white/[0.08] hover:border-[#E0AD52]/40 hover:bg-[#1C1C24]'
                  }`}
                >
                  {mood.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Genre Filter Scroll Strip */}
      {!query && genres.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5]">
            Genres
          </h3>
          <FilterChips
            options={genreOptions}
            selectedId={selectedGenreId || 'all'}
            onSelect={(id) => {
              if (id === 'all') setSelectedGenreId(null);
              else setSelectedGenreId(Number(id));
            }}
          />
        </section>
      )}

      {/* Network Alert (if sync error occurs) */}
      {fetchError && !isFiltering && (
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

      {/* Active Search or Mood Filter Results Grid */}
      {isFiltering ? (
        <section className="space-y-4 pt-1">
          <SectionHeader
            title={query ? `Search: "${query}"` : 'Curated Mood Selection'}
            count={searchResults.length}
            actionLabel="Clear Filter"
            onAction={clearFilters}
          />

          {isSearchOffline && (
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-[#9E9DA5]">
              <WifiOff size={14} className="text-amber-400" />
              <span>Offline mode — showing matches from your local catalog</span>
            </div>
          )}

          {isSearching && searchResults.length === 0 ? (
            <LoadingState count={8} layout="grid" />
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon={Film}
              badge="SEARCH CONSOLE"
              title="No Films Found"
              description="Try adjusting your title query or mood selection to find what you're looking for."
              actionText="Reset Search"
              onAction={clearFilters}
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
        /* Discovery Rails: Trending & Popular */
        <div className="space-y-10">
          {/* Trending Rail with Segmented Control */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#F5F3EB]">
                  Trending Now
                </h3>
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

            {/* Skeletons while loading */}
            {isLoadingTrending ? (
              <LoadingState count={5} layout="rail" />
            ) : trendingMovies.length > 0 ? (
              <div className="relative rail-edge-fade">
                <div className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:-mx-8 sm:px-8 scroll-smooth">
                  {trendingMovies.map((movie) => (
                    <MoviePoster
                      key={movie.id}
                      movie={movie}
                      userData={userMovieMap.get(movie.id)}
                      onClick={() => openMovieDetail(movie.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#9E9DA5] bg-[#131319] rounded-2xl border border-white/5">
                No trending releases available at this moment.
              </div>
            )}
          </section>

          {/* Popular Cinema Rail */}
          <section className="space-y-3">
            <div>
              <h3 className="font-serif font-bold text-lg sm:text-xl text-[#F5F3EB]">
                Popular Cinema
              </h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                Films capturing audiences across the globe
              </p>
            </div>

            {/* Skeletons while loading */}
            {isLoadingPopular ? (
              <LoadingState count={5} layout="rail" />
            ) : popularMovies.length > 0 ? (
              <MoviePosterRail
                title=""
                items={popularMovies.map((m) => ({ movie: m, userData: userMovieMap.get(m.id) }))}
                onMovieClick={(m) => openMovieDetail(m.id)}
              />
            ) : (
              <div className="p-8 text-center text-xs text-[#9E9DA5] bg-[#131319] rounded-2xl border border-white/5">
                No popular titles found.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
