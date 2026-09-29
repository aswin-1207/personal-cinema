import { Movie, UserMovie, MovieNight } from './movie';
import { Collection, CollectionMovie } from './collection';

export interface UserPreferences {
  displayName?: string;
  theme: 'cinematic-dark';
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  motionReduced: boolean;
  reducedMotion?: boolean;
  tmdbApiKey: string;
  backupReminderDays: number;
  lastBackupDate?: string | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string | null;
  progress: number;
  maxProgress: number;
}

export interface PersonalCinemaBackup {
  backupVersion: 1;
  appVersion: string;
  createdAt: string; // ISO string
  counts: {
    movies: number;
    userMovies: number;
    watched: number;
    favorites: number;
    collections: number;
    ratings: number;
    reviews: number;
  };
  movies: Movie[];
  userMovies: UserMovie[];
  collections: Collection[];
  collectionMovies: CollectionMovie[];
  movieNights: MovieNight[];
  preferences: UserPreferences;
  achievements: Achievement[];
}

export interface BackupValidationResult {
  isValid: boolean;
  backupVersion: number;
  createdAt: string;
  counts: {
    movies: number;
    watched: number;
    collections: number;
    ratings: number;
  };
  errors: string[];
  warnings: string[];
  backupData?: PersonalCinemaBackup;
}

export interface ConflictItem {
  movieId: number;
  movieTitle: string;
  field: 'rating' | 'status' | 'notes' | 'review';
  currentValue: any;
  backupValue: any;
  resolvedWith?: 'current' | 'backup';
}
