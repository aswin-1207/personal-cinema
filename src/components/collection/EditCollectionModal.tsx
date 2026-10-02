import React, { useState, useEffect } from 'react';
import { Collection, CollectionCoverType, CollectionSortMode } from '../../types/collection';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { Modal } from '../common/Modal';
import { Layers, Image as ImageIcon, Save } from 'lucide-react';

interface EditCollectionModalProps {
  isOpen: boolean;
  collection: Collection;
  onClose: () => void;
  onUpdated: (collection: Collection) => void;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  collection,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || '');
  const [coverType, setCoverType] = useState<CollectionCoverType>(collection.coverType || 'collage');
  const [sortMode, setSortMode] = useState<CollectionSortMode>(collection.sortMode || 'custom');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(collection.name);
      setDescription(collection.description || '');
      setCoverType(collection.coverType || 'collage');
      setSortMode(collection.sortMode || 'custom');
      setError('');
    }
  }, [isOpen, collection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Collection name cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const updated: Collection = {
        ...collection,
        name: trimmed,
        description: description.trim(),
        coverType,
        sortMode,
        updatedAt: new Date().toISOString(),
      };

      await CollectionRepository.update(updated);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Collection" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-500/20 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
            Collection Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Christopher Nolan, Marvel Universe"
            className="cinema-input w-full"
            autoFocus
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note about the theme or purpose of this collection..."
            className="cinema-input w-full h-20 resize-none"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
            Cover Style
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCoverType('collage')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs text-left transition-all cursor-pointer ${
                coverType === 'collage'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <Layers size={20} />
              <div className="text-center font-medium">Poster Collage</div>
              <div className="text-[10px] text-cinema-subtle text-center">
                Dynamic 2x2 grid of top movies
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCoverType('hero')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs text-left transition-all cursor-pointer ${
                coverType === 'hero'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <ImageIcon size={20} />
              <div className="text-center font-medium">Hero Backdrop</div>
              <div className="text-[10px] text-cinema-subtle text-center">
                Cinematic banner of lead movie
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
            Default Movie Order
          </label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as CollectionSortMode)}
            className="cinema-input w-full"
          >
            <option value="custom">Custom (Drag & Reorder Sequence)</option>
            <option value="releaseDate">Release Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="rating">Rating (Highest First)</option>
            <option value="watchedStatus">Watch Status</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="cinema-button-secondary px-4 py-2 text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="cinema-button-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
