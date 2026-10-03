// src/services/unifiedSearchService.ts
// Two-layer unified movie search: Curated Local Catalog (Layer 1) + On-Demand TMDB (Layer 2)

import { Movie } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { tmdbService, TMDBError } from './tmdbService';

export type SearchErrorCode =
  | 'OFFLINE'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | null;

export interface UnifiedSearchResult {
  sequenceId: number;
  localResults: Movie[];
  tmdbResults: Movie[];
  merged: Movie[];
  isOffline: boolean;
  tmdbError: string | null;
  errorCode: SearchErrorCode;
  page: number;
  totalPages: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
  excludeMovieIds?: Set<number>;
  onLocalResults?: (local: Movie[], sequenceId: number) => void;
  maxResults?: number;
  page?: number;
}

export class UnifiedSearchService {
  private static currentSequence = 0;

  /**
   * Normalize search string for resilient matching
   */
  public static normalize(str: string): string {
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
   * Search TMDB on-demand with pagination and error categorization
   */
  public static async searchTMDB(
    query: string,
    options?: { signal?: AbortSignal; excludeMovieIds?: Set<number>; page?: number }
  ): Promise<{ results: Movie[]; totalPages: number; error: string | null; errorCode: SearchErrorCode }> {
    const rawQuery = query.trim();
    if (!rawQuery) return { results: [], totalPages: 0, error: null, errorCode: null };

    const page = options?.page || 1;

    try {
      const response = await tmdbService.searchMulti(
        rawQuery,
        page,
        options?.signal
      );

      const list = response?.results || [];
      const filtered = options?.excludeMovieIds
        ? list.filter((m) => !options.excludeMovieIds!.has(m.id))
        : list;

      return {
        results: filtered,
        totalPages: response?.totalPages || 1,
        error: null,
        errorCode: null,
      };
    } catch (err: any) {
      if (options?.signal?.aborted) {
        return { results: [], totalPages: 0, error: null, errorCode: null };
      }

      let errorCode: SearchErrorCode = 'NETWORK_ERROR';
      if (err instanceof TMDBError) {
        if (err.code === 'RATE_LIMITED' || err.status === 429) {
          errorCode = 'RATE_LIMITED';
        } else if (err.code === 'AUTHENTICATION_FAILED' || err.status === 401 || err.status === 403) {
          errorCode = 'AUTH_ERROR';
        } else if (err.status && err.status >= 500) {
          errorCode = 'SERVER_ERROR';
        }
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        errorCode = 'OFFLINE';
      }

      const msg = err?.message || 'Network error querying TMDB';
      return { results: [], totalPages: 0, error: msg, errorCode };
    }
  }

  /**
   * Two-Layer Unified Search with Race Protection & Latest-Request-Wins:
   * 1. Generates monotonic sequence ID to prevent race conditions.
   * 2. Queries local catalog immediately.
   * 3. Concurrently queries TMDB when online.
   * 4. Merges results and deduplicates by TMDB ID.
   */
  public static async searchUnified(
    query: string,
    options?: SearchOptions
  ): Promise<UnifiedSearchResult> {
    const seq = ++UnifiedSearchService.currentSequence;
    const rawQuery = query.trim();
    const page = options?.page || 1;

    if (!rawQuery) {
      return {
        sequenceId: seq,
        localResults: [],
        tmdbResults: [],
        merged: [],
        isOffline: typeof navigator !== 'undefined' && !navigator.onLine,
        tmdbError: null,
        errorCode: null,
        page: 1,
        totalPages: 0,
      };
    }

    // LAYER 1: Fast local catalog search (only for page 1)
    const localResults =
      page === 1
        ? await this.searchLocal(rawQuery, {
            excludeMovieIds: options?.excludeMovieIds,
            maxResults: options?.maxResults,
          })
        : [];

    // Provide instant feedback if local handler provided and this request is still active
    if (options?.onLocalResults && seq === UnifiedSearchService.currentSequence) {
      options.onLocalResults(localResults, seq);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // If offline, return local results immediately with offline flag
    if (isOffline) {
      return {
        sequenceId: seq,
        localResults,
        tmdbResults: [],
        merged: localResults,
        isOffline: true,
        tmdbError: null,
        errorCode: 'OFFLINE',
        page: 1,
        totalPages: 1,
      };
    }

    // LAYER 2: Query TMDB in parallel
    const { results: tmdbResults, totalPages, error: tmdbError, errorCode } = await this.searchTMDB(
      rawQuery,
      {
        signal: options?.signal,
        excludeMovieIds: options?.excludeMovieIds,
        page,
      }
    );

    // If a newer search request was launched while this one was in flight, mark it
    // but still return valid deduplicated data with the sequenceId
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
      sequenceId: seq,
      localResults,
      tmdbResults,
      merged,
      isOffline: false,
      tmdbError,
      errorCode,
      page,
      totalPages,
    };
  }

  /**
   * Check if a given sequence ID is the latest active search
   */
  public static isLatestSequence(sequenceId: number): boolean {
    return sequenceId === UnifiedSearchService.currentSequence;
  }

  /**
   * Ensure a selected movie is persisted into the canonical local catalog
   * Reuses existing Movie records and performs an intelligent non-destructive merge.
   */
  public static async ensureCanonicalMovie(movie: Movie): Promise<Movie> {
    return MovieRepository.save(movie);
  }
}
