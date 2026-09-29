import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Movie, UserMovie, MovieNight } from '../types/movie';
import { Collection, CollectionMovie } from '../types/collection';
import { Achievement } from '../types/backup';

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
}

const DB_NAME = 'personal-cinema-db';
const DB_VERSION = 1;

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
