import { Movie, MovieStatus } from './movie';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type ImportItemStatus = 'matched' | 'ambiguous' | 'unmatched' | 'duplicate';

export interface ExtractedMovieRow {
  rawText: string;
  detectedTitle: string;
  detectedYear?: number | null;
  detectedStatus?: MovieStatus | null;
  detectedRating?: number | null;
  detectedNotes?: string | null;
}

export interface ImportCandidate {
  row: ExtractedMovieRow;
  matchedMovie?: Movie | null;
  confidence: MatchConfidence;
  status: ImportItemStatus;
  ambiguousOptions?: Movie[];
  isDuplicateInLibrary: boolean;
  isDuplicateInCollection: boolean;
  userOverrideMovie?: Movie | null;
  userSelectedOption?: 'import' | 'skip';
}

export interface ImportJobSummary {
  totalDetected: number;
  highConfidence: number;
  needsReview: number;
  unmatched: number;
  duplicates: number;
}
