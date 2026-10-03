import { useEffect, useState } from 'react';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { CollectionOverview } from '../components/ui/CollectionCard';

/** Loads every collection with progress and up to four cover posters. */
export function useCollectionsOverview(dataVersion: number) {
  const [overviews, setOverviews] = useState<CollectionOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    (async () => {
      try {
        const all = await CollectionRepository.getAll();
        const full = await Promise.all(all.map((c) => CollectionRepository.getWithMovies(c.id)));
        const rows: CollectionOverview[] = full
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => {
            const cover = f.collection.customCoverMovieId
              ? f.movies.find((m) => m.movie.id === f.collection.customCoverMovieId)?.movie
              : undefined;
            const others = f.movies.map((m) => m.movie).filter((m) => m.id !== cover?.id);
            return { collection: f.collection, progress: f.progress, covers: (cover ? [cover, ...others] : others).slice(0, 4) };
          })
          .sort((a, b) => b.collection.updatedAt.localeCompare(a.collection.updatedAt));
        if (alive) setOverviews(rows);
      } catch (err) {
        console.error('Failed to load collections:', err);
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dataVersion, reloadKey]);

  return { overviews, loading, error, reload: () => setReloadKey((k) => k + 1) };
}
