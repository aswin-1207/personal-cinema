import { TMDBService } from './tmdbService';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { UnifiedSearchService } from './unifiedSearchService';
import { getDB } from '../db/database';
import {
  ExtractedMovieRow,
  ImportCandidate,
  MatchConfidence,
  ImportItemStatus,
  ImportJobSummary,
  ColumnMapping,
  CanonicalField,
  WorkbookSheetInfo,
} from '../types/import';
import { Movie, MovieStatus, UserMovie } from '../types/movie';
import { CollectionMovie } from '../types/collection';

export class ImportService {
  /**
   * RFC-4180 Compliant CSV Parser
   * Robust against quoted commas, escaped quotes (""), CRLF/LF/CR, UTF-8 BOM, and delimiter detection.
   */
  static parseCSV(text: string): string[][] {
    if (!text) return [];

    // Strip UTF-8 BOM if present
    let raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    // Detect delimiter by inspecting first few lines outside quotes
    const delimiter = this.detectDelimiter(raw);

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    const len = raw.length;

    while (i < len) {
      const char = raw[i];

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote ("")
          if (i + 1 < len && raw[i + 1] === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            // End of quoted block
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === delimiter) {
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        } else if (char === '\r') {
          // Check CRLF
          if (i + 1 < len && raw[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentField.trim());
          currentField = '';
          if (currentRow.some((cell) => cell.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          currentField = '';
          if (currentRow.some((cell) => cell.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    // Push trailing field & row if non-empty
    if (currentField.length > 0 || inQuotes) {
      currentRow.push(currentField.trim());
    }
    if (currentRow.length > 0 && currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Autodetect delimiter (, vs ; vs \t)
   */
  private static detectDelimiter(sample: string): string {
    const lines = sample.split(/\r?\n/).slice(0, 5).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return ',';

    const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
    for (const line of lines) {
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQ = !inQ;
        else if (!inQ && counts[c] !== undefined) {
          counts[c]++;
        }
      }
    }

    if (counts[';'] > counts[','] && counts[';'] > counts['\t']) return ';';
    if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
    return ',';
  }

  /**
   * Inspect sheets in an XLSX file without parsing the whole file into memory
   */
  static async getWorkbookSheets(file: File): Promise<WorkbookSheetInfo[]> {
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    return workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const stringGrid = grid.map((row) => row.map((cell) => String(cell ?? '').trim()));
      const previewRows = stringGrid.slice(0, 4);

      return {
        name,
        rowCount: Math.max(0, stringGrid.length - 1),
        previewRows,
      };
    });
  }

  /**
   * Parse a specific sheet from an XLSX file
   */
  static async parseWorkbookSheet(file: File, sheetName?: string): Promise<string[][]> {
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const targetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetName];
    if (!sheet) return [];

    const rawGrid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    return rawGrid.map((row) => row.map((c) => String(c ?? '').trim()));
  }

  /**
   * Parse uploaded file into raw movie rows
   */
  static async parseFile(file: File, selectedSheet?: string): Promise<ExtractedMovieRow[]> {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (extension === 'xlsx' || extension === 'xls') {
      const grid = await this.parseWorkbookSheet(file, selectedSheet);
      return this.parseSpreadsheetRows(grid);
    } else if (extension === 'csv') {
      const text = await file.text();
      const grid = this.parseCSV(text);
      return this.parseSpreadsheetRows(grid);
    } else if (extension === 'json') {
      const text = await file.text();
      return this.parseJsonText(text);
    } else {
      // Plain text notes (.txt)
      const text = await file.text();
      return this.parsePlainText(text);
    }
  }

  static parseClipboardText(text: string): ExtractedMovieRow[] {
    return this.parsePlainText(text);
  }

  /**
   * Clean titles and extract potential year from parentheses/brackets
   * Preserves legitimate hyphens in titles (e.g. "Spider-Man", "Mission: Impossible - Fallout")
   */
  static cleanMovieTitle(raw: string): {
    cleanTitle: string;
    searchNormalizedTitle: string;
    year?: number | null;
    status?: MovieStatus | null;
    rating?: number | null;
    watchedDate?: string | null;
    favorite?: boolean;
    notes?: string | null;
  } {
    let text = raw.trim();
    if (!text) return { cleanTitle: '', searchNormalizedTitle: '' };

    // Strip leading list numbering (e.g. "1.", "01 -", "#1", "[1]")
    text = text.replace(/^(\d+\s*[\.\-\)]\s*|#\d+\s*|\[\d+\]\s*)/i, '').trim();

    // Strip bullet markers (•, *, -, +, ▪, ▫, ◦, etc.)
    text = text.replace(/^[\u2022\u25E6\u25AA\u25AB\*\+\-]\s+/, '').trim();

    // Strip markdown checklist items (- [ ], - [x], * [x])
    text = text.replace(/^\[[ xX]?\]\s*/, '').trim();

    // Check for favorite flag (★, heart, [favorite], [fav])
    let favorite = false;
    if (/[\u2605\u2764]|\[(fav|favorite|starred)\]/i.test(text)) {
      favorite = true;
      text = text.replace(/[\u2605\u2764]|\[(fav|favorite|starred)\]/gi, '').trim();
    }

    // Check for rating patterns like "[9/10]", "(4.5/5)", "[Rating: 4.5]", "★ 8.5"
    let rating: number | null = null;
    const ratingMatch = text.match(/\[?(?:rating:\s*|score:\s*)?(\d+(?:\.\d+)?)\s*\/\s*(5|10)\]?/i);
    if (ratingMatch) {
      const num = parseFloat(ratingMatch[1]);
      const base = parseInt(ratingMatch[2], 10);
      rating = base === 10 ? num / 2 : num;
      text = text.replace(ratingMatch[0], ' ').trim();
    }

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

    // Extract year: (2014) or [2014] or - 2014
    let year: number | null = null;
    const yearMatch = text.match(/[\(\[]\s*(19\d\d|20\d\d)\s*[\)\]]/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      text = text.replace(yearMatch[0], ' ').trim();
    } else {
      // Hyphenated trailing year: e.g. "Kaithi - 2019"
      const trailingYearMatch = text.match(/[-–—]\s*(19\d\d|20\d\d)\s*$/);
      if (trailingYearMatch) {
        year = parseInt(trailingYearMatch[1], 10);
        text = text.replace(trailingYearMatch[0], ' ').trim();
      }
    }

    // Strip dangling trailing delimiters (colon, hyphen) without stripping internal hyphens (like "Spider-Man")
    text = text.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

    // Build search normalized title
    const searchNormalized = UnifiedSearchService.normalize(text);

    return {
      cleanTitle: text,
      searchNormalizedTitle: searchNormalized,
      year,
      status,
      rating,
      favorite,
    };
  }

  /**
   * Heuristic Column Detection
   */
  static detectColumnMappings(headerRow: string[], sampleRows: string[][] = []): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];

    headerRow.forEach((colName, idx) => {
      const lower = colName.toLowerCase().trim();
      let field: CanonicalField = 'ignore';

      if (/^(movie(\s*title|\s*name)?|film(\s*title|\s*name)?|title|name)$/i.test(lower)) {
        field = 'title';
      } else if (/^(release(\s*year|\s*date)?|year|yr)$/i.test(lower)) {
        field = 'year';
      } else if (/^(status|watch\s*status|watched(\s*(status|state))?|seen|state|completed)$/i.test(lower)) {
        field = 'status';
      } else if (/^(my\s*rating|personal\s*rating|rating|score|stars|user\s*rating)$/i.test(lower)) {
        field = 'rating';
      } else if (/^(notes?|review|thoughts?|comments?|journal)$/i.test(lower)) {
        field = 'notes';
      } else if (/^(watched(\s*at|\s*date|\s*on)?|date\s*watched|viewed(\s*at|\s*date)?)$/i.test(lower)) {
        field = 'watchedDate';
      } else if (/^(favorite|fav|starred|heart)$/i.test(lower)) {
        field = 'favorite';
      }

      const sampleValues = sampleRows
        .map((r) => r[idx] || '')
        .filter((val) => val.trim().length > 0)
        .slice(0, 3);

      mappings.push({
        columnIndex: idx,
        headerName: colName || `Column ${idx + 1}`,
        mappedField: field,
        sampleValues,
      });
    });

    // Ensure at least first column is mapped to title if title was not automatically detected
    const hasTitle = mappings.some((m) => m.mappedField === 'title');
    if (!hasTitle && mappings.length > 0) {
      mappings[0].mappedField = 'title';
    }

    return mappings;
  }

  /**
   * Parse rows using explicit or detected column mappings
   */
  static parseRowsWithMapping(
    grid: string[][],
    mappings: ColumnMapping[],
    startRowIndex = 1
  ): ExtractedMovieRow[] {
    const titleMap = mappings.find((m) => m.mappedField === 'title');
    if (!titleMap) return [];

    const titleCol = titleMap.columnIndex;
    const yearCol = mappings.find((m) => m.mappedField === 'year')?.columnIndex ?? -1;
    const statusCol = mappings.find((m) => m.mappedField === 'status')?.columnIndex ?? -1;
    const ratingCol = mappings.find((m) => m.mappedField === 'rating')?.columnIndex ?? -1;
    const notesCol = mappings.find((m) => m.mappedField === 'notes')?.columnIndex ?? -1;
    const watchedDateCol = mappings.find((m) => m.mappedField === 'watchedDate')?.columnIndex ?? -1;
    const favoriteCol = mappings.find((m) => m.mappedField === 'favorite')?.columnIndex ?? -1;

    const results: ExtractedMovieRow[] = [];

    for (let r = startRowIndex; r < grid.length; r++) {
      const row = grid[r];
      if (!row || !row[titleCol]) continue;

      const rawTitle = String(row[titleCol]).trim();
      if (!rawTitle) continue;

      const cleaned = this.cleanMovieTitle(rawTitle);

      // Parse explicit year if available
      let year = cleaned.year;
      if (yearCol !== -1 && row[yearCol]) {
        const parsedYear = parseInt(String(row[yearCol]).trim(), 10);
        if (!isNaN(parsedYear) && parsedYear > 1880 && parsedYear < 2100) {
          year = parsedYear;
        }
      }

      // Parse explicit status if available
      let status: MovieStatus | null = cleaned.status ?? null;
      if (statusCol !== -1 && row[statusCol]) {
        const val = String(row[statusCol]).toLowerCase().trim();
        if (/^(yes|watched|seen|1|true|completed|finished)$/i.test(val)) status = 'watched';
        else if (/^(watching|current|in\s*progress)$/i.test(val)) status = 'watching';
        else status = 'want_to_watch';
      }

      // Parse explicit rating
      let rating = cleaned.rating;
      if (ratingCol !== -1 && row[ratingCol]) {
        const parsedRating = parseFloat(String(row[ratingCol]).trim());
        if (!isNaN(parsedRating) && parsedRating > 0) {
          rating = parsedRating > 5 ? parsedRating / 2 : parsedRating;
        }
      }

      // Parse explicit watched date
      let watchedDate = cleaned.watchedDate;
      if (watchedDateCol !== -1 && row[watchedDateCol]) {
        const dateVal = String(row[watchedDateCol]).trim();
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          watchedDate = d.toISOString();
        }
      }

      // Parse favorite
      let favorite = cleaned.favorite;
      if (favoriteCol !== -1 && row[favoriteCol]) {
        const val = String(row[favoriteCol]).toLowerCase().trim();
        favorite = /^(yes|true|1|fav|favorite)$/i.test(val);
      }

      const notes = notesCol !== -1 && row[notesCol] ? String(row[notesCol]).trim() : cleaned.notes;

      results.push({
        rawText: rawTitle,
        detectedTitle: cleaned.cleanTitle || rawTitle,
        cleanTitle: cleaned.cleanTitle || rawTitle,
        searchNormalizedTitle: cleaned.searchNormalizedTitle,
        detectedYear: year,
        detectedStatus: status,
        detectedRating: rating,
        detectedNotes: notes,
        detectedWatchedDate: watchedDate,
        detectedFavorite: favorite,
      });
    }

    return results;
  }

  private static parseSpreadsheetRows(grid: any[][]): ExtractedMovieRow[] {
    if (!grid || grid.length === 0) return [];

    const stringGrid = grid.map((row) => row.map((cell) => String(cell ?? '').trim()));
    const headerRow = stringGrid[0];
    const mappings = this.detectColumnMappings(headerRow, stringGrid.slice(1, 4));

    // If first row looks like a header, start at row 1, otherwise start at row 0
    const hasHeader = mappings.some(
      (m) => m.mappedField !== 'ignore' && /title|movie|film|name|year|status|rating/i.test(m.headerName)
    );
    const startRow = hasHeader ? 1 : 0;

    return this.parseRowsWithMapping(stringGrid, mappings, startRow);
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
            detectedTitle: cleaned.cleanTitle,
            cleanTitle: cleaned.cleanTitle,
            searchNormalizedTitle: cleaned.searchNormalizedTitle,
            detectedYear: cleaned.year,
            detectedStatus: cleaned.status,
          };
        }
        const titleStr = item.title || item.name || '';
        const cleaned = this.cleanMovieTitle(titleStr);
        return {
          rawText: titleStr,
          detectedTitle: cleaned.cleanTitle,
          cleanTitle: cleaned.cleanTitle,
          searchNormalizedTitle: cleaned.searchNormalizedTitle,
          detectedYear: item.year || cleaned.year,
          detectedStatus: item.status || cleaned.status,
          detectedRating: item.rating || item.personalRating || cleaned.rating,
          detectedNotes: item.notes || item.review || cleaned.notes,
          detectedWatchedDate: item.watchedAt || item.watchedDate,
          detectedFavorite: item.isFavorite || item.favorite || cleaned.favorite,
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
        detectedTitle: cleaned.cleanTitle,
        cleanTitle: cleaned.cleanTitle,
        searchNormalizedTitle: cleaned.searchNormalizedTitle,
        detectedYear: cleaned.year,
        detectedStatus: cleaned.status,
        detectedRating: cleaned.rating,
        detectedNotes: cleaned.notes,
        detectedFavorite: cleaned.favorite,
      };
    });
  }

  /**
   * Staged TMDB Matching Pipeline with controlled concurrency and 4-tier duplicate detection
   * Respects browser yield and rate limits.
   */
  static async matchWithTMDB(
    rows: ExtractedMovieRow[],
    targetCollectionId?: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<ImportCandidate[]> {
    const existingUserMovies = await UserMovieRepository.getAll();
    const libraryMovieIdSet = new Set(existingUserMovies.map((um) => um.movieId));

    // Target collection membership only:
    // A movie in Collection A is NOT a duplicate for Collection B!
    const collectionMovieIdSet = new Set<number>();
    if (targetCollectionId) {
      const colMovies = await CollectionRepository.getCollectionMovies(targetCollectionId);
      colMovies.forEach((cm) => collectionMovieIdSet.add(cm.movieId));
    }

    const seenTmdbIdsInBatch = new Set<number>();
    const seenTitlesInFile = new Set<string>();
    const candidates: ImportCandidate[] = [];

    // Controlled batching (chunks of 4) to ensure responsive UI and respectful API quota
    const BATCH_SIZE = 4;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (row, idx) => {
          const rowId = `cand_${i + idx}_${Date.now()}`;
          const normTitle = row.searchNormalizedTitle || UnifiedSearchService.normalize(row.detectedTitle);

          // Level 1 Duplicate: Duplicate row within the source file
          const isFileDuplicate = seenTitlesInFile.has(normTitle);
          if (!isFileDuplicate && normTitle) {
            seenTitlesInFile.add(normTitle);
          }

          if (!row.detectedTitle || !normTitle) {
            candidates.push({
              id: rowId,
              row,
              confidence: 'none',
              status: 'unmatched',
              isDuplicateInLibrary: false,
              isDuplicateInCollection: false,
              userSelectedOption: 'skip',
            });
            return;
          }

          try {
            // Layer 1 Shortcut: Check curated local seed catalog / IndexedDB first (0ms latency, zero quota)
            const localMatches = await UnifiedSearchService.searchLocal(row.detectedTitle, { maxResults: 4 });
            const queryYear = row.detectedYear;

            let results: Movie[] = [];
            const exactLocal = localMatches.find((lm) => {
              const lmNorm = UnifiedSearchService.normalize(lm.title);
              const lmYear = lm.releaseDate ? parseInt(lm.releaseDate.substring(0, 4), 10) : null;
              return lmNorm === normTitle && (!queryYear || queryYear === lmYear);
            });

            if (exactLocal) {
              results = [exactLocal];
            } else {
              // Layer 2: On-demand TMDB query with retry & backoff
              results = await this.searchTMDBWithRetry(row.detectedTitle, row.detectedYear || undefined);
            }

            if (results.length === 0) {
              candidates.push({
                id: rowId,
                row,
                confidence: 'none',
                status: 'unmatched',
                isDuplicateInLibrary: false,
                isDuplicateInCollection: false,
                userSelectedOption: 'skip',
              });
              return;
            }

            const top = results[0];
            const normTop = UnifiedSearchService.normalize(top.title);

            let confidence: MatchConfidence = 'low';
            let status: ImportItemStatus = 'matched';

            const topYear = top.releaseDate ? parseInt(top.releaseDate.substring(0, 4), 10) : null;

            if (normTitle === normTop && (!queryYear || queryYear === topYear)) {
              confidence = 'high';
            } else if (normTitle === normTop || results.length === 1) {
              confidence = 'medium';
            }

            // Ambiguity check: e.g. "The Batman" (2004) vs "The Batman" (2022)
            const closeMatches = results.filter((m) => {
              const mNorm = UnifiedSearchService.normalize(m.title);
              return mNorm === normTitle;
            });

            if (closeMatches.length > 1 && !queryYear) {
              confidence = 'medium';
              status = 'ambiguous';
            }

            // Level 2 Duplicate: Batch collision (multiple titles pointing to same TMDB movie)
            const isBatchDuplicate = seenTmdbIdsInBatch.has(top.id);
            if (!isBatchDuplicate) {
              seenTmdbIdsInBatch.add(top.id);
            }

            // Level 3 Duplicate: Already exists in personal library
            const isDuplicateInLibrary = libraryMovieIdSet.has(top.id);

            // Level 4 Duplicate: Already in CURRENT target collection
            const isDuplicateInCollection = collectionMovieIdSet.has(top.id);

            if (isFileDuplicate || isBatchDuplicate) {
              status = 'duplicate';
            }

            candidates.push({
              id: rowId,
              row,
              matchedMovie: top,
              confidence,
              status,
              ambiguousOptions: closeMatches.length > 1 ? closeMatches.slice(0, 4) : undefined,
              isDuplicateInLibrary,
              isDuplicateInCollection,
              isDuplicateInBatch: isBatchDuplicate,
              userSelectedOption: status === 'duplicate' ? 'skip' : 'import',
            });
          } catch {
            candidates.push({
              id: rowId,
              row,
              confidence: 'none',
              status: 'unmatched',
              isDuplicateInLibrary: false,
              isDuplicateInCollection: false,
              userSelectedOption: 'skip',
            });
          }
        })
      );

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, rows.length), rows.length);
      }

      // Yield execution to browser event loop to maintain buttery 60fps UI responsiveness
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return candidates;
  }

  private static async searchTMDBWithRetry(
    title: string,
    year?: number,
    retries = 2
  ): Promise<Movie[]> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { results } = await TMDBService.search(title, year);
        return results;
      } catch (err: any) {
        if (attempt === retries) throw err;
        const delay = (attempt + 1) * 300;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return [];
  }

  static getSummary(candidates: ImportCandidate[]): ImportJobSummary {
    return {
      totalDetected: candidates.length,
      highConfidence: candidates.filter((c) => c.confidence === 'high' && c.status === 'matched').length,
      needsReview: candidates.filter(
        (c) => c.status === 'ambiguous' || (c.confidence === 'medium' && c.status === 'matched')
      ).length,
      unmatched: candidates.filter((c) => c.status === 'unmatched').length,
      duplicates: candidates.filter((c) => c.status === 'duplicate').length,
      skipped: candidates.filter((c) => c.userSelectedOption === 'skip').length,
    };
  }

  /**
   * Final Commit: ATOMIC Multi-Store Transaction Commit
   * Commits movies, userMovies, and collection relationships atomically via IndexedDB transaction.
   * If any step fails, all operations roll back cleanly.
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
    const db = await getDB();

    // 1. Prepare stage datasets in memory
    const moviesToSave: Movie[] = [];
    const userMoviesToSave: UserMovie[] = [];
    const collectionMovieIds: number[] = [];
    const now = new Date().toISOString();

    for (const candidate of candidates) {
      if (candidate.userSelectedOption === 'skip') continue;

      const chosenMovie = candidate.userOverrideMovie || candidate.matchedMovie;
      if (!chosenMovie) continue;

      moviesToSave.push(chosenMovie);
      collectionMovieIds.push(chosenMovie.id);

      // Determine watch status
      const existingUserMovie = await UserMovieRepository.getByMovieId(chosenMovie.id);

      let statusToApply: MovieStatus = 'want_to_watch';
      if (options.importWatchedStatus && candidate.row.detectedStatus) {
        statusToApply = candidate.row.detectedStatus;
      } else if (existingUserMovie) {
        statusToApply = existingUserMovie.status;
      }

      // Never downgrade an already-watched movie to want_to_watch
      if (existingUserMovie?.status === 'watched') {
        statusToApply = 'watched';
      }

      // Rating handling
      let ratingToApply: number | null = existingUserMovie?.personalRating ?? null;
      if (options.importRatings && typeof candidate.row.detectedRating === 'number') {
        ratingToApply = candidate.row.detectedRating;
      }

      // Notes handling
      let notesToApply = existingUserMovie?.notes;
      if (options.importNotes && candidate.row.detectedNotes) {
        notesToApply = candidate.row.detectedNotes;
      }

      // Watched date handling
      let watchedAtToApply = existingUserMovie?.watchedAt ?? null;
      if (statusToApply === 'watched') {
        if (candidate.row.detectedWatchedDate) {
          watchedAtToApply = candidate.row.detectedWatchedDate;
        } else if (!watchedAtToApply) {
          watchedAtToApply = now;
        }
      }

      const isFavoriteToApply =
        candidate.row.detectedFavorite !== undefined
          ? candidate.row.detectedFavorite
          : existingUserMovie?.isFavorite ?? false;

      const userMovieRecord: UserMovie = {
        movieId: chosenMovie.id,
        status: statusToApply,
        personalRating: ratingToApply,
        notes: notesToApply,
        review: existingUserMovie?.review,
        isFavorite: isFavoriteToApply,
        addedAt: existingUserMovie?.addedAt || now,
        watchedAt: watchedAtToApply,
        watchingAt: statusToApply === 'watching' ? now : null,
        scheduledAt: existingUserMovie?.scheduledAt ?? null,
        rewatchCount: existingUserMovie?.rewatchCount ?? 0,
      };

      userMoviesToSave.push(userMovieRecord);
    }

    if (moviesToSave.length === 0) {
      return { importedCount: 0, collectionCount: 0 };
    }

    // 2. Execute Atomic Multi-Store IndexedDB Transaction
    const tx = db.transaction(['movies', 'userMovies', 'collections', 'collectionMovies'], 'readwrite');
    const movieStore = tx.objectStore('movies');
    const userMovieStore = tx.objectStore('userMovies');
    const collectionStore = tx.objectStore('collections');
    const colMovieStore = tx.objectStore('collectionMovies');

    try {
      // A. Save Canonical Movies (merge existing metadata)
      for (const m of moviesToSave) {
        const existing = await movieStore.get(m.id);
        if (existing) {
          const merged: Movie = {
            ...existing,
            ...m,
            runtime: m.runtime || existing.runtime || null,
            overview: m.overview || existing.overview || '',
            credits: m.credits || existing.credits,
            franchiseTags:
              m.franchiseTags && m.franchiseTags.length > 0 ? m.franchiseTags : existing.franchiseTags,
            source: existing.source || m.source || 'tmdb',
            seedCategory: existing.seedCategory || m.seedCategory,
            lastFetched: m.lastFetched || now,
          };
          await movieStore.put(merged);
        } else {
          await movieStore.put(m);
        }
      }

      // B. Save UserMovie records
      for (const um of userMoviesToSave) {
        await userMovieStore.put(um);
      }

      // C. If target collection, append missing CollectionMovie rows in source order
      let collectionCount = 0;
      if (options.collectionId && collectionMovieIds.length > 0) {
        const targetCol = await collectionStore.get(options.collectionId);
        if (targetCol) {
          const existingColMovies = await colMovieStore
            .index('by-collection')
            .getAll(options.collectionId);
          const existingMovieIdSet = new Set(existingColMovies.map((cm) => cm.movieId));

          let pos = existingColMovies.length;
          for (const mId of collectionMovieIds) {
            if (!existingMovieIdSet.has(mId)) {
              existingMovieIdSet.add(mId);
              const colMovieItem: CollectionMovie = {
                id: `${options.collectionId}_${mId}`,
                collectionId: options.collectionId,
                movieId: mId,
                position: pos++,
                addedAt: now,
              };
              await colMovieStore.put(colMovieItem);
              if (!targetCol.customOrder.includes(mId)) {
                targetCol.customOrder.push(mId);
              }
              collectionCount++;
            }
          }
          targetCol.updatedAt = now;
          await collectionStore.put(targetCol);
        }
      }

      await tx.done;

      // Recalculate collection progress if target collection was updated
      if (options.collectionId) {
        await CollectionRepository.calculateProgress(options.collectionId);
      }

      return {
        importedCount: moviesToSave.length,
        collectionCount,
      };
    } catch (err) {
      console.error('Import commit transaction failed, rolled back:', err);
      throw err;
    }
  }
}
