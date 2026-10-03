import { useMemo, useState } from 'react';
import { MovieWithUserData } from '../types/movie';
import { isSeries } from '../components/ui/MediaCard';

export type MediaFilter = 'all' | 'movie' | 'tv';

export const titleMatches = (item: MovieWithUserData, q: string) => {
  const m = item.movie;
  return [m.title, m.name, m.originalTitle, m.originalName].some((t) => t && t.toLowerCase().includes(q));
};

/** Shared search + media-type filtering for the Watchlist and Watched pages. */
export function useLibraryFilters(items: MovieWithUserData[]) {
  const [query, setQuery] = useState('');
  const [media, setMedia] = useState<MediaFilter>('all');

  const mediaCounts = useMemo(() => {
    const tv = items.filter((i) => isSeries(i.movie)).length;
    return { all: items.length, movie: items.length - tv, tv };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (media === 'tv' && !isSeries(i.movie)) return false;
      if (media === 'movie' && isSeries(i.movie)) return false;
      return !q || titleMatches(i, q);
    });
  }, [items, query, media]);

  return { query, setQuery, media, setMedia, mediaCounts, filtered };
}

export const releaseKey = (i: MovieWithUserData) => i.movie.releaseDate || i.movie.firstAirDate || '';
export const titleKey = (i: MovieWithUserData) => i.movie.title || i.movie.name || '';
