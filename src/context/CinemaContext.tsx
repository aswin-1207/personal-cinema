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

const TABS: TabType[] = ['home', 'discover', 'watchlist', 'watched', 'collections', 'profile', 'reviews'];

export interface Route {
  tab: TabType;
  sub: string | null;
  movieId: number | null;
  collectionId: string | null;
}

interface HistoryEntryState {
  pc: true;
  key: string;
  depth: number;
  tab: TabType;
}

function parseHash(hash: string, fallbackTab: TabType = 'home'): Route {
  const h = hash.replace(/^#\/?/, '');
  const empty: Route = { tab: fallbackTab, sub: null, movieId: null, collectionId: null };
  if (h.startsWith('movie=')) {
    const id = parseInt(h.slice(6), 10);
    return isNaN(id) ? { ...empty, tab: 'home' } : { ...empty, movieId: id };
  }
  if (h.startsWith('collection=')) {
    const id = decodeURIComponent(h.slice(11));
    return { ...empty, tab: 'collections', collectionId: id || null };
  }
  if (h === 'journal') return { ...empty, tab: 'reviews' };
  const [rawTab, rawSub] = h.split('/');
  const tab = rawTab.toLowerCase() as TabType;
  if (TABS.includes(tab)) {
    return { ...empty, tab, sub: rawSub ? decodeURIComponent(rawSub) : null };
  }
  return { ...empty, tab: 'home' };
}

function routeToHash(route: Route): string {
  if (route.movieId != null) return `#movie=${route.movieId}`;
  if (route.collectionId) return `#collection=${encodeURIComponent(route.collectionId)}`;
  if (route.tab === 'home' && !route.sub) return '#home';
  return `#${route.tab}${route.sub ? `/${encodeURIComponent(route.sub)}` : ''}`;
}

const isShareHash = (hash: string) => hash.startsWith('#share-movie=') || hash.startsWith('#share-col=');

const newEntryKey = () => Math.random().toString(36).slice(2, 10);

interface ToastState {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface CinemaContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType, sub?: string | null) => void;
  /** Optional sub-view of the active tab (e.g. a Discover "View all" category). */
  activeSub: string | null;
  setActiveSub: (sub: string | null) => void;
  goBack: () => void;
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
  const [route, setRoute] = useState<Route>(() =>
    typeof window !== 'undefined' && !isShareHash(window.location.hash)
      ? parseHash(window.location.hash)
      : { tab: 'home', sub: null, movieId: null, collectionId: null }
  );
  const activeTab = route.tab;
  const selectedMovieId = route.movieId;
  const selectedCollectionId = route.collectionId;
  const scrollPositions = React.useRef(new Map<string, number>());
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

  // Respect the in-app Reduced Motion preference globally
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', Boolean(preferences.motionReduced));
  }, [preferences.motionReduced]);

  // --- Hash router: the document is the single scroll owner, so every route
  // change saves/restores window scroll per history entry. ---
  const currentState = (): HistoryEntryState | null => {
    const st = window.history.state;
    return st && st.pc ? (st as HistoryEntryState) : null;
  };

  const restoreScroll = (top: number) => {
    let tries = 0;
    const attempt = () => {
      const maxTop = document.documentElement.scrollHeight - window.innerHeight;
      if (maxTop >= top - 4 || tries > 20) {
        window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
        return;
      }
      tries++;
      window.setTimeout(attempt, 50);
    };
    requestAnimationFrame(attempt);
  };

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (!isShareHash(window.location.hash) && !window.location.pathname.startsWith('/share/')) {
      const initial = parseHash(window.location.hash);
      const st: HistoryEntryState = { pc: true, key: newEntryKey(), depth: 0, tab: initial.tab };
      window.history.replaceState(st, '', routeToHash(initial));
    }

    const handlePopState = (e: PopStateEvent) => {
      if (isShareHash(window.location.hash)) return;
      const st = e.state && e.state.pc ? (e.state as HistoryEntryState) : null;
      const next = parseHash(window.location.hash, st?.tab ?? 'home');
      ScrollLockManager.forceUnlockAll();
      setRoute(next);
      const saved = st ? scrollPositions.current.get(st.key) : undefined;
      restoreScroll(saved ?? 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const prev = currentState();
    if (prev) scrollPositions.current.set(prev.key, window.scrollY);
    const st: HistoryEntryState = {
      pc: true,
      key: newEntryKey(),
      depth: options?.replace ? prev?.depth ?? 0 : (prev?.depth ?? 0) + 1,
      tab: next.tab,
    };
    try {
      if (options?.replace) window.history.replaceState(st, '', routeToHash(next));
      else window.history.pushState(st, '', routeToHash(next));
    } catch {
      /* history unavailable (sandboxed iframe) — state still updates */
    }
    ScrollLockManager.forceUnlockAll();
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const routeRef = React.useRef(route);
  routeRef.current = route;

  const setActiveTab = useCallback(
    (tab: TabType, sub: string | null = null) => {
      const cur = routeRef.current;
      if (cur.tab === tab && cur.sub === sub && cur.movieId == null && cur.collectionId == null) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      navigate({ tab, sub, movieId: null, collectionId: null });
    },
    [navigate]
  );

  const setActiveSub = useCallback(
    (sub: string | null) => {
      const cur = routeRef.current;
      navigate({ ...cur, sub, movieId: null, collectionId: null });
    },
    [navigate]
  );

  /** Back within the app if we pushed the current entry, otherwise go to the parent view. */
  const goBack = useCallback(() => {
    const st = currentState();
    if (st && st.depth > 0) {
      window.history.back();
      return;
    }
    const cur = routeRef.current;
    if (cur.movieId != null) navigate({ ...cur, movieId: null }, { replace: true });
    else if (cur.collectionId) navigate({ tab: 'collections', sub: null, movieId: null, collectionId: null }, { replace: true });
    else if (cur.sub) navigate({ ...cur, sub: null }, { replace: true });
    else navigate({ tab: 'home', sub: null, movieId: null, collectionId: null }, { replace: true });
  }, [navigate]);

  const openMovieDetail = useCallback(
    (movieId: number) => {
      const cur = routeRef.current;
      if (cur.movieId === movieId) return;
      navigate({ tab: cur.tab, sub: cur.sub, collectionId: null, movieId });
    },
    [navigate]
  );

  const closeMovieDetail = goBack;

  const openCollectionDetail = useCallback(
    (collectionId: string) => {
      navigate({ tab: 'collections', sub: null, movieId: null, collectionId });
    },
    [navigate]
  );

  const closeCollectionDetail = goBack;

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

      // 2. Mark as watched in UserMovie repository (keep the prior record so Undo can restore it)
      const previous = await UserMovieRepository.getByMovieId(movie.id);
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
          await undoMarkWatched(movie.id, previous);
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

  // Undo returns the title to exactly where it was (Watching, Watchlist, or untracked).
  const undoMarkWatched = async (movieId: number, previous: UserMovie | undefined) => {
    try {
      if (!previous) {
        await UserMovieRepository.remove(movieId);
      } else {
        const current = await UserMovieRepository.getByMovieId(movieId);
        await UserMovieRepository.save({
          ...(current ?? previous),
          status: previous.status,
          watchedAt: previous.watchedAt ?? null,
          watchingAt: previous.watchingAt ?? null,
        });
      }
      const affectedColIds = await CollectionRepository.getCollectionsForMovie(movieId);
      for (const colId of affectedColIds) {
        await CollectionRepository.calculateProgress(colId);
      }
      notifyDataChanged();
    } catch (err) {
      console.error('Failed to undo watched:', err);
      throw err;
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
        activeSub: route.sub,
        setActiveSub,
        goBack,
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
