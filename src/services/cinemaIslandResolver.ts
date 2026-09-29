import { Movie, UserMovie } from '../types/movie';
import { Collection } from '../types/collection';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { MovieRepository } from '../db/repositories/movieRepository';
import { MovieNightRepository } from '../db/repositories/movieNightRepository';
import { tmdbService } from './tmdbService';

export interface CinemaNextMovieResult {
  type: 'movie' | 'empty';
  movie?: Movie;
  userData?: UserMovie;
  contextTag?: string; // e.g. "NEXT FOR YOU" or "CONTINUE JOURNEY"
  contextDetails?: string; // e.g. "MCU · 18/38 WATCHED" or "ON YOUR WATCHLIST" or "TONIGHT'S SCREENING"
  collection?: Collection;
  collectionProgress?: {
    watched: number;
    total: number;
    percent: number;
  };
}

export class CinemaNextMovieResolver {
  /**
   * Deterministically resolves the single next movie for the user following strict priority:
   * 1. Active Collection Journey (next unwatched movie in in-progress collection)
   * 2. Next unwatched movie in any collection
   * 3. Scheduled Movie Night (today/upcoming)
   * 4. Watchlist Movie (canonical want_to_watch)
   * 5. Discovery Recommendation (trending unwatched)
   * 6. Empty State ("BUILD YOUR CINEMA")
   */
  static async resolveNextMovie(): Promise<CinemaNextMovieResult> {
    try {
      const userMovies = await UserMovieRepository.getAll();
      const userMovieMap = new Map(userMovies.map((um) => [um.movieId, um]));
      const watchedMovieIds = new Set(
        userMovies.filter((um) => um.status === 'watched').map((um) => um.movieId)
      );

      // --- Priority 1 & 2: Collection Journey ---
      const collections = await CollectionRepository.getAll();
      let activeCollectionMatch: {
        collection: Collection;
        nextMovie: Movie;
        userData?: UserMovie;
        watched: number;
        total: number;
        percent: number;
      } | null = null;

      let fallbackCollectionMatch: {
        collection: Collection;
        nextMovie: Movie;
        userData?: UserMovie;
        watched: number;
        total: number;
        percent: number;
      } | null = null;

      for (const col of collections) {
        const withMovies = await CollectionRepository.getWithMovies(col.id);
        if (!withMovies || withMovies.movies.length === 0) continue;

        const { progress, movies } = withMovies;
        if (progress.isComplete) continue; // Skip completed collections

        // Find first unwatched movie according to collection order
        const unwatchedItem = movies.find((item) => item.userData?.status !== 'watched');
        if (!unwatchedItem) continue;

        const candidate = {
          collection: col,
          nextMovie: unwatchedItem.movie,
          userData: unwatchedItem.userData,
          watched: progress.watched,
          total: progress.total,
          percent: progress.percent,
        };

        // If user already started watching this collection (watched > 0), this is an ACTIVE journey!
        if (progress.watched > 0 && !activeCollectionMatch) {
          activeCollectionMatch = candidate;
          break; // Found highest priority active collection
        } else if (!fallbackCollectionMatch) {
          fallbackCollectionMatch = candidate;
        }
      }

      const collectionChoice = activeCollectionMatch || fallbackCollectionMatch;
      if (collectionChoice) {
        return {
          type: 'movie',
          movie: collectionChoice.nextMovie,
          userData: collectionChoice.userData,
          contextTag: 'NEXT FOR YOU',
          contextDetails: `${collectionChoice.collection.name} · ${collectionChoice.watched}/${collectionChoice.total} WATCHED`,
          collection: collectionChoice.collection,
          collectionProgress: {
            watched: collectionChoice.watched,
            total: collectionChoice.total,
            percent: collectionChoice.percent,
          },
        };
      }

      // --- Priority 3: Scheduled Movie Night ---
      const upcomingNights = await MovieNightRepository.getUpcoming();
      for (const night of upcomingNights) {
        if (!watchedMovieIds.has(night.movieId)) {
          let movie = night.movie;
          if (!movie) {
            movie = await MovieRepository.getById(night.movieId);
          }
          if (movie) {
            const today = new Date().toISOString().split('T')[0];
            const isToday = night.date === today;
            return {
              type: 'movie',
              movie,
              userData: userMovieMap.get(movie.id),
              contextTag: 'NEXT FOR YOU',
              contextDetails: isToday
                ? `TONIGHT'S SCREENING · ${night.time}`
                : `SCHEDULED FOR ${night.date}`,
            };
          }
        }
      }

      // --- Priority 4: Canonical Watchlist ---
      const watchlistItems = userMovies
        .filter((um) => um.status === 'want_to_watch')
        .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));

      for (const item of watchlistItems) {
        const movie = await MovieRepository.getById(item.movieId);
        if (movie && !watchedMovieIds.has(movie.id)) {
          return {
            type: 'movie',
            movie,
            userData: item,
            contextTag: 'NEXT FOR YOU',
            contextDetails: movie.runtime ? `${movie.runtime} min · ON WATCHLIST` : 'ON YOUR WATCHLIST',
          };
        }
      }

      // --- Priority 5: Discovery Recommendation ---
      if (navigator.onLine) {
        try {
          const trending = await tmdbService.getTrending('week');
          const unwatchedTrending = trending.find((m) => !watchedMovieIds.has(m.id));
          if (unwatchedTrending) {
            return {
              type: 'movie',
              movie: unwatchedTrending,
              userData: userMovieMap.get(unwatchedTrending.id),
              contextTag: 'NEXT FOR YOU',
              contextDetails: 'RECOMMENDED SELECTION',
            };
          }
        } catch {
          // Ignore network errors in discovery fallback
        }
      }

      // Fallback: any unwatched movie in local movie repository
      const allLocal = await MovieRepository.getAll();
      const localUnwatched = allLocal.find((m) => !watchedMovieIds.has(m.id));
      if (localUnwatched) {
        return {
          type: 'movie',
          movie: localUnwatched,
          userData: userMovieMap.get(localUnwatched.id),
          contextTag: 'NEXT FOR YOU',
          contextDetails: localUnwatched.runtime
            ? `${localUnwatched.runtime} min`
            : 'IN YOUR LIBRARY',
        };
      }

      // --- Priority 6: No Movie State ---
      return {
        type: 'empty',
      };
    } catch (err) {
      console.error('Error resolving next movie for Cinema Island:', err);
      return { type: 'empty' };
    }
  }
}
