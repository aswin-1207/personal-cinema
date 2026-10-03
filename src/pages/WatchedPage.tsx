import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { MoviePoster } from '../components/movie/MoviePoster';
import { EmptyState } from '../components/common/EmptyState';
import { CheckCircle2, Search, Heart } from 'lucide-react';

export const WatchedPage: React.FC = () => {
  const { openMovieDetail, setActiveTab, dataVersion } = useCinema();
  const [movies, setMovies] = useState<MovieWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'rating' | 'year' | 'title'>('recent');

  useEffect(() => {
    let isMounted = true;
    UserMovieRepository.getWatchedWithMovies().then((watchedItems) => {
      if (!isMounted) return;
      setMovies(watchedItems);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  const filteredAndSortedMovies = useMemo(() => {
    let list = movies;

    if (onlyFavorites) {
      list = list.filter((item) => item.userData?.isFavorite);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.movie.title && item.movie.title.toLowerCase().includes(q)) ||
          (item.movie.name && item.movie.name.toLowerCase().includes(q)) ||
          (item.movie.originalTitle && item.movie.originalTitle.toLowerCase().includes(q)) ||
          (item.movie.originalName && item.movie.originalName.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'recent': {
          const dateA = a.userData?.watchedAt || a.userData?.addedAt || '';
          const dateB = b.userData?.watchedAt || b.userData?.addedAt || '';
          return dateB.localeCompare(dateA);
        }
        case 'oldest': {
          const dateA = a.userData?.watchedAt || a.userData?.addedAt || '';
          const dateB = b.userData?.watchedAt || b.userData?.addedAt || '';
          return dateA.localeCompare(dateB);
        }
        case 'rating': {
          const rA = a.userData?.personalRating ?? a.movie.voteAverage ?? 0;
          const rB = b.userData?.personalRating ?? b.movie.voteAverage ?? 0;
          return rB - rA;
        }
        case 'year': {
          const yA = a.movie.releaseDate || a.movie.firstAirDate || '';
          const yB = b.movie.releaseDate || b.movie.firstAirDate || '';
          return yB.localeCompare(yA);
        }
        case 'title': {
          const tA = a.movie.title || a.movie.name || '';
          const tB = b.movie.title || b.movie.name || '';
          return tA.localeCompare(tB);
        }
        default:
          return 0;
      }
    });
  }, [movies, onlyFavorites, searchQuery, sortBy]);

  return (
    <div className="space-y-5 sm:space-y-6 pb-4 animate-cinema-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
        <div className="space-y-0.5">
          <h1 className="font-hero-title text-xl sm:text-2xl md:text-3xl text-[#F5F3EB]">
            Watched Titles
          </h1>
          <p className="text-xs text-[#9E9DA5]">
            {movies.length} {movies.length === 1 ? 'title' : 'titles'}
          </p>
        </div>

        {/* Filter and Sort Controls */}
        {movies.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 xs:flex-initial">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9DA5] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search watched..."
                className="bg-[#131319] border border-white/[0.08] focus:border-[#E0AD52]/50 text-xs text-[#F5F3EB] placeholder-[#63626B] rounded-xl pl-8 pr-3 py-2 w-full xs:w-44 sm:w-48 transition-all outline-none min-h-[38px]"
              />
            </div>

            {/* Favorite Filter Toggle */}
            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all min-h-[38px] ${
                onlyFavorites
                  ? 'bg-[#B3262E]/20 border-[#B3262E]/60 text-white shadow-[0_0_12px_rgba(179,38,46,0.3)]'
                  : 'bg-[#131319] border-white/[0.08] text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              <Heart size={13} className={onlyFavorites ? 'fill-white text-white' : ''} />
              <span>Favorites</span>
            </button>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-[#131319] border border-white/[0.08] rounded-xl p-1 text-xs">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'oldest'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Oldest
              </button>
              <button
                onClick={() => setSortBy('rating')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'rating'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Rating
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Poster Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-[#131319] animate-pulse" />
          ))}
        </div>
      ) : filteredAndSortedMovies.length === 0 ? (
        <div className="py-12 text-center">
          {searchQuery || onlyFavorites ? (
            <div className="space-y-3">
              <p className="text-sm text-[#9E9DA5]">
                No screened films match the active filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setOnlyFavorites(false);
                }}
                className="cinema-button-ghost text-xs text-[#E0AD52] cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No watched movies yet"
              description="Mark movies as watched to record your screening history."
              actionLabel="Browse Movies"
              onAction={() => setActiveTab('discover')}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {filteredAndSortedMovies.map((item) => (
            <MoviePoster
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              onClick={() => openMovieDetail(item.movie.id)}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
};
