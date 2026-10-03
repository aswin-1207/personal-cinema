import { Movie, MovieStatus } from './movie';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type ImportItemStatus = 'matched' | 'ambiguous' | 'unmatched' | 'duplicate';

export type CanonicalField =
  | 'title'
  | 'year'
  | 'status'
  | 'rating'
  | 'notes'
  | 'watchedDate'
  | 'favorite'
  | 'mediaType'
  | 'ignore';

export interface ColumnMapping {
  columnIndex: number;
  headerName: string;
  mappedField: CanonicalField;
  sampleValues: string[];
}

export interface WorkbookSheetInfo {
  name: string;
  rowCount: number;
  previewRows: string[][];
}

export interface ExtractedMovieRow {
  rawText: string;
  detectedTitle: string;
  cleanTitle?: string;
  searchNormalizedTitle?: string;
  detectedYear?: number | null;
  detectedMediaType?: 'movie' | 'tv' | null;
  detectedStatus?: MovieStatus | null;
  detectedRating?: number | null;
  detectedNotes?: string | null;
  detectedWatchedDate?: string | null;
  detectedFavorite?: boolean;
}

export interface ImportCandidate {
  id?: string;
  row: ExtractedMovieRow;
  matchedMovie?: Movie | null;
  confidence: MatchConfidence;
  status: ImportItemStatus;
  ambiguousOptions?: Movie[];
  isDuplicateInLibrary: boolean;
  isDuplicateInCollection: boolean;
  isDuplicateInBatch?: boolean;
  userOverrideMovie?: Movie | null;
  userSelectedOption?: 'import' | 'skip';
}

export interface ImportJobSummary {
  totalDetected: number;
  highConfidence: number;
  needsReview: number;
  unmatched: number;
  duplicates: number;
  skipped?: number;
}

export type ImportProgressStage =
  | 'idle'
  | 'reading'
  | 'selecting_sheet'
  | 'mapping_columns'
  | 'matching'
  | 'review'
  | 'committing'
  | 'complete'
  | 'error';

