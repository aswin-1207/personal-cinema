import * as XLSX from 'xlsx';
import { TMDBService } from './tmdbService';
import { MovieRepository } from '../db/repositories/movieRepository';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { ExtractedMovieRow, ImportCandidate, MatchConfidence, ImportItemStatus, ImportJobSummary } from '../types/import';
import { Movie, MovieStatus } from '../types/movie';

export class ImportService {
  /**
   * Parse uploaded file or clipboard text into raw movie rows
   */
  static async parseFile(file: File): Promise<ExtractedMovieRow[]> {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      return this.parseSpreadsheetRows(json);
    } else if (extension === 'json') {
      const text = await file.text();
      return this.parseJsonText(text);
    } else {
      // Plain text, txt, notes, etc.
      const text = await file.text();
      return this.parsePlainText(text);
    }
  }

  static parseClipboardText(text: string): ExtractedMovieRow[] {
    return this.parsePlainText(text);
  }

  /**
   * Clean titles and extract potential year from parentheses/brackets
   * e.g. "01. Interstellar (2014) - Watched" -> title: "Interstellar", year: 2014, status: "watched"
   */
  static cleanMovieTitle(raw: string): { title: string; year?: number | null; status?: MovieStatus | null } {
    let text = raw.trim();
    if (!text) return { title: '' };

    // Strip leading list numbering like "1.", "01 -", "#1"
    text = text.replace(/^(\d+[\.\-\)]\s*|#\d+\s*)/i, '').trim();

    // Check for status keywords
    let status: MovieStatus | null = null;
    if (/\b(watched|seen|completed|finished)\b/i.test(text)) {
      status = 'watched';
      text = text.replace(/\b(watched|seen|completed|finished)\b/gi, '').trim();
    } else if (/\b(watching|current|in progress)\b/i.test(text)) {
      status = 'watching';
      text = text.replace(/\b(watching|current|in progress)\b/gi, '').trim();
    } else if (/\b(watchlist|want to watch|to watch|plan to watch)\b/i.test(text)) {
      status = 'want_to_watch';
      text = text.replace(/\b(watchlist|want to watch|to watch|plan to watch)\b/gi, '').trim();
    }

    // Extract year like (2014) or [2014] or - 2014
    let year: number | null = null;
    const yearMatch = text.match(/[\(\[\-\s]+(19\d\d|20\d\d)[\)\]\s]*/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      text = text.replace(yearMatch[0], ' ').trim();
    }

    // Strip dangling punctuation like "-", ":", trailing brackets
    text = text.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

    return { title: text, year, status };
  }

  private static parseSpreadsheetRows(grid: any[][]): ExtractedMovieRow[] {
    if (!grid || grid.length === 0) return [];

    // Detect header row if present
    const headerRow = grid[0].map((c) => String(c || '').toLowerCase().trim());
    let titleCol = -1;
    let yearCol = -1;
    let statusCol = -1;
    let ratingCol = -1;
    let notesCol = -1;

    headerRow.forEach((colName, idx) => {
      if (/title|movie|film|name/i.test(colName) && titleCol === -1) titleCol = idx;
      else if (/year|release/i.test(colName)) yearCol = idx;
      else if (/status|watched|seen/i.test(colName)) statusCol = idx;
      else if (/rating|score|stars/i.test(colName)) ratingCol = idx;
      else if (/note|review|comment/i.test(colName)) notesCol = idx;
    });

    const hasHeader = titleCol !== -1;
    const startRow = hasHeader ? 1 : 0;
    if (!hasHeader) titleCol = 0; // Default to first column

    const results: ExtractedMovieRow[] = [];

    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r];
      if (!row || !row[titleCol]) continue;

      const rawTitle = String(row[titleCol]).trim();
      if (!rawTitle) continue;

      const cleaned = this.cleanMovieTitle(rawTitle);
      const year = yearCol !== -1 && row[yearCol] ? parseInt(String(row[yearCol]), 10) : cleaned.year;
      
      let status: MovieStatus | null = cleaned.status ?? null;
      if (statusCol !== -1 && row[statusCol]) {
        const val = String(row[statusCol]).toLowerCase();
        if (/yes|watched|seen|1|true/i.test(val)) status = 'watched';
        else if (/watching/i.test(val)) status = 'watching';
        else status = 'want_to_watch';
      }

      let rating: number | null = null;
      if (ratingCol !== -1 && row[ratingCol]) {
        const parsedRating = parseFloat(String(row[ratingCol]));
        if (!isNaN(parsedRating) && parsedRating > 0) {
          // Normalize 1-10 to 1-5 if needed
          rating = parsedRating > 5 ? parsedRating / 2 : parsedRating;
        }
      }

      const notes = notesCol !== -1 && row[notesCol] ? String(row[notesCol]).trim() : null;

      results.push({
        rawText: rawTitle,
        detectedTitle: cleaned.title,
        detectedYear: year,
        detectedStatus: status,
        detectedRating: rating,
        detectedNotes: notes,
      });
    }

    return results;
  }

  private static parseJsonText(text: string): ExtractedMovieRow[] {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.movies || [];
      return list.map((item: any) => {
        if (typeof item === 'string') {
          const cleaned = this.cleanMovieTitle(item);
          return {
            rawText: item,
            detectedTitle: cleaned.title,
            detectedYear: cleaned.year,
            detectedStatus: cleaned.status,
          };
        }
        const cleaned = this.cleanMovieTitle(item.title || item.name || '');
        return {
          rawText: item.title || item.name || '',
          detectedTitle: cleaned.title,
          detectedYear: item.year || cleaned.year,
          detectedStatus: item.status || cleaned.status,
          detectedRating: item.rating || item.personalRating,
          detectedNotes: item.notes || item.review,
        };
      });
    } catch {
      return this.parsePlainText(text);
    }
  }

  private static parsePlainText(text: string): ExtractedMovieRow[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line) => {
      const cleaned = this.cleanMovieTitle(line);
      return {
        rawText: line,
        detectedTitle: cleaned.title,
        detectedYear: cleaned.year,
        detectedStatus: cleaned.status,
      };
    });
  }

  /**
   * Staged TMDB Matching Pipeline with controlled concurrency and duplicate detection
   */
  static async matchWithTMDB(
    rows: ExtractedMovieRow[],
    targetCollectionId?: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<ImportCandidate[]> {
    const existingUserMovies = await UserMovieRepository.getAll();
    const libraryMovieIdSet = new Set(existingUserMovies.map((um) => um.movieId));

    const collectionMovieIdSet = new Set<number>();
    if (targetCollectionId) {
      const colMovies = await CollectionRepository.getCollectionMovies(targetCollectionId);
      colMovies.forEach((cm) => collectionMovieIdSet.add(cm.movieId));
    }

    const seenTmdbIdsInBatch = new Set<number>();
    const candidates: ImportCandidate[] = [];

    // Controlled batch processing (chunks of 3 to avoid TMDB rate limits)
    const BATCH_SIZE = 3;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (row) => {
          if (!row.detectedTitle) {
            candidates.push({
              row,
              confidence: 'none',
              status: 'unmatched',
              isDuplicateInLibrary: false,
              isDuplicateInCollection: false,
            });
            return;
          }

          try {
            const { results } = await TMDBService.search(row.detectedTitle, row.detectedYear || undefined);

            if (results.length === 0) {
              candidates.push({
                row,
                confidence: 'none',
                status: 'unmatched',
                isDuplicateInLibrary: false,
                isDuplicateInCollection: false,
              });
              return;
            }

            const top = results[0];
            const normQuery = row.detectedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normTop = top.title.toLowerCase().replace(/[^a-z0-9]/g, '');

            let confidence: MatchConfidence = 'low';
            let status: ImportItemStatus = 'matched';

            const queryYear = row.detectedYear;
            const topYear = top.releaseDate ? parseInt(top.releaseDate.substring(0, 4), 10) : null;

            if (normQuery === normTop && (!queryYear || queryYear === topYear)) {
              confidence = 'high';
            } else if (normQuery === normTop || results.length === 1) {
              confidence = 'medium';
            }

            // Ambiguity check: e.g. "The Batman" (2004) vs "The Batman" (2022)
            const closeMatches = results.filter((m) => {
              const mNorm = m.title.toLowerCase().replace(/[^a-z0-9]/g, '');
              return mNorm === normQuery;
            });

            if (closeMatches.length > 1 && !queryYear) {
              confidence = 'medium';
              status = 'ambiguous';
            }

            // Duplicate detection
            const isDuplicateInLibrary = libraryMovieIdSet.has(top.id);
            const isDuplicateInCollection = collectionMovieIdSet.has(top.id);
            const isDuplicateInBatch = seenTmdbIdsInBatch.has(top.id);

            if (isDuplicateInBatch) {
              status = 'duplicate';
            } else {
              seenTmdbIdsInBatch.add(top.id);
            }

            candidates.push({
              row,
              matchedMovie: top,
              confidence,
              status,
              ambiguousOptions: closeMatches.length > 1 ? closeMatches.slice(0, 4) : undefined,
              isDuplicateInLibrary,
              isDuplicateInCollection,
            });
          } catch {
            candidates.push({
              row,
              confidence: 'none',
              status: 'unmatched',
              isDuplicateInLibrary: false,
              isDuplicateInCollection: false,
            });
          }
        })
      );

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, rows.length), rows.length);
      }
    }

    return candidates;
  }

  static getSummary(candidates: ImportCandidate[]): ImportJobSummary {
    return {
      totalDetected: candidates.length,
      highConfidence: candidates.filter((c) => c.confidence === 'high' && c.status === 'matched').length,
      needsReview: candidates.filter((c) => c.status === 'ambiguous' || (c.confidence === 'medium' && c.status === 'matched')).length,
      unmatched: candidates.filter((c) => c.status === 'unmatched').length,
      duplicates: candidates.filter((c) => c.status === 'duplicate').length,
    };
  }

  /**
   * Final commit: persists movies, user status, and collection relationships
   */
  static async commitImport(
    candidates: ImportCandidate[],
    options: {
      collectionId?: string;
      importWatchedStatus?: boolean;
      importRatings?: boolean;
      importNotes?: boolean;
    }
  ): Promise<{ importedCount: number; collectionCount: number }> {
    const moviesToSave: Movie[] = [];
    const movieIdsForCollection: number[] = [];
    let importedCount = 0;

    for (const candidate of candidates) {
      if (candidate.userSelectedOption === 'skip' || candidate.status === 'duplicate') continue;

      const chosenMovie = candidate.userOverrideMovie || candidate.matchedMovie;
      if (!chosenMovie) continue;

      moviesToSave.push(chosenMovie);
      movieIdsForCollection.push(chosenMovie.id);
      importedCount++;

      // Check user preferences on status, rating, notes
      const statusToApply: MovieStatus =
        options.importWatchedStatus && candidate.row.detectedStatus
          ? candidate.row.detectedStatus
          : 'want_to_watch';

      const ratingToApply =
        options.importRatings && typeof candidate.row.detectedRating === 'number'
          ? candidate.row.detectedRating
          : null;

      const notesToApply =
        options.importNotes && candidate.row.detectedNotes ? candidate.row.detectedNotes : undefined;

      const existingUserMovie = await UserMovieRepository.getByMovieId(chosenMovie.id);
      if (statusToApply === 'watched') {
        await UserMovieRepository.markWatched(chosenMovie.id, {
          rating: ratingToApply || existingUserMovie?.personalRating,
          notes: notesToApply || existingUserMovie?.notes,
        });
      } else if (!existingUserMovie) {
        await UserMovieRepository.addToWatchlist(chosenMovie.id);
        if (notesToApply || ratingToApply) {
          await UserMovieRepository.setReviewAndNotes(chosenMovie.id, { notes: notesToApply });
        }
      }
    }

    // Batch save movies to DB
    await MovieRepository.saveMany(moviesToSave);

    // If target collection, add movies in source order
    let collectionCount = 0;
    if (options.collectionId && movieIdsForCollection.length > 0) {
      await CollectionRepository.addMoviesToCollection(options.collectionId, movieIdsForCollection);
      collectionCount = movieIdsForCollection.length;
    }

    return { importedCount, collectionCount };
  }
}
