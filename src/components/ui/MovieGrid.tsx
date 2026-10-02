import React from 'react';

interface MovieGridProps {
  children: React.ReactNode;
  columns?: 'auto' | '2' | '3' | '4';
  className?: string;
}

export const MovieGrid: React.FC<MovieGridProps> = ({
  children,
  columns = 'auto',
  className = '',
}) => {
  const colClass = {
    auto: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    '2': 'grid-cols-2',
    '3': 'grid-cols-2 sm:grid-cols-3',
    '4': 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
  }[columns];

  return (
    <div
      className={`grid ${colClass} gap-3 sm:gap-4 md:gap-5 w-full min-w-0 ${className}`}
    >
      {children}
    </div>
  );
};
