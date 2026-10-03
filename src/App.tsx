import React from 'react';
import { CinemaProvider, useCinema } from './context/CinemaContext';
import { CinemaShell } from './components/cinema/CinemaShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Spinner } from './components/ui/States';
import { Home } from './pages/Home';

const CHUNK_RELOAD_KEY = 'mycinema_chunk_reload';

// After a new deploy, an open tab can request a page chunk that no longer exists.
// Reload once to pick up the current build instead of showing the error screen.
function lazyPage<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return React.lazy(() =>
    loader()
      .then((mod) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return mod;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      })
  );
}

const Discover = lazyPage(() => import('./pages/Discover').then((m) => ({ default: m.Discover })));
const WatchlistPage = lazyPage(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const WatchedPage = lazyPage(() => import('./pages/WatchedPage').then((m) => ({ default: m.WatchedPage })));
const CollectionsPage = lazyPage(() => import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage })));
const CollectionDetail = lazyPage(() => import('./pages/CollectionDetail').then((m) => ({ default: m.CollectionDetail })));
const MovieDetail = lazyPage(() => import('./pages/MovieDetail').then((m) => ({ default: m.MovieDetail })));
const Profile = lazyPage(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const ReviewsPage = lazyPage(() => import('./pages/ReviewsPage').then((m) => ({ default: m.ReviewsPage })));

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
