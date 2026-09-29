import { Movie, Genre } from '../types/movie';
import { MovieRepository } from '../db/repositories/movieRepository';
import { PreferencesRepository } from '../db/repositories/preferencesRepository';
import { CURATED_LANDMARKS } from './curatedLandmarks';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MEMORY_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export class TMDBService {
  private static async getApiKey(): Promise<string> {
    const prefs = await PreferencesRepository.getPreferences();
    return prefs.tmdbApiKey || 'b8b7e2d9b936e7ec548679d98bc19d3e';
  }

  private static async fetchWithCache<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = await this.getApiKey();
    const query = new URLSearchParams({ api_key: apiKey, ...params }).toString();
    const url = `${TMDB_BASE_URL}${endpoint}?${query}`;

    // Check memory cache
    const cached = MEMORY_CACHE.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`TMDB error (${res.status}): ${res.statusText}`);
      }
      const data = await res.json();
      MEMORY_CACHE.set(url, { data, timestamp: Date.now() });
      return data as T;
    } catch (err) {
      // If offline, DNS blocked, or network error, check if we have older cached data
      if (cached) {
        return cached.data as T;
      }
      throw err;
    }
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
      console.warn('Search failed or offline, checking local archive & landmarks:', err);
      // Fallback: search local IndexedDB movies + curated landmarks
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
    // Check if we already have it in local DB
    const local = await MovieRepository.getById(tmdbId);
    if (local && local.overview && local.credits) {
      return local;
    }

    try {
      const data = await this.fetchWithCache<any>(`/movie/${tmdbId}`, {
        append_to_response: 'credits',
      });
      const movie = this.mapRawToMovie(data);
      // Save/cache to local DB
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
      console.warn('Trending fetch failed or offline, using curated vault:', err);
      const local = await MovieRepository.getAll();
      if (local.length > 5) return local.slice(0, 20);
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
      console.warn('Popular fetch failed or offline, using curated vault:', err);
      const local = await MovieRepository.getAll();
      if (local.length > 5) return local.slice(0, 20);
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

  static getPosterUrl(path?: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'original' = 'w500'): string {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  static getBackdropUrl(path?: string | null, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  static getImageUrl(path?: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
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
};
