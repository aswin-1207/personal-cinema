// src/services/seedCatalogService.ts
// Handles controlled initialization and non-blocking population of the curated seed catalog

import { Movie } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { SEED_MOVIES, SEED_CATALOG_VERSION } from '../data/seedCatalog';

export class SeedCatalogService {
  public static readonly VERSION = SEED_CATALOG_VERSION;

  /**
   * Check if the seed catalog of the current version has already been installed
   */
  public static async isInstalled(): Promise<boolean> {
    try {
      const installedVersion = await PreferencesRepository.getPreference<number>(
        'seed_catalog_installed_version'
      );
      return typeof installedVersion === 'number' && installedVersion >= this.VERSION;
    } catch {
      return false;
    }
  }

  /**
   * Controlled, idempotent initialization of the curated seed catalog.
   * NEVER alters userMovies, watchlist, watched, favorites, or collections.
   */
  public static async initializeSeedCatalog(): Promise<boolean> {
    const alreadyInstalled = await this.isInstalled();
    if (alreadyInstalled) {
      return false;
    }

    try {
      // 1. Get existing movies in local database
      const existingMovies = await MovieRepository.getAll();
      const existingMap = new Map<number, Movie>(existingMovies.map((m) => [m.id, m]));

      // 2. Prepare movies to insert or enrich
      const toSave: Movie[] = [];

      for (const seedMovie of SEED_MOVIES) {
        if (!existingMap.has(seedMovie.id)) {
          // Brand new movie: insert with seed source
          toSave.push({
            ...seedMovie,
            source: 'seed',
          });
        } else {
          // Existing movie: enrich tags and category if missing, preserve everything else
          const existing = existingMap.get(seedMovie.id)!;
          let changed = false;

          if (!existing.franchiseTags && seedMovie.franchiseTags) {
            existing.franchiseTags = seedMovie.franchiseTags;
            changed = true;
          }
          if (!existing.seedCategory && seedMovie.seedCategory) {
            existing.seedCategory = seedMovie.seedCategory;
            changed = true;
          }
          if (changed) {
            toSave.push(existing);
          }
        }
      }

      // 3. Batch save into MovieRepository
      if (toSave.length > 0) {
        await MovieRepository.saveMany(toSave);
      }

      // 4. Record successful installation version
      await PreferencesRepository.setPreference('seed_catalog_installed_version', this.VERSION);

      console.info(
        `[SeedCatalogService] Initialized seed catalog v${this.VERSION} (${toSave.length} records added/updated, total catalog: ${existingMovies.length + toSave.length})`
      );

      return true;
    } catch (err) {
      console.error('[SeedCatalogService] Error initializing seed catalog:', err);
      return false;
    }
  }

  /**
   * Get seed catalog metrics and breakdown
   */
  public static getMetrics(): {
    version: number;
    totalSeedMovies: number;
    categories: Record<string, number>;
  } {
    const categories: Record<string, number> = {};
    for (const movie of SEED_MOVIES) {
      const cat = movie.seedCategory || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return {
      version: this.VERSION,
      totalSeedMovies: SEED_MOVIES.length,
      categories,
    };
  }

  /**
   * Retrieve seed movies by category (e.g. 'marvel', 'dc', 'sony_spiderman')
   */
  public static async getByCategory(category: string): Promise<Movie[]> {
    const all = await MovieRepository.getAll();
    return all.filter((m) => m.seedCategory === category);
  }

  /**
   * Retrieve seed movies matching a franchise tag (e.g. 'Avengers', 'Batman', 'X-Men')
   */
  public static async getByFranchise(tag: string): Promise<Movie[]> {
    const norm = tag.toLowerCase();
    const all = await MovieRepository.getAll();
    return all.filter((m) =>
      m.franchiseTags?.some((t) => t.toLowerCase().includes(norm))
    );
  }
}
