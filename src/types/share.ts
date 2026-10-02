export type ShareCardStyle = 'poster' | 'cinema' | 'minimal';

export interface MovieSharePayload {
  movieId: number;
  title: string;
  year?: string;
  runtime?: string;
  genres: string[];
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbRating: number;
  // Privacy-guarded optional fields
  status?: string | null;
  rating?: number | null;
  review?: string | null;
}

export interface CollectionSharePayload {
  collectionId: string;
  name: string;
  description?: string;
  totalMovies: number;
  watchedMovies: number;
  completionPercent: number;
  isComplete: boolean;
  completedAt?: string | null;
  finalMovieId?: number | null;
  finalMovieTitle?: string | null;
  posters: string[];
}

export type ShareActionOutcome = 'shared' | 'copied' | 'cancelled' | 'downloaded' | 'failed';

export interface ShareResult {
  outcome: ShareActionOutcome;
  method?: 'native' | 'file' | 'clipboard' | 'download' | 'fallback';
  error?: string;
}
