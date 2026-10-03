import React from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { CinemaShell } from './components/cinema/CinemaShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Spinner } from './components/ui/States';
import { Home } from './pages/Home';

const Discover = React.lazy(() => import('./pages/Discover').then((m) => ({ default: m.Discover })));
const WatchlistPage = React.lazy(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const WatchedPage = React.lazy(() => import('./pages/WatchedPage').then((m) => ({ default: m.WatchedPage })));
const CollectionsPage = React.lazy(() => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })));
const CollectionDetail = React.lazy(() => import('./pages/CollectionDetail').then((m) => ({ default: m.CollectionDetail })));
const MovieDetail = React.lazy(() => import('./pages/MovieDetail').then((m) => ({ default: m.MovieDetail })));
const Profile = React.lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const ReviewsPage = React.lazy(() => import('./pages/ReviewsPage').then((m) => ({ default: m.ReviewsPage })));

const AppContent: React.FC = () => {
  const { activeTab, activeSub, selectedMovieId, closeMovieDetail, selectedCollectionId, closeCollectionDetail } = useCinema();

  let page: React.ReactNode;
  let key: string;
  if (selectedMovieId != null) {
    key = `movie-${selectedMovieId}`;
    page = <MovieDetail movieId={selectedMovieId} onClose={closeMovieDetail} />;
  } else if (selectedCollectionId) {
    key = `collection-${selectedCollectionId}`;
    page = <CollectionDetail collectionId={selectedCollectionId} onBack={closeCollectionDetail} />;
  } else {
    key = `${activeTab}-${activeSub ?? ''}`;
    page =
      activeTab === 'discover' ? <Discover /> :
      activeTab === 'watchlist' ? <WatchlistPage /> :
      activeTab === 'watched' ? <WatchedPage /> :
      activeTab === 'collections' ? <CollectionsPage /> :
      activeTab === 'profile' ? <Profile /> :
      activeTab === 'reviews' ? <ReviewsPage /> :
      <Home />;
  }

  return (
    <CinemaShell>
      <React.Suspense fallback={<Spinner />}>
        <div key={key} className="animate-cinema-fade">
          {page}
        </div>
      </React.Suspense>
    </CinemaShell>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <CinemaProvider>
      <AppContent />
    </CinemaProvider>
  </ErrorBoundary>
);

export default App;
