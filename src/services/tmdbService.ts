import { Movie, Genre } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { getDB, TMDBCacheEntry } from '../db/database';
import { CURATED_LANDMARKS } from './curatedLandmarks';

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
    if (userKey) {
      const type = userKey.startsWith('ey') && userKey.length > 50 ? 'bearer_token' : 'v3_key';
      return { type, value: userKey, source: 'user_override' };
    }

    const envKey = (
      (import.meta as any).env?.VITE_TMDB_API_KEY ||
      (import.meta as any).env?.VITE_TMDB_ACCESS_TOKEN ||
      (import.meta as any).env?.VITE_TMDB_READ_TOKEN ||
      ''
    ).trim();

    if (envKey) {
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
    if (endpoint.startsWith('/movie/')) return TTL_MAP.details;
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

  private static directTMDBFailed = false;

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

    // Fast-path: On Vercel / production or if direct TMDB has previously encountered an ISP block/DNS hang,
    // hit the /api/tmdb proxy immediately without wasting seconds on a dead DNS connection.
    const isVercelOrProduction = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.protocol === 'https:'
    );

    if ((isVercelOrProduction || this.directTMDBFailed) && typeof window !== 'undefined') {
      try {
        const proxyParams = new URLSearchParams(params);
        proxyParams.set('endpoint', endpoint);
        const proxyUrl = `/api/tmdb?${proxyParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const proxyHeaders: Record<string, string> = { Accept: 'application/json' };
        if (auth.value) proxyHeaders['Authorization'] = `Bearer ${auth.value}`;

        const proxyRes = await fetch(proxyUrl, { headers: proxyHeaders, signal: controller.signal });
        clearTimeout(timeoutId);

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return data as T;
        }
      } catch {
        // Fall back to attempting direct fetch below
      }
    }

    // Attempt direct TMDB with controlled retries (Section 15)
    let maxAttempts = this.directTMDBFailed ? 1 : 2;
    let attempt = 0;
    let lastError: TMDBError | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      if (signal?.aborted) {
        throw new TMDBError('Request aborted', 'NETWORK_ERROR');
      }

      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 2500);

        // Combine caller signal and timeout signal
        const onAbort = () => timeoutController.abort();
        if (signal) signal.addEventListener('abort', onAbort);

        const res = await fetch(directUrl, { headers, signal: timeoutController.signal });
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (res.ok) {
          this.directTMDBFailed = false; // Direct connection verified working
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
        this.directTMDBFailed = true; // Mark direct route failed to activate proxy
        lastError =
          err instanceof TMDBError
            ? err
            : new TMDBError(err?.message || 'Network request failed', 'NETWORK_ERROR');

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
      }
    }

    // Stage 2: Fallback to /api/tmdb serverless proxy (bypasses regional ISP blocks)
    if (typeof window !== 'undefined') {
      try {
        const proxyParams = new URLSearchParams(params);
        proxyParams.set('endpoint', endpoint);
        const proxyUrl = `/api/tmdb?${proxyParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const proxyHeaders: Record<string, string> = { Accept: 'application/json' };
        if (auth.value) proxyHeaders['Authorization'] = `Bearer ${auth.value}`;

        const proxyRes = await fetch(proxyUrl, { headers: proxyHeaders, signal: controller.signal });
        clearTimeout(timeoutId);

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return data as T;
        }
      } catch {
        // Fallback failed
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

    try {
      const data = await this.fetchWithCache<any>('/search/movie', params, { signal });
      const rawResults = data.results || [];
      const results = rawResults.map((raw: any) => this.mapRawToMovie(raw));
      return { results, totalPages: data.total_pages || 1 };
    } catch (err: any) {
      if (err instanceof TMDBError && err.code === 'NETWORK_ERROR' && err.message.includes('aborted')) {
        throw err;
      }
      // Check local vault if offline
      const allLocal = await MovieRepository.getAll();
      const lower = query.toLowerCase();
      const localMatches = allLocal.filter((m) => m.title.toLowerCase().includes(lower));
      const landmarkMatches = CURATED_LANDMARKS.filter((m) => m.title.toLowerCase().includes(lower));

      const mergedMap = new Map<number, Movie>();
      localMatches.forEach((m) => mergedMap.set(m.id, m));
      landmarkMatches.forEach((m) => {
        if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
      });

      return { results: Array.from(mergedMap.values()), totalPages: 1 };
    }
  }

  /**
   * Get full movie details with credits
   */
  static async getDetails(tmdbId: number): Promise<Movie> {
    const local = await MovieRepository.getById(tmdbId);
    if (local && local.overview && local.credits) {
      return local;
    }

    try {
      const data = await this.fetchWithCache<any>(`/movie/${tmdbId}`, {
        append_to_response: 'credits',
      });
      const movie = this.mapRawToMovie(data);
      await MovieRepository.save(movie);
      return movie;
    } catch (err) {
      if (local) return local;
      const landmark = CURATED_LANDMARKS.find((m) => m.id === tmdbId);
      if (landmark) return landmark;
      throw err;
    }
  }

  static async getById(tmdbId: number): Promise<Movie> {
    return this.getDetails(tmdbId);
  }

  static async getSimilar(tmdbId: number): Promise<Movie[]> {
    try {
      const data = await this.fetchWithCache<any>(`/movie/${tmdbId}/similar`);
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch {
      return CURATED_LANDMARKS.filter((m) => m.id !== tmdbId).slice(0, 8);
    }
  }

  static async getCredits(tmdbId: number): Promise<{ cast: any[]; crew: any[]; director?: string }> {
    try {
      const data = await this.fetchWithCache<any>(`/movie/${tmdbId}/credits`);
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
   * Get trending movies with SWR support
   */
  static async getTrending(
    timeWindow: 'day' | 'week' = 'week',
    onRevalidate?: (movies: Movie[]) => void
  ): Promise<Movie[]> {
    try {
      const res = await this.fetchWithSWR<any>(
        `/trending/movie/${timeWindow}`,
        {},
        onRevalidate ? (fresh) => onRevalidate((fresh.results || []).map((r: any) => this.mapRawToMovie(r))) : undefined
      );
      return (res.data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch (err: any) {
      const local = await MovieRepository.getAll();
      if (local.length >= 6) return local.slice(0, 20);
      return CURATED_LANDMARKS.slice(0, 16);
    }
  }

  /**
   * Get popular movies with SWR support
   */
  static async getPopular(page: number = 1, onRevalidate?: (movies: Movie[]) => void): Promise<Movie[]> {
    try {
      const res = await this.fetchWithSWR<any>(
        '/movie/popular',
        { page: page.toString() },
        onRevalidate ? (fresh) => onRevalidate((fresh.results || []).map((r: any) => this.mapRawToMovie(r))) : undefined
      );
      return (res.data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch (err: any) {
      const local = await MovieRepository.getAll();
      if (local.length >= 6) return local.slice(0, 20);
      return CURATED_LANDMARKS.slice(8, 24);
    }
  }

  /**
   * Get genre list
   */
  static async getGenres(): Promise<Genre[]> {
    try {
      const data = await this.fetchWithCache<any>('/genre/movie/list');
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
   * Discover movies by genre IDs or mood
   */
  static async discover(params: { genreIds?: number[]; sortBy?: string; page?: number }): Promise<Movie[]> {
    const queryParams: Record<string, string> = {
      page: (params.page || 1).toString(),
      sort_by: params.sortBy || 'popularity.desc',
      include_adult: 'false',
    };
    if (params.genreIds && params.genreIds.length > 0) {
      queryParams.with_genres = params.genreIds.join(',');
    }

    try {
      const data = await this.fetchWithCache<any>('/discover/movie', queryParams);
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch {
      if (params.genreIds && params.genreIds.length > 0) {
        const targetIds = new Set(params.genreIds);
        const matches = CURATED_LANDMARKS.filter((m) =>
          m.genres.some((g) => targetIds.has(g.id))
        );
        return matches.length > 0 ? matches : CURATED_LANDMARKS.slice(0, 8);
      }
      return CURATED_LANDMARKS.slice(0, 10);
    }
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
   * Canonical Movie Model Mapper (Section 5)
   */
  private static mapRawToMovie(raw: any): Movie {
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

    return {
      id: raw.id,
      title: raw.title || raw.name || 'Untitled',
      originalTitle: raw.original_title || undefined,
      overview: raw.overview || '',
      releaseDate: raw.release_date || undefined,
      runtime: typeof raw.runtime === 'number' ? raw.runtime : null,
      posterPath: raw.poster_path || null,
      backdropPath: raw.backdrop_path || null,
      voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
      voteCount: typeof raw.vote_count === 'number' ? raw.vote_count : 0,
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
  getMovieDetails: (id: number) => TMDBService.getById(id),
  getTrending: (window: 'day' | 'week' = 'week', onRevalidate?: (movies: Movie[]) => void) =>
    TMDBService.getTrending(window, onRevalidate),
  getPopular: (page: number = 1, onRevalidate?: (movies: Movie[]) => void) =>
    TMDBService.getPopular(page, onRevalidate),
  getSimilar: (id: number) => TMDBService.getSimilar(id),
  getCredits: (id: number) => TMDBService.getCredits(id),
  getGenres: () => TMDBService.getGenres(),
  discoverMovies: (params: { with_genres?: string; sort_by?: string }) =>
    TMDBService.discover({
      genreIds: params.with_genres ? params.with_genres.split(',').map((g) => parseInt(g, 10)) : undefined,
      sortBy: params.sort_by,
    }),
  getTMDBImageUrl: (path?: string | null, size?: any) => TMDBService.getTMDBImageUrl(path, size),
  getImageUrl: (path?: string | null, size?: any) => TMDBService.getImageUrl(path, size),
  getPosterUrl: (path?: string | null, size?: any) => TMDBService.getPosterUrl(path, size),
  getBackdropUrl: (path?: string | null, size?: any) => TMDBService.getBackdropUrl(path, size),
  runDiagnostics: () => TMDBService.runDiagnostics(),
};
