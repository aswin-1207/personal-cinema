import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { Collection } from '../types/collection';
import { CollectionCard } from '../components/collection/CollectionCard';
import { CreateCollectionModal } from '../components/collection/CreateCollectionModal';
import { EmptyState } from '../components/common/EmptyState';
import { FolderPlus } from 'lucide-react';

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

  return (
    <div className="space-y-6 pb-20">
      {/* Header matching Figma 2:209 */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-[#F5F3EB] tracking-tight">
            Collections
          </h1>
          <p className="text-xs sm:text-sm text-[#9E9DA5]">
            Organize movies your way.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-[#E0AD52] hover:bg-[#D49B35] text-[#09090B] font-bold text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(224,173,82,0.35)] active:scale-95 cursor-pointer"
        >
          <FolderPlus size={16} />
          <span>+ CREATE COLLECTION</span>
        </button>
      </div>

      <div className="pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] mb-4">
          YOUR COLLECTIONS
        </h2>

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
      </div>

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
