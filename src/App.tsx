import React, { useState, useEffect } from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { Navbar } from './components/common/Navbar';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { Toast } from './components/common/Toast';
import { CompletionMoment } from './components/movie/CompletionMoment';
import { CollectionCompletionModal } from './components/collection/CollectionCompletionModal';

// Pages
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Library } from './pages/Library';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionDetail } from './pages/CollectionDetail';
import { MovieDetail } from './pages/MovieDetail';
import { Profile } from './pages/Profile';
import { SharedMoviePage } from './pages/SharedMoviePage';

const AppContent: React.FC = () => {
  const {
    activeTab,
    selectedMovieId,
    closeMovieDetail,
    selectedCollectionId,
    closeCollectionDetail,
    celebrationCollection,
    dismissCelebrationCollection,
  } = useCinema();

  const [shareHash, setShareHash] = useState<string>(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setShareHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleDismissShare = () => {
    window.location.hash = '';
    setShareHash('');
  };

  return (
    <div className="min-h-screen bg-cinema-black text-cinema-white flex flex-col md:flex-row relative antialiased selection:bg-cinema-gold selection:text-cinema-black">
      {/* Offline Status Bar */}
      <OfflineIndicator />

      {/* Main Navigation Sidebar & Mobile Bottom Bar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 md:py-8 max-w-7xl mx-auto w-full mb-16 md:mb-0">
        {selectedCollectionId ? (
          <CollectionDetail
            collectionId={selectedCollectionId}
            onBack={closeCollectionDetail}
          />
        ) : (
          <>
            {activeTab === 'home' && <Home />}
            {activeTab === 'discover' && <Discover />}
            {activeTab === 'library' && <Library />}
            {activeTab === 'collections' && <CollectionsPage />}
            {activeTab === 'profile' && <Profile />}
          </>
        )}
      </main>

      {/* Movie Detail Fullscreen Modal */}
      {selectedMovieId && (
        <MovieDetail movieId={selectedMovieId} onClose={closeMovieDetail} />
      )}

      {/* Celebration Moment: Mark as Watched */}
      <CompletionMoment />

      {/* Celebration Modal: Collection 100% Complete */}
      {celebrationCollection && (
        <CollectionCompletionModal
          collection={celebrationCollection}
          onClose={dismissCelebrationCollection}
        />
      )}

      {/* Shared Link Hash Page (Preview & Import) */}
      {shareHash && (shareHash.startsWith('#share-movie=') || shareHash.startsWith('#share-col=')) && (
        <SharedMoviePage hash={shareHash} onDismiss={handleDismissShare} />
      )}

      {/* Global Toast Notification */}
      <Toast />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CinemaProvider>
      <AppContent />
    </CinemaProvider>
  );
};

export default App;
