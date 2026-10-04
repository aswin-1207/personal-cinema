import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Compass, Eye } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieWithUserData } from '../types/movie';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup } from '../components/ui/ChipGroup';
import { SearchBar } from '../components/ui/SearchBar';
import { SortSelect } from '../components/ui/SortSelect';
import { MediaCard } from '../components/ui/MediaCard';
import { MediaGrid, MediaGridSkeleton } from '../components/ui/MediaGrid';
import { EmptyState } from '../components/ui/States';
import { MediaFilter, releaseKey, titleKey, useLibraryFilters } from '../hooks/useLibraryFilters';

type Segment = 'want_to_watch' | 'watching';
type SortKey = 'added' | 'release' | 'rating' | 'title';

export const WatchlistPage: React.FC = () => {
  const { setActiveTab, activeSub, setActiveSub, dataVersion } = useCinema();
  const [items, setItems] = useState<MovieWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('added');
  const segment: Segment = activeSub === 'watching' ? 'watching' : 'want_to_watch';

  useEffect(() => {
    let alive = true;
    UserMovieRepository.getWatchlistWithMovies()
      .then((rows) => alive && setItems(rows))
      .catch((err) => console.error('Failed to load watchlist:', err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dataVersion]);

  const counts = useMemo(
    () => ({
      want_to_watch: items.filter((i) => i.userData?.status === 'want_to_watch').length,
      watching: items.filter((i) => i.userData?.status === 'watching').length,
    }),
    [items]
  );

  const segmentItems = useMemo(() => items.filter((i) => i.userData?.status === segment), [items, segment]);
  const { query, setQuery, media, setMedia, mediaCounts, filtered } = useLibraryFilters(segmentItems);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case 'release':
        return list.sort((a, b) => releaseKey(b).localeCompare(releaseKey(a)));
      case 'rating':
        return list.sort((a, b) => (b.movie.voteAverage || 0) - (a.movie.voteAverage || 0));
      case 'title':
        return list.sort((a, b) => titleKey(a).localeCompare(titleKey(b)));
      default:
        return list.sort((a, b) =>
          (b.userData?.watchingAt || b.userData?.addedAt || '').localeCompare(a.userData?.watchingAt || a.userData?.addedAt || '')
        );
    }
  }, [filtered, sort]);

  const switchSegment = (s: Segment) => {
    if (s !== segment) setActiveSub(s === 'watching' ? 'watching' : null);
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title="Watchlist" subtitle={loading ? undefined : `${counts.want_to_watch} to watch · ${counts.watching} watching`} />

      <div role="tablist" aria-label="Watchlist sections" className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface border border-line max-w-md">
        {(
          [
            { id: 'want_to_watch', label: 'Want to Watch', icon: Bookmark },
            { id: 'watching', label: 'Watching', icon: Eye },
          ] as const
        ).map((s) => {
          const selected = segment === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchSegment(s.id)}
              className={`min-h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors ${
                selected ? 'bg-gold text-ink' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {s.label}
              <span className={`tabular-nums text-[12px] ${selected ? 'text-ink/70' : 'text-subtle'}`}>{counts[s.id]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <MediaGridSkeleton />
      ) : segmentItems.length === 0 ? (
        segment === 'watching' ? (
          <EmptyState
            icon={<Eye size={22} />}
            title="Nothing in progress"
            description="Mark a movie or series as Watching from its detail page to track it here."
            action={counts.want_to_watch > 0 ? { label: 'Open Want to Watch', onClick: () => switchSegment('want_to_watch') } : undefined}
          />
        ) : (
          <EmptyState
            icon={<Bookmark size={22} />}
            title="Your watchlist is empty"
            description="Save movies and series you want to watch."
            action={{ label: 'Discover titles', icon: <Compass size={16} aria-hidden="true" />, onClick: () => setActiveTab('discover') }}
          />
        )
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <SearchBar value={query} onChange={setQuery} label={segment === 'watching' ? 'Search watching' : 'Search watchlist'} className="sm:max-w-sm" />
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
                  { value: 'added', label: 'Recently added' },
                  { value: 'release', label: 'Release date' },
                  { value: 'rating', label: 'TMDB rating' },
                  { value: 'title', label: 'Title' },
                ]}
              />
            </div>
          </div>

          {sorted.length === 0 ? (
            <EmptyState compact title="No matches" description="Try a different title or filter." action={{ label: 'Clear', onClick: () => { setQuery(''); setMedia('all'); } }} />
          ) : (
            <MediaGrid>
              {sorted.map((item, i) => (
                <MediaCard key={item.movie.id} movie={item.movie} userData={item.userData} priority={i < 6} />
              ))}
            </MediaGrid>
          )}
        </>
      )}
    </div>
  );
};
