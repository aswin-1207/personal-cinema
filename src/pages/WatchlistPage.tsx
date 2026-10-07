import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { MoviePoster } from '../components/movie/MoviePoster';
import { EmptyState } from '../components/common/EmptyState';
import { Bookmark, Search, PlayCircle } from 'lucide-react';

export const WatchlistPage: React.FC = () => {
  const { openMovieDetail, setActiveTab, dataVersion } = useCinema();
  const [movies, setMovies] = useState<MovieWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'want_to_watch' | 'watching'>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'added' | 'year' | 'rating' | 'title'>('added');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let isMounted = true;
    UserMovieRepository.getWatchlistWithMovies().then((watchlistItems) => {
      if (!isMounted) return;
      setMovies(watchlistItems);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  const counts = useMemo(() => {
    const wantToWatch = movies.filter((m) => m.userData?.status === 'want_to_watch').length;
    const watching = movies.filter((m) => m.userData?.status === 'watching').length;
    const filmCount = movies.filter((m) => m.movie.mediaType !== 'tv').length;
    const seriesCount = movies.filter((m) => m.movie.mediaType === 'tv').length;
    return { all: movies.length, wantToWatch, watching, filmCount, seriesCount };
  }, [movies]);

  const filteredAndSortedMovies = useMemo(() => {
    let list = movies;

    if (statusFilter !== 'all') {
      list = list.filter((item) => item.userData?.status === statusFilter);
    }

    if (mediaTypeFilter === 'movie') {
      list = list.filter((item) => item.movie.mediaType !== 'tv');
    } else if (mediaTypeFilter === 'tv') {
      list = list.filter((item) => item.movie.mediaType === 'tv');
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
      let comparison = 0;
      switch (sortBy) {
        case 'added': {
          const dateA = a.userData?.watchingAt || a.userData?.addedAt || '';
          const dateB = b.userData?.watchingAt || b.userData?.addedAt || '';
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'year': {
          const dateA = a.movie.releaseDate || a.movie.firstAirDate || '';
          const dateB = b.movie.releaseDate || b.movie.firstAirDate || '';
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'rating':
          comparison = (a.movie.voteAverage || 0) - (b.movie.voteAverage || 0);
          break;
        case 'title': {
          const tA = a.movie.title || a.movie.name || '';
          const tB = b.movie.title || b.movie.name || '';
          comparison = tA.localeCompare(tB);
          break;
        }
      }
      return sortDesc ? -comparison : comparison;
    });
  }, [movies, statusFilter, searchQuery, sortBy, sortDesc]);

  return (
    <div className="space-y-5 sm:space-y-6 pb-4 animate-cinema-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
        <div className="space-y-0.5">
          <h1 className="font-hero-title text-xl sm:text-2xl md:text-3xl text-[#F5F3EB]">
            Watchlist
          </h1>
          <p className="text-xs text-[#9E9DA5]">
            {counts.all} {counts.all === 1 ? 'title' : 'titles'}
            {counts.watching > 0 ? ` · ${counts.watching} watching` : ''}
          </p>
        </div>

        {/* Search & Sort Controls */}
        {movies.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 xs:flex-initial">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9DA5] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search watchlist..."
                className="bg-[#131319] border border-white/[0.08] focus:border-[#E0AD52]/50 text-xs text-[#F5F3EB] placeholder-[#63626B] rounded-xl pl-8 pr-3 py-2 w-full xs:w-44 sm:w-52 transition-all outline-none min-h-[38px]"
              />
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 bg-[#131319] border border-white/[0.08] rounded-xl p-1 text-xs">
              <button
                onClick={() => {
                  if (sortBy === 'added') setSortDesc(!sortDesc);
                  else {
                    setSortBy('added');
                    setSortDesc(true);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'added'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Date {sortBy === 'added' ? (sortDesc ? '↓' : '↑') : ''}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'rating') setSortDesc(!sortDesc);
                  else {
                    setSortBy('rating');
                    setSortDesc(true);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'rating'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Rating {sortBy === 'rating' ? (sortDesc ? '↓' : '↑') : ''}
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'title') setSortDesc(!sortDesc);
                  else {
                    setSortBy('title');
                    setSortDesc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none transition-colors ${
                  sortBy === 'title'
                    ? 'bg-[#E0AD52] text-[#09090B]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
                }`}
              >
                Title {sortBy === 'title' ? (sortDesc ? '↓' : '↑') : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs / Pills */}
      {movies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.06] pb-3">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                statusFilter === 'all'
                  ? 'bg-[#E0AD52]/20 border-[#E0AD52]/60 text-[#E0AD52]'
                  : 'bg-[#131319] border-white/5 text-[#9E9DA5] hover:text-white'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('want_to_watch')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                statusFilter === 'want_to_watch'
                  ? 'bg-[#E0AD52]/20 border-[#E0AD52]/60 text-[#E0AD52]'
                  : 'bg-[#131319] border-white/5 text-[#9E9DA5] hover:text-white'
              }`}
            >
              Want to Watch ({counts.wantToWatch})
            </button>
            <button
              onClick={() => setStatusFilter('watching')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                statusFilter === 'watching'
                  ? 'bg-[#E0AD52]/20 border-[#E0AD52]/60 text-[#E0AD52]'
                  : 'bg-[#131319] border-white/5 text-[#9E9DA5] hover:text-white'
              }`}
            >
              Watching ({counts.watching})
            </button>
          </div>

          {/* Media Type Toggle */}
          <div className="flex items-center gap-1 bg-[#131319] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setMediaTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer border-none ${
                mediaTypeFilter === 'all'
                  ? 'bg-[#E0AD52] text-[#09090B]'
                  : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMediaTypeFilter('movie')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer border-none ${
                mediaTypeFilter === 'movie'
                  ? 'bg-[#E0AD52] text-[#09090B]'
                  : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              Films ({counts.filmCount})
            </button>
            <button
              onClick={() => setMediaTypeFilter('tv')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer border-none ${
                mediaTypeFilter === 'tv'
                  ? 'bg-[#E0AD52] text-[#09090B]'
                  : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              Series ({counts.seriesCount})
            </button>
          </div>
        </div>
      )}

      {/* Poster Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-[#131319] animate-pulse" />
          ))}
        </div>
      ) : filteredAndSortedMovies.length === 0 ? (
        <div className="py-12 text-center">
          {searchQuery ? (
            <div className="space-y-3">
              <p className="text-sm text-[#9E9DA5]">
                No titles match "{searchQuery}".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="cinema-button-ghost text-xs text-[#E0AD52] cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          ) : statusFilter === 'watching' ? (
            <EmptyState
              icon={PlayCircle}
              title="No movies currently watching"
              description="Mark a movie as watching to track active screenings."
              actionLabel="View Watchlist"
              onAction={() => setStatusFilter('want_to_watch')}
            />
          ) : (
            <EmptyState
              icon={Bookmark}
              title="Your watchlist is empty"
              description="Add movies from Discover to track what you want to watch."
              actionLabel="Explore Movies"
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
