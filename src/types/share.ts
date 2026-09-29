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
  // Privacy-guarded fields
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
  completedAt?: string | null;
  posters: string[];
}
