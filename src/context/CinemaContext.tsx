import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Movie, UserMovie } from '../types/movie';
import { Collection } from '../types/collection';
import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { PreferencesRepository, DEFAULT_PREFERENCES } from '../db/repositories/preferencesRepository';
import { UserPreferences } from '../types/backup';
import { soundService } from '../services/soundService';
import { hapticsService } from '../services/hapticsService';

export type TabType = 'home' | 'discover' | 'library' | 'collections' | 'profile';

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
  setReviewAndNotes: (movieId: number, data: { review?: string; notes?: string }) => Promise<UserMovie>;
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

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load user preferences
    PreferencesRepository.getPreferences().then((p) => {
      setPreferences(p);
      soundService.setSoundEnabled(p.soundEnabled);
      hapticsService.setHapticsEnabled(p.hapticsEnabled);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    const updated = await PreferencesRepository.updatePreference(key, value);
    setPreferences(updated);
    if (key === 'soundEnabled') soundService.setSoundEnabled(value as boolean);
    if (key === 'hapticsEnabled') hapticsService.setHapticsEnabled(value as boolean);
  };

  const openMovieDetail = (movieId: number) => {
    setSelectedMovieId(movieId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeMovieDetail = () => {
    setSelectedMovieId(null);
  };

  const openCollectionDetail = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeCollectionDetail = () => {
    setSelectedCollectionId(null);
  };

  // --- Centralized Movie Actions ---

  const markAsWatched = async (
    movie: Movie,
    options?: { rating?: number | null; notes?: string; review?: string; isFavorite?: boolean }
  ) => {
    // 1. Ensure movie metadata is stored
    await MovieRepository.save(movie);

    // 2. Mark as watched in UserMovie repository
    const updated = await UserMovieRepository.markWatched(movie.id, options);

    // 3. Audio & tactile feedback
    soundService.playWatchedChime();
    hapticsService.confirm();

    // 4. Trigger celebratory moment
    setCelebrationMovie(movie);

    // 5. Check if any collections containing this movie are now 100% complete!
    const collections = await CollectionRepository.getAll();
    for (const c of collections) {
      const colMovies = await CollectionRepository.getCollectionMovies(c.id);
      if (colMovies.some((cm) => cm.movieId === movie.id)) {
        const progress = await CollectionRepository.calculateProgress(c.id);
        if (progress.isComplete) {
          // Play triumph chord and show collection completed dialog
          soundService.playCollectionTriumph();
          hapticsService.success();
          setCelebrationCollection(c);
          break;
        }
      }
    }

    // 6. Show Undo Toast
    showToast(`✓ Marked "${movie.title}" as Watched`, 'Undo', async () => {
      await unmarkWatched(movie.id);
      showToast(`Restored "${movie.title}"`);
    });

    notifyDataChanged();
    return updated;
  };

  const unmarkWatched = async (movieId: number) => {
    await UserMovieRepository.unmarkWatched(movieId);
    soundService.playSubtleClick();
    hapticsService.tap();
    notifyDataChanged();
  };

  const addToWatchlist = async (movie: Movie) => {
    await MovieRepository.save(movie);
    const updated = await UserMovieRepository.addToWatchlist(movie.id);
    soundService.playSubtleClick();
    hapticsService.tap();
    showToast(`Added "${movie.title}" to Watchlist`, 'View', () => {
      setActiveTab('library');
    });
    notifyDataChanged();
    return updated;
  };

  const setWatching = async (movie: Movie) => {
    await MovieRepository.save(movie);
    const updated = await UserMovieRepository.setWatching(movie.id);
    soundService.playSubtleClick();
    hapticsService.tap();
    showToast(`Now watching "${movie.title}"`);
    notifyDataChanged();
    return updated;
  };

  const toggleFavorite = async (movie: Movie) => {
    await MovieRepository.save(movie);
    const updated = await UserMovieRepository.toggleFavorite(movie.id);
    soundService.playSubtleClick();
    hapticsService.tap();
    notifyDataChanged();
    return updated;
  };

  const setRating = async (movieId: number, rating: number | null) => {
    const updated = await UserMovieRepository.setRating(movieId, rating);
    soundService.playSubtleClick();
    hapticsService.tap();
    notifyDataChanged();
    return updated;
  };

  const setReviewAndNotes = async (movieId: number, data: { review?: string; notes?: string }) => {
    const updated = await UserMovieRepository.setReviewAndNotes(movieId, data);
    soundService.playSubtleClick();
    hapticsService.tap();
    notifyDataChanged();
    return updated;
  };

  const removeFromLibrary = async (movieId: number) => {
    await UserMovieRepository.remove(movieId);
    soundService.playSubtleClick();
    hapticsService.tap();
    showToast('Removed movie from library');
    notifyDataChanged();
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
