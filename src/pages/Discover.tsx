import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { Movie, Genre } from '../types/movie';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MoviePoster } from '../components/movie/MoviePoster';
import { MoviePosterRail } from '../components/movie/MoviePosterRail';
import { CinemaSegmentedControl } from '../components/common/CinemaSegmentedControl';
import { CinemaButton } from '../components/common/CinemaButton';
import { Search, X, Film, RefreshCw, KeyRound } from 'lucide-react';

const SCREENING_MOODS = [
  { label: 'Mind-Bending', genreId: 878 },
  { label: 'Adrenaline', genreId: 28 },
  { label: 'Cozy', genreId: 35 },
  { label: 'Suspense', genreId: 53 },
  { label: 'Emotional', genreId: 18 },
  { label: 'Eerie', genreId: 27 },
  { label: 'Sci-Fi', genreId: 878 },
  { label: 'Horror', genreId: 27 },
];

export const Discover: React.FC = () => {
  const { openMovieDetail, isOnline, dataVersion, setActiveTab } = useCinema();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);

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
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load user data map for library badges
  useEffect(() => {
    UserMovieRepository.getAll().then((list) => {
      const map = new Map(list.map((um) => [um.movieId, um]));
      setUserMovieMap(map);
    });
  }, [dataVersion]);

  // Load discovery data (Trending, Popular, Genres) with SWR (Section 7 & 11)
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

  // Perform search or genre discover with AbortController (Section 12 & 13)
  useEffect(() => {
    const controller = new AbortController();

    if (debouncedQuery) {
      setIsSearching(true);
      tmdbService
        .searchMovies(debouncedQuery, undefined, 1, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) {
            setSearchResults(res.results || []);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    } else if (selectedGenreId) {
      setIsSearching(true);
      tmdbService
        .discoverMovies({ with_genres: String(selectedGenreId), sort_by: 'popularity.desc' })
        .then((res: any) => {
          if (!controller.signal.aborted) {
            const list = Array.isArray(res) ? res : res.results || [];
            setSearchResults(list);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, selectedGenreId]);

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

  return (
    <div className="pb-28 space-y-8 select-none animate-cinema-fade">
      {/* Refined Header (Section 9) */}
      <div className="space-y-4">
        <div>
          <span className="font-caps-label text-[#8C7AD0] tracking-widest text-[11px] block">
            DISCOVERY CONSOLE
          </span>
          <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#F5F3EB] tracking-tight mt-0.5">
            Find your next film.
          </h1>
        </div>

        {/* Unified Search Console (Section 10 & 17) */}
        <div className="relative w-full max-w-2xl flex items-center bg-[#131319]/90 border border-white/10 focus-within:border-[#8C7AD0] rounded-2xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] focus-within:shadow-[0_0_24px_rgba(140,122,208,0.25)] transition-all duration-300">
          <Search size={18} className="text-[#8C7AD0] flex-shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, directors, actors..."
            className="w-full bg-transparent border-none text-sm text-[#F5F3EB] placeholder-[#63626B] outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#9E9DA5] hover:text-[#F5F3EB] cursor-pointer border-none bg-transparent flex-shrink-0 ml-2"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Screening Moods with Cinema Purple Accents (Section 11) */}
      {!query && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8C7AD0]" />
              <span>Exploration Moods</span>
            </h3>
            {selectedGenreId && (
              <button
                onClick={clearFilters}
                className="text-xs text-[#E0AD52] hover:underline cursor-pointer border-none bg-transparent"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {SCREENING_MOODS.map((mood, idx) => {
              const isSelected = selectedGenreId === mood.genreId;
              return (
                <button
                  key={`${mood.genreId}-${idx}`}
                  onClick={() => handleSelectMood(mood.genreId)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#8C7AD0] text-[#09090B] border-[#8C7AD0] shadow-[0_2px_14px_rgba(140,122,208,0.35)] scale-[1.02] font-bold'
                      : 'bg-[#131319]/80 text-[#F5F3EB] border-white/[0.08] hover:border-[#8C7AD0]/40 hover:bg-[#1A1A24]'
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
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:-mx-8 sm:px-8">
          <button
            onClick={() => setSelectedGenreId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
              selectedGenreId === null
                ? 'bg-[#EDC257] text-[#09090D] border-[#EDC257] font-bold shadow-sm'
                : 'bg-white/[0.05] text-[#9E9DA5] border-white/5 hover:text-white'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => {
            const isSelected = selectedGenreId === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGenreId(isSelected ? null : g.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#EDC257] text-[#09090D] border-[#EDC257] font-bold shadow-sm'
                    : 'bg-white/[0.05] text-[#9E9DA5] border-white/5 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
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
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="font-section-title text-[#F5F2F0]">
              {query ? `Search: "${query}"` : 'Curated Mood Selection'}
            </h2>
            <button
              onClick={clearFilters}
              className="text-xs text-[#EDC257] hover:underline cursor-pointer border-none bg-transparent"
            >
              Clear
            </button>
          </div>

          {isSearching ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-2xl cinema-skeleton" />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-16 text-center text-[#5C5B64] space-y-2">
              <Film size={36} className="mx-auto text-[#5C5B64]" />
              <h3 className="font-serif font-bold text-base text-[#F5F2F0]">No Films Found</h3>
              <p className="text-xs text-[#9E9DA5]">Try adjusting your title query or mood selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {searchResults.map((movie) => (
                <MoviePoster
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  className="w-full"
                  onClick={() => openMovieDetail(movie.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Discovery Rails: Trending & Popular */
        <div className="space-y-10">
          {/* Trending Rail with Segmented Control (Section 12, 13, 14) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-section-title text-[#F5F2F0]">Trending Now</h3>
                <p className="text-xs text-[#9E9DA5] mt-0.5">
                  Most discussed and watched right now
                </p>
              </div>

              {/* Polished Segmented Control (Section 14) */}
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
              <div className="flex gap-3 overflow-x-hidden pt-1 pb-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-36 sm:w-44 aspect-[2/3] rounded-2xl cinema-skeleton flex-shrink-0" />
                ))}
              </div>
            ) : trendingMovies.length > 0 ? (
              <div className="relative rail-edge-fade">
                <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:-mx-8 sm:px-8 scroll-smooth">
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
              <div className="p-8 text-center text-xs text-[#9E9DA5] bg-[#171924]/40 rounded-2xl border border-white/5">
                No trending releases available at this moment.
              </div>
            )}
          </section>

          {/* Popular Cinema Rail (Section 15) */}
          <section className="space-y-3">
            <div>
              <h3 className="font-section-title text-[#F5F2F0]">Popular Cinema</h3>
              <p className="text-xs text-[#9E9DA5] mt-0.5">
                Films capturing audiences across the globe
              </p>
            </div>

            {/* Skeletons while loading */}
            {isLoadingPopular ? (
              <div className="flex gap-3 overflow-x-hidden pt-1 pb-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-36 sm:w-44 aspect-[2/3] rounded-2xl cinema-skeleton flex-shrink-0" />
                ))}
              </div>
            ) : popularMovies.length > 0 ? (
              <MoviePosterRail
                title=""
                items={popularMovies.map((m) => ({ movie: m, userData: userMovieMap.get(m.id) }))}
                onMovieClick={(m) => openMovieDetail(m.id)}
              />
            ) : (
              <div className="p-8 text-center text-xs text-[#9E9DA5] bg-[#171924]/40 rounded-2xl border border-white/5">
                No popular titles found.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
