// Canonical Movie & UserMovie Types for Personal Cinema

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profilePath?: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profilePath?: string | null;
}

export interface MovieCredits {
  cast: CastMember[];
  crew: CrewMember[];
}

export type MediaType = 'movie' | 'tv';

export const TV_ID_OFFSET = 10_000_000;

export function toCanonicalId(mediaType: MediaType, tmdbId: number): number {
  return mediaType === 'tv' ? TV_ID_OFFSET + tmdbId : tmdbId;
}

export function parseCanonicalId(id: number): { mediaType: MediaType; tmdbId: number } {
  if (id >= TV_ID_OFFSET) {
    return { mediaType: 'tv', tmdbId: id - TV_ID_OFFSET };
  }
  return { mediaType: 'movie', tmdbId: id };
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath?: string | null;
  originCountry?: string;
}

export interface Network {
  id: number;
  name: string;
  logoPath?: string | null;
  originCountry?: string;
}

export interface Movie {
  id: number; // Canonical internal integer ID for DB storage & relations (toCanonicalId)
  tmdbId?: number; // Raw TMDB ID
  mediaType?: MediaType; // 'movie' | 'tv' (defaults to 'movie' for legacy records)
  title: string; // Movie title or TV series name
  name?: string; // TV series name alias
  originalTitle?: string;
  originalName?: string;
  originalLanguage?: string;
  overview?: string;
  releaseDate?: string; // YYYY-MM-DD
  firstAirDate?: string; // YYYY-MM-DD (for TV)
  runtime?: number | null; // minutes (for movies)
  numberOfSeasons?: number; // For TV series
  numberOfEpisodes?: number; // For TV series
  networks?: Network[]; // For TV series
  createdByName?: string; // For TV series creator
  productionCompanies?: ProductionCompany[];
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage: number;
  voteCount?: number;
  popularity?: number;
  genres: Genre[];
  credits?: MovieCredits;
  status?: string;
  tagline?: string;
  budget?: number;
  revenue?: number;
  lastFetched: string; // ISO string
  source?: 'seed' | 'tmdb' | 'user' | 'import';
  seedCategory?: string;
  franchiseTags?: string[];
}

export type MovieStatus = 'want_to_watch' | 'watching' | 'watched' | 'none';

export interface UserMovie {
  movieId: number; // Foreign key to Movie.id
  status: MovieStatus;
  personalRating?: number | null; // 0.5 to 5.0 (half star steps)
  notes?: string;
  review?: string;
  reviewTitle?: string;
  reviewedAt?: string | null; // ISO string
  hasSpoilers?: boolean;
  isFavorite: boolean;
  addedAt: string; // ISO string
  watchedAt?: string | null; // ISO string
  watchingAt?: string | null; // ISO string
  scheduledAt?: string | null; // ISO string
  rewatchCount: number;
}

export interface MovieWithUserData {
  movie: Movie;
  userData?: UserMovie;
}
