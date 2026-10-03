import React from 'react';
import { PosterSkeleton } from './States';

export const MEDIA_GRID_CLASS =
  'grid gap-x-3 gap-y-5 sm:gap-x-4 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]';

export const MediaGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`${MEDIA_GRID_CLASS} ${className}`}>{children}</div>
);

export const MediaGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div className={MEDIA_GRID_CLASS} role="status" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <PosterSkeleton key={i} />
    ))}
  </div>
);
