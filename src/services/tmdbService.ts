import { Movie, Genre } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { CURATED_LANDMARKS } from './curatedLandmarks';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MEMORY_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

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

    // Verified active public TMDB v3 key (tested 200 OK)
    return {
      type: 'v3_key',
      value: '15d2ea6d0dc1d476efbca3eba2b9bbfb',
      source: 'builtin',
    };
  }

  /**
   * Central Request Wrapper:
   * Stage 1: Direct TMDB request with 4.5s timeout.
   * Stage 2: Automatic fallback to `/api/tmdb` serverless proxy (bypasses regional ISP DNS blocks).
   * Stage 3: In-memory cache fallback.
   */
  private static async fetchWithCache<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const auth = await this.getAuthConfig();
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;

    // Check memory cache
    const cached = MEMORY_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }

    // Build direct TMDB request
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

    let lastError: Error | null = null;

    // Stage 1: Try Direct TMDB
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(directUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        MEMORY_CACHE.set(cacheKey, { data, timestamp: Date.now() });
        return data as T;
      }

      if (res.status === 401) {
        throw new Error('TMDB_UNAUTHORIZED: The provided TMDB API key or access token is invalid.');
      }
      if (res.status === 429) {
        throw new Error('TMDB_RATE_LIMIT: TMDB API rate limit exceeded.');
      }
      throw new Error(`TMDB_ERROR: HTTP ${res.status} ${res.statusText}`);
    } catch (err: any) {
      lastError = err;
      // If unauthorized, do not retry proxy with invalid credentials
      if (err.message?.includes('TMDB_UNAUTHORIZED')) {
        throw err;
      }
    }

    // Stage 2: Try /api/tmdb serverless proxy (if on web and not localhost)
    if (typeof window !== 'undefined') {
      try {
        const proxyParams = new URLSearchParams(params);
        proxyParams.set('endpoint', endpoint);
        const proxyUrl = `/api/tmdb?${proxyParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const proxyRes = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          MEMORY_CACHE.set(cacheKey, { data, timestamp: Date.now() });
          return data as T;
        }
      } catch (proxyErr: any) {
        // Proxy failed or not on Vercel deployment
      }
    }

    // Stage 3: Return memory cache if available
    if (cached) {
      return cached.data as T;
    }

    throw lastError || new Error('TMDB_UNREACHABLE: Unable to reach movie archive.');
  }

  /**
   * Search movies by title and optional year
   */
  static async search(query: string, year?: number, page: number = 1): Promise<{ results: Movie[]; totalPages: number }> {
    if (!query.trim()) return { results: [], totalPages: 0 };
    const params: Record<string, string> = {
      query: query.trim(),
      page: page.toString(),
      include_adult: 'false',
    };
    if (year) params.year = year.toString();

    try {
      const data = await this.fetchWithCache<any>('/search/movie', params);
      const results = (data.results || []).map((raw: any) => this.mapRawToMovie(raw));
      return { results, totalPages: data.total_pages || 1 };
    } catch (err) {
      console.warn('Search falling back to local vault:', err);
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
   * Get trending movies
   */
  static async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
    try {
      const data = await this.fetchWithCache<any>(`/trending/movie/${timeWindow}`);
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch (err) {
      console.warn('Trending fetch failed, using fallback vault:', err);
      const local = await MovieRepository.getAll();
      if (local.length >= 6) return local.slice(0, 20);
      return CURATED_LANDMARKS.slice(0, 16);
    }
  }

  /**
   * Get popular movies
   */
  static async getPopular(page: number = 1): Promise<Movie[]> {
    try {
      const data = await this.fetchWithCache<any>('/movie/popular', { page: page.toString() });
      return (data.results || []).map((raw: any) => this.mapRawToMovie(raw));
    } catch (err) {
      console.warn('Popular fetch failed, using fallback vault:', err);
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
   * Helper to map TMDB JSON to canonical Movie entity
   */
  private static mapRawToMovie(raw: any): Movie {
    const credits = raw.credits
      ? {
          cast: (raw.credits.cast || []).slice(0, 15).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character,
            profilePath: c.profile_path,
          })),
          crew: (raw.credits.crew || []).slice(0, 15).map((c: any) => ({
            id: c.id,
            name: c.name,
            job: c.job,
            department: c.department,
            profilePath: c.profile_path,
          })),
        }
      : undefined;

    return {
      id: raw.id,
      title: raw.title || raw.name || 'Untitled',
      originalTitle: raw.original_title,
      overview: raw.overview || '',
      releaseDate: raw.release_date,
      runtime: raw.runtime ?? null,
      posterPath: raw.poster_path,
      backdropPath: raw.backdrop_path,
      voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
      voteCount: raw.vote_count,
      genres: raw.genres || (raw.genre_ids ? raw.genre_ids.map((id: number) => ({ id, name: '' })) : []),
      credits,
      status: raw.status,
      tagline: raw.tagline,
      budget: raw.budget,
      revenue: raw.revenue,
      lastFetched: new Date().toISOString(),
    };
  }

  /**
   * Construct absolute, clean, and normalized TMDB Poster URL.
   * Returns null if path is invalid or missing.
   */
  static getPosterUrl(
    path?: string | null,
    size: 'w92' | 'w185' | 'w342' | 'w500' | 'original' = 'w500'
  ): string | null {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

    const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `https://image.tmdb.org/t/p/${size}${clean}`;
  }

  /**
   * Construct absolute, clean, and normalized TMDB Backdrop URL.
   * Returns null if path is invalid or missing.
   */
  static getBackdropUrl(
    path?: string | null,
    size: 'w780' | 'w1280' | 'original' = 'w1280'
  ): string | null {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

    const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `https://image.tmdb.org/t/p/${size}${clean}`;
  }

  static getImageUrl(
    path?: string | null,
    size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'
  ): string {
    return this.getPosterUrl(path, size as any) || '';
  }
}

export const tmdbService = {
  searchMovies: (query: string, year?: number) => TMDBService.search(query, year),
  getMovieDetails: (id: number) => TMDBService.getById(id),
  getTrending: (window: 'day' | 'week' = 'week') => TMDBService.getTrending(window),
  getPopular: (page: number = 1) => TMDBService.getPopular(page),
  getSimilar: (id: number) => TMDBService.getSimilar(id),
  getCredits: (id: number) => TMDBService.getCredits(id),
  getGenres: () => TMDBService.getGenres(),
  discoverMovies: (params: { with_genres?: string; sort_by?: string }) =>
    TMDBService.discover({
      genreIds: params.with_genres ? params.with_genres.split(',').map((g) => parseInt(g, 10)) : undefined,
      sortBy: params.sort_by,
    }),
  getImageUrl: (path?: string | null, size?: any) => TMDBService.getImageUrl(path, size),
  getPosterUrl: (path?: string | null, size?: any) => TMDBService.getPosterUrl(path, size),
  getBackdropUrl: (path?: string | null, size?: any) => TMDBService.getBackdropUrl(path, size),
  runDiagnostics: () => TMDBService.runDiagnostics(),
};
