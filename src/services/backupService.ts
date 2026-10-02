import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { clearAllLocalData } from '../db/database';
import {
  PersonalCinemaBackup,
  BackupValidationResult,
  ConflictItem,
} from '../types/backup';

export class BackupService {
  /**
   * Generate complete JSON backup
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

    // Sanitize preferences (do NOT include raw private API keys or tokens in public backup)
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
        reviews: userMovies.filter((um) => !!um.review).length,
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
        errors.push(`Unsupported backup version (${parsed.backupVersion}). Max supported is 1.`);
      }

      if (!Array.isArray(parsed.movies)) errors.push("Missing or invalid 'movies' array.");
      if (!Array.isArray(parsed.userMovies)) errors.push("Missing or invalid 'userMovies' array.");
      if (!Array.isArray(parsed.collections)) errors.push("Missing or invalid 'collections' array.");

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
        errors: [`JSON Parse error: ${e.message}`],
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

    const movieMap = new Map(backup.movies.map((m) => [m.id, m]));

    for (const backupItem of backup.userMovies) {
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
   * Smart Merge Restore
   */
  static async restoreWithMerge(
    backup: PersonalCinemaBackup,
    conflictResolutions?: Map<string, 'current' | 'backup'>
  ): Promise<{ mergedMovies: number; mergedCollections: number }> {
    // 1. Merge Movies metadata
    await MovieRepository.saveMany(backup.movies || []);

    // 2. Merge UserMovies
    const localUserMovies = await UserMovieRepository.getAll();
    const localMap = new Map(localUserMovies.map((um) => [um.movieId, um]));

    const mergedUserMovies = [...localUserMovies];

    for (const incoming of backup.userMovies || []) {
      const local = localMap.get(incoming.movieId);
      if (!local) {
        mergedUserMovies.push(incoming);
      } else {
        // Resolve conflicts if any
        const ratingRes = conflictResolutions?.get(`${incoming.movieId}_rating`);
        const statusRes = conflictResolutions?.get(`${incoming.movieId}_status`);

        local.status = statusRes === 'current' ? local.status : incoming.status;
        local.personalRating = ratingRes === 'current' ? local.personalRating : incoming.personalRating;
        local.isFavorite = local.isFavorite || incoming.isFavorite;
        local.notes = local.notes || incoming.notes;
        local.review = local.review || incoming.review;
        local.watchedAt = local.watchedAt || incoming.watchedAt;
      }
    }
    await UserMovieRepository.saveMany(mergedUserMovies);

    // 3. Merge Collections & CollectionMovies
    const existingCols = await CollectionRepository.getAll();
    const existingColIds = new Set(existingCols.map((c) => c.id));
    const colsToSave = (backup.collections || []).filter((c) => !existingColIds.has(c.id));

    await CollectionRepository.saveMany(colsToSave, backup.collectionMovies || []);

    return {
      mergedMovies: backup.movies?.length || 0,
      mergedCollections: colsToSave.length,
    };
  }

  /**
   * Replace Mode: completely wipe and restore from backup
   */
  static async restoreWithReplace(backup: PersonalCinemaBackup): Promise<void> {
    await clearAllLocalData();

    await MovieRepository.saveMany(backup.movies || []);
    await UserMovieRepository.saveMany(backup.userMovies || []);
    await CollectionRepository.saveMany(backup.collections || [], backup.collectionMovies || []);
    if (backup.achievements) {
      await PreferencesRepository.saveAchievements(backup.achievements);
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
