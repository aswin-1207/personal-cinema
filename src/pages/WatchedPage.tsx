import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Compass, Heart, Star } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup } from '../components/ui/ChipGroup';
import { SearchBar } from '../components/ui/SearchBar';
import { SortSelect } from '../components/ui/SortSelect';
import { MediaCard, mediaTypeLabel } from '../components/ui/MediaCard';
import { MediaGrid, MediaGridSkeleton } from '../components/ui/MediaGrid';
import { EmptyState } from '../components/ui/States';
import { MediaFilter, releaseKey, titleKey, useLibraryFilters } from '../hooks/useLibraryFilters';

type SortKey = 'recent' | 'oldest' | 'my_rating' | 'release' | 'title';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export const WatchedPage: React.FC = () => {
  const { setActiveTab, dataVersion, activeSub } = useCinema();
  const [items, setItems] = useState<MovieWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('recent');
  const [favoritesOnly, setFavoritesOnly] = useState(activeSub === 'favorites');

  useEffect(() => {
    let alive = true;
    UserMovieRepository.getWatchedWithMovies()
      .then((rows) => alive && setItems(rows))
      .catch((err) => console.error('Failed to load watched titles:', err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dataVersion]);

  const base = useMemo(() => (favoritesOnly ? items.filter((i) => i.userData?.isFavorite) : items), [items, favoritesOnly]);
  const { query, setQuery, media, setMedia, mediaCounts, filtered } = useLibraryFilters(base);
  const favoriteCount = useMemo(() => items.filter((i) => i.userData?.isFavorite).length, [items]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const watchedKey = (i: MovieWithUserData) => i.userData?.watchedAt || i.userData?.addedAt || '';
    switch (sort) {
      case 'oldest':
        return list.sort((a, b) => watchedKey(a).localeCompare(watchedKey(b)));
      case 'my_rating':
        return list.sort((a, b) => (b.userData?.personalRating ?? -1) - (a.userData?.personalRating ?? -1));
      case 'release':
        return list.sort((a, b) => releaseKey(b).localeCompare(releaseKey(a)));
      case 'title':
        return list.sort((a, b) => titleKey(a).localeCompare(titleKey(b)));
      default:
        return list.sort((a, b) => watchedKey(b).localeCompare(watchedKey(a)));
    }
  }, [filtered, sort]);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Watched" subtitle={loading ? undefined : `${items.length} ${items.length === 1 ? 'title' : 'titles'} completed`} />

      {loading ? (
        <MediaGridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="Nothing watched yet"
          description="Titles you mark as watched appear here with the date you finished them."
          action={{ label: 'Discover titles', icon: <Compass size={16} aria-hidden="true" />, onClick: () => setActiveTab('discover') }}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <SearchBar value={query} onChange={setQuery} label="Search watched" className="sm:max-w-sm" />
            <div className="flex items-center gap-2 min-w-0">
              <ChipGroup<MediaFilter>
                label="Media type"
                size="sm"
                value={media}
                onChange={setMedia}
                options={[
                  { value: 'all', label: 'All', count: mediaCounts.all },
                  { value: 'movie', label: 'Movies', count: mediaCounts.movie },
                  { value: 'tv', label: 'Series', count: mediaCounts.tv },
                ]}
                className="flex-1 min-w-0 !mx-0 !px-0"
              />
              <SortSelect<SortKey>
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'recent', label: 'Recently watched' },
                  { value: 'oldest', label: 'First watched' },
                  { value: 'my_rating', label: 'My rating' },
                  { value: 'release', label: 'Release date' },
                  { value: 'title', label: 'Title' },
                ]}
              />
            </div>
          </div>
          {favoriteCount > 0 && (
            <button
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full border text-[12px] font-semibold transition-colors ${
                favoritesOnly ? 'bg-[#F0848A]/15 border-[#F0848A]/50 text-[#F0848A]' : 'bg-surface border-line text-muted hover:text-text'
              }`}
            >
              <Heart size={13} className={favoritesOnly ? 'fill-current' : ''} aria-hidden="true" />
              Favorites
              <span className="tabular-nums opacity-70">{favoriteCount}</span>
            </button>
          )}

          {sorted.length === 0 ? (
            <EmptyState
              compact
              title="No matches"
              description="Try a different title or filter."
              action={{ label: 'Clear', onClick: () => { setQuery(''); setMedia('all'); setFavoritesOnly(false); } }}
            />
          ) : (
            <MediaGrid>
              {sorted.map((item, i) => (
                <MediaCard
                  key={item.movie.id}
                  movie={item.movie}
                  userData={item.userData}
                  priority={i < 6}
                  showQuickWatch={false}
                  meta={
                    <>
                      <span className="truncate">
                        {formatDate(item.userData?.watchedAt) || mediaTypeLabel(item.movie)}
                      </span>
                      {item.userData?.personalRating ? (
                        <span className="inline-flex items-center gap-0.5 text-gold ml-auto shrink-0" aria-label={`Your rating ${item.userData.personalRating} of 5`}>
                          <Star size={10} className="fill-current" aria-hidden="true" />
                          {item.userData.personalRating}
                        </span>
                      ) : null}
                    </>
                  }
                />
              ))}
            </MediaGrid>
          )}
        </>
      )}
    </div>
  );
};
