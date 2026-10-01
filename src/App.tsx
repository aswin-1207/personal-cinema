import React from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { CinemaShell } from './components/cinema/CinemaShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { WatchlistPage } from './pages/WatchlistPage';
import { WatchedPage } from './pages/WatchedPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionDetail } from './pages/CollectionDetail';
import { MovieDetail } from './pages/MovieDetail';
import { Profile } from './pages/Profile';

const AppContent: React.FC = () => {
  const {
    activeTab,
    selectedMovieId,
    closeMovieDetail,
    selectedCollectionId,
    closeCollectionDetail,
  } = useCinema();

  return (
    <CinemaShell
      selectedCollectionId={selectedCollectionId}
      selectedMovieId={selectedMovieId}
      renderMovieDetail={(movieId) => (
        <MovieDetail movieId={movieId} onClose={closeMovieDetail} />
      )}
      renderCollectionDetail={(collectionId) => (
        <CollectionDetail collectionId={collectionId} onBack={closeCollectionDetail} />
      )}
    >
      {activeTab === 'home' && <Home />}
      {activeTab === 'discover' && <Discover />}
      {activeTab === 'watchlist' && <WatchlistPage />}
      {activeTab === 'watched' && <WatchedPage />}
      {activeTab === 'collections' && <CollectionsPage />}
      {activeTab === 'profile' && <Profile />}
    </CinemaShell>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <CinemaProvider>
        <AppContent />
      </CinemaProvider>
    </ErrorBoundary>
  );
};

export default App;

