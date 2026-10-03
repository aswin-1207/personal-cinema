import React, { createContext, useContext, useState } from 'react';
import { CinemaDesktopNav, CinemaMobileNav } from '../common/Navbar';
import { OfflineIndicator } from '../common/OfflineIndicator';
import { Toast } from '../common/Toast';
import { CompletionMoment } from '../movie/CompletionMoment';
import { CollectionCompletionModal } from '../collection/CollectionCompletionModal';
import { SharedMoviePage } from '../../pages/SharedMoviePage';
import { useCinema } from '../../context/CinemaContext';

interface CinemaShellContextType {
  ambientColor: string;
  setAmbientColor: (color: string) => void;
}

const CinemaShellContext = createContext<CinemaShellContextType>({
  ambientColor: 'rgba(237, 194, 87, 0.08)',
  setAmbientColor: () => {},
});

export const useCinemaShell = () => useContext(CinemaShellContext);

interface CinemaShellProps {
  children: React.ReactNode;
  selectedCollectionId: string | null;
  selectedMovieId: number | null;
  renderMovieDetail: (id: number) => React.ReactNode;
  renderCollectionDetail: (id: string) => React.ReactNode;
}

export const CinemaShell: React.FC<CinemaShellProps> = ({
  children,
  selectedCollectionId,
  selectedMovieId,
  renderMovieDetail,
  renderCollectionDetail,
}) => {
  const { celebrationCollection, dismissCelebrationCollection } = useCinema();
  const [ambientColor, setAmbientColor] = useState<string>('rgba(237, 194, 87, 0.08)');
  const getShareRoute = () => {
    if (window.location.hash.startsWith('#share-movie=') || window.location.hash.startsWith('#share-col=')) {
      return window.location.hash;
    }
    const pathname = window.location.pathname;
    if (pathname.startsWith('/share/movie/')) {
      const id = pathname.replace('/share/movie/', '');
      return `#share-movie=${id}${window.location.search}`;
    }
    if (pathname.startsWith('/share/collection/')) {
      const id = pathname.replace('/share/collection/', '');
      return `#share-col=${id}${window.location.search}`;
    }
    return '';
  };

  const [shareHash, setShareHash] = useState<string>(getShareRoute());

  React.useEffect(() => {
    const handleUrlChange = () => setShareHash(getShareRoute());
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleDismissShare = () => {
    window.location.hash = '';
    if (window.location.pathname.startsWith('/share/')) {
      window.history.pushState(null, '', '/');
    }
    setShareHash('');
  };

  return (
    <CinemaShellContext.Provider value={{ ambientColor, setAmbientColor }}>
      {/* LAYER 0: Base Cinema Canvas */}
      <div className="min-h-[100dvh] bg-[#09090B] text-[#F5F3EB] flex flex-col md:flex-row relative antialiased selection:bg-[#E0AD52] selection:text-[#09090B]">
        
        {/* LAYER 1: Dynamic Ambient Glow (Atmosphere derived from active artwork with gold and purple undertones) */}
        <div
          className="fixed top-0 left-0 right-0 h-[70vh] pointer-events-none z-0 transition-all duration-1000 ease-out opacity-80 blur-[100px]"
          style={{
            background: `radial-gradient(circle at 50% 12%, ${ambientColor}, transparent 72%), radial-gradient(circle at 85% 35%, rgba(140, 122, 208, 0.08), transparent 65%), radial-gradient(circle at 15% 65%, rgba(179, 38, 46, 0.05), transparent 60%)`,
          }}
        />

        {/* LAYER 1B: Subtle Cinematic Film Grain (Section 10 & 11) */}
        <div className="cinema-film-grain" aria-hidden="true" />

        {/* System Offline Status */}
        <OfflineIndicator />

        {/* LAYER 6: Desktop Left Navigation & Mobile Bottom Navigation */}
        <CinemaDesktopNav />
        <CinemaMobileNav />

        {/* Main Cinema Content Area (Single Primary Vertical Scroll Container) */}
        <main className="flex-1 min-w-0 md:pl-[var(--cinema-sidebar-width)] w-full relative z-10 pb-[var(--cinema-bottom-clearance)] md:pb-16">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8 pt-[max(var(--cinema-top-clearance),1rem)] sm:pt-[max(var(--cinema-top-clearance),1.5rem)] md:pt-8 w-full">
            {selectedCollectionId ? (
              renderCollectionDetail(selectedCollectionId)
            ) : (
              children
            )}
          </div>
        </main>

        {/* LAYER 8: Fullscreen Movie Detail Modal */}
        {selectedMovieId && renderMovieDetail(selectedMovieId)}

        {/* LAYER 8: Celebration Moments */}
        <CompletionMoment />
        {celebrationCollection && (
          <CollectionCompletionModal
            collection={celebrationCollection}
            onClose={dismissCelebrationCollection}
          />
        )}

        {/* LAYER 8: Shared Links Preview */}
        {shareHash && (shareHash.startsWith('#share-movie=') || shareHash.startsWith('#share-col=')) && (
          <SharedMoviePage hash={shareHash} onDismiss={handleDismissShare} />
        )}

        {/* LAYER 8: Global Toast Notifications */}
        <Toast />
      </div>
    </CinemaShellContext.Provider>
  );
};
