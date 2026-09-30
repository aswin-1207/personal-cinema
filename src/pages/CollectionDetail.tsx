import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { CollectionWithMovies } from '../../src/types/collection';
import { MoviePoster } from '../components/movie/MoviePoster';
import { AddMoviesToCollectionModal } from '../components/collection/AddMoviesToCollectionModal';
import { CollectionShareModal } from '../components/share/CollectionShareModal';
import { EmptyState } from '../components/common/EmptyState';
import {
  ArrowLeft,
  Share2,
  Plus,
  Trash2,
  Trophy,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  X,
  Layers,
} from 'lucide-react';

interface CollectionDetailProps {
  collectionId: string;
  onBack: () => void;
}

export const CollectionDetail: React.FC<CollectionDetailProps> = ({ collectionId, onBack }) => {
  const { openMovieDetail, showToast, dataVersion, notifyDataChanged } = useCinema();

  const [collectionData, setCollectionData] = useState<CollectionWithMovies | null>(null);
  const [filter, setFilter] = useState<'all' | 'watched' | 'watching' | 'unwatched'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const loadData = async () => {
    const data = await CollectionRepository.getWithMovies(collectionId);
    setCollectionData(data);
  };

  useEffect(() => {
    loadData();
  }, [collectionId, dataVersion]);

  if (!collectionData) {
    return (
      <div className="py-20 text-center text-[#5C5B64]">
        <div className="w-10 h-10 rounded-full border-2 border-[#1E2029] border-t-[#EDC257] animate-spin mx-auto mb-3" />
        <p className="text-xs font-serif">Entering Universe...</p>
      </div>
    );
  }

  const { collection, movies, progress } = collectionData;

  const handleDeleteCollection = async () => {
    if (confirm(`Are you sure you want to delete "${collection.name}"? Movies in your library will not be deleted.`)) {
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

  const filteredMovies = movies.filter((item) => {
    if (filter === 'watched') return item.userData?.status === 'watched';
    if (filter === 'watching') return item.userData?.status === 'watching';
    if (filter === 'unwatched') return item.userData?.status !== 'watched';
    return true;
  });

  return (
    <div className="space-y-8 pb-24 select-none animate-cinema-fade">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-[#9E9DA5] hover:text-[#F5F2F0] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Collections</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsShareOpen(true)}
            className="cinema-button-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Share2 size={14} />
            <span>Share Saga</span>
          </button>

          <button
            onClick={handleDeleteCollection}
            className="p-2 rounded-xl text-[#9E9DA5] hover:text-[#B81C28] hover:bg-red-950/30 transition-colors"
            title="Delete Collection"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Universe Establishing Hero Stage (Section 33) */}
      <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#171924] to-[#10121A] border border-[#EDC257]/30 relative overflow-hidden shadow-2xl">
        {/* Subtle Ambient Glow if 100% complete */}
        {progress.isComplete && (
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#EDC257]/20 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-[#EDC257] text-[11px] font-bold tracking-[0.18em] uppercase">
              <Layers size={14} />
              <span>CURATED MOVIE UNIVERSE</span>
            </div>

            {progress.isComplete && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDC257]/15 border border-[#EDC257]/40 text-[#EDC257] text-xs font-black shadow-[0_2px_12px_rgba(237,194,87,0.3)]">
                <Trophy size={14} />
                <span>COLLECTION MASTERED ✓</span>
              </div>
            )}

            <h1 className="font-hero-title">
              {collection.name}
            </h1>

            {collection.description && (
              <p className="text-xs sm:text-sm text-[#F5F2F0]/80 leading-relaxed max-w-xl">
                {collection.description}
              </p>
            )}

            {/* Derived Thin Progress Bar (Section 34) */}
            <div className="space-y-1.5 max-w-md pt-2">
              <div className="flex justify-between text-xs text-[#9E9DA5]">
                <span>
                  {progress.watched} of {progress.total} movies completed
                </span>
                <span className={`font-bold ${progress.isComplete ? 'text-[#EDC257]' : 'text-[#F5F2F0]'}`}>
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#09090D] rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    progress.isComplete
                      ? 'bg-gradient-to-r from-[#D99C33] to-[#EDC257] shadow-[0_0_12px_rgba(237,194,87,0.4)]'
                      : 'bg-[#EDC257]'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsAddOpen(true)}
              className="cinema-button-primary px-6 py-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(237,194,87,0.35)]"
            >
              <Plus size={15} />
              <span>Add Movies</span>
            </button>

            {movies.length > 1 && (
              <button
                onClick={() => setReorderMode(!reorderMode)}
                className={`cinema-button-secondary px-4 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  reorderMode ? 'border-[#EDC257] text-[#EDC257]' : ''
                }`}
              >
                <ArrowUpDown size={15} />
                <span>{reorderMode ? 'Done Reordering' : 'Reorder Sequence'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-white/[0.08] pb-3 gap-2">
        {(['all', 'unwatched', 'watching', 'watched'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer border-none ${
              filter === mode
                ? 'bg-[#EDC257] text-[#09090D] shadow-md'
                : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F2F0]'
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

      {/* Transition into Poster Wall (Section 33) */}
      {filteredMovies.length === 0 ? (
        <EmptyState
          title={`No ${filter} movies in this saga`}
          description={
            filter === 'all'
              ? 'Add movies to this collection to start curating your journey.'
              : 'Switch filters or add more films.'
          }
          actionText="Add Movies"
          onAction={() => setIsAddOpen(true)}
        />
      ) : reorderMode ? (
        /* Reorder Sequence Mode with Strict Boundary Containment */
        <div className="space-y-2">
          {movies.map((item, index) => (
            <div
              key={item.movie.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[#131319] border border-white/5 gap-2"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="text-xs font-mono text-[#E0AD52] w-6 flex-shrink-0">{index + 1}.</span>
                <span className="text-sm font-semibold text-[#F5F3EB] line-clamp-1 break-words truncate" title={item.movie.title}>
                  {item.movie.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleMoveMovie(index, index - 1)}
                  disabled={index === 0}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#F5F3EB] cursor-pointer"
                  title="Move Up"
                >
                  <MoveUp size={14} />
                </button>
                <button
                  onClick={() => handleMoveMovie(index, index + 1)}
                  disabled={index === movies.length - 1}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#F5F3EB] cursor-pointer"
                  title="Move Down"
                >
                  <MoveDown size={14} />
                </button>
                <button
                  onClick={() => handleRemoveMovie(item.movie.id)}
                  className="p-1.5 rounded bg-red-950/40 text-red-400 hover:bg-red-900/60 ml-2 cursor-pointer"
                  title="Remove from Collection"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Visual Poster Wall with 2:3 Aspect Ratio */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredMovies.map((item) => (
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

      {/* Collection Share Modal */}
      <CollectionShareModal
        isOpen={isShareOpen}
        collectionData={collectionData}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};
