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

  // Reset state when modal opens or closes
  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCoverType('collage');
      setSortMode('custom');
      setIsSubmitting(false);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Collection name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const col = await CollectionRepository.create({
        name: trimmed,
        description: description.trim(),
        coverType,
        sortMode,
      });
      setName('');
      setDescription('');
      onCreated(col);
      onClose();
    } catch (err: any) {
      console.error('Failed to create collection:', err);
      setError(err?.message || 'Failed to create collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Collection"
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
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="cinema-button-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-gold"
          >
            <FolderPlus size={15} />
            <span>{isSubmitting ? 'Creating...' : 'Create Collection'}</span>
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
            placeholder="e.g. Christopher Nolan, Cozy Autumn, Noir Classics"
            className="cinema-input w-full text-sm"
            autoFocus
            maxLength={60}
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
            maxLength={250}
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
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all cursor-pointer ${
                coverType === 'collage'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <Layers size={18} />
              <div className="font-semibold text-center">Poster Collage</div>
            </button>

            <button
              type="button"
              onClick={() => setCoverType('hero')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all cursor-pointer ${
                coverType === 'hero'
                  ? 'border-cinema-gold bg-cinema-gold/10 text-cinema-gold shadow-gold'
                  : 'border-white/10 bg-cinema-charcoal/50 text-cinema-silver hover:border-white/20'
              }`}
            >
              <ImageIcon size={18} />
              <div className="font-semibold text-center">Hero Backdrop</div>
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
            <option value="custom">Custom (Drag & Reorder)</option>
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
