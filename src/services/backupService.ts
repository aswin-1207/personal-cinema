import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { getDB } from '../db/database';
import {
  PersonalCinemaBackup,
  BackupValidationResult,
  ConflictItem,
} from '../types/backup';
import { Movie } from '../types/movie';

export class BackupService {
  /**
   * Generate complete JSON backup with secrets sanitized
   */
  static async generateFullBackup(): Promise<PersonalCinemaBackup> {
    const movies = await MovieRepository.getAll();
    const userMovies = await UserMovieRepository.getAll();
    const collections = await CollectionRepository.getAll();
    const collectionMovies: any[] = [];
    for (const c of collections) {
      const items = await CollectionRepository.getCollectionMovies(c.id);
      collectionMovies.push(...items);
    }
    const prefs = await PreferencesRepository.getPreferences();

    // Absolute privacy protection: sanitize private tokens/keys
    const sanitizedPrefs = { ...prefs, tmdbApiKey: '' };

    const now = new Date().toISOString();
    const backup: PersonalCinemaBackup = {
      backupVersion: 1,
      appVersion: '1.0.0',
      createdAt: now,
      counts: {
        movies: movies.length,
        userMovies: userMovies.length,
        watched: userMovies.filter((um) => um.status === 'watched').length,
        favorites: userMovies.filter((um) => um.isFavorite).length,
        collections: collections.length,
        ratings: userMovies.filter((um) => typeof um.personalRating === 'number').length,
        reviews: userMovies.filter((um) => !!um.review || !!um.notes).length,
      },
      movies,
      userMovies,
      collections,
      collectionMovies,
      preferences: sanitizedPrefs,
    };

    // Update last backup timestamp in local preferences
    await PreferencesRepository.updatePreference('lastBackupDate', now);

    return backup;
  }

