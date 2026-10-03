import { Movie, Genre, MediaType, toCanonicalId, parseCanonicalId } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { getDB, TMDBCacheEntry } from '../db/database';
import { SEED_MOVIES } from '../data/seedCatalog';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Specific TTLs by data category (Section 9)
const TTL_MAP: Record<string, number> = {
  trending: 15 * 60 * 1000, // 15 minutes
  popular: 60 * 60 * 1000, // 1 hour
  search: 5 * 60 * 1000, // 5 minutes
  details: 24 * 60 * 60 * 1000, // 24 hours
  genres: 7 * 24 * 60 * 60 * 1000, // 7 days
  discover: 30 * 60 * 1000, // 30 minutes
  similar: 60 * 60 * 1000, // 1 hour
  credits: 24 * 60 * 60 * 1000, // 24 hours
  tv: 24 * 60 * 60 * 1000, // 24 hours
};

export type TMDBErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'TMDB_REQUEST_FAILED'
  | 'NO_RESULTS';

export class TMDBError extends Error {
  code: TMDBErrorCode;
  status?: number;

  constructor(message: string, code: TMDBErrorCode, status?: number) {
    super(message);
    this.name = 'TMDBError';
    this.code = code;
    this.status = status;
  }
}

export interface TMDBAuthConfig {
  type: 'v3_key' | 'bearer_token';
  value: string;
  source: 'user_override' | 'environment' | 'builtin';
}

export interface TMDBDiagnostics {
  isConfigured: boolean;
  authType: 'v3_key' | 'bearer_token';
  authSource: 'user_override' | 'environment' | 'builtin';
  isOnline: boolean;
  isConnected: boolean;
  latencyMs: number | null;
  lastError: string | null;
  sampleMovieTitle: string | null;
}

export interface SWRResult<T> {
  data: T;
  isStale: boolean;
  fromCache: boolean;
}

// In-memory cache for active session
const MEMORY_CACHE = new Map<string, { data: any; timestamp: number; ttlMs: number }>();

// In-flight request deduplication map (Section 8)
const IN_FLIGHT_REQUESTS = new Map<string, Promise<any>>();

// Concurrency queue controller (Section 14)
class RequestQueue {
  private activeCount = 0;
  private maxConcurrent = 4;
  private queue: Array<() => void> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

const REQUEST_QUEUE = new RequestQueue();

export class TMDBService {
  /**
   * Determine the active TMDB authentication configuration.
   * Priority:
   * 1. User manual override stored in IndexedDB
   * 2. Vite environment variable (VITE_TMDB_API_KEY, VITE_TMDB_ACCESS_TOKEN, VITE_TMDB_READ_TOKEN)
   * 3. Verified built-in demonstration key
   */
  static async getAuthConfig(): Promise<TMDBAuthConfig> {
    const prefs = await PreferencesRepository.getPreferences();
    const userKey = prefs.tmdbApiKey?.trim();
    if (userKey && userKey !== 'b8b7e2d9b936e7ec548679d98bc19d3e') {
      const type = userKey.startsWith('ey') && userKey.length > 50 ? 'bearer_token' : 'v3_key';
      return { type, value: userKey, source: 'user_override' };
    }

    const envKey = (
      (import.meta as any).env?.VITE_TMDB_API_KEY ||
      (import.meta as any).env?.VITE_TMDB_ACCESS_TOKEN ||
      (import.meta as any).env?.VITE_TMDB_READ_TOKEN ||
      ''
    ).trim();

    if (envKey && envKey !== 'b8b7e2d9b936e7ec548679d98bc19d3e') {
      const type = envKey.startsWith('ey') && envKey.length > 50 ? 'bearer_token' : 'v3_key';
      return { type, value: envKey, source: 'environment' };
    }

    // Verified active public TMDB key
    return {
      type: 'v3_key',
      value: '15d2ea6d0dc1d476efbca3eba2b9bbfb',
      source: 'builtin',
    };
  }

  private static getTTLForEndpoint(endpoint: string): number {
    if (endpoint.includes('/trending')) return TTL_MAP.trending;
    if (endpoint.includes('/popular')) return TTL_MAP.popular;
    if (endpoint.includes('/search')) return TTL_MAP.search;
    if (endpoint.includes('/discover')) return TTL_MAP.discover;
    if (endpoint.includes('/genre')) return TTL_MAP.genres;
    if (endpoint.includes('/credits')) return TTL_MAP.credits;
    if (endpoint.includes('/similar')) return TTL_MAP.similar;
    if (endpoint.startsWith('/movie/') || endpoint.startsWith('/tv/')) return TTL_MAP.details;
    return 10 * 60 * 1000;
  }

