import React, { useMemo, useState } from 'react';
import { FolderPlus, Layers, Upload } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { CreateCollectionModal } from '../components/collection/CreateCollectionModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { PageHeader } from '../components/ui/PageHeader';
import { CollectionCard } from '../components/ui/CollectionCard';
import { ChipGroup } from '../components/ui/ChipGroup';
import { SortSelect } from '../components/ui/SortSelect';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Button, IconButton } from '../components/ui/Button';
import { useCollectionsOverview } from '../hooks/useCollectionsOverview';

type Filter = 'all' | 'progress' | 'complete';
type Sort = 'updated' | 'name' | 'progress';

export const CollectionsPage: React.FC = () => {
  const { openCollectionDetail, dataVersion, notifyDataChanged, showToast } = useCinema();
  const { overviews, loading, error, reload } = useCollectionsOverview(dataVersion);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('updated');

  const counts = useMemo(() => {
    const complete = overviews.filter((o) => o.progress.isComplete && o.progress.total > 0).length;
    return { all: overviews.length, complete, progress: overviews.length - complete };
  }, [overviews]);

  const visible = useMemo(() => {
    const list = overviews.filter((o) => {
      const done = o.progress.isComplete && o.progress.total > 0;
      return filter === 'all' || (filter === 'complete' ? done : !done);
    });
    return [...list].sort((a, b) =>
      sort === 'name'
        ? a.collection.name.localeCompare(b.collection.name)
        : sort === 'progress'
        ? b.progress.percent - a.progress.percent
        : b.collection.updatedAt.localeCompare(a.collection.updatedAt)
    );
  }, [overviews, filter, sort]);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Collections"
        actions={
          <>
            <IconButton label="Import a list" variant="ghost" onClick={() => setIsImportOpen(true)}>
              <Upload size={18} aria-hidden="true" />
            </IconButton>
            <Button size="sm" icon={<FolderPlus size={15} aria-hidden="true" />} onClick={() => setIsCreateOpen(true)}>
              New
            </Button>
          </>
        }
      />

      {overviews.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChipGroup<Filter>
            label="Filter collections"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'progress', label: 'In progress', count: counts.progress },
              { value: 'complete', label: 'Complete', count: counts.complete },
            ]}
          />
          <SortSelect<Sort>
            label="Sort collections"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'updated', label: 'Recently updated' },
              { value: 'name', label: 'Name' },
              { value: 'progress', label: 'Progress' },
            ]}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/4.4] rounded-2xl cinema-skeleton" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Couldn't load collections" onRetry={reload} />
      ) : overviews.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="No collections yet"
          description="Group titles by director, franchise or mood and track your progress."
          action={{ label: 'Create collection', onClick: () => setIsCreateOpen(true) }}
        />
      ) : visible.length === 0 ? (
        <EmptyState compact title={filter === 'complete' ? 'No completed collections yet' : 'Every collection is complete'} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {visible.map((o) => (
            <CollectionCard key={o.collection.id} overview={o} onOpen={() => openCollectionDetail(o.collection.id)} />
          ))}
        </div>
      )}

      <CreateCollectionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(col) => {
          showToast(`Created ${col.name}`);
          notifyDataChanged();
          openCollectionDetail(col.id);
        }}
      />
      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={() => {
          setIsImportOpen(false);
          notifyDataChanged();
        }}
      />
    </div>
  );
};
