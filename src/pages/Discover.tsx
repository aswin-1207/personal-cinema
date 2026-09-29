import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { tmdbService } from '../services/tmdbService';
import { Movie, Genre } from '../types/movie';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieCard } from '../components/movie/MovieCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { Search, Sparkles, X } from 'lucide-react';

const MOODS = [
  { label: 'Mind-Bending', genreId: 878, desc: 'Sci-Fi & Reality Shifters' }, // Sci-Fi
  { label: 'Adrenaline Rush', genreId: 28, desc: 'Explosive Action' }, // Action
  { label: 'Cozy & Heartwarming', genreId: 35, desc: 'Comedy & Comfort' }, // Comedy
  { label: 'Chilling Suspense', genreId: 53, desc: 'Nail-biting Thrillers' }, // Thriller
  { label: 'Deeply Moving', genreId: 18, desc: 'Cinematic Drama' }, // Drama
  { label: 'Eerie & Haunting', genreId: 27, desc: 'Atmospheric Horror' }, // Horror
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
    }, 400);
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
          setSearchResults(res.results);
        })
        .finally(() => setIsSearching(false));
    } else if (selectedGenreId) {
      setIsSearching(true);
      tmdbService
        .discoverMovies({ with_genres: String(selectedGenreId), sort_by: 'popularity.desc' })
        .then((res: any) => {
          setSearchResults(res.results);
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

  const isShowingFiltered = Boolean(debouncedQuery || selectedGenreId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Search */}
      <div className="space-y-4">
        <div>
          <h1 className="font-serif font-bold text-3xl text-cinema-white">Discover Vault</h1>
          <p className="text-xs text-cinema-subtle mt-1">
            Search millions of films across global cinema archives via TMDB.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cinema-gold" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedGenreId) setSelectedGenreId(null);
            }}
            placeholder="Search by title, director, keyword..."
            className="cinema-input w-full pl-11 pr-10 py-3.5 text-sm bg-cinema-surface/80 border-white/10 focus:border-cinema-gold"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cinema-subtle hover:text-cinema-white p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mood Filter Cards (When not searching by text) */}
        {!query && (
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-cinema-subtle mb-2 font-medium">
              <Sparkles size={13} className="text-cinema-gold" />
              <span>Screening Moods</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {MOODS.map((m) => {
                const isSelected = selectedGenreId === m.genreId;
                return (
                  <button
                    key={m.label}
                    onClick={() => handleSelectMood(m.genreId)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-cinema-gold bg-cinema-gold/15 text-cinema-gold shadow-gold'
                        : 'border-white/5 bg-cinema-surface/40 hover:bg-cinema-surface hover:border-white/15 text-cinema-silver'
                    }`}
                  >
                    <div className="font-semibold text-xs text-cinema-white line-clamp-1">{m.label}</div>
                    <div className="text-[10px] text-cinema-subtle mt-0.5 line-clamp-1">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Genre Pill Carousel */}
        {genres.length > 0 && !query && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedGenreId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedGenreId === null
                  ? 'border-cinema-gold bg-cinema-gold/20 text-cinema-gold'
                  : 'border-white/5 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                    isSelected
                      ? 'border-cinema-gold bg-cinema-gold/20 text-cinema-gold'
                      : 'border-white/5 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isShowingFiltered ? (
        /* Search / Filter Results Grid */
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-xl text-cinema-white">
              {debouncedQuery
                ? `Results for "${debouncedQuery}"`
                : genres.find((g) => g.id === selectedGenreId)?.name || 'Filtered Films'}
            </h3>
            <button
              onClick={clearFilters}
              className="text-xs text-cinema-gold hover:underline flex items-center gap-1"
            >
              <X size={12} />
              <span>Clear Filter</span>
            </button>
          </div>

          {isSearching ? (
            <div className="py-20 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mb-3" />
              <span className="text-xs text-cinema-subtle">Searching TMDB Vault...</span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {searchResults.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  onClick={() => openMovieDetail(movie.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-cinema-subtle">
              <p className="text-sm font-medium text-cinema-silver">No movies matched your search.</p>
              <p className="text-xs mt-1">Try another title, director name, or clear active filters.</p>
            </div>
          )}
        </section>
      ) : (
        /* Default Discover Rows: Trending & Popular */
        <div className="space-y-10">
          {/* Trending Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                title="Trending Movies"
                subtitle="Most discussed and tracked this week"
                className="mb-0"
              />
              <div className="flex bg-cinema-surface rounded-lg p-1 border border-white/5 text-xs">
                <button
                  onClick={() => setTrendingTime('day')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    trendingTime === 'day'
                      ? 'bg-cinema-gold text-cinema-black font-semibold'
                      : 'text-cinema-silver hover:text-cinema-white'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTrendingTime('week')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    trendingTime === 'week'
                      ? 'bg-cinema-gold text-cinema-black font-semibold'
                      : 'text-cinema-silver hover:text-cinema-white'
                  }`}
                >
                  This Week
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {trendingMovies.slice(0, 10).map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  onClick={() => openMovieDetail(movie.id)}
                />
              ))}
            </div>
          </section>

          {/* Popular Films */}
          <section>
            <SectionHeader
              title="All-Time Popular"
              subtitle="Enduring cinematic favorites worldwide"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {popularMovies.slice(0, 10).map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  userData={userMovieMap.get(movie.id)}
                  onClick={() => openMovieDetail(movie.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
