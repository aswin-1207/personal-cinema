import React, { createContext, useContext, useState } from 'react';
import { CinemaDesktopNav, CinemaMobileNav } from '../common/Navbar';
import { CinemaIsland } from '../island/CinemaIsland';
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
  const [shareHash, setShareHash] = useState<string>(window.location.hash);

  React.useEffect(() => {
    const handleHashChange = () => setShareHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleDismissShare = () => {
    window.location.hash = '';
    setShareHash('');
  };

  return (
    <CinemaShellContext.Provider value={{ ambientColor, setAmbientColor }}>
      {/* LAYER 0: Base Cinema Canvas */}
      <div className="min-h-screen bg-[#09090D] text-[#F5F2F0] flex flex-col md:flex-row relative antialiased selection:bg-[#EDC257] selection:text-[#09090D] overflow-x-hidden">
        
        {/* LAYER 1: Dynamic Ambient Glow (Atmosphere derived from active artwork) */}
        <div
          className="fixed top-0 left-0 right-0 h-[65vh] pointer-events-none z-0 transition-all duration-1000 ease-out opacity-70 blur-[100px]"
          style={{
            background: `radial-gradient(circle at 50% 15%, ${ambientColor}, transparent 75%)`,
          }}
        />

        {/* LAYER 7: Signature Cinema Island */}
        <CinemaIsland />

        {/* System Offline Status */}
        <OfflineIndicator />

        {/* LAYER 6: Desktop Left Navigation & Mobile Bottom Navigation */}
        <CinemaDesktopNav />
        <CinemaMobileNav />

        {/* LAYER 4: Main Cinema Content Area */}
        <main className="flex-1 min-w-0 md:ml-[240px] px-4 sm:px-8 py-5 md:py-8 max-w-7xl mx-auto w-full mb-20 md:mb-0 relative z-10">
          {selectedCollectionId ? (
            renderCollectionDetail(selectedCollectionId)
          ) : (
            children
          )}
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
