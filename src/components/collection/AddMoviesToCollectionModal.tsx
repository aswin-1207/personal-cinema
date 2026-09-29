import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { Movie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { Search, Check, Plus, Film } from 'lucide-react';

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
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [existingMovieIds, setExistingMovieIds] = useState<Set<number>>(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      const libraryMovies = await MovieRepository.getAll();
      const colMovies = await CollectionRepository.getCollectionMovies(collectionId);
      const existing = new Set(colMovies.map((cm) => cm.movieId));

      setAllMovies(libraryMovies);
      setExistingMovieIds(existing);
      setSelectedMovieIds(new Set());
      setSearchQuery('');
    }

    load();
  }, [isOpen, collectionId]);

  const toggleSelect = (movieId: number) => {
    setSelectedMovieIds((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedMovieIds.size === 0) return;
    try {
      setIsSubmitting(true);
      await CollectionRepository.addMoviesToCollection(collectionId, Array.from(selectedMovieIds));
      onAdded();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMovies = allMovies.filter((m) => {
    if (existingMovieIds.has(m.id)) return false;
    if (!searchQuery.trim()) return true;
    return m.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Movies to "${collectionName}"`}
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col h-[70vh] max-h-[600px]">
        {/* Search input */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="cinema-input w-full pl-9"
          />
        </div>

        {/* Movie list */}
        <div className="flex-grow overflow-y-auto pr-1 space-y-2">
          {filteredMovies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-cinema-subtle">
              <Film size={36} className="mb-2 opacity-40 text-cinema-gold" />
              <p className="text-sm font-medium">No available movies found</p>
              <p className="text-xs text-cinema-subtle mt-1">
                {allMovies.length === 0
                  ? 'Your library is empty. Add movies to your library first!'
                  : 'All matching movies are already in this collection.'}
              </p>
            </div>
          ) : (
            filteredMovies.map((movie) => {
              const isSelected = selectedMovieIds.has(movie.id);
              const poster = movie.posterPath ? tmdbService.getImageUrl(movie.posterPath, 'w92') : null;
              const year = movie.releaseDate ? movie.releaseDate.split('-')[0] : '';

              return (
                <div
                  key={movie.id}
                  onClick={() => toggleSelect(movie.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cinema-gold bg-cinema-gold/10'
                      : 'border-white/5 bg-cinema-charcoal/40 hover:bg-cinema-surface hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 bg-cinema-charcoal rounded overflow-hidden flex-shrink-0">
                      {poster ? (
                        <img src={poster} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-cinema-subtle text-[10px]">
                          No Poster
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-cinema-white line-clamp-1">{movie.title}</h4>
                      <p className="text-xs text-cinema-subtle">
                        {year} {movie.runtime ? `· ${movie.runtime}m` : ''}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
          <div className="text-xs text-cinema-silver">
            {selectedMovieIds.size} movie{selectedMovieIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="cinema-button-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isSubmitting || selectedMovieIds.size === 0}
              className="cinema-button-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              <span>Add to Collection</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