  /**
   * IndexedDB Cache Layer (Section 10)
   */
  private static async getFromIDBCache(key: string): Promise<TMDBCacheEntry | null> {
    try {
      const db = await getDB();
      const entry = await db.get('tmdbCache', key);
      return entry || null;
    } catch {
      return null;
    }
  }

  private static async saveToIDBCache(key: string, data: any, ttlMs: number): Promise<void> {
    try {
      const db = await getDB();
      await db.put('tmdbCache', {
        key,
        data,
        timestamp: Date.now(),
        ttlMs,
      });
    } catch {
      // Ignore cache write errors
    }
  }

  /**
   * Core network fetch with retry, backoff, and deduplication
   */
  private static async executeNetworkFetch<T>(
    endpoint: string,
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> {
    const auth = await this.getAuthConfig();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    let directUrl = '';
    const directParams = new URLSearchParams(params);

    if (auth.type === 'bearer_token') {
      headers['Authorization'] = `Bearer ${auth.value}`;
      const qs = directParams.toString();
      directUrl = `${TMDB_BASE_URL}${endpoint}${qs ? `?${qs}` : ''}`;
    } else {
      directParams.set('api_key', auth.value);
      directUrl = `${TMDB_BASE_URL}${endpoint}?${directParams.toString()}`;
    }

    // Priority Route: Browser environment uses /api/tmdb serverless proxy with 9000ms timeout
    // This bypasses regional ISP DNS blocking and CORS issues reliably across both local dev and production.
    if (typeof window !== 'undefined') {
      try {
        const proxyParams = new URLSearchParams(params);
        proxyParams.set('endpoint', endpoint);
        const proxyUrl = `/api/tmdb?${proxyParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);
        const proxyHeaders: Record<string, string> = { Accept: 'application/json' };
        // Only forward custom key if user explicitly provided a personal override in Settings
        if (auth.source === 'user_override' && auth.value) {
          proxyHeaders['Authorization'] = `Bearer ${auth.value}`;
        }

        const onAbort = () => controller.abort();
        if (signal) signal.addEventListener('abort', onAbort);

        const proxyRes = await fetch(proxyUrl, { headers: proxyHeaders, signal: controller.signal });
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return data as T;
        }

        // Categorize HTTP errors returned from proxy
        if (proxyRes.status === 401 || proxyRes.status === 403) {
          throw new TMDBError(
            'TMDB authentication failed. Check credentials.',
            'AUTHENTICATION_FAILED',
            proxyRes.status
          );
        }
        if (proxyRes.status === 429) {
          throw new TMDBError('TMDB rate limit reached. Try again shortly.', 'RATE_LIMITED', 429);
        }
        if (proxyRes.status === 404) {
          throw new TMDBError('Resource not found on TMDB.', 'TMDB_REQUEST_FAILED', 404);
        }
        if (proxyRes.status >= 500) {
          throw new TMDBError('TMDB service is temporarily unavailable.', 'TMDB_REQUEST_FAILED', proxyRes.status);
        }
        throw new TMDBError(`HTTP ${proxyRes.status}: ${proxyRes.statusText}`, 'TMDB_REQUEST_FAILED', proxyRes.status);
      } catch (err: any) {
        if (err instanceof TMDBError) {
          throw err;
        }
        if (signal?.aborted) {
          throw new TMDBError('Request aborted by caller', 'NETWORK_ERROR');
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new TMDBError('Device is offline', 'NETWORK_ERROR');
        }
        // Fall back to direct fetch attempt only on network transport failures
      }
    }

    // Secondary Route: Direct TMDB with controlled retries
    let maxAttempts = 2;
    let attempt = 0;
    let lastError: TMDBError | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      if (signal?.aborted) {
        throw new TMDBError('Request aborted by caller', 'NETWORK_ERROR');
      }

      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 3500);

        const onAbort = () => timeoutController.abort();
        if (signal) signal.addEventListener('abort', onAbort);

        const res = await fetch(directUrl, { headers, signal: timeoutController.signal });
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (res.ok) {
          const data = await res.json();
          return data as T;
        }

        if (res.status === 401 || res.status === 403) {
          throw new TMDBError(
            'TMDB authentication failed. Check credentials.',
            'AUTHENTICATION_FAILED',
            res.status
          );
        }

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 1000)));
            continue;
          }
          throw new TMDBError('TMDB rate limit reached.', 'RATE_LIMITED', 429);
        }

        if (res.status >= 500 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 500));
          continue;
        }

        throw new TMDBError(`HTTP ${res.status}: ${res.statusText}`, 'TMDB_REQUEST_FAILED', res.status);
      } catch (err: any) {
        if (err instanceof TMDBError && err.code === 'AUTHENTICATION_FAILED') {
          throw err;
        }
        if (signal?.aborted) {
          throw new TMDBError('Request aborted by caller', 'NETWORK_ERROR');
        }
        lastError =
          err instanceof TMDBError
            ? err
            : new TMDBError(err?.message || 'Network request failed', 'NETWORK_ERROR');

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
      }
    }

    throw lastError || new TMDBError('TMDB service unreachable', 'NETWORK_ERROR');
  }

  /**
   * Request with memory cache + IndexedDB cache + request deduplication (Sections 8, 9, 10)
   */
  static async fetchWithCache<T>(
    endpoint: string,
    params: Record<string, string> = {},
    options?: { signal?: AbortSignal; ttl?: number }
  ): Promise<T> {
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    const ttlMs = options?.ttl || this.getTTLForEndpoint(endpoint);

    // 1. Check in-memory cache
    const memCached = MEMORY_CACHE.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < memCached.ttlMs) {
      return memCached.data as T;
    }

    // 2. Check in-flight request deduplication (Section 8)
    if (IN_FLIGHT_REQUESTS.has(cacheKey)) {
      return IN_FLIGHT_REQUESTS.get(cacheKey)! as Promise<T>;
    }

    // 3. Check persistent IndexedDB cache (Section 10)
    const idbCached = await this.getFromIDBCache(cacheKey);
    if (idbCached && Date.now() - idbCached.timestamp < idbCached.ttlMs) {
      // Re-populate memory cache
      MEMORY_CACHE.set(cacheKey, {
        data: idbCached.data,
        timestamp: idbCached.timestamp,
        ttlMs: idbCached.ttlMs,
      });
      return idbCached.data as T;
    }

    // 4. Dispatch through concurrency queue and deduplicate
    const fetchPromise = REQUEST_QUEUE.run(async () => {
      try {
        const freshData = await this.executeNetworkFetch<T>(endpoint, params, options?.signal);
        // Save to memory cache
        MEMORY_CACHE.set(cacheKey, { data: freshData, timestamp: Date.now(), ttlMs });
        // Save to IndexedDB cache
        this.saveToIDBCache(cacheKey, freshData, ttlMs);
        return freshData;
      } finally {
        IN_FLIGHT_REQUESTS.delete(cacheKey);
      }
    });

    IN_FLIGHT_REQUESTS.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Stale-While-Revalidate pattern (Section 7 & 11)
   * Returns cached data immediately if available, then triggers background refresh.
   */
  static async fetchWithSWR<T>(
    endpoint: string,
    params: Record<string, string> = {},
    onRevalidate?: (fresh: T) => void,
    options?: { signal?: AbortSignal; ttl?: number }
  ): Promise<SWRResult<T>> {
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    const ttlMs = options?.ttl || this.getTTLForEndpoint(endpoint);

    // Check memory first
    const memCached = MEMORY_CACHE.get(cacheKey);
    if (memCached) {
      const isStale = Date.now() - memCached.timestamp >= memCached.ttlMs;
      if (isStale && onRevalidate) {
        // Trigger background revalidation without blocking caller
        this.fetchWithCache<T>(endpoint, params, { signal: options?.signal, ttl: ttlMs })
          .then((fresh) => onRevalidate(fresh))
          .catch(() => {});
      }
      return { data: memCached.data as T, isStale, fromCache: true };
    }

    // Check IndexedDB
    const idbCached = await this.getFromIDBCache(cacheKey);
    if (idbCached) {
      const isStale = Date.now() - idbCached.timestamp >= idbCached.ttlMs;
      MEMORY_CACHE.set(cacheKey, {
        data: idbCached.data,
        timestamp: idbCached.timestamp,
        ttlMs: idbCached.ttlMs,
      });
      if (isStale && onRevalidate) {
        this.fetchWithCache<T>(endpoint, params, { signal: options?.signal, ttl: ttlMs })
          .then((fresh) => onRevalidate(fresh))
          .catch(() => {});
      }
      return { data: idbCached.data as T, isStale, fromCache: true };
    }

    // No cache: await fresh network fetch
    const freshData = await this.fetchWithCache<T>(endpoint, params, options);
    return { data: freshData, isStale: false, fromCache: false };
  }

  /**
   * Search movies by title and optional year with AbortSignal support (Section 12 & 13)
   */
  static async search(
    query: string,
    year?: number,
    page: number = 1,
    signal?: AbortSignal
  ): Promise<{ results: Movie[]; totalPages: number }> {
    if (!query.trim()) return { results: [], totalPages: 0 };
    const params: Record<string, string> = {
      query: query.trim(),
      page: page.toString(),
      include_adult: 'false',
    };
    if (year) params.year = year.toString();

    const data = await this.fetchWithCache<any>('/search/movie', params, { signal });
    const rawResults = data.results || [];
    const results = rawResults.map((raw: any) => this.mapRawToMovie(raw, 'movie'));
    return { results, totalPages: data.total_pages || 1 };
  }

  /**
   * Unified multi-search across Movies and TV Series
   */
  static async searchMulti(
    query: string,
    page: number = 1,
    signal?: AbortSignal
  ): Promise<{ results: Movie[]; totalPages: number }> {
    if (!query.trim()) return { results: [], totalPages: 0 };
    const params: Record<string, string> = {
      query: query.trim(),
      page: page.toString(),
      include_adult: 'false',
    };

    const data = await this.fetchWithCache<any>('/search/multi', params, { signal });
    const rawResults = (data.results || []).filter(
      (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
    );
    const results = rawResults.map((raw: any) => this.mapRawToMovie(raw));
    return { results, totalPages: data.total_pages || 1 };
  }

  /**
   * Get full details for Movie or TV Series with credits
   */
  static async getDetails(id: number): Promise<Movie> {
    const local = await MovieRepository.getById(id);
    if (local && local.overview && local.credits) {
      return local;
    }

    const { mediaType, tmdbId } = parseCanonicalId(id);

    try {
      const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
      const data = await this.fetchWithCache<any>(endpoint, {
        append_to_response: 'credits',
      });
      const movie = this.mapRawToMovie(data, mediaType);
      await MovieRepository.save(movie);
      return movie;
    } catch (err) {
      if (local) return local;
      const seed = SEED_MOVIES.find((m) => m.id === id);
      if (seed) return seed;
      throw err;
    }
  }

  static async getById(id: number): Promise<Movie> {
    return this.getDetails(id);
  }

  static async getSimilar(id: number): Promise<Movie[]> {
    const { mediaType, tmdbId } = parseCanonicalId(id);
    try {
      const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}/similar` : `/movie/${tmdbId}/similar`;
      const data = await this.fetchWithCache<any>(endpoint);
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw, mediaType));
    } catch {
      return SEED_MOVIES.filter((m) => m.id !== id).slice(0, 8);
    }
  }

