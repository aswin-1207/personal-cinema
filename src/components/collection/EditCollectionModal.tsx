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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Collection"
      maxWidth="max-w-md"
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="cinema-button-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            <span>Save Changes</span>
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {error && (
          <div className="p-2.5 text-xs text-cinema-crimson bg-cinema-crimson/10 border border-cinema-crimson/20 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#9E9DA5] mb-1 font-semibold">
            Collection Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Christopher Nolan, Marvel Universe"
            className="cinema-input w-full text-sm"
            autoFocus
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#9E9DA5] mb-1 font-semibold">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note about the theme or purpose of this collection..."
            className="cinema-input w-full h-16 resize-none text-xs"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#9E9DA5] mb-1 font-semibold">
            Cover Style
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setCoverType('collage')}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs text-left transition-all cursor-pointer ${
                coverType === 'collage'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <Layers size={18} />
              <div className="font-semibold text-center">Poster Collage</div>
              <div className="text-[10px] text-[#9E9DA5] text-center">2x2 grid of top movies</div>
            </button>

            <button
              type="button"
              onClick={() => setCoverType('hero')}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs text-left transition-all cursor-pointer ${
                coverType === 'hero'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <ImageIcon size={18} />
              <div className="font-semibold text-center">Hero Backdrop</div>
              <div className="text-[10px] text-[#9E9DA5] text-center">Lead movie banner</div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-[#9E9DA5] mb-1 font-semibold">
            Default Movie Order
          </label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as CollectionSortMode)}
            className="cinema-input w-full text-xs"
          >
            <option value="custom">Custom (Drag & Reorder Sequence)</option>
            <option value="releaseDate">Release Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="rating">Rating (Highest First)</option>
            <option value="watchedStatus">Watch Status</option>
          </select>
        </div>
      </div>
    </Modal>
  );
};
