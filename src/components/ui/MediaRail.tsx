import React, { useId, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Movie, UserMovie } from '../../types/movie';
import { MediaCard } from './MediaCard';
import { SectionHeader } from './SectionHeader';
import { ErrorState, PosterSkeleton } from './States';

export const RAIL_ITEM_WIDTH = 'w-[31vw] max-w-[132px] min-w-[104px] sm:w-[148px] sm:max-w-none lg:w-[164px]';

interface MediaRailProps {
  title: string;
  items: Movie[];
  userDataMap?: Map<number, UserMovie>;
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  onRetry?: () => void;
  onViewAll?: () => void;
  /** Hide the whole section when there is nothing to show (default). */
  hideWhenEmpty?: boolean;
  priority?: boolean;
  right?: React.ReactNode;
  className?: string;
}

/** Section title + horizontally scrolling poster row (snap on touch, arrow buttons on desktop). */
export const MediaRail: React.FC<MediaRailProps> = ({
  title,
  items,
  userDataMap,
  loading,
  error,
  offline,
  onRetry,
  onViewAll,
  hideWhenEmpty = true,
  priority,
  right,
  className = '',
}) => {
  const headingId = useId();
  const scroller = useRef<HTMLDivElement>(null);

  if (!loading && !error && items.length === 0 && hideWhenEmpty) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby={headingId} className={`min-w-0 ${className}`}>
      <SectionHeader
        id={headingId}
        title={title}
        actionLabel={onViewAll && items.length > 0 ? 'View all' : undefined}
        onAction={onViewAll}
        right={
          <div className="ml-auto flex items-center gap-1">
            {right}
            {items.length > 4 && (
              <div className="hidden [@media(hover:hover)]:md:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollBy(-1)}
                  aria-label={`Scroll ${title} left`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/5"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollBy(1)}
                  aria-label={`Scroll ${title} right`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/5"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        }
      />
      {error && items.length === 0 ? (
        <ErrorState compact offline={offline} onRetry={onRetry} className="mt-2" />
      ) : (
        <div
          ref={scroller}
          className="mt-2 flex gap-3 overflow-x-auto overscroll-x-contain no-scrollbar snap-x snap-mandatory bleed-x rail-x pb-1"
        >
          {loading && items.length === 0
            ? Array.from({ length: 7 }).map((_, i) => <PosterSkeleton key={i} className={`shrink-0 ${RAIL_ITEM_WIDTH}`} />)
            : items.map((movie, i) => (
                <MediaCard
                  key={movie.id}
                  movie={movie}
                  userData={userDataMap?.get(movie.id)}
                  priority={priority && i < 4}
                  className={`shrink-0 snap-start ${RAIL_ITEM_WIDTH}`}
                />
              ))}
        </div>
      )}
    </section>
  );
};
