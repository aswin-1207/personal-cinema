import React from 'react';

interface LoadingStateProps {
  count?: number;
  layout?: 'grid' | 'rail';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  count = 6,
  layout = 'grid',
  className = '',
}) => {
  const skeletons = Array.from({ length: count });

  if (layout === 'rail') {
    return (
      <div className={`flex gap-4 overflow-x-auto no-scrollbar py-2 ${className}`}>
        {skeletons.map((_, idx) => (
          <div
            key={idx}
            className="w-36 sm:w-44 flex-shrink-0 space-y-2.5 animate-pulse"
          >
            <div className="aspect-[2/3] w-full rounded-2xl bg-[#131319] border border-white/5" />
            <div className="h-3.5 w-3/4 rounded bg-white/5" />
            <div className="h-2.5 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5 ${className}`}
    >
      {skeletons.map((_, idx) => (
        <div key={idx} className="w-full space-y-2.5 animate-pulse">
          <div className="aspect-[2/3] w-full rounded-2xl bg-[#131319] border border-white/5" />
          <div className="h-3.5 w-3/4 rounded bg-white/5" />
          <div className="h-2.5 w-1/2 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
};