  static async getCredits(id: number): Promise<{ cast: any[]; crew: any[]; director?: string }> {
    const { mediaType, tmdbId } = parseCanonicalId(id);
    try {
      const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}/credits` : `/movie/${tmdbId}/credits`;
      const data = await this.fetchWithCache<any>(endpoint);
      const cast = data.cast || [];
      const crew = data.crew || [];
      const directorObj = crew.find((c: any) => c.job === 'Director');
      return {
        cast,
        crew,
        director: directorObj?.name,
      };
    } catch {
      return { cast: [], crew: [] };
    }
  }

  /**
   * Get trending movies or TV series with SWR support
   */
  static async getTrending(
    timeWindow: 'day' | 'week' = 'week',
    onRevalidate?: (movies: Movie[]) => void,
    mediaType: 'all' | 'movie' | 'tv' = 'movie',
    page: number = 1
  ): Promise<Movie[]> {
    const endpoint = `/trending/${mediaType}/${timeWindow}`;
    try {
      const res = await this.fetchWithSWR<any>(
        endpoint,
        { page: page.toString() },
        onRevalidate
          ? (fresh) =>
              onRevalidate(
                (fresh.results || [])
                  .filter((r: any) => r.media_type !== 'person')
                  .map((r: any) =>
                    this.mapRawToMovie(r, mediaType === 'all' ? undefined : (mediaType as MediaType))
                  )
              )
          : undefined
      );
      return (res.data.results || [])
        .filter((r: any) => r.media_type !== 'person')
        .map((raw: any) =>
          this.mapRawToMovie(raw, mediaType === 'all' ? undefined : (mediaType as MediaType))
        );
    } catch (err: any) {
      const local = await MovieRepository.getAll();
      if (local.length >= 6) return local.slice(0, 20);
      return SEED_MOVIES.filter((m) => m.seedCategory === 'trending').slice(0, 20);
    }
  }

  /**
   * Get popular movies or series with SWR support
   */
  static async getPopular(
    page: number = 1,
    onRevalidate?: (movies: Movie[]) => void,
    mediaType: 'movie' | 'tv' = 'movie'
  ): Promise<Movie[]> {
    const endpoint = mediaType === 'tv' ? '/tv/popular' : '/movie/popular';
    try {
      const res = await this.fetchWithSWR<any>(
        endpoint,
        { page: page.toString() },
        onRevalidate
          ? (fresh) =>
              onRevalidate((fresh.results || []).map((r: any) => this.mapRawToMovie(r, mediaType)))
          : undefined
      );
      return (res.data.results || []).map((raw: any) => this.mapRawToMovie(raw, mediaType));
    } catch (err: any) {
      const local = await MovieRepository.getAll();
      if (local.length >= 6) return local.slice(0, 20);
      return SEED_MOVIES.filter((m) => m.seedCategory === 'recent_popular').slice(0, 20);
    }
  }

  /**
   * Get top rated movies or series
   */
  static async getTopRated(
    mediaType: 'movie' | 'tv' = 'movie',
    page: number = 1
  ): Promise<Movie[]> {
    const endpoint = mediaType === 'tv' ? '/tv/top_rated' : '/movie/top_rated';
    try {
      const data = await this.fetchWithCache<any>(endpoint, { page: page.toString() });
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw, mediaType));
    } catch {
      return [...SEED_MOVIES].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)).slice(0, 20);
    }
  }

  /**
   * Get genre list
   */
  static async getGenres(mediaType: 'movie' | 'tv' = 'movie'): Promise<Genre[]> {
    const endpoint = mediaType === 'tv' ? '/genre/tv/list' : '/genre/movie/list';
    try {
      const data = await this.fetchWithCache<any>(endpoint);
      return data.genres || [];
    } catch {
      return [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
        { id: 16, name: 'Animation' },
        { id: 35, name: 'Comedy' },
        { id: 80, name: 'Crime' },
        { id: 99, name: 'Documentary' },
        { id: 18, name: 'Drama' },
        { id: 14, name: 'Fantasy' },
        { id: 27, name: 'Horror' },
        { id: 9648, name: 'Mystery' },
        { id: 10749, name: 'Romance' },
        { id: 878, name: 'Sci-Fi' },
        { id: 53, name: 'Thriller' },
      ];
    }
  }

  /**
   * Core Discover query with full parameter and mediaType support
   */
  static async discoverPaged(params: {
    mediaType?: 'movie' | 'tv';
    genreIds?: number[];
    withoutGenreIds?: number[];
    withCompanies?: string;
    withOriginalLanguage?: string;
    withOriginCountry?: string;
    withKeywords?: string;
    withCast?: string;
    withCrew?: string;
    sortBy?: string;
    page?: number;
    voteAverageGte?: number;
    voteCountGte?: number;
    primaryReleaseYear?: number;
    firstAirDateYear?: number;
  }): Promise<{ results: Movie[]; totalPages: number }> {
    const mediaType: MediaType = params.mediaType || 'movie';
    const endpoint = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';

    const queryParams: Record<string, string> = {
      page: (params.page || 1).toString(),
      sort_by: params.sortBy || 'popularity.desc',
      include_adult: 'false',
    };
    if (params.genreIds && params.genreIds.length > 0) {
      queryParams.with_genres = params.genreIds.join(',');
    }
    if (params.withoutGenreIds && params.withoutGenreIds.length > 0) {
      queryParams.without_genres = params.withoutGenreIds.join(',');
    }
    if (params.withCompanies) {
      queryParams.with_companies = params.withCompanies;
    }
    if (params.withOriginalLanguage) {
      queryParams.with_original_language = params.withOriginalLanguage;
    }
    if (params.withOriginCountry) {
      queryParams.with_origin_country = params.withOriginCountry;
    }
    if (params.withKeywords) {
      queryParams.with_keywords = params.withKeywords;
    }
    if (params.withCast) {
      queryParams.with_cast = params.withCast;
    }
    if (params.withCrew) {
      queryParams.with_crew = params.withCrew;
    }
    if (params.voteAverageGte) {
      queryParams['vote_average.gte'] = params.voteAverageGte.toString();
    }
    if (params.voteCountGte) {
      queryParams['vote_count.gte'] = params.voteCountGte.toString();
    }
    if (params.primaryReleaseYear) {
      queryParams.primary_release_year = params.primaryReleaseYear.toString();
    }
    if (params.firstAirDateYear) {
      queryParams.first_air_date_year = params.firstAirDateYear.toString();
    }

    try {
      const data = await this.fetchWithCache<any>(endpoint, queryParams);
      const results = (data.results || []).map((raw: any) => this.mapRawToMovie(raw, mediaType));
      return { results, totalPages: data.total_pages || 1 };
    } catch {
      return { results: SEED_MOVIES.slice(0, 10), totalPages: 1 };
    }
  }

  /**
   * Discover movies or TV series returning Movie[] directly (for simple rail usage)
   */
  static async discover(params: Parameters<typeof TMDBService.discoverPaged>[0]): Promise<Movie[]> {
    const res = await this.discoverPaged(params);
    return res.results;
  }

  // =========================================================================
  // DEDICATED CATEGORY QUERIES (Prompt Sections 6, 7, 8, 9, 10)
  // =========================================================================

  /**
   * Section 6: HOLLYWOOD — Major Category (Broad movie discovery pool)
   */
  static async getHollywoodMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withOriginCountry: 'US',
      withOriginalLanguage: 'en',
      voteCountGte: 150,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Section 7: HOLLYWOOD SERIES — Major Requirement (Broad TV discovery pool)
   */
  static async getHollywoodSeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      withOriginalLanguage: 'en',
      withoutGenreIds: [10763, 10767], // Filter out talk shows / news
      voteCountGte: 80,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Section 8: MARVEL — Movies (MCU, Sony Spider-Man, Legacy Marvel)
   */
  static async getMarvelMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withCompanies: '420|7505|13252', // Marvel Studios, Marvel Entertainment, Marvel Animation
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Section 9: MARVEL SERIES — Real TV Category
   */
  static async getMarvelSeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      withCompanies: '420|7505|13252',
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Section 10: SONY — Movies (Columbia Pictures, Sony Pictures, TriStar)
   */
  static async getSonyMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withCompanies: '5|34|2251|559|3287', // Columbia, Sony, Sony Animation, TriStar, Screen Gems
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * SONY SERIES / Animation
   */
  static async getSonySeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      withCompanies: '5|34|2251|559|3287',
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * DC Universe Movies
   */
  static async getDCMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withCompanies: '9993|429', // DC Entertainment, DC Comics
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * DC Universe Series
   */
  static async getDCSeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      withCompanies: '9993|429',
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Sci-Fi Landmarks Movies
   */
  static async getSciFiMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      genreIds: [878],
      voteCountGte: 200,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Crime & Thriller Series
   */
  static async getCrimeThrillerSeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      genreIds: [80, 9648], // Crime & Mystery
      voteCountGte: 80,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Anime & Animation Series
   */
  static async getAnimeSeries(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'tv',
      withOriginalLanguage: 'ja',
      genreIds: [16],
      voteCountGte: 50,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Regional Indian Blockbuster Cinema
   */
  static async getRegionalIndianMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withOriginalLanguage: 'ta|hi|te|ml',
      voteCountGte: 25,
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Tamil Cinema
   */
  static async getTamilMovies(page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    return this.discoverPaged({
      mediaType: 'movie',
      withOriginalLanguage: 'ta',
      sortBy: 'popularity.desc',
      page,
    });
  }

  /**
   * Run live diagnostic test for TMDB connectivity
   */
  static async runDiagnostics(): Promise<TMDBDiagnostics> {
    const auth = await this.getAuthConfig();
    const startTime = Date.now();

    try {
      const data = await this.fetchWithCache<any>('/movie/27205'); // Inception
      const latencyMs = Date.now() - startTime;
      return {
        isConfigured: Boolean(auth.value),
        authType: auth.type,
        authSource: auth.source,
        isOnline: navigator.onLine,
        isConnected: true,
        latencyMs,
        lastError: null,
        sampleMovieTitle: data?.title || 'Inception',
      };
    } catch (err: any) {
      return {
        isConfigured: Boolean(auth.value),
        authType: auth.type,
        authSource: auth.source,
        isOnline: navigator.onLine,
        isConnected: false,
        latencyMs: null,
        lastError: err?.message || 'Connection failed',
        sampleMovieTitle: null,
      };
    }
  }

  /**
   * Canonical Movie & TV Series Model Mapper (Prompt Sections 2, 3, 4)
   */
  public static mapRawToMovie(raw: any, explicitMediaType?: MediaType): Movie {
    const rawType = raw.media_type;
    const mediaType: MediaType =
      rawType === 'tv'
        ? 'tv'
        : rawType === 'movie'
        ? 'movie'
        : explicitMediaType ||
          (raw.first_air_date !== undefined || raw.name !== undefined || raw.number_of_seasons !== undefined
            ? 'tv'
            : 'movie');

    const rawId = typeof raw.id === 'number' ? raw.id : parseInt(raw.id, 10);
    const canonicalId = toCanonicalId(mediaType, rawId);

    const credits = raw.credits
      ? {
          cast: (raw.credits.cast || []).slice(0, 15).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profilePath: c.profile_path || null,
          })),
          crew: (raw.credits.crew || []).slice(0, 15).map((c: any) => ({
            id: c.id,
            name: c.name,
            job: c.job,
            department: c.department,
            profilePath: c.profile_path || null,
          })),
        }
      : undefined;

    const networks = Array.isArray(raw.networks)
      ? raw.networks.map((n: any) => ({
          id: n.id,
          name: n.name,
          logoPath: n.logo_path || null,
          originCountry: n.origin_country,
        }))
      : undefined;

    const productionCompanies = Array.isArray(raw.production_companies)
      ? raw.production_companies.map((p: any) => ({
          id: p.id,
          name: p.name,
          logoPath: p.logo_path || null,
          originCountry: p.origin_country,
        }))
      : undefined;

    const createdByName =
      Array.isArray(raw.created_by) && raw.created_by.length > 0
        ? raw.created_by.map((c: any) => c.name).join(', ')
        : undefined;

    return {
      id: canonicalId,
      tmdbId: rawId,
      mediaType,
      title: raw.title || raw.name || 'Untitled',
      name: raw.name || raw.title,
      originalTitle: raw.original_title || raw.original_name || undefined,
      originalName: raw.original_name || raw.original_title || undefined,
      originalLanguage: raw.original_language || undefined,
      overview: raw.overview || '',
      releaseDate: raw.release_date || raw.first_air_date || undefined,
      firstAirDate: raw.first_air_date || (mediaType === 'tv' ? raw.release_date : undefined),
      runtime: mediaType === 'movie' && typeof raw.runtime === 'number' ? raw.runtime : null,
      numberOfSeasons: typeof raw.number_of_seasons === 'number' ? raw.number_of_seasons : undefined,
      numberOfEpisodes: typeof raw.number_of_episodes === 'number' ? raw.number_of_episodes : undefined,
      networks,
      createdByName,
      productionCompanies,
      posterPath: raw.poster_path || null,
      backdropPath: raw.backdrop_path || null,
      voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
      voteCount: typeof raw.vote_count === 'number' ? raw.vote_count : 0,
      popularity: typeof raw.popularity === 'number' ? raw.popularity : undefined,
      genres: raw.genres || (raw.genre_ids ? raw.genre_ids.map((id: number) => ({ id, name: '' })) : []),
      credits,
      status: raw.status || undefined,
      tagline: raw.tagline || undefined,
      budget: raw.budget || undefined,
      revenue: raw.revenue || undefined,
      lastFetched: new Date().toISOString(),
    };
  }

  /**
   * Centralized Poster Image URL utility (Section 6 & 18)
   */
  static getPosterUrl(
    path?: string | null,
    size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'
  ): string | null {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

    const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `https://image.tmdb.org/t/p/${size}${clean}`;
  }