  /**
   * Trigger browser file download of backup JSON
   */
  static async downloadBackupFile(): Promise<string> {
    const backup = await this.generateFullBackup();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `PersonalCinema_Backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(backup, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  }

  /**
   * Validate uploaded backup JSON
   */
  static validateBackupJSON(jsonString: string): BackupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsed = JSON.parse(jsonString);

      if (!parsed || typeof parsed !== 'object') {
        return {
          isValid: false,
          backupVersion: 0,
          createdAt: '',
          counts: { movies: 0, watched: 0, collections: 0, ratings: 0 },
          errors: ['Backup file is not valid JSON.'],
          warnings: [],
        };
      }

      if (!parsed.backupVersion) {
        errors.push("Missing required field: 'backupVersion'.");
      } else if (parsed.backupVersion > 1) {
        errors.push(`Unsupported backup version (${parsed.backupVersion}). Max supported version is 1.`);
      }

      if (!Array.isArray(parsed.movies)) {
        errors.push("Missing or invalid 'movies' array.");
      } else {
        // Validate sample movie integrity
        for (let i = 0; i < Math.min(5, parsed.movies.length); i++) {
          const m = parsed.movies[i];
          if (!m || typeof m.id !== 'number' || !m.title) {
            errors.push(`Invalid movie record at index ${i}: missing valid id or title.`);
            break;
          }
        }
      }

      if (!Array.isArray(parsed.userMovies)) {
        errors.push("Missing or invalid 'userMovies' array.");
      }
      if (!Array.isArray(parsed.collections)) {
        errors.push("Missing or invalid 'collections' array.");
      }

      const counts = {
        movies: parsed.movies?.length || 0,
        watched: parsed.userMovies?.filter((um: any) => um.status === 'watched').length || 0,
        collections: parsed.collections?.length || 0,
        ratings: parsed.userMovies?.filter((um: any) => typeof um.personalRating === 'number').length || 0,
      };

      if (counts.movies === 0) {
        warnings.push('Backup file contains 0 movies.');
      }

      return {
        isValid: errors.length === 0,
        backupVersion: parsed.backupVersion || 1,
        createdAt: parsed.createdAt || 'Unknown Date',
        counts,
        errors,
        warnings,
        backupData: errors.length === 0 ? (parsed as PersonalCinemaBackup) : undefined,
      };
    } catch (e: any) {
      return {
        isValid: false,
        backupVersion: 0,
        createdAt: '',
        counts: { movies: 0, watched: 0, collections: 0, ratings: 0 },
        errors: [`JSON parse error: ${e.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Detect conflicts between current local data and incoming backup data
   */
  static async detectConflicts(backup: PersonalCinemaBackup): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = [];
    const localUserMovies = await UserMovieRepository.getAll();
    const localMap = new Map(localUserMovies.map((um) => [um.movieId, um]));

    const movieMap = new Map((backup.movies || []).map((m) => [m.id, m]));

    for (const backupItem of backup.userMovies || []) {
      const local = localMap.get(backupItem.movieId);
      if (!local) continue;

      const title = movieMap.get(backupItem.movieId)?.title || `Movie #${backupItem.movieId}`;

      // Check rating conflict
      if (
        typeof local.personalRating === 'number' &&
        typeof backupItem.personalRating === 'number' &&
        local.personalRating !== backupItem.personalRating
      ) {
        conflicts.push({
          movieId: backupItem.movieId,
          movieTitle: title,
          field: 'rating',
          currentValue: local.personalRating,
          backupValue: backupItem.personalRating,
        });
      }

      // Check status conflict (e.g. watched vs want_to_watch)
      if (local.status !== backupItem.status) {
        conflicts.push({
          movieId: backupItem.movieId,
          movieTitle: title,
          field: 'status',
          currentValue: local.status,
          backupValue: backupItem.status,
        });
      }
    }

    return conflicts;
  }

  /**
   * ATOMIC Smart Merge Restore
   * Merges incoming backup data into the local database inside a single multi-store IndexedDB transaction.
   */
  static async restoreWithMerge(
    backup: PersonalCinemaBackup,
    conflictResolutions?: Map<string, 'current' | 'backup'>
  ): Promise<{ mergedMovies: number; mergedCollections: number }> {
    const db = await getDB();
    const tx = db.transaction(
      ['movies', 'userMovies', 'collections', 'collectionMovies'],
      'readwrite'
    );
    const movieStore = tx.objectStore('movies');
    const userMovieStore = tx.objectStore('userMovies');
    const colStore = tx.objectStore('collections');
    const colMovieStore = tx.objectStore('collectionMovies');

    try {
      // 1. Merge Movies: non-destructive merge
      for (const m of backup.movies || []) {
        const existing = await movieStore.get(m.id);
        if (existing) {
          const merged: Movie = {
            ...existing,
            ...m,
            runtime: m.runtime || existing.runtime || null,
            overview: m.overview || existing.overview || '',
            credits: m.credits || existing.credits,
            franchiseTags:
              m.franchiseTags && m.franchiseTags.length > 0 ? m.franchiseTags : existing.franchiseTags,
            source: existing.source || m.source || 'tmdb',
            seedCategory: existing.seedCategory || m.seedCategory,
            lastFetched: m.lastFetched || new Date().toISOString(),
          };
          await movieStore.put(merged);
        } else {
          await movieStore.put(m);
        }
      }

      // 2. Merge UserMovies with conflict resolution
      const localUserMovies = await userMovieStore.getAll();
      const localMap = new Map(localUserMovies.map((um) => [um.movieId, um]));

      for (const incoming of backup.userMovies || []) {
        const local = localMap.get(incoming.movieId);
        if (!local) {
          await userMovieStore.put(incoming);
        } else {
          const ratingRes = conflictResolutions?.get(`${incoming.movieId}_rating`);
          const statusRes = conflictResolutions?.get(`${incoming.movieId}_status`);

          local.status = statusRes === 'current' ? local.status : incoming.status;
          local.personalRating =
            ratingRes === 'current' ? local.personalRating : incoming.personalRating;
          local.isFavorite = local.isFavorite || incoming.isFavorite;
          local.notes = local.notes || incoming.notes;
          local.review = local.review || incoming.review;
          local.watchedAt = local.watchedAt || incoming.watchedAt;

          await userMovieStore.put(local);
        }
      }

      // 3. Merge Collections & CollectionMovies
      const existingCols = await colStore.getAll();
      const existingColIds = new Set(existingCols.map((c) => c.id));
      let mergedCollectionsCount = 0;

      for (const c of backup.collections || []) {
        if (!existingColIds.has(c.id)) {
          await colStore.put(c);
          mergedCollectionsCount++;
        }
      }

      const existingColMovieItems = await colMovieStore.getAll();
      const existingColMovieIds = new Set(existingColMovieItems.map((cm) => cm.id));

      for (const cm of backup.collectionMovies || []) {
        if (!existingColMovieIds.has(cm.id)) {
          await colMovieStore.put(cm);
        }
      }

      await tx.done;

      return {
        mergedMovies: backup.movies?.length || 0,
        mergedCollections: mergedCollectionsCount,
      };
    } catch (err) {
      console.error('restoreWithMerge transaction failed, rolled back:', err);
      throw err;
    }
  }

  /**
   * ATOMIC Replace Mode: CLEAR + REBUILD inside a single multi-store transaction.
   * Guarantees zero partially restored state; rolls back completely on any failure.
   */
  static async restoreWithReplace(backup: PersonalCinemaBackup): Promise<void> {
    const db = await getDB();
    const candidateStores = ['movies', 'userMovies', 'collections', 'collectionMovies'];
    const tx = db.transaction(candidateStores as any, 'readwrite');

    const movieStore = tx.objectStore('movies');
    const userMovieStore = tx.objectStore('userMovies');
    const colStore = tx.objectStore('collections');
    const colMovieStore = tx.objectStore('collectionMovies');

    try {
      // 1. CLEAR all stores inside transaction
      await movieStore.clear();
      await userMovieStore.clear();
      await colStore.clear();
      await colMovieStore.clear();

      // 2. REBUILD exact state from backup inside same transaction
      for (const m of backup.movies || []) {
        await movieStore.put(m);
      }
      for (const um of backup.userMovies || []) {
        await userMovieStore.put(um);
      }
      for (const c of backup.collections || []) {
        await colStore.put(c);
      }
      for (const cm of backup.collectionMovies || []) {
        await colMovieStore.put(cm);
      }

      await tx.done;
    } catch (err) {
      console.error('restoreWithReplace transaction failed, rolled back completely:', err);
      throw err;
    }
  }

  /**
   * Health Summary of current local cinema
   */
  static async getHealthSummary(): Promise<{
    moviesCount: number;
    watchedCount: number;
    collectionsCount: number;
    ratingsCount: number;
    lastBackupDate: string | null;
    daysSinceLastBackup: number | null;
    isBackupOverdue: boolean;
  }> {
    const prefs = await PreferencesRepository.getPreferences();
    const moviesCount = await MovieRepository.count();
    const userCounts = await UserMovieRepository.count();
    const collections = await CollectionRepository.getAll();

    let daysSince: number | null = null;
    let isOverdue = false;

    if (prefs.lastBackupDate) {
      const diffMs = Date.now() - new Date(prefs.lastBackupDate).getTime();
      daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSince >= (prefs.backupReminderDays || 30)) {
        isOverdue = true;
      }
    } else if (moviesCount > 0) {
      isOverdue = true;
    }

    return {
      moviesCount,
      watchedCount: userCounts.watched,
      collectionsCount: collections.length,
      ratingsCount: (await UserMovieRepository.getAll()).filter((u) => typeof u.personalRating === 'number').length,
      lastBackupDate: prefs.lastBackupDate || null,
      daysSinceLastBackup: daysSince,
      isBackupOverdue: isOverdue,
    };
  }
}
