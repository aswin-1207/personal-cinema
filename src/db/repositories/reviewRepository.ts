import { getDB } from '../database';
import { UserMovie, MovieWithUserData } from '../../types/movie';
import { MovieRepository } from './movieRepository';
import { UserMovieRepository } from './userMovieRepository';

export interface SaveReviewInput {
  rating?: number | null;
  reviewTitle?: string;
  reviewText?: string;
  hasSpoilers?: boolean;
}

export interface ReviewSearchResult {
  item: MovieWithUserData;
  matchType: 'title' | 'text' | 'both';
  textExcerpt?: string;
}

export class ReviewRepository {
  /**
   * Get review/userMovie record for a specific movie
   */
  static async getReview(movieId: number): Promise<UserMovie | undefined> {
    return UserMovieRepository.getByMovieId(movieId);
  }

  /**
   * Save or update a review.
   * Rating and reviewText are independent:
   * - Can have rating with no review
   * - Can have review with no rating
   * - Can have both
   * Transitions status to 'watched' if not already tracked/watched.
   * Zero rewatch architecture.
   */
  static async saveReview(movieId: number, data: SaveReviewInput): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);
    const now = new Date().toISOString();

    const cleanReviewText = data.reviewText !== undefined ? data.reviewText.trim() : existing?.review;
    const cleanReviewTitle = data.reviewTitle !== undefined ? data.reviewTitle.trim() : existing?.reviewTitle;
    const hasReviewContent = Boolean(cleanReviewText && cleanReviewText.length > 0);

    const updated: UserMovie = {
      movieId,
      status: existing?.status || 'none', // Reviewing or rating does NOT force watched
      personalRating: data.rating !== undefined ? data.rating : existing?.personalRating ?? null,
      notes: existing?.notes,
      review: hasReviewContent ? cleanReviewText : undefined,
      reviewTitle: hasReviewContent && cleanReviewTitle ? cleanReviewTitle : undefined,
      reviewedAt: hasReviewContent ? (existing?.reviewedAt || now) : (existing?.reviewedAt ?? null),
      hasSpoilers: data.hasSpoilers !== undefined ? data.hasSpoilers : existing?.hasSpoilers ?? false,
      isFavorite: existing?.isFavorite ?? false,
      addedAt: existing?.addedAt || now,
      watchedAt: existing?.watchedAt ?? null, // preserve original watched date if already watched
      watchingAt: null,
      scheduledAt: existing?.scheduledAt ?? null,
      rewatchCount: 0, // Explicitly NO rewatch architecture
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Delete a review text while strictly PRESERVING:
   * - watched status
   * - watchedAt date
   * - personalRating (rating remains independent)
   * - isFavorite
   * - notes
   */
  static async deleteReview(movieId: number): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);

    if (!existing) {
      await tx.done;
      throw new Error(`Movie #${movieId} not found in library.`);
    }

    const updated: UserMovie = {
      ...existing,
      review: undefined,
      reviewTitle: undefined,
      reviewedAt: null,
      hasSpoilers: false,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Delete only the personal rating while strictly PRESERVING:
   * - review text
   * - review title
   * - reviewedAt
   * - watched status & watchedAt
   */
  static async deleteRating(movieId: number): Promise<UserMovie> {
    const db = await getDB();
    const tx = db.transaction('userMovies', 'readwrite');
    const store = tx.objectStore('userMovies');
    const existing = await store.get(movieId);

    if (!existing) {
      await tx.done;
      throw new Error(`Movie #${movieId} not found in library.`);
    }

    const updated: UserMovie = {
      ...existing,
      personalRating: null,
    };

    await store.put(updated);
    await tx.done;
    return updated;
  }

  /**
   * Retrieve all journal entries (movies with a written review OR rating)
   * joined with canonical Movie metadata using a single batched IDB transaction.
   */
  static async getAllJournalEntries(): Promise<MovieWithUserData[]> {
    const db = await getDB();
    const allUserMovies = await db.getAll('userMovies');
    
    // Filter to movies that have either a written review or a personal rating
    const journalUserMovies = allUserMovies.filter((um) => {
      const hasReview = Boolean(um.review && um.review.trim().length > 0);
      const hasRating = um.personalRating !== null && um.personalRating !== undefined;
      return hasReview || hasRating;
    });

    if (journalUserMovies.length === 0) return [];

    const movieIds = journalUserMovies.map((um) => um.movieId);
    const movies = await MovieRepository.getByIds(movieIds);
    const movieMap = new Map(movies.map((m) => [m.id, m]));

    return journalUserMovies
      .filter((um) => movieMap.has(um.movieId))
      .map((um) => ({
        movie: movieMap.get(um.movieId)!,
        userData: um,
      }));
  }

  /**
   * Search journal entries by Movie title or written review text
   */
  static search(items: MovieWithUserData[], query: string): ReviewSearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.map((item) => ({ item, matchType: 'title' }));
    }

    const results: ReviewSearchResult[] = [];

    for (const item of items) {
      const titleMatch =
        item.movie.title.toLowerCase().includes(q) ||
        Boolean(item.movie.originalTitle && item.movie.originalTitle.toLowerCase().includes(q));

      const reviewText = item.userData?.review || '';
      const reviewTitle = item.userData?.reviewTitle || '';
      const textMatch =
        reviewText.toLowerCase().includes(q) ||
        reviewTitle.toLowerCase().includes(q);

      if (titleMatch && textMatch) {
        results.push({ item, matchType: 'both' });
      } else if (titleMatch) {
        results.push({ item, matchType: 'title' });
      } else if (textMatch) {
        // Extract excerpt around matched query
        let excerpt = '';
        const idx = reviewText.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(reviewText.length, idx + q.length + 40);
          excerpt = (start > 0 ? '...' : '') + reviewText.slice(start, end) + (end < reviewText.length ? '...' : '');
        }
        results.push({ item, matchType: 'text', textExcerpt: excerpt });
      }
    }

    return results;
  }
}
