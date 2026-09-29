import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { Achievement } from '../types/backup';

export interface CinemaOverviewStats {
  totalWatched: number;
  totalWatchlist: number;
  totalWatching: number;
  totalFavorites: number;
  totalCollections: number;
  completedCollections: number;
  // Runtime-based hours (derived strictly from movie.runtime, NOT any timer)
  totalRuntimeHours: number;
  totalRuntimeMinutes: number;
  averageRating: number | null;
  topGenres: Array<{ name: string; count: number }>;
  watchedThisMonth: number;
  watchedThisYear: number;
}

export class StatsService {
  /**
   * Calculate real personal cinema statistics
   */
  static async getOverview(): Promise<CinemaOverviewStats> {
    const all = await UserMovieRepository.getAllWithMovies();
    const collections = await CollectionRepository.getAll();

    const watchedItems = all.filter((item) => item.userData?.status === 'watched');
    const watchlistItems = all.filter((item) => item.userData?.status === 'want_to_watch');
    const watchingItems = all.filter((item) => item.userData?.status === 'watching');
    const favoriteItems = all.filter((item) => item.userData?.isFavorite);

    // Sum actual movie runtimes (ignoring 0/null, strictly from movie metadata)
    let totalMinutes = 0;
    for (const item of watchedItems) {
      if (item.movie.runtime && item.movie.runtime > 0) {
        totalMinutes += item.movie.runtime;
      }
    }
    const totalRuntimeHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Average rating
    const ratedItems = watchedItems.filter(
      (item) => typeof item.userData?.personalRating === 'number' && item.userData.personalRating > 0
    );
    const avgRating =
      ratedItems.length > 0
        ? Math.round(
            (ratedItems.reduce((acc, cur) => acc + (cur.userData!.personalRating || 0), 0) / ratedItems.length) * 10
          ) / 10
        : null;

    // Genre distribution
    const genreCountMap = new Map<string, number>();
    for (const item of watchedItems) {
      for (const g of item.movie.genres || []) {
        if (g.name) {
          genreCountMap.set(g.name, (genreCountMap.get(g.name) || 0) + 1);
        }
      }
    }
    const topGenres = Array.from(genreCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Dates for this month & year
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYearPrefix = `${now.getFullYear()}`;

    const watchedThisMonth = watchedItems.filter((i) => (i.userData?.watchedAt || '').startsWith(currentMonthPrefix)).length;
    const watchedThisYear = watchedItems.filter((i) => (i.userData?.watchedAt || '').startsWith(currentYearPrefix)).length;

    // Completed collections
    let completedCollections = 0;
    for (const c of collections) {
      const progress = await CollectionRepository.calculateProgress(c.id);
      if (progress.isComplete) {
        completedCollections++;
      }
    }

    return {
      totalWatched: watchedItems.length,
      totalWatchlist: watchlistItems.length,
      totalWatching: watchingItems.length,
      totalFavorites: favoriteItems.length,
      totalCollections: collections.length,
      completedCollections,
      totalRuntimeHours,
      totalRuntimeMinutes: totalMinutes,
      averageRating: avgRating,
      topGenres,
      watchedThisMonth,
      watchedThisYear,
    };
  }

  /**
   * Derive real achievements from actual user library milestones
   */
  static async getAchievements(): Promise<Achievement[]> {
    const stats = await this.getOverview();
    const all = await UserMovieRepository.getAll();
    const reviewsCount = all.filter((um) => !!um.review && um.review.trim().length > 0).length;

    const definitions: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      max: number;
      current: number;
    }> = [
      {
        id: 'first_screening',
        title: 'First Screening',
        description: 'Mark your very first film as watched in Personal Cinema.',
        icon: 'film',
        max: 1,
        current: stats.totalWatched,
      },
      {
        id: 'cinephile_10',
        title: 'Silver Screen',
        description: 'Watch 10 films in your personal catalog.',
        icon: 'sparkles',
        max: 10,
        current: stats.totalWatched,
      },
      {
        id: 'cinephile_50',
        title: 'Golden Archive',
        description: 'Complete 50 film screenings.',
        icon: 'award',
        max: 50,
        current: stats.totalWatched,
      },
      {
        id: 'century_100',
        title: 'Century Club',
        description: 'Reach 100 films logged in your cinema.',
        icon: 'trophy',
        max: 100,
        current: stats.totalWatched,
      },
      {
        id: 'genre_explorer',
        title: 'Genre Explorer',
        description: 'Watch films across at least 5 different genres.',
        icon: 'compass',
        max: 5,
        current: stats.topGenres.length,
      },
      {
        id: 'collection_finisher',
        title: 'Franchise Master',
        description: '100% complete an entire custom collection.',
        icon: 'check-circle',
        max: 1,
        current: stats.completedCollections,
      },
      {
        id: 'film_critic',
        title: 'Film Critic',
        description: 'Write personal reflections or reviews for 5 films.',
        icon: 'feather',
        max: 5,
        current: reviewsCount,
      },
    ];

    return definitions.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      progress: Math.min(def.current, def.max),
      maxProgress: def.max,
      unlockedAt: def.current >= def.max ? 'Unlocked' : null,
    }));
  }

  static async evaluateAchievements(): Promise<Achievement[]> {
    return this.getAchievements();
  }
}
