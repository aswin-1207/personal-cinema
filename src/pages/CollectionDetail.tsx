import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Edit3, ListOrdered, MoreHorizontal, Plus, Share2, Trash2, Upload, X } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { CollectionSortMode, CollectionWithMovies } from '../types/collection';
import { getMediaYear } from '../types/movie';
import { tmdbService } from '../services/tmdbService';
import { AddMoviesToCollectionModal } from '../components/collection/AddMoviesToCollectionModal';
import { EditCollectionModal } from '../components/collection/EditCollectionModal';
import { CollectionShareModal } from '../components/share/CollectionShareModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { Modal } from '../components/common/Modal';
import { WatchedButton } from '../components/movie/WatchedButton';
import { PageHeader } from '../components/ui/PageHeader';
import { CollectionCollage } from '../components/ui/CollectionCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ChipGroup } from '../components/ui/ChipGroup';
import { SortSelect } from '../components/ui/SortSelect';
import { MediaCard, mediaTypeLabel } from '../components/ui/MediaCard';
import { MediaGrid } from '../components/ui/MediaGrid';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';
import { Button, IconButton } from '../components/ui/Button';

interface CollectionDetailProps {
  collectionId: string;
  onBack: () => void;
}

type Filter = 'all' | 'watched' | 'watching' | 'unwatched';
type Sort = CollectionSortMode | 'releaseDateDesc';

