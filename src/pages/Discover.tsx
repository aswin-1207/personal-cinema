import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { Movie, Genre } from '../types/movie';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MoviePoster } from '../components/movie/MoviePoster';
import { MoviePosterRail } from '../components/movie/MoviePosterRail';
import { Search, X, Compass, Film } from 'lucide-react';

const MOODS = [
  { label: 'Mind-Bending', genreId: 878, desc: 'Sci-Fi & Reality Shifters' },
  { label: 'Adrenaline Rush', genreId: 28, desc: 'Explosive Action' },
  { label: 'Cozy & Heartwarming', genreId: 35, desc: 'Comforting Cinema' },
  { label: 'Chilling Suspense', genreId: 53, desc: 'Nail-Biting Thrillers' },
  { label: 'Deeply Moving', genreId: 18, desc: 'Emotional Dramas' },
  { label: 'Eerie & Haunting', genreId: 27, desc: 'Atmospheric Horror' },
];

export const Discover: React.FC = () => {
  const { openMovieDetail, isOnline, dataVersion } = useCinema();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);

  const [trendingTime, setTrendingTime] = useState<'day' | 'week'>('week');
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);

  const [userMovieMap, setUserMovieMap] = useState<Map<number, any>>(new Map());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Load user data map for library badges
  useEffect(() => {
    UserMovieRepository.getAll().then((list) => {
      const map = new Map(list.map((um) => [um.movieId, um]));
      setUserMovieMap(map);
    });
  }, [dataVersion]);

  // Load genres, trending, and popular
  useEffect(() => {
    if (!isOnline) return;

    tmdbService.getGenres().then(setGenres).catch(console.error);
    tmdbService.getTrending(trendingTime).then(setTrendingMovies).catch(console.error);
    tmdbService.getPopular(1).then((res: any) => setPopularMovies(res.results)).catch(console.error);
  }, [isOnline, trendingTime]);

  // Perform search or genre discover
  useEffect(() => {
    if (!isOnline) return;

    if (debouncedQuery) {
      setIsSearching(true);
      tmdbService
        .searchMovies(debouncedQuery)
        .then((res: any) => {
          setSearchResults(res.results || []);
        })
        .finally(() => setIsSearching(false));
    } else if (selectedGenreId) {
      setIsSearching(true);
      tmdbService
        .discoverMovies({ with_genres: String(selectedGenreId), sort_by: 'popularity.desc' })
        .then((res: any) => {
          setSearchResults(res.results || []);
        })
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, selectedGenreId, isOnline]);

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
    <div className="pb-24 space-y-10 select-none animate-cinema-fade">
      {/* Exploration Header & Expanding Search Bar (Section 42 & 43) */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 text-[#EDC257] text-[11px] font-bold tracking-[0.16em] uppercase">
            <Compass size={14} />
            <span>DISCOVER & EXPLORE</span>
          </div>
          <h1 className="font-hero-title mt-1">
            Global Movie Vault
          </h1>
          <p className="text-xs sm:text-sm text-[#9E9DA5] mt-1">
            Explore world cinema, curate by mood, or search the complete TMDB film database.
          </p>
        </div>

        {/* Expanding Search Bar */}
        <div className="relative max-w-2xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#EDC257]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, director, saga, or keywords..."
            className="w-full bg-[#171924]/90 border border-white/10 focus:border-[#EDC257] rounded-2xl pl-12 pr-10 py-3.5 text-sm text-[#F5F2F0] placeholder-[#5C5B64] shadow-[0_4px_20px_rgba(0,0,0,0.5)] focus:shadow-[0_0_24px_rgba(237,194,87,0.25)] outline-none transition-all duration-300"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#9E9DA5] hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Mood Exploration Chips (Section 42) */}
      {!query && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-section-title text-sm sm:text-base text-[#F5F2F0]">
              Curate By Cinematic Mood
            </h3>
            {selectedGenreId && (
              <button
                onClick={clearFilters}
                className="text-xs text-[#EDC257] hover:underline"
              >
                Reset Mood
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {MOODS.map((mood) => {
              const isSelected = selectedGenreId === mood.genreId;
              return (
                <button
                  key={mood.genreId}
                  onClick={() => handleSelectMood(mood.genreId)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#EDC257]/15 border-[#EDC257] text-[#EDC257] shadow-[0_4px_20px_rgba(237,194,87,0.25)] scale-[1.02]'
                      : 'bg-[#171924]/60 border-white/[0.06] text-[#F5F2F0] hover:bg-[#171924] hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-bold font-serif line-clamp-1">{mood.label}</div>
                  <div className="text-[10px] text-[#9E9DA5] line-clamp-1 mt-0.5">{mood.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Genre Filter Scroll Strip */}
      {!query && genres.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:-mx-8 sm:px-8">
          <button
            onClick={() => setSelectedGenreId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
              selectedGenreId === null
                ? 'bg-[#EDC257] text-[#09090D] border-[#EDC257] shadow-gold'
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
                    ? 'bg-[#EDC257] text-[#09090D] border-[#EDC257] shadow-gold'
                    : 'bg-white/[0.05] text-[#9E9DA5] border-white/5 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Search or Mood Filter Results Grid */}
      {isFiltering ? (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h2 className="font-section-title text-[#F5F2F0]">
              {query ? `Search Results for "${query}"` : 'Curated Mood Selection'}
            </h2>
            <button
              onClick={clearFilters}
              className="text-xs text-[#EDC257] hover:underline"
            >
              Clear
            </button>
          </div>

          {isSearching ? (
            <div className="py-20 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#171924] border-t-[#EDC257] animate-spin mb-3" />
              <span className="text-xs text-[#9E9DA5] font-serif">Scanning Vault...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-16 text-center text-[#5C5B64] space-y-2">
              <Film size={36} className="mx-auto text-[#5C5B64]" />
              <h3 className="font-serif font-bold text-base text-[#F5F2F0]">No Films Found</h3>
              <p className="text-xs text-[#9E9DA5]">Try adjusting your title query or mood selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map((movie) => (
                <MoviePoster
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  onClick={() => openMovieDetail(movie.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Discovery Rails: Trending & Popular */
        <div className="space-y-10">
          {/* Trending Rail with Day/Week Toggle */}
          <section className="space-y-3.5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-section-title text-[#F5F2F0]">Trending Cinema</h3>
                  <div className="flex items-center bg-[#171924] border border-white/5 rounded-lg p-0.5 text-[10px] font-bold">
                    <button
                      onClick={() => setTrendingTime('day')}
                      className={`px-2 py-0.5 rounded ${
                        trendingTime === 'day' ? 'bg-[#EDC257] text-[#09090D]' : 'text-[#9E9DA5]'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setTrendingTime('week')}
                      className={`px-2 py-0.5 rounded ${
                        trendingTime === 'week' ? 'bg-[#EDC257] text-[#09090D]' : 'text-[#9E9DA5]'
                      }`}
                    >
                      This Week
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#9E9DA5] mt-0.5">
                  Most viewed cinematic releases right now
                </p>
              </div>
            </div>

            <div className="relative rail-edge-fade">
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:-mx-8 sm:px-8 scroll-smooth">
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
          </section>

          {/* Popular Films Rail */}
          <MoviePosterRail
            title="World Popularity"
            subtitle="Films capturing audiences across the globe"
            items={popularMovies.map((m) => ({ movie: m, userData: userMovieMap.get(m.id) }))}
            onMovieClick={(m) => openMovieDetail(m.id)}
          />
        </div>
      )}
    </div>
  );
};
