// src/services/unifiedSearchService.ts
// Two-layer unified movie search: Curated Local Catalog (Layer 1) + On-Demand TMDB (Layer 2)

import { Movie } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { tmdbService } from './tmdbService';

export interface UnifiedSearchResult {
  localResults: Movie[];
  tmdbResults: Movie[];
  merged: Movie[];
  isOffline: boolean;
  tmdbError: string | null;
}

export interface SearchOptions {
  signal?: AbortSignal;
  excludeMovieIds?: Set<number>;
  onLocalResults?: (local: Movie[]) => void;
  maxResults?: number;
}

export class UnifiedSearchService {
  /**
   * Normalize search string for resilient matching
   */
  private static normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Search local database (seeded catalog + any previously discovered or added movies)
   */
  public static async searchLocal(
    query: string,
    options?: { excludeMovieIds?: Set<number>; maxResults?: number }
  ): Promise<Movie[]> {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    const normQuery = this.normalize(rawQuery);
    if (!normQuery) return [];

    const queryWords = normQuery.split(' ').filter(Boolean);
    const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'and', 'to', 'for', 'is', 'on', 'at', 'part', 'movie']);
    const meaningfulWords = queryWords.filter((w) => !stopWords.has(w));
    const allMovies = await MovieRepository.getAll();

    const scored: Array<{ movie: Movie; score: number }> = [];

    for (const movie of allMovies) {
      if (options?.excludeMovieIds?.has(movie.id)) {
        continue;
      }

      const normTitle = this.normalize(movie.title || '');
      const normOrig = this.normalize(movie.originalTitle || '');
      const normTags = (movie.franchiseTags || []).map((t) => this.normalize(t));

      let score = 0;

      // 1. Exact title match
      if (normTitle === normQuery) {
        score += 100;
      }
      // 2. Starts with query
      else if (normTitle.startsWith(normQuery)) {
        score += 70;
      }
      // 3. Contains full query phrase
      else if (normTitle.includes(normQuery)) {
        score += 50;
      }
      // 4. All meaningful words present in title
      else if (meaningfulWords.length > 0 && meaningfulWords.every((w) => normTitle.includes(w))) {
        score += 35;
      }
      // 5. Some meaningful words in title (requires at least one meaningful word to match!)
      else if (meaningfulWords.length > 0) {
        const matches = meaningfulWords.filter((w) => normTitle.includes(w)).length;
        if (matches > 0 && matches / meaningfulWords.length >= 0.5) {
          score += matches * 10;
        }
      }

      // Check franchise tags (only meaningful words or exact match)
      for (const tag of normTags) {
        if (tag === normQuery) {
          score += 40;
        } else if (tag.includes(normQuery)) {
          score += 25;
        } else if (meaningfulWords.length > 0 && meaningfulWords.some((w) => tag.includes(w))) {
          score += 15;
        }
      }

      // Original title fallback
      if (normOrig && normOrig !== normTitle && normOrig.includes(normQuery)) {
        score += 20;
      }

      // Boost vote average slightly for tie-breaking
      if (score > 0 && typeof movie.voteAverage === 'number') {
        score += movie.voteAverage * 0.5;
      }

      if (score > 0) {
        scored.push({ movie, score });
      }
    }

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    const limit = options?.maxResults ?? 60;
    return scored.slice(0, limit).map((s) => s.movie);
  }

  /**
   * Search TMDB on-demand
   */
  public static async searchTMDB(
    query: string,
    options?: { signal?: AbortSignal; excludeMovieIds?: Set<number> }
  ): Promise<{ results: Movie[]; error: string | null }> {
    const rawQuery = query.trim();
    if (!rawQuery) return { results: [], error: null };

    try {
      const response = await tmdbService.searchMovies(
        rawQuery,
        undefined,
        1,
        options?.signal
      );

      const list = response?.results || [];
      const filtered = options?.excludeMovieIds
        ? list.filter((m) => !options.excludeMovieIds!.has(m.id))
        : list;

      return { results: filtered, error: null };
    } catch (err: any) {
      if (options?.signal?.aborted) {
        return { results: [], error: null };
      }
      const msg = err?.message || 'Network error querying TMDB';
      return { results: [], error: msg };
    }
  }

  /**
   * Two-Layer Unified Search:
   * 1. Query local catalog immediately.
   * 2. Concurrently query TMDB when online.
   * 3. Merge results and deduplicate by TMDB ID.
   */
  public static async searchUnified(
    query: string,
    options?: SearchOptions
  ): Promise<UnifiedSearchResult> {
    const rawQuery = query.trim();
    if (!rawQuery) {
      return {
        localResults: [],
        tmdbResults: [],
        merged: [],
        isOffline: !navigator.onLine,
        tmdbError: null,
      };
    }

    // LAYER 1: Fast local catalog search
    const localResults = await this.searchLocal(rawQuery, {
      excludeMovieIds: options?.excludeMovieIds,
      maxResults: options?.maxResults,
    });

    // Provide instant feedback if local handler provided
    if (options?.onLocalResults) {
      options.onLocalResults(localResults);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // If offline, return local results immediately with offline flag
    if (isOffline) {
      return {
        localResults,
        tmdbResults: [],
        merged: localResults,
        isOffline: true,
        tmdbError: null,
      };
    }

    // LAYER 2: Query TMDB in parallel
    const { results: tmdbResults, error: tmdbError } = await this.searchTMDB(
      rawQuery,
      {
        signal: options?.signal,
        excludeMovieIds: options?.excludeMovieIds,
      }
    );

    // MERGE & DEDUPLICATE by TMDB ID
    const mergedMap = new Map<number, Movie>();

    // 1. Add all local results first (preserves local canonical representations)
    for (const movie of localResults) {
      mergedMap.set(movie.id, movie);
    }

    // 2. Add any additional TMDB results that aren't already present
    for (const movie of tmdbResults) {
      if (!mergedMap.has(movie.id)) {
        mergedMap.set(movie.id, {
          ...movie,
          source: 'tmdb',
        });
      }
    }

    const merged = Array.from(mergedMap.values());

    return {
      localResults,
      tmdbResults,
      merged,
      isOffline: false,
      tmdbError,
    };
  }

  /**
   * Ensure a selected movie is persisted into the canonical local catalog
   */
  public static async ensureCanonicalMovie(movie: Movie): Promise<Movie> {
    const existing = await MovieRepository.getById(movie.id);
    if (existing) {
      return existing;
    }

    const canonical: Movie = {
      ...movie,
      source: movie.source || 'tmdb',
      lastFetched: movie.lastFetched || new Date().toISOString(),
    };

    await MovieRepository.save(canonical);
    return canonical;
  }
}
