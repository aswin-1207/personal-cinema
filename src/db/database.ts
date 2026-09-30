import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Movie, UserMovie, MovieNight } from '../types/movie';
import { Collection, CollectionMovie } from '../types/collection';
import { Achievement } from '../types/backup';

export interface TMDBCacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttlMs: number;
}

export interface PersonalCinemaDBSchema extends DBSchema {
  movies: {
    key: number;
    value: Movie;
    indexes: { 'by-title': string };
  };
  userMovies: {
    key: number;
    value: UserMovie;
    indexes: {
      'by-status': string;
      'by-favorite': number;
      'by-watchedAt': string;
      'by-addedAt': string;
    };
  };
  collections: {
    key: string;
    value: Collection;
    indexes: { 'by-createdAt': string };
  };
  collectionMovies: {
    key: string;
    value: CollectionMovie;
    indexes: {
      'by-collection': string;
      'by-movie': number;
      'by-collection-position': [string, number];
    };
  };
  movieNights: {
    key: string;
    value: MovieNight;
    indexes: { 'by-date': string; 'by-status': string };
  };
  preferences: {
    key: string;
    value: { key: string; value: any };
  };
  achievements: {
    key: string;
    value: Achievement;
  };
  tmdbCache: {
    key: string;
    value: TMDBCacheEntry;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'personal-cinema-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<PersonalCinemaDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<PersonalCinemaDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PersonalCinemaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Movies Store
        if (!db.objectStoreNames.contains('movies')) {
          const movieStore = db.createObjectStore('movies', { keyPath: 'id' });
          movieStore.createIndex('by-title', 'title');
        }

        // UserMovies Store
        if (!db.objectStoreNames.contains('userMovies')) {
          const userMovieStore = db.createObjectStore('userMovies', { keyPath: 'movieId' });
          userMovieStore.createIndex('by-status', 'status');
          userMovieStore.createIndex('by-favorite', 'isFavorite');
          userMovieStore.createIndex('by-watchedAt', 'watchedAt');
          userMovieStore.createIndex('by-addedAt', 'addedAt');
        }

        // Collections Store
        if (!db.objectStoreNames.contains('collections')) {
          const colStore = db.createObjectStore('collections', { keyPath: 'id' });
          colStore.createIndex('by-createdAt', 'createdAt');
        }

        // CollectionMovies Junction Store
        if (!db.objectStoreNames.contains('collectionMovies')) {
          const colMovieStore = db.createObjectStore('collectionMovies', { keyPath: 'id' });
          colMovieStore.createIndex('by-collection', 'collectionId');
          colMovieStore.createIndex('by-movie', 'movieId');
          colMovieStore.createIndex('by-collection-position', ['collectionId', 'position']);
        }

        // Movie Nights Store
        if (!db.objectStoreNames.contains('movieNights')) {
          const nightStore = db.createObjectStore('movieNights', { keyPath: 'id' });
          nightStore.createIndex('by-date', 'date');
          nightStore.createIndex('by-status', 'status');
        }

        // Preferences Store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }

        // Achievements Store
        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' });
        }

        // TMDB Persistent Cache Store (Decoupled from Personal Data)
        if (!db.objectStoreNames.contains('tmdbCache')) {
          const cacheStore = db.createObjectStore('tmdbCache', { keyPath: 'key' });
          cacheStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['movies', 'userMovies', 'collections', 'collectionMovies', 'movieNights', 'achievements'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('movies').clear(),
    tx.objectStore('userMovies').clear(),
    tx.objectStore('collections').clear(),
    tx.objectStore('collectionMovies').clear(),
    tx.objectStore('movieNights').clear(),
    tx.objectStore('achievements').clear(),
  ]);
  await tx.done;
}

export async function clearTMDBCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tmdbCache', 'readwrite');
  await tx.objectStore('tmdbCache').clear();
  await tx.done;
}

export async function validateAndRepairDatabase(): Promise<{
  orphanCollectionMoviesRemoved: number;
  invalidEntriesRepaired: number;
}> {
  const db = await getDB();
  let orphanCollectionMoviesRemoved = 0;
  let invalidEntriesRepaired = 0;

  try {
    const collections = await db.getAll('collections');
    const collectionIds = new Set(collections.map((c) => c.id));
    const colMovies = await db.getAll('collectionMovies');

    const tx = db.transaction(['collectionMovies', 'userMovies'], 'readwrite');
    const colMovieStore = tx.objectStore('collectionMovies');
    const userMovieStore = tx.objectStore('userMovies');

    for (const cm of colMovies) {
      if (!collectionIds.has(cm.collectionId)) {
        await colMovieStore.delete(cm.id);
        orphanCollectionMoviesRemoved++;
      }
    }

    const userMovies = await db.getAll('userMovies');
    for (const um of userMovies) {
      if (!['want_to_watch', 'watching', 'watched', 'dropped'].includes(um.status)) {
        um.status = 'want_to_watch';
        await userMovieStore.put(um);
        invalidEntriesRepaired++;
      }
    }

    await tx.done;
  } catch (err) {
    console.warn('Database integrity check skipped or encountered error:', err);
  }

  return { orphanCollectionMoviesRemoved, invalidEntriesRepaired };
}

