import { getDB } from '../database';
import { Movie } from '../../types/movie';

export class MovieRepository {
  static async getById(id: number): Promise<Movie | undefined> {
    const db = await getDB();
    return db.get('movies', id);
  }

  static async getByIds(ids: number[]): Promise<Movie[]> {
    const db = await getDB();
    const tx = db.transaction('movies', 'readonly');
    const store = tx.objectStore('movies');
    const movies: Movie[] = [];
    for (const id of ids) {
      const m = await store.get(id);
      if (m) movies.push(m);
    }
    await tx.done;
    return movies;
  }

  static async save(movie: Movie): Promise<void> {
    const db = await getDB();
    await db.put('movies', movie);
  }

  static async saveMany(movies: Movie[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('movies', 'readwrite');
    const store = tx.objectStore('movies');
    for (const m of movies) {
      await store.put(m);
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
