import { getDB } from '../database';
import { UserMovie, MovieStatus, MovieWithUserData } from '../../types/movie';
import { MovieRepository } from './movieRepository';

export class UserMovieRepository {
  static async getByMovieId(movieId: number): Promise<UserMovie | undefined> {
    const db = await getDB();
    return db.get('userMovies', movieId);
  }

  static async getAll(): Promise<UserMovie[]> {
    const db = await getDB();
    return db.getAll('userMovies');
  }

  static async getByStatus(status: MovieStatus): Promise<UserMovie[]> {
    const db = await getDB();
    return db.getAllFromIndex('userMovies', 'by-status', status);
  }

  static async getFavorites(): Promise<UserMovie[]> {
    const db = await getDB();
    const all = await db.getAll('userMovies');
    return all.filter((item) => item.isFavorite);
  }

  static async save(userMovie: UserMovie): Promise<void> {
    const db = await getDB();
    await db.put('userMovies', userMovie);
  }

  static async saveMany(userMovies: UserMovie[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    for (const um of userMovies) {
      await store.put(um);
    }
    await tx.done;
  }

  /**
   * Centralized, Idempotent, Atomic "✓ MARK AS WATCHED"
   */
  static async markWatched(
    movieId: number,
    options?: { rating?: number | null; notes?: string; review?: string; isFavorite?: boolean }
  ): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: 'watched',
      personalRating: options?.rating !== undefined ? options.rating : existing?.personalRating ?? null,
      notes: options?.notes !== undefined ? options.notes : existing?.notes,
      review: options?.review !== undefined ? options.review : existing?.review,
      isFavorite: options?.isFavorite !== undefined ? options.isFavorite : existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt || now, // preserve original watchedAt if already recorded
      watchingAt: null,
      scheduledAt: null,
      rewatchCount: existing ? (existing.status === 'watched' ? existing.rewatchCount + 1 : existing.rewatchCount) : 0,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Undo / Unmark Watched
   */
  static async unmarkWatched(movieId: number): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: 'want_to_watch',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: null,
      watchingAt: null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Add to Watchlist (want_to_watch)
   */
  static async addToWatchlist(movieId: number): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: 'want_to_watch',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt ?? null,
      watchingAt: null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Set Status to Watching
   */
  static async setWatching(movieId: number): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: 'watching',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt ?? null,
      watchingAt: now,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Remove from Watchlist without affecting canonical Movie or Collections
   */
  static async removeFromWatchlist(movieId: number): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    if (existing && (existing.status === 'want_to_watch' || existing.status === 'watching')) {
      await store.delete(movieId);
    }
    await tx.done;
  }

  /**
   * Toggle Favorite
   */
  static async toggleFavorite(movieId: number): Promise<UserMovie> {
    const existing = await this.getByMovieId(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: existing?.status || 'want_to_watch',
      personalRating: existing?.personalRating ?? null,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing ? !existing.isFavorite : true,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt ?? null,
      watchingAt: existing?.watchingAt ?? null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await this.save(updated);
    return updated;
  }

  /**
   * Update Rating
   */
  static async setRating(movieId: number, rating: number | null): Promise<UserMovie> {
    const existing = await this.getByMovieId(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: existing?.status || 'watched', // rating implies watched only if not already tracked
      personalRating: rating,
      notes: existing?.notes,
      review: existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt || (existing?.status === 'watched' || !existing ? now : null),
      watchingAt: existing?.watchingAt ?? null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await this.save(updated);
    return updated;
  }

  /**
   * Update Review & Notes
   */
  static async setReviewAndNotes(
    movieId: number,
    data: { review?: string; notes?: string }
  ): Promise<UserMovie> {
    const existing = await this.getByMovieId(movieId);
    const now = new Date().toISOString();

    const updated: UserMovie = {
      movieId,
      status: existing?.status || 'want_to_watch',
      personalRating: existing?.personalRating ?? null,
      notes: data.notes !== undefined ? data.notes : existing?.notes,
      review: data.review !== undefined ? data.review : existing?.review,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt ?? null,
      watchingAt: existing?.watchingAt ?? null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: existing?.rewatchCount ?? 0,
    };

    await this.save(updated);
    return updated;
  }

  static async remove(movieId: number): Promise<void> {
    const db = await getDB();
    await db.delete('userMovies', movieId);
  }

  /**
   * Get all user movies joined with canonical Movie data
   */
  static async getAllWithMovies(): Promise<MovieWithUserData[]> {
    const userMovies = await this.getAll();
    const movieIds = userMovies.map((um) => um.movieId);
    const movies = await MovieRepository.getByIds(movieIds);
    const movieMap = new Map(movies.map((m) => [m.id, m]));

    return userMovies
      .filter((um) => movieMap.has(um.movieId))
      .map((um) => ({
        movie: movieMap.get(um.movieId)!,
        userData: um,
      }));
  }

  static async count(): Promise<{ total: number; watched: number; watching: number; wantToWatch: number; favorites: number }> {
    const all = await this.getAll();
    return {
      total: all.length,
      watched: all.filter((m) => m.status === 'watched').length,
      watching: all.filter((m) => m.status === 'watching').length,
      wantToWatch: all.filter((m) => m.status === 'want_to_watch').length,
      favorites: all.filter((m) => m.isFavorite).length,
    };
  }
}
