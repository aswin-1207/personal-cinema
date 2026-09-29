import { getDB } from '../database';
import { MovieNight } from '../../types/movie';
import { MovieRepository } from './movieRepository';

export class MovieNightRepository {
  static async getById(id: string): Promise<MovieNight | undefined> {
    const db = await getDB();
    return db.get('movieNights', id);
  }

  static async getAll(): Promise<MovieNight[]> {
    const db = await getDB();
    return db.getAll('movieNights');
  }

  static async getUpcoming(): Promise<Array<MovieNight & { movie?: import('../../types/movie').Movie }>> {
    const db = await getDB();
    const all = await db.getAll('movieNights');
    const today = new Date().toISOString().split('T')[0];

    const upcoming = all
      .filter((n) => n.status === 'scheduled' && n.date >= today)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const result = [];
    for (const night of upcoming) {
      const movie = await MovieRepository.getById(night.movieId);
      result.push({ ...night, movie });
    }
    return result;
  }

  static async getTonight(): Promise<(MovieNight & { movie?: import('../../types/movie').Movie }) | null> {
    const upcoming = await this.getUpcoming();
    const today = new Date().toISOString().split('T')[0];
    const tonight = upcoming.find((n) => n.date === today);
    return tonight || null;
  }

  static async schedule(data: {
    movieId: number;
    date: string;
    time: string;
    reminderMinutes?: number;
    notes?: string;
  }): Promise<MovieNight> {
    const db = await getDB();
    const night: MovieNight = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'night_' + Date.now(),
      movieId: data.movieId,
      date: data.date,
      time: data.time,
      reminderMinutes: data.reminderMinutes ?? 30,
      notes: data.notes || '',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    await db.put('movieNights', night);
    return night;
  }

  static async update(night: MovieNight): Promise<void> {
    const db = await getDB();
    await db.put('movieNights', night);
  }

  static async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('movieNights', id);
  }

  static async saveMany(nights: MovieNight[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('movieNights', 'readwrite');
    for (const n of nights) {
      await tx.objectStore('movieNights').put(n);
    }
    await tx.done;
  }
}
