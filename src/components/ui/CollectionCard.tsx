import React from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { Collection, CollectionProgress } from '../../types/collection';
import { Movie } from '../../types/movie';
import { tmdbService } from '../../services/tmdbService';
import { ProgressBar } from './ProgressBar';

export interface CollectionOverview {
  collection: Collection;
  progress: CollectionProgress;
  covers: Movie[];
}

/** 2×2 poster collage (Figma collection cover). Empty slots show a muted tile. */
export const CollectionCollage: React.FC<{ covers: Movie[]; className?: string }> = ({ covers, className = '' }) => {
  const slots = Array.from({ length: 4 }, (_, i) => covers[i]);
  if (covers.length === 0) {
    return (
      <div className={`aspect-[4/3] bg-surface-2 flex items-center justify-center text-subtle ${className}`} aria-hidden="true">
        <Layers size={28} />
      </div>
    );
  }
  return (
    <div className={`aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px bg-ink ${className}`} aria-hidden="true">
      {slots.map((m, i) => {
        const url = m ? tmdbService.getPosterUrl(m.posterPath, 'w185') : null;
        return (
          <div key={i} className="relative overflow-hidden bg-surface-2">
            {url && <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />}
            {m && !url && (
              <span className="absolute inset-0 p-1.5 flex items-end text-[9px] font-bold uppercase text-gold/80 leading-tight line-clamp-3">
                {m.title}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface CollectionCardProps {
  overview: CollectionOverview;
  onOpen: () => void;
  className?: string;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ overview, onOpen, className = '' }) => {
  const { collection, progress, covers } = overview;
  const complete = progress.isComplete && progress.total > 0;
  return (
    <article
      className={`group relative rounded-2xl overflow-hidden bg-surface border transition-colors ${
        complete ? 'border-green/35' : 'border-line hover:border-line-strong'
      } ${className}`}
    >
      <div className="relative">
        <CollectionCollage covers={covers} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" aria-hidden="true" />
        {complete && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-green text-ink text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 size={12} aria-hidden="true" />
            Complete
          </span>
        )}
      </div>
      <div className="p-3 pt-2">
        <h3 className="text-[14px] font-semibold text-text line-clamp-1">
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-gold focus-visible:after:rounded-2xl"
          >
            {collection.name}
          </button>
        </h3>
        {collection.description && <p className="text-[12px] text-muted line-clamp-1 mt-0.5">{collection.description}</p>}
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
          <span className="text-muted tabular-nums">
            {progress.watched} / {progress.total} watched
          </span>
          <span className={`tabular-nums ${complete ? 'text-green' : 'text-gold'}`}>{progress.percent}%</span>
        </div>
        <ProgressBar value={progress.percent} complete={complete} size="xs" className="mt-1.5" label={`${collection.name} progress`} />
      </div>
    </article>
  );
};
