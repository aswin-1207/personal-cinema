import React from 'react';

interface CinemaPageProps {
  children: React.ReactNode;
  className?: string;
  noBottomPadding?: boolean;
}

export const CinemaPage: React.FC<CinemaPageProps> = ({
  children,
  className = '',
  noBottomPadding = false,
}) => {
  return (
    <div
      className={`min-h-full w-full max-w-7xl mx-auto space-y-8 animate-cinema-fade ${
        noBottomPadding ? '' : 'pb-24 sm:pb-16'
      } ${className}`}
    >
      {children}
    </div>
  );
};
