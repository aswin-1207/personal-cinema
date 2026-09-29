import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { CollectionWithMovies } from '../../src/types/collection';
import { MovieCard } from '../components/movie/MovieCard';
import { AddMoviesToCollectionModal } from '../components/collection/AddMoviesToCollectionModal';
import { CollectionShareModal } from '../components/share/CollectionShareModal';
import { CollectionCompletionModal } from '../components/collection/CollectionCompletionModal';
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);
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
      <div className="py-20 text-center text-cinema-subtle">
        <div className="w-10 h-10 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading collection...</p>
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
    <div className="space-y-6 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-cinema-subtle hover:text-cinema-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Collections</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsShareOpen(true)}
            className="cinema-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>

          <button
            onClick={handleDeleteCollection}
            className="p-1.5 rounded-lg text-cinema-subtle hover:text-cinema-crimson transition-colors"
            title="Delete Collection"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="p-6 rounded-2xl bg-cinema-surface/70 border border-white/5 relative overflow-hidden">
        {/* Glow if complete */}
        {progress.isComplete && (
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-cinema-gold/15 rounded-full blur-2xl pointer-events-none" />
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            {progress.isComplete && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cinema-gold/20 border border-cinema-gold/40 text-cinema-gold text-xs font-semibold mb-3 shadow-gold">
                <Trophy size={14} />
                <span>Collection Mastered (100% Watched)</span>
              </div>
            )}

            <h1 className="font-serif font-extrabold text-3xl sm:text-4xl text-cinema-white mb-2">
              {collection.name}
            </h1>

            {collection.description && (
              <p className="text-sm text-cinema-silver leading-relaxed mb-4">
                {collection.description}
              </p>
            )}

            {/* Derived Progress Bar */}
            <div className="space-y-1.5 max-w-md">
              <div className="flex justify-between text-xs text-cinema-silver">
                <span>
                  {progress.watched} of {progress.total} movies completed
                </span>
                <span className={`font-semibold ${progress.isComplete ? 'text-cinema-gold' : ''}`}>
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 bg-cinema-charcoal rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress.isComplete
                      ? 'bg-gradient-to-r from-cinema-amber to-cinema-gold shadow-gold'
                      : 'bg-cinema-gold'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => setIsAddOpen(true)}
              className="cinema-button-primary px-5 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-gold"
            >
              <Plus size={15} />
              <span>Add Movies</span>
            </button>

            {movies.length > 1 && (
              <button
                onClick={() => setReorderMode(!reorderMode)}
                className={`cinema-button-secondary px-4 py-2.5 text-xs flex items-center justify-center gap-1.5 ${
                  reorderMode ? 'border-cinema-gold text-cinema-gold' : ''
                }`}
              >
                <ArrowUpDown size={15} />
                <span>{reorderMode ? 'Done Reordering' : 'Reorder List'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-white/10 pb-3 gap-3">
        {(['all', 'unwatched', 'watching', 'watched'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === mode
                ? 'bg-cinema-gold text-cinema-black'
                : 'text-cinema-silver hover:text-cinema-white bg-cinema-surface/50'
            }`}
          >
            {mode === 'all'
              ? `All (${movies.length})`
              : mode === 'watched'
              ? `Watched (${progress.watched})`
              : mode === 'watching'
              ? `Watching (${progress.watching})`
              : `Unwatched (${progress.unwatched})`}
          </button>
        ))}
      </div>

      {/* Movie Grid or Reorder List */}
      {filteredMovies.length === 0 ? (
        <EmptyState
          title={`No ${filter} movies in this collection`}
          description={
            movies.length === 0
              ? 'This collection is empty. Click below to add movies from your library.'
              : 'Switch filters or add more films to this collection.'
          }
          actionLabel={movies.length === 0 ? 'Add Movies' : undefined}
          onAction={movies.length === 0 ? () => setIsAddOpen(true) : undefined}
        />
      ) : reorderMode ? (
        /* Reorder List View */
        <div className="space-y-2">
          {movies.map((item, idx) => (
            <div
              key={item.movie.id}
              className="flex items-center justify-between p-3 rounded-xl bg-cinema-surface border border-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-cinema-gold w-6">#{idx + 1}</span>
                <span className="font-medium text-cinema-white text-sm">{item.movie.title}</span>
                <span className="text-xs text-cinema-subtle">
                  ({item.movie.releaseDate?.substring(0, 4) || 'N/A'})
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={idx === 0}
                  onClick={() => handleMoveMovie(idx, idx - 1)}
                  className="p-1.5 rounded bg-cinema-charcoal hover:bg-cinema-surfaceElevated disabled:opacity-30 text-cinema-silver"
                  title="Move Up"
                >
                  <MoveUp size={15} />
                </button>
                <button
                  disabled={idx === movies.length - 1}
                  onClick={() => handleMoveMovie(idx, idx + 1)}
                  className="p-1.5 rounded bg-cinema-charcoal hover:bg-cinema-surfaceElevated disabled:opacity-30 text-cinema-silver"
                  title="Move Down"
                >
                  <MoveDown size={15} />
                </button>
                <button
                  onClick={() => handleRemoveMovie(item.movie.id)}
                  className="p-1.5 rounded text-cinema-crimson hover:bg-cinema-crimson/10 ml-2"
                  title="Remove from Collection"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Standard Movie Cards Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {filteredMovies.map((item) => (
            <div key={item.movie.id} className="relative group">
              <MovieCard
                movie={item.movie}
                userData={item.userData}
                onClick={() => openMovieDetail(item.movie.id)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMovie(item.movie.id);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-cinema-black/80 text-cinema-subtle hover:text-cinema-crimson opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                title="Remove from collection"
              >
                <X size={13} />
              </button>
            </div>
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

      {/* Share Collection Modal */}
      {collectionData && (
        <CollectionShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          collectionData={collectionData}
        />
      )}

      {/* 100% Completion Celebration Modal */}
      {showCompletionModal && (
        <CollectionCompletionModal
          collection={collection}
          onClose={() => setShowCompletionModal(false)}
          onShare={() => setIsShareOpen(true)}
        />
      )}
    </div>
  );
};
