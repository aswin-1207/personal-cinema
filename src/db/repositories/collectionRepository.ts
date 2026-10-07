import { getDB } from '../database';
import { Collection, CollectionMovie, CollectionProgress, CollectionWithMovies } from '../../types/collection';
import { MovieRepository } from './movieRepository';
import { UserMovieRepository } from './userMovieRepository';

export class CollectionRepository {
  static async getById(id: string): Promise<Collection | undefined> {
    const db = await getDB();
    return db.get('collections', id);
  }

  static async getAll(): Promise<Collection[]> {
    const db = await getDB();
    return db.getAll('collections');
  }

  static async create(data: {
    name: string;
    description?: string;
    coverType?: Collection['coverType'];
    customCoverMovieId?: number | null;
    sortMode?: Collection['sortMode'];
  }): Promise<Collection> {
    const trimmedName = data.name ? data.name.trim() : '';
    if (!trimmedName) {
      throw new Error('Collection name cannot be empty');
    }

    const db = await getDB();
    const now = new Date().toISOString();
    let newId = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    try {
      if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        newId = globalThis.crypto.randomUUID();
      } else if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        newId = window.crypto.randomUUID();
      }
    } catch {}

    const collection: Collection = {
      id: newId,
      name: trimmedName.slice(0, 100),
      description: data.description?.trim().slice(0, 500) || '',
      coverType: data.coverType || 'collage',
      customCoverMovieId: data.customCoverMovieId || null,
      sortMode: data.sortMode || 'custom',
      customOrder: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      finalMovieId: null,
    };

    await db.put('collections', collection);
    return collection;
  }

  static async update(collection: Collection): Promise<void> {
    const trimmedName = collection.name ? collection.name.trim() : '';
    if (!trimmedName) {
      throw new Error('Collection name cannot be empty');
    }
    collection.name = trimmedName.slice(0, 100);
    if (collection.description) {
      collection.description = collection.description.trim().slice(0, 500);
    }

    const db = await getDB();
    collection.updatedAt = new Date().toISOString();
    await db.put('collections', collection);
  }

  static async getCollectionsForMovie(movieId: number): Promise<string[]> {
    const db = await getDB();
    const items = await db.getAllFromIndex('collectionMovies', 'by-movie', movieId);
    return items.map((item) => item.collectionId);
  }

  static async delete(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['collections', 'collectionMovies'], 'readwrite');
    await tx.objectStore('collections').delete(id);

    // Delete associated collectionMovies
    const colMovieStore = tx.objectStore('collectionMovies');
    const index = colMovieStore.index('by-collection');
    let cursor = await index.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  // --- Collection Movies Management ---

  static async addMovieToCollection(collectionId: string, movieId: number): Promise<void> {
    const db = await getDB();
    const collection = await this.getById(collectionId);
    if (!collection) return;

    // Check if already in collection
    const id = `${collectionId}_${movieId}`;
    const existing = await db.get('collectionMovies', id);
    if (existing) return;

    const currentCount = (await this.getCollectionMovies(collectionId)).length;
    const item: CollectionMovie = {
      id,
      collectionId,
      movieId,
      position: currentCount,
      addedAt: new Date().toISOString(),
    };

    await db.put('collectionMovies', item);

    // Update customOrder
    if (!collection.customOrder.includes(movieId)) {
      collection.customOrder.push(movieId);
      await this.update(collection);
    }
  }

  static async addMoviesToCollection(collectionId: string, movieIds: number[]): Promise<void> {
    const db = await getDB();
    const collection = await this.getById(collectionId);
    if (!collection) return;

    const existingItems = await this.getCollectionMovies(collectionId);
    const existingMovieIds = new Set(existingItems.map((item) => item.movieId));

    const tx = db.transaction(['collections', 'collectionMovies'], 'readwrite');
    const store = tx.objectStore('collectionMovies');
    let pos = existingItems.length;

    for (const movieId of movieIds) {
      if (!existingMovieIds.has(movieId)) {
        existingMovieIds.add(movieId);
        const item: CollectionMovie = {
          id: `${collectionId}_${movieId}`,
          collectionId,
          movieId,
          position: pos++,
          addedAt: new Date().toISOString(),
        };
        await store.put(item);
        if (!collection.customOrder.includes(movieId)) {
          collection.customOrder.push(movieId);
        }
      }
    }

    collection.updatedAt = new Date().toISOString();
    await tx.objectStore('collections').put(collection);
    await tx.done;
  }

  static async removeMovieFromCollection(collectionId: string, movieId: number): Promise<void> {
    const db = await getDB();
    const id = `${collectionId}_${movieId}`;
    await db.delete('collectionMovies', id);

    const collection = await this.getById(collectionId);
    if (collection) {
      collection.customOrder = collection.customOrder.filter((mId) => mId !== movieId);
      await this.update(collection);
    }
  }

  static async getCollectionMovies(collectionId: string): Promise<CollectionMovie[]> {
    const db = await getDB();
    return db.getAllFromIndex('collectionMovies', 'by-collection', collectionId);
  }

  static async updateMovieOrder(collectionId: string, orderedMovieIds: number[]): Promise<void> {
    const db = await getDB();
    const collection = await this.getById(collectionId);
    if (!collection) return;

    collection.customOrder = orderedMovieIds;
    collection.sortMode = 'custom';
    await this.update(collection);

    // Update position on individual CollectionMovie rows
    const tx = db.transaction('collectionMovies', 'readwrite');
    const store = tx.objectStore('collectionMovies');
    for (let i = 0; i < orderedMovieIds.length; i++) {
      const id = `${collectionId}_${orderedMovieIds[i]}`;
      const item = await store.get(id);
      if (item) {
        item.position = i;
        await store.put(item);
      }
    }
    await tx.done;
  }

  /**
   * Derive live progress for a collection from canonical userMovies
   */
  static async calculateProgress(collectionId: string): Promise<CollectionProgress> {
    const colMovies = await this.getCollectionMovies(collectionId);
    if (colMovies.length === 0) {
      return { total: 0, watched: 0, watching: 0, unwatched: 0, percent: 0, isComplete: false };
    }

    const movieIds = colMovies.map((cm) => cm.movieId);
    const userMovieMap = await UserMovieRepository.getByMovieIds(movieIds);
    let watched = 0;
    let watching = 0;
    let unwatched = 0;
    let latestWatchedTime = -1;
    let finalMovieId: number | null = null;

    for (const mId of movieIds) {
      const userMovie = userMovieMap.get(mId);
      if (userMovie?.status === 'watched') {
        watched++;
        const time = userMovie.watchedAt
          ? new Date(userMovie.watchedAt).getTime()
          : (userMovie.addedAt ? new Date(userMovie.addedAt).getTime() : 0);
        if (time >= latestWatchedTime) {
          latestWatchedTime = time;
          finalMovieId = mId;
        }
      } else if (userMovie?.status === 'watching') {
        watching++;
      } else {
        unwatched++;
      }
    }

    const total = colMovies.length;
    const percent = Math.round((watched / total) * 100);
    const isComplete = total > 0 && watched === total;

    // Check if completion status needs updating
    const collection = await this.getById(collectionId);
    if (collection) {
      let changed = false;
      if (isComplete) {
        if (!collection.completedAt) {
          collection.completedAt = new Date().toISOString();
          changed = true;
        }
        if ((collection.finalMovieId ?? null) !== finalMovieId) {
          collection.finalMovieId = finalMovieId;
          changed = true;
        }
      } else {
        if (collection.completedAt != null || collection.finalMovieId != null) {
          collection.completedAt = null;
          collection.finalMovieId = null;
          changed = true;
        }
      }
      if (changed) {
        // Direct write without altering collection.updatedAt to avoid triggering infinite re-render loops
        const db = await getDB();
        await db.put('collections', collection);
      }
    }

    return { total, watched, watching, unwatched, percent, isComplete };
  }

  /**
   * Get full collection object joined with movies and live progress
   */
  static async getWithMovies(collectionId: string): Promise<CollectionWithMovies | null> {
    const collection = await this.getById(collectionId);
    if (!collection) return null;

    const colMovies = await this.getCollectionMovies(collectionId);
    const movieIds = colMovies.map((cm) => cm.movieId);
    const [movies, userMovieMap] = await Promise.all([
      MovieRepository.getByIds(movieIds),
      UserMovieRepository.getByMovieIds(movieIds),
    ]);
    const movieMap = new Map(movies.map((m) => [m.id, m]));

    // Build movie items with user data
    const movieItems = colMovies.map((cm) => {
      const movie = movieMap.get(cm.movieId);
      if (!movie) return null;
      const userData = userMovieMap.get(cm.movieId);
      return {
        movie,
        userData,
        position: cm.position,
      };
    });

    const validMovies = movieItems.filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort movies according to collection's sortMode
    validMovies.sort((a, b) => {
      switch (collection.sortMode) {
        case 'custom': {
          const idxA = collection.customOrder.indexOf(a.movie.id);
          const idxB = collection.customOrder.indexOf(b.movie.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          return a.position - b.position;
        }
        case 'releaseDate': {
          const dateA = a.movie.releaseDate || '0000';
          const dateB = b.movie.releaseDate || '0000';
          return dateA.localeCompare(dateB);
        }
        case 'title':
          return a.movie.title.localeCompare(b.movie.title);
        case 'rating': {
          const rA = a.userData?.personalRating ?? a.movie.voteAverage;
          const rB = b.userData?.personalRating ?? b.movie.voteAverage;
          return rB - rA;
        }
        case 'watchedStatus': {
          const order: Record<string, number> = { watched: 0, watching: 1, want_to_watch: 2 };
          const sA = order[a.userData?.status || 'want_to_watch'] ?? 3;
          const sB = order[b.userData?.status || 'want_to_watch'] ?? 3;
          return sA - sB;
        }
        default:
          return a.position - b.position;
      }
    });

    const progress = await this.calculateProgress(collectionId);
    return {
      collection,
      movies: validMovies,
      progress,
    };
  }

  static async saveMany(collections: Collection[], collectionMovies: CollectionMovie[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['collections', 'collectionMovies'], 'readwrite');
    const colStore = tx.objectStore('collections');
    const colMovieStore = tx.objectStore('collectionMovies');

    for (const c of collections) {
      await colStore.put(c);
    }
    for (const cm of collectionMovies) {
      await colMovieStore.put(cm);
    }
    await tx.done;
  }
}
