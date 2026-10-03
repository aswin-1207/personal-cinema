import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Movie, UserMovie } from '../types/movie';
import { Collection } from '../types/collection';
import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { ReviewRepository } from '../db/repositories/reviewRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { PreferencesRepository, DEFAULT_PREFERENCES } from '../db/repositories/preferencesRepository';
import { validateAndRepairDatabase } from '../db/database';
import { SeedCatalogService } from '../services/seedCatalogService';
import { ScrollLockManager } from '../services/scrollLockManager';
import { UserPreferences } from '../types/backup';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';

export type TabType = 'home' | 'discover' | 'watchlist' | 'watched' | 'collections' | 'profile' | 'reviews';

interface ToastState {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface CinemaContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedMovieId: number | null;
  openMovieDetail: (movieId: number) => void;
  closeMovieDetail: () => void;
  selectedCollectionId: string | null;
  openCollectionDetail: (collectionId: string) => void;
  closeCollectionDetail: () => void;

  // Actions on Movies
  markAsWatched: (
    movie: Movie,
    options?: { rating?: number | null; notes?: string; review?: string; isFavorite?: boolean }
  ) => Promise<UserMovie>;
  unmarkWatched: (movieId: number) => Promise<void>;
  addToWatchlist: (movie: Movie) => Promise<UserMovie>;
  setWatching: (movie: Movie) => Promise<UserMovie>;
  toggleFavorite: (movie: Movie) => Promise<UserMovie>;
  setRating: (movieId: number, rating: number | null) => Promise<UserMovie>;
  setReviewAndNotes: (
    movieId: number,
    data: { review?: string; reviewTitle?: string; notes?: string; hasSpoilers?: boolean }
  ) => Promise<UserMovie>;
  deleteReview: (movieId: number) => Promise<void>;
  deleteRating: (movieId: number) => Promise<void>;
  removeFromWatchlist: (movieId: number) => Promise<void>;
  removeFromLibrary: (movieId: number) => Promise<void>;

  // Celebrations
  celebrationMovie: Movie | null;
  dismissCelebrationMovie: () => void;
  celebrationCollection: Collection | null;
  dismissCelebrationCollection: () => void;

  // Global state
  isOnline: boolean;
  toast: ToastState | null;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: () => void;
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>;

  // Data reload trigger
  dataVersion: number;
  notifyDataChanged: () => void;
}

const CinemaContext = createContext<CinemaContextType | null>(null);

