import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { Movie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { UnifiedSearchService, SearchErrorCode } from '../../services/unifiedSearchService';
import { Search, Check, Plus, Film, Loader2, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

interface AddMoviesToCollectionModalProps {
  isOpen: boolean;
  collectionId: string;
  collectionName: string;
  onClose: () => void;
  onAdded: () => void;
}

export const AddMoviesToCollectionModal: React.FC<AddMoviesToCollectionModalProps> = ({
  isOpen,
  collectionId,
  collectionName,
  onClose,
  onAdded,
}) => {
  const [existingMovieIds, setExistingMovieIds] = useState<Set<number>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [selectedMoviesMap, setSelectedMoviesMap] = useState<Map<number, Movie>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [displayedMovies, setDisplayedMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SearchErrorCode>(null);
  const [allMatchesAlreadyInCollection, setAllMatchesAlreadyInCollection] = useState(false);

  // Keep a cache of all available local movies not in this collection
  const localAvailableRef = useRef<Movie[]>([]);
  const latestSequenceRef = useRef<number>(0);

  // Load existing collection members and available local movies
  const loadInitialData = useCallback(async () => {
    // Reset synchronously so anything typed while members load is not wiped.
    setSelectedMovieIds(new Set());
    setSelectedMoviesMap(new Map());
    setSearchQuery('');
    setDebouncedQuery('');
    const colMovies = await CollectionRepository.getCollectionMovies(collectionId);
    const existing = new Set(colMovies.map((cm) => cm.movieId));

    const allLocal = await MovieRepository.getAll();
    const availableLocal = allLocal.filter((m) => !existing.has(m.id));

    localAvailableRef.current = availableLocal;
    setExistingMovieIds(existing);
    setDisplayedMovies((prev) => (prev.length ? prev : availableLocal.slice(0, 50)));
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    setSearchError(null);
    setErrorCode(null);
    setAllMatchesAlreadyInCollection(false);
  }, [collectionId]);

  useEffect(() => {
    if (!isOpen) return;
    loadInitialData();
  }, [isOpen, loadInitialData]);

  // Debounce search query (280ms) to avoid flooding TMDB and prevent race conditions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute two-layer search with race protection & latest-request-wins
  const executeSearch = useCallback(
    (query: string) => {
      if (!query) {
        setDisplayedMovies(localAvailableRef.current.slice(0, 50));
        setIsSearching(false);
        setSearchError(null);
        setErrorCode(null);
        setAllMatchesAlreadyInCollection(false);
        return () => {};
      }

      const controller = new AbortController();
      let isCancelled = false;
      setIsSearching(true);
      setSearchError(null);
      setErrorCode(null);
      setAllMatchesAlreadyInCollection(false);

      // 1. Instant local search preview
      UnifiedSearchService.searchLocal(query, {
        excludeMovieIds: existingMovieIds,
        maxResults: 40,
      }).then((localMatches) => {
        if (!isCancelled && !controller.signal.aborted) {
          setDisplayedMovies(localMatches);
        }
      });

      // 2. Full unified search (TMDB + Local merged & filtered strictly by current collection)
      UnifiedSearchService.searchUnified(query, {
        signal: controller.signal,
        excludeMovieIds: existingMovieIds,
        maxResults: 60,
      })
        .then(async (res) => {
          if (isCancelled || controller.signal.aborted) return;
          if (res.sequenceId < latestSequenceRef.current) return;
          latestSequenceRef.current = res.sequenceId;

          setDisplayedMovies(res.merged);
          setIsOffline(res.isOffline);

          if (res.tmdbError) {
            setSearchError(res.tmdbError);
            setErrorCode(res.errorCode);
          }

          // Distinguish between true zero results vs. all matching movies already in collection
          if (res.merged.length === 0) {
            // Check without collection exclusion to see if matching movies exist
            const unfilteredLocal = await UnifiedSearchService.searchLocal(query, { maxResults: 10 });
            if (unfilteredLocal.length > 0 && unfilteredLocal.every((m) => existingMovieIds.has(m.id))) {
              setAllMatchesAlreadyInCollection(true);
            } else {
              setAllMatchesAlreadyInCollection(false);
            }
          } else {
            setAllMatchesAlreadyInCollection(false);
          }
        })
        .catch((err: any) => {
          if (!isCancelled && !controller.signal.aborted) {
            setSearchError(err?.message || 'Search request failed');
            setErrorCode('NETWORK_ERROR');
          }
        })
        .finally(() => {
          if (!isCancelled && !controller.signal.aborted) {
            setIsSearching(false);
          }
        });

      return () => {
        isCancelled = true;
        controller.abort();
      };
    },
    [existingMovieIds]
  );

  useEffect(() => {
    return executeSearch(debouncedQuery);
  }, [debouncedQuery, executeSearch]);

  const toggleSelect = (movie: Movie) => {
    setSelectedMovieIds((prev) => {
      const next = new Set(prev);
      if (next.has(movie.id)) {
        next.delete(movie.id);
      } else {
        next.add(movie.id);
      }
      return next;
    });

    setSelectedMoviesMap((prev) => {
      const next = new Map(prev);
      if (next.has(movie.id)) {
        next.delete(movie.id);
      } else {
        next.set(movie.id, movie);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedMovieIds.size === 0) return;
    try {
      setIsSubmitting(true);

      // Ensure any newly added movie from TMDB is canonicalized into MovieRepository
      for (const movie of selectedMoviesMap.values()) {
        await UnifiedSearchService.ensureCanonicalMovie(movie);
      }

      await CollectionRepository.addMoviesToCollection(collectionId, Array.from(selectedMovieIds));
      onAdded();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    executeSearch(debouncedQuery);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add titles to "${collectionName}"`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-cinema-silver">
            {selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isSubmitting || selectedMovieIds.size === 0}
              className="cinema-button-primary px-5 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add to Collection</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col">
        {/* Search input with live status indicator */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movie title, Marvel, DC, Batman, Avengers..."
            className="cinema-input w-full pl-9 pr-10 text-xs sm:text-sm"
            autoFocus
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cinema-gold animate-spin">
              <Loader2 size={16} />
            </div>
          )}
        </div>

        {/* Offline indicator if searching without connection */}
        {isOffline && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-[11px] text-cinema-subtle">
            <WifiOff size={13} className="text-amber-400" />
            <span>Offline. Searching titles saved on this device.</span>
          </div>
        )}

        {/* Rate limited / Server error banner */}
        {searchError && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-2 text-xs text-red-300">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle size={14} className="flex-shrink-0 text-red-400" />
              <span className="truncate">
                {errorCode === 'RATE_LIMITED'
                  ? 'TMDB request limit reached. Try again shortly.'
                  : errorCode === 'AUTH_ERROR'
                  ? 'TMDB configuration needs attention.'
                  : isOffline
                  ? 'You are offline. Showing titles saved on this device.'
                  : 'Search is unavailable right now. Showing titles saved on this device.'}
              </span>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-[11px] font-semibold text-cinema-gold hover:underline cursor-pointer bg-transparent border-none p-0 flex-shrink-0"
            >
              <RefreshCw size={11} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Movie list with 2-layer feedback */}
        <div className="flex-grow overflow-y-auto pr-1 space-y-2">
          {displayedMovies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-cinema-subtle">
              <Film size={36} className="mb-2 opacity-40 text-cinema-gold" />
              <p className="text-sm font-medium text-cinema-white">
                {isSearching
                  ? 'Searching catalog & TMDB...'
                  : allMatchesAlreadyInCollection
                  ? 'All matching movies are already in this collection'
                  : debouncedQuery
                  ? `No movies found for "${debouncedQuery}"`
                  : 'No available movies found'}
              </p>
              <p className="text-xs text-cinema-subtle mt-1 max-w-sm">
                {allMatchesAlreadyInCollection
                  ? `All films matching "${debouncedQuery}" have already been added to "${collectionName}".`
                  : debouncedQuery
                  ? 'Try a different title.'
                  : 'Search for a movie or series.'}
              </p>
            </div>
          ) : (
            displayedMovies.map((movie) => {
              const isSelected = selectedMovieIds.has(movie.id);
              const poster = movie.posterPath ? tmdbService.getImageUrl(movie.posterPath, 'w92') : null;
              const year = movie.releaseDate ? movie.releaseDate.split('-')[0] : '';

              return (
                <div
                  key={movie.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${movie.title}${year ? `, ${year}` : ''}${movie.mediaType === 'tv' ? ', Series' : ', Movie'}`}
                  onClick={() => toggleSelect(movie)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSelect(movie);
                    }
                  }}
                  className={`flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cinema-gold bg-cinema-gold/10 shadow-sm'
                      : 'border-white/5 bg-[#131319] hover:bg-[#1C1C24] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div className="w-10 h-14 bg-[#09090B] rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                      {poster ? (
                        <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-cinema-subtle text-[9px] text-center p-1">
                          No Poster
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-semibold text-cinema-white line-clamp-1 break-words" title={movie.title}>
                          {movie.title}
                        </h4>
                      </div>
                      <p className="text-xs text-cinema-subtle mt-0.5">
                        {year}
                        {movie.voteAverage > 0 ? ` · ★ ${movie.voteAverage}` : ''}
                        {movie.franchiseTags && movie.franchiseTags.length > 0
                          ? ` · ${movie.franchiseTags.slice(0, 2).join(', ')}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected
                        ? 'bg-cinema-gold text-cinema-black shadow-gold'
                        : 'border border-white/20 text-transparent'
                    }`}
                  >
                    <Check size={14} className={isSelected ? 'block' : 'hidden'} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
