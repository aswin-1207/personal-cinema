import { getDB } from '../database';
import { Movie } from '../../types/movie';

export class MovieRepository {
  static async getById(id: number): Promise<Movie | undefined> {
    const db = await getDB();
    return db.get('movies', id);
  }

  static async getByIds(ids: number[]): Promise<Movie[]> {
    if (!ids.length) return [];
    const db = await getDB();
    const tx = db.transaction('movies', 'readonly');
    const store = tx.objectStore('movies');
    const results = await Promise.all(ids.map((id) => store.get(id)));
    await tx.done;
    return results.filter((m): m is Movie => !!m);
  }

  static async save(movie: Movie): Promise<Movie> {
    const db = await getDB();
    const existing = await db.get('movies', movie.id);
    if (existing) {
      // Merge intelligently: preserve richer fields if incoming is a shallow search result
      const merged: Movie = {
        ...existing,
        ...movie,
        runtime: movie.runtime || existing.runtime || null,
        overview: movie.overview || existing.overview || '',
        credits: movie.credits || existing.credits,
        franchiseTags:
          movie.franchiseTags && movie.franchiseTags.length > 0 ? movie.franchiseTags : existing.franchiseTags,
        source: existing.source || movie.source || 'tmdb',
        seedCategory: existing.seedCategory || movie.seedCategory,
        lastFetched: movie.lastFetched || new Date().toISOString(),
      };
      await db.put('movies', merged);
      return merged;
    } else {
      await db.put('movies', movie);
      return movie;
    }
  }

  static async saveMany(movies: Movie[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('movies', 'readwrite');
    const store = tx.objectStore('movies');
    for (const m of movies) {
      const existing = await store.get(m.id);
      if (existing) {
        const merged: Movie = {
          ...existing,
          ...m,
          runtime: m.runtime || existing.runtime || null,
          overview: m.overview || existing.overview || '',
          credits: m.credits || existing.credits,
          franchiseTags: m.franchiseTags && m.franchiseTags.length > 0 ? m.franchiseTags : existing.franchiseTags,
          source: existing.source || m.source || 'tmdb',
          seedCategory: existing.seedCategory || m.seedCategory,
          lastFetched: m.lastFetched || new Date().toISOString(),
        };
        await store.put(merged);
      } else {
        await store.put(m);
      }
    }
    await tx.done;
  }

  static async getAll(): Promise<Movie[]> {
    const db = await getDB();
    return db.getAll('movies');
  }

  static async count(): Promise<number> {
    const db = await getDB();
    return db.count('movies');
  }

  static async delete(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('movies', id);
  }
}
