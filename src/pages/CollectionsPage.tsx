import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { Collection } from '../types/collection';
import { CollectionCard } from '../components/collection/CollectionCard';
import { CreateCollectionModal } from '../components/collection/CreateCollectionModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { EmptyState } from '../components/common/EmptyState';
import { CinemaHeader } from '../components/ui/CinemaHeader';
import { FolderPlus, Upload } from 'lucide-react';

export const CollectionsPage: React.FC = () => {
  const { openCollectionDetail, dataVersion, notifyDataChanged, showToast } = useCinema();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
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
    <div className="space-y-5 pb-4">
      {/* Header matching compact cinema layout */}
      <CinemaHeader
        title="Collections"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="cinema-button-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Import movies from CSV, Excel, or Text list"
            >
              <Upload size={13} />
              <span>Import List</span>
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="cinema-button-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FolderPlus size={13} />
              <span>+ New Collection</span>
            </button>
          </div>
        }
      />

      <div className="pt-1">

      {/* Responsive Grid of collections */}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
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
        onCreated={async (col) => {
          setIsCreateOpen(false);
          setCollections((prev) => {
            const exists = prev.some((c) => c.id === col.id);
            return exists ? prev : [col, ...prev];
          });
          notifyDataChanged();
          showToast(`Collection "${col.name}" created.`);
          openCollectionDetail(col.id);
        }}
      />

      {/* Import Wizard Modal */}
      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={() => {
          loadCollections();
          notifyDataChanged();
        }}
      />
    </div>
  );
};