export const CollectionDetail: React.FC<CollectionDetailProps> = ({ collectionId, onBack }) => {
  const { openMovieDetail, showToast, dataVersion, notifyDataChanged } = useCinema();
  const [data, setData] = useState<CollectionWithMovies | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('custom');
  const [editMode, setEditMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<'add' | 'edit' | 'share' | 'import' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await CollectionRepository.getWithMovies(collectionId);
      setData(d);
      setStatus(d ? 'ready' : 'missing');
      return d;
    } catch (err) {
      console.error('Failed to load collection:', err);
      setStatus('error');
      return null;
    }
  }, [collectionId]);

  useEffect(() => {
    load().then((d) => d && setSort((s) => (s === 'custom' ? d.collection.sortMode : s)));
  }, [load, dataVersion]);

  const movies = data?.movies ?? [];
  const collection = data?.collection;

  const counts = useMemo(
    () => ({
      all: movies.length,
      watched: movies.filter((m) => m.userData?.status === 'watched').length,
      watching: movies.filter((m) => m.userData?.status === 'watching').length,
      unwatched: movies.filter((m) => m.userData?.status !== 'watched').length,
    }),
    [movies]
  );

  const ordered = useMemo(() => {
    if (!collection) return [];
    const idx = (id: number) => {
      const i = collection.customOrder.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const date = (m: (typeof movies)[number]) => m.movie.releaseDate || m.movie.firstAirDate || '0000';
    return [...movies].sort((a, b) => {
      switch (sort) {
        case 'releaseDate':
          return date(a).localeCompare(date(b));
        case 'releaseDateDesc':
          return date(b).localeCompare(date(a));
        case 'title':
          return a.movie.title.localeCompare(b.movie.title);
        case 'rating':
          return (b.userData?.personalRating ?? b.movie.voteAverage ?? 0) - (a.userData?.personalRating ?? a.movie.voteAverage ?? 0);
        case 'watchedStatus': {
          const o: Record<string, number> = { watched: 0, watching: 1, want_to_watch: 2 };
          return (o[a.userData?.status || ''] ?? 3) - (o[b.userData?.status || ''] ?? 3);
        }
        default:
          return idx(a.movie.id) - idx(b.movie.id) || a.position - b.position;
      }
    });
  }, [movies, sort, collection]);

  const displayed = useMemo(
    () =>
      ordered.filter((m) =>
        filter === 'watched'
          ? m.userData?.status === 'watched'
          : filter === 'watching'
          ? m.userData?.status === 'watching'
          : filter === 'unwatched'
          ? m.userData?.status !== 'watched'
          : true
      ),
    [ordered, filter]
  );

  const nextUp = useMemo(() => ordered.find((m) => m.userData?.status !== 'watched') ?? null, [ordered]);

  if (status === 'loading') return <Spinner label="Loading collection" />;
  if (status === 'error') return <ErrorState title="Couldn't load this collection" onRetry={load} />;
  if (!data || !collection) {
    return (
      <div className="space-y-4">
        <PageHeader title="Collection" onBack={onBack} backLabel="Back to Collections" />
        <EmptyState title="Collection not found" description="It may have been deleted." action={{ label: 'All collections', onClick: onBack }} />
      </div>
    );
  }

  const { progress } = data;
  const complete = progress.isComplete && progress.total > 0;
  const canReorder = sort === 'custom' && filter === 'all';
  const backdrop = tmdbService.getBackdropUrl(movies[0]?.movie.backdropPath, 'w1280');

  const removeMovie = async (movieId: number, title: string) => {
    setBusy(true);
    try {
      await CollectionRepository.removeMovieFromCollection(collection.id, movieId);
      await load();
      notifyDataChanged();
      showToast(`Removed ${title}`);
    } catch {
      showToast(`Couldn't remove ${title}`);
    } finally {
      setBusy(false);
    }
  };

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= ordered.length || busy) return;
    const ids = ordered.map((m) => m.movie.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setBusy(true);
    try {
      await CollectionRepository.updateMovieOrder(collection.id, ids);
      await load();
    } catch {
      showToast("Couldn't save the new order");
    } finally {
      setBusy(false);
    }
  };

  const deleteCollection = async () => {
    setBusy(true);
    try {
      await CollectionRepository.delete(collection.id);
      setModal(null);
      showToast(`Deleted ${collection.name}`);
      notifyDataChanged();
      onBack();
    } catch {
      showToast("Couldn't delete the collection");
    } finally {
      setBusy(false);
    }
  };

  const menuItems = [
    { label: 'Edit details', icon: <Edit3 size={16} aria-hidden="true" />, onClick: () => setModal('edit') },
    { label: 'Import a list', icon: <Upload size={16} aria-hidden="true" />, onClick: () => setModal('import') },
    { label: 'Delete collection', icon: <Trash2 size={16} aria-hidden="true" />, onClick: () => setModal('delete'), danger: true },
  ];

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title=""
        onBack={onBack}
        backLabel="Back to Collections"
        showProfile={false}
        actions={
          <>
            <IconButton label="Share collection" variant="ghost" onClick={() => setModal('share')}>
              <Share2 size={18} aria-hidden="true" />
            </IconButton>
            <div className="relative">
              <IconButton label="More options" variant="ghost" active={menuOpen} onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
                <MoreHorizontal size={18} aria-hidden="true" />
              </IconButton>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <ul role="menu" className="absolute right-0 top-12 z-40 w-52 rounded-xl bg-surface-2 border border-line-strong p-1 shadow-xl">
                    {menuItems.map((item) => (
                      <li key={item.label} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            item.onClick();
                          }}
                          className={`w-full min-h-11 px-3 rounded-lg flex items-center gap-2.5 text-[14px] text-left hover:bg-white/5 ${
                            item.danger ? 'text-[#F0848A]' : 'text-text'
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        }
      />

      {/* Hero */}
      <section className={`relative overflow-hidden rounded-[20px] border bg-surface ${complete ? 'border-green/35' : 'border-line'}`}>
        {backdrop && <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/50" aria-hidden="true" />
        <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
          <CollectionCollage covers={movies.slice(0, 4).map((m) => m.movie)} className="w-full sm:w-[220px] rounded-xl overflow-hidden shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col">
            <h1 className="font-page-title break-words">{collection.name}</h1>
            {collection.description && <p className="mt-1 text-[14px] text-muted line-clamp-3">{collection.description}</p>}
            <div className="mt-auto pt-4 space-y-2">
              <div className="flex items-baseline justify-between text-[12px] font-semibold uppercase tracking-wider">
                <span className="text-muted tabular-nums">
                  {progress.watched} / {progress.total} watched
                  {progress.watching > 0 && <span className="text-subtle"> · {progress.watching} watching</span>}
                </span>
                <span className={`text-[18px] tabular-nums ${complete ? 'text-green' : 'text-gold'}`}>{progress.percent}%</span>
              </div>
              <ProgressBar value={progress.percent} complete={complete} size="sm" label="Collection progress" />
              {complete ? (
                <p className="flex items-center gap-2 text-[13px] font-semibold text-green animate-cinema-fade">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Collection complete
                  {collection.completedAt && (
                    <span className="text-muted font-normal">
                      · {new Date(collection.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {nextUp && !complete && (
        <section aria-label="Next up" className="flex items-center gap-3 rounded-2xl bg-surface border border-line p-3">
          <button type="button" onClick={() => openMovieDetail(nextUp.movie.id)} className="shrink-0 w-12 aspect-[2/3] rounded-lg overflow-hidden bg-surface-2" aria-label={`Open ${nextUp.movie.title}`}>
            {nextUp.movie.posterPath && <img src={tmdbService.getPosterUrl(nextUp.movie.posterPath, 'w92') || ''} alt="" className="w-full h-full object-cover" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-caps-label text-gold">Next up</p>
            <p className="text-[14px] font-semibold text-text truncate">{nextUp.movie.title}</p>
            <p className="text-[12px] text-muted">{[getMediaYear(nextUp.movie), mediaTypeLabel(nextUp.movie)].filter(Boolean).join(' · ')}</p>
          </div>
          <WatchedButton movie={nextUp.movie} userData={nextUp.userData} style="icon" />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Plus size={15} aria-hidden="true" />} onClick={() => setModal('add')}>
          Add titles
        </Button>
        {(movies.length > 0 || editMode) && (
          <Button
            size="sm"
            variant={editMode ? 'outline' : 'secondary'}
            icon={editMode ? <X size={15} aria-hidden="true" /> : <ListOrdered size={15} aria-hidden="true" />}
            onClick={() => {
              if (!editMode) {
                setSort('custom');
                setFilter('all');
              }
              setEditMode((e) => !e);
            }}
          >
            {editMode ? 'Done' : 'Reorder / remove'}
          </Button>
        )}
      </div>

      {movies.length > 0 && !editMode && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChipGroup<Filter>
            label="Filter titles"
            value={filter}
            onChange={setFilter}
            size="sm"
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'watched', label: 'Watched', count: counts.watched },
              { value: 'watching', label: 'Watching', count: counts.watching },
              { value: 'unwatched', label: 'Unwatched', count: counts.unwatched },
            ]}
          />
          <SortSelect<Sort>
            label="Sort titles"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'custom', label: 'Custom order' },
              { value: 'releaseDate', label: 'Release (oldest)' },
              { value: 'releaseDateDesc', label: 'Release (newest)' },
              { value: 'title', label: 'Title' },
              { value: 'rating', label: 'Rating' },
              { value: 'watchedStatus', label: 'Status' },
            ]}
          />
        </div>
      )}

      {movies.length === 0 ? (
        <EmptyState compact title="No titles yet" description="Add movies or series to start tracking progress." action={{ label: 'Add titles', onClick: () => setModal('add') }} />
      ) : editMode && canReorder ? (
        <ol className="space-y-2" aria-label="Reorder titles" aria-busy={busy}>
          {ordered.map((m, i) => (
            <li key={m.movie.id} className="flex items-center gap-3 rounded-xl bg-surface border border-line p-2 pr-1">
              <span className="w-6 text-center text-[12px] font-semibold text-subtle tabular-nums">{i + 1}</span>
              <div className="w-10 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 shrink-0">
                {m.movie.posterPath && <img src={tmdbService.getPosterUrl(m.movie.posterPath, 'w92') || ''} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-text truncate">{m.movie.title}</p>
                <p className="text-[12px] text-muted">{[getMediaYear(m.movie), mediaTypeLabel(m.movie)].filter(Boolean).join(' · ')}</p>
              </div>
              <IconButton label={`Move ${m.movie.title} up`} variant="ghost" disabled={i === 0 || busy} onClick={() => move(i, i - 1)}>
                <ArrowUp size={17} aria-hidden="true" />
              </IconButton>
              <IconButton label={`Move ${m.movie.title} down`} variant="ghost" disabled={i === ordered.length - 1 || busy} onClick={() => move(i, i + 1)}>
                <ArrowDown size={17} aria-hidden="true" />
              </IconButton>
              <IconButton label={`Remove ${m.movie.title} from collection`} variant="ghost" disabled={busy} onClick={() => removeMovie(m.movie.id, m.movie.title)}>
                <Trash2 size={17} className="text-[#F0848A]" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ol>
      ) : displayed.length === 0 ? (
        <EmptyState compact title="Nothing matches this filter" />
      ) : (
        <MediaGrid>
          {displayed.map((m, i) => (
            <MediaCard key={m.movie.id} movie={m.movie} userData={m.userData} priority={i < 6} />
          ))}
        </MediaGrid>
      )}

      <AddMoviesToCollectionModal
        isOpen={modal === 'add'}
        collectionId={collection.id}
        collectionName={collection.name}
        onClose={() => setModal(null)}
        onAdded={() => {
          load();
          notifyDataChanged();
        }}
      />
      {modal === 'edit' && (
        <EditCollectionModal
          isOpen
          collection={collection}
          onClose={() => setModal(null)}
          onUpdated={() => {
            setModal(null);
            load();
            notifyDataChanged();
          }}
        />
      )}
      {modal === 'share' && <CollectionShareModal isOpen onClose={() => setModal(null)} collectionData={data} />}
      <ImportWizard
        isOpen={modal === 'import'}
        onClose={() => setModal(null)}
        initialCollectionId={collection.id}
        onComplete={() => {
          setModal(null);
          load();
          notifyDataChanged();
        }}
      />
      <Modal
        isOpen={modal === 'delete'}
        onClose={() => setModal(null)}
        title={`Delete “${collection.name}”?`}
        maxWidth={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={busy} onClick={deleteCollection}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">Only the collection is removed. Your titles, ratings and watch history stay.</p>
      </Modal>
    </div>
  );
};