  /**
   * Centralized Backdrop Image URL utility (Section 6 & 18)
   */
  static getBackdropUrl(
    path?: string | null,
    size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'
  ): string | null {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

    const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `https://image.tmdb.org/t/p/${size}${clean}`;
  }

  /**
   * Centralized General Image URL helper (Section 6)
   */
  static getTMDBImageUrl(
    path?: string | null,
    size: 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'
  ): string | null {
    if (!path) return null;
    if (size === 'w1280' || size === 'w300') {
      return this.getBackdropUrl(path, size as any);
    }
    return this.getPosterUrl(path, size as any);
  }

  static getImageUrl(
    path?: string | null,
    size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'
  ): string {
    return this.getTMDBImageUrl(path, size as any) || '';
  }
}

export const tmdbService = {
  searchMovies: (query: string, year?: number, page?: number, signal?: AbortSignal) =>
    TMDBService.search(query, year, page, signal),
  searchMulti: (query: string, page?: number, signal?: AbortSignal) =>
    TMDBService.searchMulti(query, page, signal),
  getMovieDetails: (id: number) => TMDBService.getById(id),
  getTrending: (
    window: 'day' | 'week' = 'week',
    onRevalidate?: (movies: Movie[]) => void,
    mediaType: 'all' | 'movie' | 'tv' = 'movie',
    page: number = 1
  ) => TMDBService.getTrending(window, onRevalidate, mediaType, page),
  getPopular: (
    page: number = 1,
    onRevalidate?: (movies: Movie[]) => void,
    mediaType: 'movie' | 'tv' = 'movie'
  ) => TMDBService.getPopular(page, onRevalidate, mediaType),
  getTopRated: (mediaType: 'movie' | 'tv' = 'movie', page: number = 1) =>
    TMDBService.getTopRated(mediaType, page),
  getSimilar: (id: number) => TMDBService.getSimilar(id),
  getCredits: (id: number) => TMDBService.getCredits(id),
  getGenres: (mediaType: 'movie' | 'tv' = 'movie') => TMDBService.getGenres(mediaType),
  discoverPaged: (params: Parameters<typeof TMDBService.discoverPaged>[0]) =>
    TMDBService.discoverPaged(params),
  discover: (params: Parameters<typeof TMDBService.discoverPaged>[0]) => TMDBService.discover(params),
  discoverMovies: (params: { with_genres?: string; sort_by?: string }) =>
    TMDBService.discover({
      genreIds: params.with_genres ? params.with_genres.split(',').map((g) => parseInt(g, 10)) : undefined,
      sortBy: params.sort_by,
    }),
  getHollywoodMovies: (page: number = 1) => TMDBService.getHollywoodMovies(page),
  getHollywoodSeries: (page: number = 1) => TMDBService.getHollywoodSeries(page),
  getMarvelMovies: (page: number = 1) => TMDBService.getMarvelMovies(page),
  getMarvelSeries: (page: number = 1) => TMDBService.getMarvelSeries(page),
  getSonyMovies: (page: number = 1) => TMDBService.getSonyMovies(page),
  getSonySeries: (page: number = 1) => TMDBService.getSonySeries(page),
  getDCMovies: (page: number = 1) => TMDBService.getDCMovies(page),
  getDCSeries: (page: number = 1) => TMDBService.getDCSeries(page),
  getSciFiMovies: (page: number = 1) => TMDBService.getSciFiMovies(page),
  getCrimeThrillerSeries: (page: number = 1) => TMDBService.getCrimeThrillerSeries(page),
  getAnimeSeries: (page: number = 1) => TMDBService.getAnimeSeries(page),
  getRegionalIndianMovies: (page: number = 1) => TMDBService.getRegionalIndianMovies(page),
  getTamilMovies: (page: number = 1) => TMDBService.getTamilMovies(page),
  getTMDBImageUrl: (path?: string | null, size?: any) => TMDBService.getTMDBImageUrl(path, size),
  getImageUrl: (path?: string | null, size?: any) => TMDBService.getImageUrl(path, size),
  getPosterUrl: (path?: string | null, size?: any) => TMDBService.getPosterUrl(path, size),
  getBackdropUrl: (path?: string | null, size?: any) => TMDBService.getBackdropUrl(path, size),
  runDiagnostics: () => TMDBService.runDiagnostics(),
};