export const CinemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [celebrationMovie, setCelebrationMovie] = useState<Movie | null>(null);
  const [celebrationCollection, setCelebrationCollection] = useState<Collection | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [dataVersion, setDataVersion] = useState<number>(1);

  // In-flight operation tracker to prevent rapid double-clicks and race conditions
  const inFlightOps = React.useRef(new Set<string>());

  // Monitor network status & initialize local preferences safely
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Safely load user preferences and run integrity audit
    PreferencesRepository.getPreferences()
      .then((p) => {
        setPreferences(p);
        soundService.setSoundEnabled(p.soundEnabled);
        hapticsService.setHapticsEnabled(p.hapticsEnabled);
      })
      .catch((err) => {
        console.warn('Storage unavailable or restricted, using default preferences:', err);
        setPreferences(DEFAULT_PREFERENCES);
      });

    // Run background integrity check to prune orphaned records
    validateAndRepairDatabase().catch((err) => {
      console.warn('Database integrity repair skipped:', err);
    });

    // Initialize curated seed catalog (non-blocking, idempotent)
    SeedCatalogService.initializeSeedCatalog()
      .then((didSeed) => {
        if (didSeed) notifyDataChanged();
      })
      .catch((err) => {
        console.warn('Seed catalog initialization deferred:', err);
      });

    const handleHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h === '#reviews' || h === '#journal') {
        setActiveTab('reviews');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  const notifyDataChanged = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({
      id: String(Date.now()),
      message,
      actionLabel,
      onAction,
    });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const updatePreference = async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    try {
      const updated = await PreferencesRepository.updatePreference(key, value);
      setPreferences(updated);
      if (key === 'soundEnabled') soundService.setSoundEnabled(value as boolean);
      if (key === 'hapticsEnabled') hapticsService.setHapticsEnabled(value as boolean);
    } catch (err) {
      console.error('Failed to update preference:', err);
      showToast('Could not save preference change');
    }
  };

  // Auto-reset any dangling scroll locks on tab transitions
  useEffect(() => {
    ScrollLockManager.forceUnlockAll();
  }, [activeTab]);

  // Handle popstate for browser back button support
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#movie=')) {
        const id = parseInt(hash.replace('#movie=', ''), 10);
        if (!isNaN(id)) setSelectedMovieId(id);
      } else {
        setSelectedMovieId(null);
      }

      if (hash.startsWith('#collection=')) {
        const id = hash.replace('#collection=', '');
        if (id) setSelectedCollectionId(id);
      } else {
        setSelectedCollectionId(null);
      }
    };

    // Deep link detection on initial mount
    if (window.location.hash.startsWith('#movie=')) {
      const id = parseInt(window.location.hash.replace('#movie=', ''), 10);
      if (!isNaN(id)) setSelectedMovieId(id);
    } else if (window.location.hash.startsWith('#collection=')) {
      const id = window.location.hash.replace('#collection=', '');
      if (id) setSelectedCollectionId(id);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openMovieDetail = (movieId: number) => {
    setSelectedMovieId(movieId);
    try {
      if (window.location.hash !== `#movie=${movieId}`) {
        window.history.pushState({ type: 'movie', id: movieId }, '', `#movie=${movieId}`);
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeMovieDetail = () => {
    setSelectedMovieId(null);
    ScrollLockManager.forceUnlockAll();
    if (window.location.hash.startsWith('#movie=')) {
      try {
        window.history.back();
      } catch {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  };

  const openCollectionDetail = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    try {
      if (window.location.hash !== `#collection=${collectionId}`) {
        window.history.pushState({ type: 'collection', id: collectionId }, '', `#collection=${collectionId}`);
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeCollectionDetail = () => {
    setSelectedCollectionId(null);
    ScrollLockManager.forceUnlockAll();
    if (window.location.hash.startsWith('#collection=')) {
      try {
        window.history.back();
      } catch {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  };

  // --- Centralized Movie Actions with Concurrency and Error Guards ---

  const markAsWatched = async (
    movie: Movie,
    options?: { rating?: number | null; notes?: string; review?: string; isFavorite?: boolean }
  ): Promise<UserMovie> => {
    const opKey = `watched_${movie.id}`;
    if (inFlightOps.current.has(opKey)) {
      const existing = await UserMovieRepository.getByMovieId(movie.id);
      if (existing) return existing;
    }
    inFlightOps.current.add(opKey);

    try {
      // 1. Ensure movie metadata is stored
      await MovieRepository.save(movie);

      // 2. Mark as watched in UserMovie repository
      const updated = await UserMovieRepository.markWatched(movie.id, options);

      // 3. Audio & tactile feedback
      soundService.playWatchedChime();
      hapticsService.confirm();

      // 4. Check if any collections containing this movie are now 100% complete!
      const affectedColIds = await CollectionRepository.getCollectionsForMovie(movie.id);
      for (const colId of affectedColIds) {
        const c = await CollectionRepository.getById(colId);
        if (!c) continue;
        const wasCompleteBefore = Boolean(c.completedAt);
        const progress = await CollectionRepository.calculateProgress(c.id);
        if (progress.isComplete && !wasCompleteBefore) {
          soundService.playCollectionTriumph();
          hapticsService.success();
          setCelebrationCollection(c);
          break;
        }
      }

      // 5. Show Undo Toast
      showToast(`✓ Marked "${movie.title}" as Watched`, 'Undo', async () => {
        try {
          await unmarkWatched(movie.id);
          showToast(`Restored "${movie.title}"`);
        } catch {
          showToast(`Could not restore "${movie.title}"`);
        }
      });

      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to mark movie as watched:', err);
      showToast(`Storage error: could not record "${movie.title}"`);
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const unmarkWatched = async (movieId: number) => {
    const opKey = `unmark_${movieId}`;
    if (inFlightOps.current.has(opKey)) return;
    inFlightOps.current.add(opKey);

    try {
      await UserMovieRepository.unmarkWatched(movieId);

      // Recalculate progress for any collections containing this movie
      const affectedColIds = await CollectionRepository.getCollectionsForMovie(movieId);
      for (const colId of affectedColIds) {
        await CollectionRepository.calculateProgress(colId);
      }

      soundService.playSubtleClick();
      hapticsService.tap();
      notifyDataChanged();
    } catch (err: any) {
      console.error('Failed to unmark watched:', err);
      showToast('Storage error: could not update movie status');
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const addToWatchlist = async (movie: Movie): Promise<UserMovie> => {
    const opKey = `watchlist_${movie.id}`;
    if (inFlightOps.current.has(opKey)) {
      const existing = await UserMovieRepository.getByMovieId(movie.id);
      if (existing) return existing;
    }
    inFlightOps.current.add(opKey);

    try {
      await MovieRepository.save(movie);
      const updated = await UserMovieRepository.addToWatchlist(movie.id);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast(`Added "${movie.title}" to Watchlist`, 'View', () => {
        setActiveTab('watchlist');
      });
      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to add to watchlist:', err);
      showToast(`Storage error: could not add "${movie.title}"`);
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const setWatching = async (movie: Movie): Promise<UserMovie> => {
    const opKey = `watching_${movie.id}`;
    if (inFlightOps.current.has(opKey)) {
      const existing = await UserMovieRepository.getByMovieId(movie.id);
      if (existing) return existing;
    }
    inFlightOps.current.add(opKey);

    try {
      await MovieRepository.save(movie);
      const updated = await UserMovieRepository.setWatching(movie.id);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast(`Now watching "${movie.title}"`);
      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to set watching status:', err);
      showToast(`Storage error: could not update "${movie.title}"`);
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const toggleFavorite = async (movie: Movie): Promise<UserMovie> => {
    const opKey = `fav_${movie.id}`;
    if (inFlightOps.current.has(opKey)) {
      const existing = await UserMovieRepository.getByMovieId(movie.id);
      if (existing) return existing;
    }
    inFlightOps.current.add(opKey);

    try {
      await MovieRepository.save(movie);
      const updated = await UserMovieRepository.toggleFavorite(movie.id);
      soundService.playSubtleClick();
      hapticsService.tap();
      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      showToast('Storage error: could not update favorite status');
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const setRating = async (movieId: number, rating: number | null) => {
    try {
      const updated = await UserMovieRepository.setRating(movieId, rating);
      soundService.playSubtleClick();
      hapticsService.tap();
      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to save rating:', err);
      showToast('Storage error: could not save rating');
      throw err;
    }
  };

  const setReviewAndNotes = async (
    movieId: number,
    data: { review?: string; reviewTitle?: string; notes?: string; hasSpoilers?: boolean }
  ) => {
    try {
      const updated = await UserMovieRepository.setReviewAndNotes(movieId, data);
      soundService.playSubtleClick();
      hapticsService.tap();
      notifyDataChanged();
      return updated;
    } catch (err: any) {
      console.error('Failed to save review/notes:', err);
      showToast('Storage error: could not save screening notes');
      throw err;
    }
  };

  const deleteReview = async (movieId: number) => {
    try {
      await ReviewRepository.deleteReview(movieId);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast('Review deleted');
      notifyDataChanged();
    } catch (err: any) {
      console.error('Failed to delete review:', err);
      showToast('Storage error: could not remove review');
      throw err;
    }
  };

  const deleteRating = async (movieId: number) => {
    try {
      await ReviewRepository.deleteRating(movieId);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast('Rating removed');
      notifyDataChanged();
    } catch (err: any) {
      console.error('Failed to delete rating:', err);
      showToast('Storage error: could not remove rating');
      throw err;
    }
  };

  const removeFromWatchlist = async (movieId: number) => {
    const opKey = `rm_watchlist_${movieId}`;
    if (inFlightOps.current.has(opKey)) return;
    inFlightOps.current.add(opKey);

    try {
      await UserMovieRepository.removeFromWatchlist(movieId);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast('Removed from Watchlist');
      notifyDataChanged();
    } catch (err: any) {
      console.error('Failed to remove from watchlist:', err);
      showToast('Storage error: could not update watchlist');
      throw err;
    } finally {
      inFlightOps.current.delete(opKey);
    }
  };

  const removeFromLibrary = async (movieId: number) => {
    try {
      await UserMovieRepository.remove(movieId);
      soundService.playSubtleClick();
      hapticsService.tap();
      showToast('Removed movie from your cinema');
      notifyDataChanged();
    } catch (err: any) {
      console.error('Failed to remove from library:', err);
      showToast('Storage error: could not remove movie');
      throw err;
    }
  };

  return (
    <CinemaContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedMovieId,
        openMovieDetail,
        closeMovieDetail,
        selectedCollectionId,
        openCollectionDetail,
        closeCollectionDetail,
        markAsWatched,
        unmarkWatched,
        addToWatchlist,
        setWatching,
        toggleFavorite,
        setRating,
        setReviewAndNotes,
        deleteReview,
        deleteRating,
        removeFromWatchlist,
        removeFromLibrary,
        celebrationMovie,
        dismissCelebrationMovie: () => setCelebrationMovie(null),
        celebrationCollection,
        dismissCelebrationCollection: () => setCelebrationCollection(null),
        isOnline,
        toast,
        showToast,
        dismissToast,
        preferences,
        updatePreference,
        dataVersion,
        notifyDataChanged,
      }}
    >
      {children}
    </CinemaContext.Provider>
  );
};

export const useCinema = (): CinemaContextType => {
  const ctx = useContext(CinemaContext);
  if (!ctx) throw new Error('useCinema must be used within a CinemaProvider');
  return ctx;
};
