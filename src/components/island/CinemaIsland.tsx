import React, { useState, useEffect, useRef } from 'react';
import { useCinema } from '../../context/CinemaContext';
import {
  CinemaNextMovieResolver,
  CinemaNextMovieResult,
} from '../../services/cinemaIslandResolver';
import { CinemaIslandCollapsed } from './CinemaIslandCollapsed';
import { CinemaIslandExpanded } from './CinemaIslandExpanded';

export const CinemaIsland: React.FC = () => {
  const { openMovieDetail, setActiveTab, dataVersion } = useCinema();

  const [nextMovieData, setNextMovieData] = useState<CinemaNextMovieResult | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve next movie whenever dataVersion changes (real-time reactive)
  useEffect(() => {
    let isMounted = true;
    CinemaNextMovieResolver.resolveNextMovie().then((res) => {
      if (isMounted) setNextMovieData(res);
    });
    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  // Handle outside click & escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  if (!nextMovieData) return null;

  const handleWatchNow = () => {
    if (nextMovieData.type === 'movie' && nextMovieData.movie) {
      openMovieDetail(nextMovieData.movie.id);
      setIsExpanded(false);
    }
  };

  const handleDiscover = () => {
    setActiveTab('discover');
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto transition-all duration-300"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      }}
    >
      {isExpanded ? (
        <CinemaIslandExpanded
          data={nextMovieData}
          onWatchNow={handleWatchNow}
          onDiscover={handleDiscover}
          onClose={() => setIsExpanded(false)}
        />
      ) : (
        <CinemaIslandCollapsed
          data={nextMovieData}
          onClick={() => setIsExpanded(true)}
        />
      )}
    </div>
  );
};
