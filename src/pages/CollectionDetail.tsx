import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { CollectionWithMovies, CollectionSortMode } from '../types/collection';
import { MoviePoster } from '../components/movie/MoviePoster';
import { AddMoviesToCollectionModal } from '../components/collection/AddMoviesToCollectionModal';
import { EditCollectionModal } from '../components/collection/EditCollectionModal';
import { CollectionShareModal } from '../components/share/CollectionShareModal';
import { EmptyState } from '../components/common/EmptyState';
import {
  ArrowLeft,
  Share2,
  Plus,
  Trash2,
  Edit3,
  Film,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  X,
  Layers,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react';

interface CollectionDetailProps {
  collectionId: string;
  onBack: () => void;
}

export const CollectionDetail: React.FC<CollectionDetailProps> = ({ collectionId, onBack }) => {
  const { openMovieDetail, showToast, dataVersion, notifyDataChanged } = useCinema();

  const [collectionData, setCollectionData] = useState<CollectionWithMovies | null>(null);
  const [filter, setFilter] = useState<'all' | 'watched' | 'watching' | 'unwatched'>('all');
  const [activeSort, setActiveSort] = useState<CollectionSortMode | 'releaseDateDesc'>('custom');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const loadData = async () => {
    const data = await CollectionRepository.getWithMovies(collectionId);
    setCollectionData(data);
    if (data?.collection.sortMode) {
      setActiveSort(data.collection.sortMode);
    }
  };

  useEffect(() => {
    loadData();
  }, [collectionId, dataVersion]);

  const movies = collectionData?.movies || [];
  const progress = collectionData?.progress;
  const collection = collectionData?.collection;

  // Find next unwatched movie according to collection order (Section 57)
  const nextUnwatchedMovie = useMemo(() => {
    if (!progress || progress.isComplete || progress.unwatched === 0) return null;
    return movies.find((item) => item.userData?.status !== 'watched') || null;
  }, [movies, progress]);

  // Sorting and Filtering
  const displayedMovies = useMemo(() => {
    if (!collection) return [];
    // 1. Filter
    let list = movies.filter((item) => {
      if (filter === 'watched') return item.userData?.status === 'watched';
      if (filter === 'watching') return item.userData?.status === 'watching';
      if (filter === 'unwatched') return item.userData?.status !== 'watched';
      return true;
    });

    // 2. Sort
    return [...list].sort((a, b) => {
      switch (activeSort) {
        case 'custom': {
          const idxA = collection.customOrder.indexOf(a.movie.id);
          const idxB = collection.customOrder.indexOf(b.movie.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          return a.position - b.position;
        }
        case 'releaseDate': {
          const dateA = a.movie.releaseDate || '0000';
          const dateB = b.movie.releaseDate || '0000';
          return dateA.localeCompare(dateB);
        }
        case 'releaseDateDesc': {
          const dateA = a.movie.releaseDate || '0000';
          const dateB = b.movie.releaseDate || '0000';
          return dateB.localeCompare(dateA);
        }
        case 'title':
          return a.movie.title.localeCompare(b.movie.title);
        case 'rating': {
          const rA = a.userData?.personalRating ?? a.movie.voteAverage ?? 0;
          const rB = b.userData?.personalRating ?? b.movie.voteAverage ?? 0;
          return rB - rA;
        }
        case 'watchedStatus': {
          const order: Record<string, number> = { watched: 0, watching: 1, want_to_watch: 2 };
          const sA = order[a.userData?.status || 'want_to_watch'] ?? 3;
          const sB = order[b.userData?.status || 'want_to_watch'] ?? 3;
          return sA - sB;
        }
        default:
          return a.position - b.position;
      }
    });
  }, [movies, filter, activeSort, collection]);

  if (!collectionData || !collection || !progress) {
    return (
      <div className="py-20 text-center text-[#5C5B64]">
        <div className="w-10 h-10 rounded-full border-2 border-[#1C1C24] border-t-[#E0AD52] animate-spin mx-auto mb-3" />
        <p className="text-xs font-serif text-[#9E9DA5]">Loading Collection...</p>
      </div>
    );
  }

  const handleDeleteCollection = async () => {
    if (
      confirm(
        `Are you sure you want to delete "${collection.name}"? This removes the collection grouping, but your movies, watchlist, and watched history will remain.`
      )
    ) {
      await CollectionRepository.delete(collection.id);
      showToast(`Collection "${collection.name}" deleted.`);
      notifyDataChanged();
      onBack();
    }
  };

  const handleRemoveMovie = async (movieId: number) => {
    await CollectionRepository.removeMovieFromCollection(collection.id, movieId);
    showToast('Movie removed from collection.');
    loadData();
    notifyDataChanged();
  };

  const handleMoveMovie = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= movies.length) return;
    const currentOrder = movies.map((m) => m.movie.id);
    const [moved] = currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, moved);

    await CollectionRepository.updateMovieOrder(collection.id, currentOrder);
    loadData();
  };

  const finalMovieItem = collection.finalMovieId
    ? movies.find((m) => m.movie.id === collection.finalMovieId)
    : movies.length > 0
    ? movies[movies.length - 1]
    : null;

  return (
    <div className="space-y-5 sm:space-y-6 pb-4 select-none animate-cinema-fade">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F3EB] transition-colors cursor-pointer border-none min-h-[44px]"
        >
          <ArrowLeft size={16} />
          <span>Back to Collections</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditOpen(true)}
            className="cinema-button-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            title="Edit Collection Name & Cover"
          >
            <Edit3 size={13} />
            <span>Edit</span>
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className="cinema-button-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Share2 size={13} />
            <span>Share Collection</span>
          </button>

          <button
            onClick={handleDeleteCollection}
            className="p-2.5 rounded-xl text-[#9E9DA5] hover:text-[#EF4444] hover:bg-red-950/30 transition-colors cursor-pointer border-none bg-transparent min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Delete Collection"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Universe Hero Stage */}
      <div className="p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#131319] to-[#0E0E14] border border-[#E0AD52]/30 relative overflow-hidden shadow-2xl">
        {/* Subtle Ambient Gold Glow if complete */}
        {progress.isComplete && (
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#E0AD52]/20 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-[#E0AD52] text-[11px] font-bold tracking-[0.18em] uppercase">
              <Layers size={14} />
              <span>COLLECTION</span>
            </div>

            {progress.isComplete && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E0AD52]/10 border border-[#E0AD52]/30 text-[#E0AD52] text-xs font-semibold tracking-wide">
                <CheckCircle2 size={13} className="text-[#E0AD52]" />
                <span>COLLECTION COMPLETE ✓</span>
              </div>
            )}

            <h1 className="font-hero-title text-2xl sm:text-4xl text-[#F5F3EB]">
              {collection.name}
            </h1>

            {collection.description && (
              <p className="text-xs sm:text-sm text-[#F5F3EB]/80 leading-relaxed max-w-xl">
                {collection.description}
              </p>
            )}

            {/* Derived Progress Bar */}
            <div className="space-y-1.5 max-w-md pt-2">
              <div className="flex justify-between text-xs text-[#9E9DA5]">
                <span>
                  {progress.watched} of {progress.total} films watched
                  {!progress.isComplete && progress.unwatched > 0
                    ? ` · ${progress.unwatched} remaining`
                    : ''}
                </span>
                <span className={`font-bold ${progress.isComplete ? 'text-[#E0AD52]' : 'text-[#F5F3EB]'}`}>
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#09090B] rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    progress.isComplete
                      ? 'bg-gradient-to-r from-[#D99C33] to-[#E0AD52] shadow-[0_0_12px_rgba(224,173,82,0.4)]'
                      : 'bg-[#E0AD52]'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsAddOpen(true)}
              className="cinema-button-primary px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(224,173,82,0.35)] cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Movies</span>
            </button>

            {movies.length > 1 && (
              <button
                onClick={() => {
                  setReorderMode(!reorderMode);
                  if (!reorderMode) setActiveSort('custom');
                }}
                className={`cinema-button-secondary px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  reorderMode ? 'border-[#E0AD52] text-[#E0AD52]' : ''
                }`}
              >
                <ArrowUpDown size={15} />
                <span>{reorderMode ? 'Done Reordering' : 'Reorder Sequence'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Next Unwatched Spotlight (Section 57) */}
      {!progress.isComplete && nextUnwatchedMovie && (
        <div
          onClick={() => openMovieDetail(nextUnwatchedMovie.movie.id)}
          className="p-3.5 sm:p-4 rounded-2xl bg-[#131319]/80 border border-white/10 hover:border-[#E0AD52]/40 transition-all cursor-pointer flex items-center justify-between gap-4 group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#09090D] flex-shrink-0 border border-white/5">
              {nextUnwatchedMovie.movie.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${nextUnwatchedMovie.movie.posterPath}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[#5C5B64]">
                  Film
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#E0AD52] flex items-center gap-1.5">
                <PlayCircle size={12} />
                <span>NEXT UNWATCHED IN SEQUENCE</span>
              </div>
              <h4 className="font-serif font-bold text-sm text-[#F5F3EB] group-hover:text-[#E0AD52] transition-colors truncate mt-0.5">
                {nextUnwatchedMovie.movie.title}
              </h4>
              <p className="text-[11px] text-[#9E9DA5] truncate">
                {nextUnwatchedMovie.movie.releaseDate ? nextUnwatchedMovie.movie.releaseDate.split('-')[0] : ''}
                {nextUnwatchedMovie.movie.runtime ? ` · ${nextUnwatchedMovie.movie.runtime} min` : ''}
              </p>
            </div>
          </div>
          <span className="cinema-button-ghost text-xs text-[#E0AD52] group-hover:translate-x-1 transition-transform flex-shrink-0">
            View Movie →
          </span>
        </div>
      )}

      {/* The Final Film Memory Card if Completed (Section 43 & 44) */}
      {progress.isComplete && finalMovieItem && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#131319] to-[#0D0D12] border border-[#E0AD52]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-md bg-[#18181B]">
              {finalMovieItem.movie.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${finalMovieItem.movie.posterPath}`}
                  alt={finalMovieItem.movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#E0AD52]">
                  <Film size={20} />
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#E0AD52]">
                THE FINAL FILM
              </div>
              <div className="font-serif font-bold text-base text-[#F5F3EB] mt-0.5">
                {finalMovieItem.movie.title}
              </div>
              <div className="text-xs text-[#9E9DA5] mt-0.5">
                Concluded this cinematic journey
                {collection.completedAt
                  ? ` on ${new Date(collection.completedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`
                  : ''}
                .
              </div>
            </div>
          </div>
          <button
            onClick={() => openMovieDetail(finalMovieItem.movie.id)}
            className="cinema-button-secondary text-xs px-3.5 py-1.5 self-end sm:self-center flex items-center gap-1.5 text-[#E0AD52] hover:text-[#D49B35] cursor-pointer"
          >
            <span>Screening Record</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* Filter Tabs & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        {/* Core Filters: ALL | WATCHED | WATCHING | UNWATCHED */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(['all', 'unwatched', 'watching', 'watched'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border-none ${
                filter === mode
                  ? 'bg-[#E0AD52] text-[#09090B] font-bold shadow-md'
                  : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              {mode === 'all'
                ? `All (${movies.length})`
                : mode === 'unwatched'
                ? `Unwatched (${progress.unwatched})`
                : mode === 'watching'
                ? `Watching (${progress.watching})`
                : `Watched (${progress.watched})`}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown (Section 19) */}
        {!reorderMode && movies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9E9DA5] uppercase tracking-wider font-semibold">Sort:</span>
            <select
              value={activeSort}
              onChange={(e) => setActiveSort(e.target.value as any)}
              className="bg-[#131319] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-[#F5F3EB] outline-none cursor-pointer"
            >
              <option value="custom">Custom Sequence</option>
              <option value="releaseDate">Release Date (Oldest)</option>
              <option value="releaseDateDesc">Release Date (Newest)</option>
              <option value="title">Title (A-Z)</option>
              <option value="rating">Rating (Highest)</option>
              <option value="watchedStatus">Watched Status</option>
            </select>
          </div>
        )}
      </div>

      {/* Transition into Poster Wall / Reorder Sequence */}
      {displayedMovies.length === 0 ? (
        <EmptyState
          title={`No ${filter === 'all' ? '' : filter} movies in this collection`}
          description={
            filter === 'all'
              ? 'Add movies to this collection to start curating your journey.'
              : 'Switch filters or add more films to this collection.'
          }
          actionText="Add Movies"
          onAction={() => setIsAddOpen(true)}
        />
      ) : reorderMode ? (
        /* Reorder Sequence Mode */
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs text-[#9E9DA5] mb-3">
            Use the arrows to adjust the screening order. Changes are saved automatically.
          </p>
          {movies.map((item, index) => (
            <div
              key={item.movie.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[#131319] border border-white/5 gap-2"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="text-xs font-mono text-[#E0AD52] w-6 flex-shrink-0">{index + 1}.</span>
                <span
                  className="text-sm font-semibold text-[#F5F3EB] line-clamp-1 break-words truncate"
                  title={item.movie.title}
                >
                  {item.movie.title}
                </span>
                {item.userData?.status === 'watched' && (
                  <span className="text-[10px] text-[#E0AD52] bg-[#E0AD52]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                    ✓ Watched
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleMoveMovie(index, index - 1)}
                  disabled={index === 0}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#F5F3EB] cursor-pointer"
                  title="Move Up"
                  aria-label={`Move ${item.movie.title} up`}
                >
                  <MoveUp size={14} />
                </button>
                <button
                  onClick={() => handleMoveMovie(index, index + 1)}
                  disabled={index === movies.length - 1}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#F5F3EB] cursor-pointer"
                  title="Move Down"
                  aria-label={`Move ${item.movie.title} down`}
                >
                  <MoveDown size={14} />
                </button>
                <button
                  onClick={() => handleRemoveMovie(item.movie.id)}
                  className="p-1.5 rounded bg-red-950/40 text-red-400 hover:bg-red-900/60 ml-2 cursor-pointer"
                  title="Remove from Collection"
                  aria-label={`Remove ${item.movie.title} from collection`}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Visual Poster Wall with 2:3 Aspect Ratio */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {displayedMovies.map((item) => (
            <MoviePoster
              key={item.movie.id}
              movie={item.movie}
              userData={item.userData}
              className="w-full"
              onClick={() => openMovieDetail(item.movie.id)}
            />
          ))}
        </div>
      )}

      {/* Add Movies Modal */}
      <AddMoviesToCollectionModal
        isOpen={isAddOpen}
        collectionId={collection.id}
        collectionName={collection.name}
        onClose={() => setIsAddOpen(false)}
        onAdded={() => {
          loadData();
          notifyDataChanged();
        }}
      />

      {/* Edit Collection Modal */}
      <EditCollectionModal
        isOpen={isEditOpen}
        collection={collection}
        onClose={() => setIsEditOpen(false)}
        onUpdated={(updated) => {
          setCollectionData((prev) => (prev ? { ...prev, collection: updated } : null));
          loadData();
          notifyDataChanged();
        }}
      />

      {/* Collection Share Modal */}
      <CollectionShareModal
        isOpen={isShareOpen}
        collectionData={collectionData}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};
