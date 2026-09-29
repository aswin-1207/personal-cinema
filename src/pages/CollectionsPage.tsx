import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { Collection } from '../types/collection';
import { CollectionCard } from '../components/collection/CollectionCard';
import { CreateCollectionModal } from '../components/collection/CreateCollectionModal';
import { EmptyState } from '../components/common/EmptyState';
import { FolderPlus, Trophy } from 'lucide-react';

export const CollectionsPage: React.FC = () => {
  const { openCollectionDetail, dataVersion } = useCinema();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const all = await CollectionRepository.getAll();
      setCollections(all);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [dataVersion]);

  const completedCount = collections.filter((c) => Boolean(c.completedAt)).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-3xl text-cinema-white">Curated Collections</h1>
          <p className="text-xs text-cinema-subtle mt-0.5">
            Organize films by director, franchise, cinematic universe, or personal theme.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {completedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cinema-gold/10 border border-cinema-gold/20 text-cinema-gold text-xs font-semibold">
              <Trophy size={14} />
              <span>
                {completedCount} {completedCount === 1 ? 'Collection' : 'Collections'} Mastered
              </span>
            </div>
          )}

          <button
            onClick={() => setIsCreateOpen(true)}
            className="cinema-button-primary px-4 py-2 text-xs flex items-center gap-1.5 shadow-gold"
          >
            <FolderPlus size={15} />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      {/* Grid of collections */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full border-2 border-cinema-charcoal border-t-cinema-gold animate-spin mb-3" />
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          title="No Collections Yet"
          description="Create your first collection to group your favorite director's filmography or theme nights."
          actionText="Create Collection"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {collections.map((col) => (
            <CollectionCard
              key={col.id}
              collection={col}
              onClick={() => openCollectionDetail(col.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateCollectionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(col) => {
          setCollections((prev) => [...prev, col]);
          openCollectionDetail(col.id);
        }}
      />
    </div>
  );
};
