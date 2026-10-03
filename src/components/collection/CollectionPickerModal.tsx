import React, { useEffect, useState } from 'react';
import { Check, FolderPlus, Layers } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../ui/Button';
import { CreateCollectionModal } from './CreateCollectionModal';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { MovieRepository } from '../../db/repositories/movieRepository';
import { Collection } from '../../types/collection';
import { Movie } from '../../types/movie';
import { useCinema } from '../../context/CinemaContext';

interface CollectionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie;
}

/** Add/remove a title from any collection. Every toggle is persisted before the UI updates. */
export const CollectionPickerModal: React.FC<CollectionPickerModalProps> = ({ isOpen, onClose, movie }) => {
  const { showToast, notifyDataChanged } = useCinema();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [all, ids] = await Promise.all([CollectionRepository.getAll(), CollectionRepository.getCollectionsForMovie(movie.id)]);
    setCollections(all.sort((a, b) => a.name.localeCompare(b.name)));
    setMemberIds(new Set(ids));
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, movie.id]);

  const toggle = async (col: Collection) => {
    if (busyId) return;
    setBusyId(col.id);
    try {
      if (memberIds.has(col.id)) {
        await CollectionRepository.removeMovieFromCollection(col.id, movie.id);
        showToast(`Removed from ${col.name}`);
      } else {
        await MovieRepository.save(movie);
        await CollectionRepository.addMovieToCollection(col.id, movie.id);
        showToast(`Added to ${col.name}`);
      }
      await refresh();
      notifyDataChanged();
    } catch (err) {
      console.error('Collection update failed:', err);
      showToast(`Couldn't update ${col.name}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isCreateOpen}
        onClose={onClose}
        title="Add to collection"
        description={movie.title}
        maxWidth={460}
        footer={
          <>
            <Button variant="secondary" icon={<FolderPlus size={16} aria-hidden="true" />} onClick={() => setIsCreateOpen(true)}>
              New collection
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl cinema-skeleton" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="py-6 text-center">
            <Layers size={26} className="mx-auto text-subtle" aria-hidden="true" />
            <p className="mt-2 text-[14px] font-semibold text-text">No collections yet</p>
            <p className="text-[13px] text-muted">Create one to start grouping titles.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {collections.map((col) => {
              const selected = memberIds.has(col.id);
              return (
                <li key={col.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    disabled={busyId === col.id}
                    onClick={() => toggle(col)}
                    className={`w-full min-h-14 flex items-center gap-3 px-3.5 rounded-xl border text-left transition-colors ${
                      selected ? 'bg-gold/10 border-gold/40' : 'bg-surface-2 border-line hover:border-line-strong'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                        selected ? 'bg-gold border-gold text-ink' : 'border-line-strong'
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <Check size={15} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 text-[14px] font-semibold text-text truncate">{col.name}</span>
                    {busyId === col.id && <span className="text-[12px] text-muted">Saving…</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
      <CreateCollectionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={async (col) => {
          setIsCreateOpen(false);
          try {
            await MovieRepository.save(movie);
            await CollectionRepository.addMovieToCollection(col.id, movie.id);
            showToast(`Added to ${col.name}`);
            notifyDataChanged();
          } catch {
            showToast(`Created ${col.name}, but couldn't add this title`);
          }
          await refresh();
        }}
      />
    </>
  );
};
