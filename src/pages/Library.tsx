import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { MoviePoster } from '../components/movie/MoviePoster';
import { WatchedButton } from '../components/movie/WatchedButton';
import { RatingControl } from '../components/movie/RatingControl';
import { EmptyState } from '../components/common/EmptyState';
import {
  Bookmark,
  CheckCircle,
  Heart,
  Grid,
  List as ListIcon,
  Search,
  ArrowUpDown,
  Film,
} from 'lucide-react';
import { tmdbService } from '../services/tmdbService';

type TabType = 'watchlist' | 'watched' | 'favorites' | 'collections' | 'all';
type SortOption = 'addedAt' | 'releaseDate' | 'title' | 'personalRating' | 'tmdbRating';

export const Library: React.FC = () => {
  const { openMovieDetail, setRating, setActiveTab, dataVersion } = useCinema();

  const [activeTab, setActiveTabFilter] = useState<TabType>('watchlist');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('addedAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const [libraryItems, setLibraryItems] = useState<MovieWithUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    UserMovieRepository.getAllWithMovies()
      .then((items) => {
        if (isMounted) setLibraryItems(items);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  // Derived genres from library movies
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    libraryItems.forEach((item) => {
      item.movie.genres?.forEach((g) => genreSet.add(g.name));
    });
    return Array.from(genreSet).sort();
  }, [libraryItems]);

  // Filtered and Sorted list
  const filteredItems = useMemo(() => {
    return libraryItems
      .filter((item) => {
        // Tab filtering
        if (activeTab === 'watchlist') return item.userData?.status === 'want_to_watch';
        if (activeTab === 'watched') return item.userData?.status === 'watched';
        if (activeTab === 'favorites') return item.userData?.isFavorite;
        return true;
      })
      .filter((item) => {
        // Genre filtering
        if (selectedGenre !== 'all') {
          return item.movie.genres?.some((g) => g.name === selectedGenre);
        }
        return true;
      })
      .filter((item) => {
        // Search filtering
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.movie.title.toLowerCase().includes(q) ||
          item.userData?.notes?.toLowerCase().includes(q) ||
          item.userData?.review?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        switch (sortBy) {
          case 'addedAt': {
            const dA = a.userData?.addedAt || '';
            const dB = b.userData?.addedAt || '';
            diff = dA.localeCompare(dB);
            break;
          }
          case 'releaseDate': {
            const rA = a.movie.releaseDate || '';
            const rB = b.movie.releaseDate || '';
            diff = rA.localeCompare(rB);
            break;
          }
          case 'title':
            diff = a.movie.title.localeCompare(b.movie.title);
            break;
          case 'personalRating': {
            const pA = a.userData?.personalRating ?? -1;
            const pB = b.userData?.personalRating ?? -1;
            diff = pA - pB;
            break;
          }
          case 'tmdbRating':
            diff = a.movie.voteAverage - b.movie.voteAverage;
            break;
        }
        return sortDesc ? -diff : diff;
      });
  }, [libraryItems, activeTab, selectedGenre, searchQuery, sortBy, sortDesc]);

  return (
    <div className="space-y-6 pb-20">
      {/* Title Header matching Figma 2:177 */}
      <div className="space-y-1">
        <h1 className="font-serif font-black text-2xl sm:text-3xl text-[#F5F3EB] tracking-tight">
          My Cinema
        </h1>
        <p className="text-xs sm:text-sm text-[#9E9DA5]">
          Your personal movie library.
        </p>
      </div>

      {/* Tabs & Display Mode Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Segmented Tab Controls matching Figma 2:177 */}
        <div className="flex bg-[#131319] rounded-xl p-1 border border-white/5 overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTabFilter('watchlist')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'watchlist'
                ? 'bg-[#E0AD52] text-[#09090B] shadow-[0_2px_12px_rgba(224,173,82,0.35)]'
                : 'text-[#9E9DA5] hover:text-[#F5F3EB]'
            }`}
          >
            <Bookmark size={13} />
            <span>WATCHLIST</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('watched')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'watched'
                ? 'bg-[#E0AD52] text-[#09090B] shadow-[0_2px_12px_rgba(224,173,82,0.35)]'
                : 'text-[#9E9DA5] hover:text-[#F5F3EB]'
            }`}
          >
            <CheckCircle size={13} />
            <span>WATCHED</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('favorites')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-[#E0AD52] text-[#09090B] shadow-[0_2px_12px_rgba(224,173,82,0.35)]'
                : 'text-[#9E9DA5] hover:text-[#F5F3EB]'
            }`}
          >
            <Heart size={13} />
            <span>FAVORITES</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#E0AD52] text-[#09090B] shadow-[0_2px_12px_rgba(224,173,82,0.35)]'
                : 'text-[#9E9DA5] hover:text-[#F5F3EB]'
            }`}
          >
            <Film size={13} />
            <span>ALL</span>
          </button>
        </div>

        {/* Display Mode (Grid / List) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex bg-[#131319] rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                displayMode === 'grid' ? 'bg-[#24242E] text-[#E0AD52]' : 'text-[#9E9DA5]'
              }`}
              title="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                displayMode === 'list' ? 'bg-[#24242E] text-[#E0AD52]' : 'text-[#9E9DA5]'
              }`}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar matching Figma 2:177 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E9DA5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter library by title..."
              className="w-full bg-[#131319]/90 border border-white/10 focus:border-[#E0AD52] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F5F3EB] placeholder-[#63626B] outline-none transition-colors"
            />
          </div>

        {/* Genre Filter */}
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="cinema-input py-2 text-xs"
        >
          <option value="all">All Genres</option>
          {availableGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* Sort selector */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="cinema-input flex-grow py-2 text-xs"
          >
            <option value="addedAt">Date Added</option>
            <option value="releaseDate">Release Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="personalRating">Personal Rating</option>
            <option value="tmdbRating">TMDB Rating</option>
          </select>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="p-2 rounded-lg bg-cinema-surface border border-white/5 text-cinema-silver hover:text-cinema-white"
            title={sortDesc ? 'Descending' : 'Ascending'}
          >
            <ArrowUpDown size={15} />
          </button>
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mb-3" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={`No ${activeTab === 'all' ? 'films' : activeTab} found`}
          description={
            searchQuery || selectedGenre !== 'all'
              ? 'Try adjusting your search query or genre filter.'
              : activeTab === 'watchlist'
              ? 'You have no movies on your watchlist yet.'
              : activeTab === 'watched'
              ? 'You haven’t logged any watched movies yet.'
              : 'Your favorites shelf is currently empty.'
          }
          actionText="Discover Films"
          onAction={() => setActiveTab('discover')}
        />
      ) : displayMode === 'grid' ? (
        /* Visual Poster Grid with 2:3 Aspect Ratio */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <MoviePoster
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              className="w-full"
              onClick={() => openMovieDetail(item.movie.id)}
            />
          ))}
        </div>
      ) : (
        /* List Mode with Strict Boundary Containment */
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const poster = item.movie.posterPath
              ? tmdbService.getImageUrl(item.movie.posterPath, 'w92')
              : null;
            const year = item.movie.releaseDate ? item.movie.releaseDate.substring(0, 4) : '';

            return (
              <div
                key={item.movie.id}
                onClick={() => openMovieDetail(item.movie.id)}
                className="flex items-center justify-between p-3 rounded-xl bg-cinema-surface/60 border border-white/5 hover:border-cinema-gold/40 hover:bg-cinema-surface cursor-pointer transition-all gap-2"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                  {/* Poster Thumbnail */}
                  <div className="w-12 h-16 bg-cinema-charcoal rounded-lg overflow-hidden flex-shrink-0 shadow">
                    {poster ? (
                      <img src={poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-cinema-subtle">
                        No Poster
                      </div>
                    )}
                  </div>

                  {/* Title & details with Guaranteed Strict Containment */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-semibold text-cinema-white text-sm line-clamp-2 break-words leading-snug"
                      title={item.movie.title}
                    >
                      {item.movie.title}
                    </h3>
                    <div className="text-xs text-cinema-subtle flex items-center gap-2 mt-0.5">
                      <span>{year || '—'}</span>
                      {item.movie.runtime && <span>· {item.movie.runtime}m</span>}
                      {item.movie.genres && (
                        <span className="truncate">· {item.movie.genres.slice(0, 2).map((g) => g.name).join(', ')}</span>
                      )}
                    </div>
                    {item.userData?.notes && (
                      <p className="text-xs text-cinema-silver mt-1 line-clamp-1 italic truncate">
                        "{item.userData.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating & Actions (Never Pushed Off-Screen) */}
                <div
                  className="flex items-center gap-3 sm:gap-4 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RatingControl
                    value={item.userData?.personalRating || null}
                    onChange={(r) => setRating(item.movie.id, r)}
                    size="sm"
                  />

                  <WatchedButton
                    movie={item.movie}
                    userData={item.userData}
                    style="icon"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
