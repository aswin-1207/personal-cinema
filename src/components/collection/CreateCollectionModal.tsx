import React, { useState } from 'react';
import { Collection, CollectionCoverType, CollectionSortMode } from '../../types/collection';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { Modal } from '../common/Modal';
import { FolderPlus, Layers, Image as ImageIcon } from 'lucide-react';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverType, setCoverType] = useState<CollectionCoverType>('collage');
  const [sortMode, setSortMode] = useState<CollectionSortMode>('custom');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Collection name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const col = await CollectionRepository.create({
        name,
        description,
        coverType,
        sortMode,
      });
      setName('');
      setDescription('');
      onCreated(col);
      onClose();
    } catch (err) {
      setError('Failed to create collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Collection" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-cinema-crimson bg-cinema-crimson/10 border border-cinema-crimson/20 rounded-lg">
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
            placeholder="e.g. Christopher Nolan, Cozy Autumn, Noir Classics"
            className="cinema-input w-full"
            autoFocus
            maxLength={60}
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
            maxLength={250}
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
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs text-left transition-all ${
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
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs text-left transition-all ${
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
            <option value="custom">Custom (Drag & Reorder)</option>
            <option value="releaseDate">Release Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="rating">Rating (Highest First)</option>
            <option value="watchedStatus">Watch Status</option>
          </select>
        </div>

        <div className="sticky bottom-0 bg-[#131319] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 border-t border-white/[0.08] flex justify-end gap-3 z-10">
          <button type="button" onClick={onClose} className="cinema-button-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="cinema-button-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <FolderPlus size={16} />
            <span>Create Collection</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
