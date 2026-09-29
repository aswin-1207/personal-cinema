// Custom Cinematic Collection Types

export type CollectionCoverType = 'collage' | 'hero' | 'custom';
export type CollectionSortMode = 'custom' | 'releaseDate' | 'title' | 'rating' | 'watchedStatus';

export interface Collection {
  id: string; // UUID
  name: string;
  description?: string;
  coverType: CollectionCoverType;
  customCoverMovieId?: number | null;
  sortMode: CollectionSortMode;
  customOrder: number[]; // Array of movie IDs in user order
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  completedAt?: string | null; // ISO string when 100% completed
}

export interface CollectionMovie {
  id: string; // `${collectionId}_${movieId}`
  collectionId: string;
  movieId: number;
  position: number;
  addedAt: string; // ISO string
}

export interface CollectionProgress {
  total: number;
  watched: number;
  watching: number;
  unwatched: number;
  percent: number;
  isComplete: boolean;
}

export interface CollectionWithMovies {
  collection: Collection;
  movies: Array<{
    movie: import('./movie').Movie;
    userData?: import('./movie').UserMovie;
    position: number;
  }>;
  progress: CollectionProgress;
}
