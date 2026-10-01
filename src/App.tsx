import React from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { CinemaShell } from './components/cinema/CinemaShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Library } from './pages/Library';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionDetail } from './pages/CollectionDetail';
import { MovieDetail } from './pages/MovieDetail';
import { Profile } from './pages/Profile';
import { CalendarPage } from './pages/CalendarPage';

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
      {activeTab === 'library' && <Library />}
      {activeTab === 'collections' && <CollectionsPage />}
      {activeTab === 'calendar' && <CalendarPage />}
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

