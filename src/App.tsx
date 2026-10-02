import React from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { CinemaShell } from './components/cinema/CinemaShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Primary Landing Page (Synchronous for instant FCP)
import { Home } from './pages/Home';

// Code-split secondary pages for performance & reduced initial bundle
const Discover = React.lazy(() => import('./pages/Discover').then((m) => ({ default: m.Discover })));
const WatchlistPage = React.lazy(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const WatchedPage = React.lazy(() => import('./pages/WatchedPage').then((m) => ({ default: m.WatchedPage })));
const CollectionsPage = React.lazy(() => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })));
const CollectionDetail = React.lazy(() => import('./pages/CollectionDetail').then((m) => ({ default: m.CollectionDetail })));
const MovieDetail = React.lazy(() => import('./pages/MovieDetail').then((m) => ({ default: m.MovieDetail })));
const Profile = React.lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));

const AtmosphericLoader: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-in">
    <div className="w-8 h-8 rounded-full border-2 border-gold/20 border-t-gold animate-spin mb-3" />
    <span className="text-[11px] uppercase tracking-widest text-text-muted/70 font-mono">
      Preparing Cinema Experience
    </span>
  </div>
);

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
        <React.Suspense fallback={<AtmosphericLoader />}>
          <MovieDetail movieId={movieId} onClose={closeMovieDetail} />
        </React.Suspense>
      )}
      renderCollectionDetail={(collectionId) => (
        <React.Suspense fallback={<AtmosphericLoader />}>
          <CollectionDetail collectionId={collectionId} onBack={closeCollectionDetail} />
        </React.Suspense>
      )}
    >
      <React.Suspense fallback={<AtmosphericLoader />}>
        {activeTab === 'home' && <Home />}
        {activeTab === 'discover' && <Discover />}
        {activeTab === 'watchlist' && <WatchlistPage />}
        {activeTab === 'watched' && <WatchedPage />}
        {activeTab === 'collections' && <CollectionsPage />}
        {activeTab === 'profile' && <Profile />}
      </React.Suspense>
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

