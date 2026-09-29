import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { MovieCard } from '../components/movie/MovieCard';
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
  Layers,
} from 'lucide-react';
import { tmdbService } from '../services/tmdbService';
import { CollectionsPage } from './CollectionsPage';

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

  // Watched stats calculation
  const watchedStats = useMemo(() => {
    const watched = libraryItems.filter((i) => i.userData?.status === 'watched');
    let totalMinutes = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    watched.forEach((item) => {
      totalMinutes += item.movie.runtime || 110;
      if (typeof item.userData?.personalRating === 'number') {
        ratingSum += item.userData.personalRating;
        ratingCount++;
      }
    });

    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '—';

    return { count: watched.length, hours, avgRating };
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
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-3xl text-cinema-white">My Cinema Vault</h1>
          <p className="text-xs text-cinema-subtle mt-0.5">
            Your personal, canonical film catalog and screening records.
          </p>
        </div>

        {/* Watched stats pill strip (shown when Watched or All selected) */}
        {(activeTab === 'watched' || activeTab === 'all') && (
          <div className="flex items-center gap-3 bg-cinema-surface/60 border border-white/5 rounded-xl px-4 py-2 text-xs">
            <div>
              <span className="text-cinema-subtle block">Watched</span>
              <span className="font-bold text-cinema-white">{watchedStats.count}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div>
              <span className="text-cinema-subtle block">Hours</span>
              <span className="font-bold text-cinema-white">{watchedStats.hours}h</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div>
              <span className="text-cinema-subtle block">Avg Score</span>
              <span className="font-bold text-cinema-gold">{watchedStats.avgRating} ★</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs & Display Mode Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Segmented Tab Controls */}
        <div className="flex bg-cinema-surface rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setActiveTabFilter('watchlist')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'watchlist'
                ? 'bg-cinema-gold text-cinema-black shadow-gold'
                : 'text-cinema-silver hover:text-cinema-white'
            }`}
          >
            <Bookmark size={14} />
            <span>Watchlist</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('watched')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'watched'
                ? 'bg-cinema-gold text-cinema-black shadow-gold'
                : 'text-cinema-silver hover:text-cinema-white'
            }`}
          >
            <CheckCircle size={14} />
            <span>Watched</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('favorites')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'favorites'
                ? 'bg-cinema-gold text-cinema-black shadow-gold'
                : 'text-cinema-silver hover:text-cinema-white'
            }`}
          >
            <Heart size={14} />
            <span>Favorites</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('collections')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'collections'
                ? 'bg-cinema-gold text-cinema-black shadow-gold'
                : 'text-cinema-silver hover:text-cinema-white'
            }`}
          >
            <Layers size={14} />
            <span>Collections</span>
          </button>

          <button
            onClick={() => setActiveTabFilter('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-cinema-gold text-cinema-black shadow-gold'
                : 'text-cinema-silver hover:text-cinema-white'
            }`}
          >
            <Film size={14} />
            <span>All</span>
          </button>
        </div>

        {/* Display Mode (Grid / List) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex bg-cinema-surface rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                displayMode === 'grid' ? 'bg-cinema-charcoal text-cinema-gold' : 'text-cinema-subtle'
              }`}
              title="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`p-1.5 rounded transition-colors ${
                displayMode === 'list' ? 'bg-cinema-charcoal text-cinema-gold' : 'text-cinema-subtle'
              }`}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'collections' ? (
        <CollectionsPage />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter library by title, notes..."
                className="cinema-input w-full pl-9 py-2 text-xs"
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
        /* Grid Mode */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <MovieCard
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              onClick={() => openMovieDetail(item.movie.id)}
            />
          ))}
        </div>
      ) : (
        /* List Mode */
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
                className="flex items-center justify-between p-3 rounded-xl bg-cinema-surface/50 border border-white/5 hover:border-cinema-gold/40 hover:bg-cinema-surface cursor-pointer transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Poster Thumbnail */}
                  <div className="w-12 h-16 bg-cinema-charcoal rounded overflow-hidden flex-shrink-0">
                    {poster ? (
                      <img src={poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-cinema-subtle">
                        No Poster
                      </div>
                    )}
                  </div>

                  {/* Title & details */}
                  <div>
                    <h3 className="font-semibold text-cinema-white text-sm line-clamp-1">
                      {item.movie.title}
                    </h3>
                    <div className="text-xs text-cinema-subtle flex items-center gap-2 mt-0.5">
                      <span>{year}</span>
                      {item.movie.runtime && <span>· {item.movie.runtime}m</span>}
                      {item.movie.genres && (
                        <span>· {item.movie.genres.slice(0, 2).map((g) => g.name).join(', ')}</span>
                      )}
                    </div>
                    {item.userData?.notes && (
                      <p className="text-xs text-cinema-silver mt-1 line-clamp-1 italic">
                        "{item.userData.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating & Actions */}
                <div
                  className="flex items-center gap-4 flex-shrink-0"
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
    </>
  )}
</div>
);
};
