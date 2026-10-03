import React from 'react';
import { Bookmark, Check, Eye, Heart } from 'lucide-react';
import { MovieStatus } from '../../types/movie';

export const STATUS_LABEL: Record<Exclude<MovieStatus, 'none'>, string> = {
  want_to_watch: 'Watchlist',
  watching: 'Watching',
  watched: 'Watched',
};

interface StatusBadgeProps {
  status?: MovieStatus;
  favorite?: boolean;
  compact?: boolean;
  className?: string;
}

/** Status pill used on posters and rows. Watched = gold, Watching = purple, Watchlist = neutral. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, favorite, compact, className = '' }) => {
  if (!status || status === 'none') {
    return favorite ? (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink/80 text-[#F0848A] ${className}`} aria-label="Favorite">
        <Heart size={12} className="fill-current" />
      </span>
    ) : null;
  }
  const styles =
    status === 'watched'
      ? 'bg-gold text-ink'
      : status === 'watching'
      ? 'bg-purple text-white'
      : 'bg-ink/85 text-text border border-white/15';
  const Icon = status === 'watched' ? Check : status === 'watching' ? Eye : Bookmark;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${styles} ${
          compact ? 'w-6 h-6 justify-center' : 'h-6 px-2'
        }`}
      >
        <Icon size={12} strokeWidth={status === 'watched' ? 3 : 2.25} aria-hidden="true" />
        {compact ? <span className="sr-only">{STATUS_LABEL[status]}</span> : <span>{STATUS_LABEL[status]}</span>}
      </span>
      {favorite && (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink/80 text-[#F0848A]">
          <Heart size={12} className="fill-current" aria-hidden="true" />
          <span className="sr-only">Favorite</span>
        </span>
      )}
    </span>
  );
};
