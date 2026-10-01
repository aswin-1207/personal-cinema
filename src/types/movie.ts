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

export interface Movie {
  id: number; // TMDB ID
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  overview?: string;
  releaseDate?: string;
  runtime?: number | null; // minutes
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage: number;
  voteCount?: number;
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

export type MovieStatus = 'want_to_watch' | 'watching' | 'watched';

export interface UserMovie {
  movieId: number; // Foreign key to Movie.id
  status: MovieStatus;
  personalRating?: number | null; // 0.5 to 5.0 (half star steps)
  notes?: string;
  review?: string;
  isFavorite: boolean;
  addedAt: string; // ISO string
  watchedAt?: string | null; // ISO string
  scheduledAt?: string | null; // ISO string
  rewatchCount: number;
}

export interface MovieWithUserData {
  movie: Movie;
  userData?: UserMovie;
}

export interface MovieNight {
  id: string; // UUID
  movieId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  reminderMinutes: number; // e.g. 30
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}
