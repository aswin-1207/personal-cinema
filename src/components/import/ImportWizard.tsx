import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import {
  ExtractedMovieRow,
  ImportCandidate,
  ImportJobSummary,
  WorkbookSheetInfo,
  ColumnMapping,
  CanonicalField,
} from '../../types/import';
import { Collection } from '../../types/collection';
import { ImportService } from '../../services/importService';
import { CollectionRepository } from '../../db/repositories/collectionRepository';
import { tmdbService } from '../../services/tmdbService';
import { Movie } from '../../types/movie';
import {
  Upload,
  Clipboard,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  ArrowRight,
  Search,
  X,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialCollectionId?: string;
}

type Step = 'source' | 'sheets' | 'mapping' | 'matching' | 'review' | 'success';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialCollectionId,
}) => {
  const [step, setStep] = useState<Step>('source');
  const [sourceType, setSourceType] = useState<'file' | 'clipboard'>('file');
  const [clipboardText, setClipboardText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Workbook sheets & column mapping state
  const [availableSheets, setAvailableSheets] = useState<WorkbookSheetInfo[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [spreadsheetGrid, setSpreadsheetGrid] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  // Collections selection
  const [collections, setCollections] = useState<Collection[]>([]);
  const [targetCollectionOption, setTargetCollectionOption] = useState<string>(
    initialCollectionId || 'none'
  );
  const [newCollectionName, setNewCollectionName] = useState('');

  // Processing state
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [summary, setSummary] = useState<ImportJobSummary>({
    totalDetected: 0,
    highConfidence: 0,
    needsReview: 0,
    unmatched: 0,
    duplicates: 0,
  });

  // Review screen filter
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'needs_review' | 'high' | 'unmatched' | 'duplicates'
  >('all');
  const [searchOverrideId, setSearchOverrideId] = useState<number | null>(null);
  const [searchOverrideQuery, setSearchOverrideQuery] = useState('');
  const [searchOverrideResults, setSearchOverrideResults] = useState<Movie[]>([]);
  const [isSearchingOverride, setIsSearchingOverride] = useState(false);

  // Import options
  const [importWatchedStatus, setImportWatchedStatus] = useState(true);
  const [importRatings, setImportRatings] = useState(true);
  const [importNotes, setImportNotes] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ importedCount: number; collectionCount: number }>({
    importedCount: 0,
    collectionCount: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('source');
      setSourceType('file');
      setClipboardText('');
      setSelectedFile(null);
      setAvailableSheets([]);
      setSelectedSheetName('');
      setSpreadsheetGrid([]);
      setColumnMappings([]);
      setCandidates([]);
      CollectionRepository.getAll().then(setCollections);
    }
  }, [isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        try {
          const sheets = await ImportService.getWorkbookSheets(file);
          setAvailableSheets(sheets);
          if (sheets.length > 0) {
            setSelectedSheetName(sheets[0].name);
          }
        } catch (err) {
          console.error('Failed to inspect workbook sheets:', err);
        }
      } else {
        setAvailableSheets([]);
      }
    }
  };

  const handleProceedFromSource = async () => {
    if (sourceType === 'file' && selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if ((ext === 'xlsx' || ext === 'xls') && availableSheets.length > 1) {
        setStep('sheets');
        return;
      }

      // Check if we can extract grid for column mapping
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        let grid: string[][] = [];
        if (ext === 'csv') {
          const text = await selectedFile.text();
          grid = ImportService.parseCSV(text);
        } else {
          grid = await ImportService.parseWorkbookSheet(selectedFile, selectedSheetName);
        }

        if (grid.length > 0) {
          setSpreadsheetGrid(grid);
          const header = grid[0];
          const mappings = ImportService.detectColumnMappings(header, grid.slice(1, 4));
          setColumnMappings(mappings);

          // If title not found with high confidence or headers are ambiguous, prompt mapping step
          const hasConfidentTitle = mappings.some(
            (m) => m.mappedField === 'title' && /title|movie|film|name/i.test(m.headerName)
          );
          if (!hasConfidentTitle) {
            setStep('mapping');
            return;
          }
        }
      }
    }

    // Direct match
    await executeMatching();
  };

  const handleSelectSheetAndProceed = async (sheetName: string) => {
    setSelectedSheetName(sheetName);
    if (!selectedFile) return;

    const grid = await ImportService.parseWorkbookSheet(selectedFile, sheetName);
    setSpreadsheetGrid(grid);

    if (grid.length > 0) {
      const header = grid[0];
      const mappings = ImportService.detectColumnMappings(header, grid.slice(1, 4));
      setColumnMappings(mappings);
      setStep('mapping');
    } else {
      await executeMatching();
    }
  };

  const executeMatching = async () => {
    let rows: ExtractedMovieRow[] = [];

    if (sourceType === 'file' && selectedFile) {
      if (spreadsheetGrid.length > 0 && columnMappings.length > 0) {
        rows = ImportService.parseRowsWithMapping(spreadsheetGrid, columnMappings, 1);
      } else {
        rows = await ImportService.parseFile(selectedFile, selectedSheetName);
      }
    } else if (sourceType === 'clipboard' && clipboardText.trim()) {
      rows = await ImportService.parseClipboardText(clipboardText);
    }

    if (rows.length === 0) {
      alert('No movie rows detected. Please check your file or text format.');
      return;
    }

    setStep('matching');
    setProgress({ processed: 0, total: rows.length });

    const targetColId =
      targetCollectionOption !== 'none' && targetCollectionOption !== 'new'
        ? targetCollectionOption
        : undefined;

    const matchedCandidates = await ImportService.matchWithTMDB(
      rows,
      targetColId,
      (processed, total) => setProgress({ processed, total })
    );

    setCandidates(matchedCandidates);
    setSummary(ImportService.getSummary(matchedCandidates));
    setStep('review');
  };

  const handleUpdateMappingField = (index: number, newField: CanonicalField) => {
    setColumnMappings((prev) => {
      const next = [...prev];
      // If setting to title, clear any other column mapped to title
      if (newField === 'title') {
        next.forEach((m, i) => {
          if (i !== index && m.mappedField === 'title') {
            m.mappedField = 'ignore';
          }
        });
      }
      next[index] = { ...next[index], mappedField: newField };
      return next;
    });
  };

  const handleSelectAmbiguousMatch = (index: number, movie: Movie) => {
    setCandidates((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        userOverrideMovie: movie,
        confidence: 'high',
        status: 'matched',
      };
      return next;
    });
  };

  const handleToggleSkip = (index: number) => {
    setCandidates((prev) => {
      const next = [...prev];
      const isSkipped = next[index].userSelectedOption === 'skip';
      next[index] = {
        ...next[index],
        userSelectedOption: isSkipped ? 'import' : 'skip',
      };
      return next;
    });
  };

  const handleSearchOverride = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingOverride(true);
    try {
      const res = await tmdbService.searchMovies(query);
      setSearchOverrideResults(res.results.slice(0, 5));
    } finally {
      setIsSearchingOverride(false);
    }
  };

  const handleApplyOverride = (index: number, movie: Movie) => {
    handleSelectAmbiguousMatch(index, movie);
    setSearchOverrideId(null);
    setSearchOverrideQuery('');
    setSearchOverrideResults([]);
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      let finalCollectionId: string | undefined = undefined;

      if (targetCollectionOption === 'new' && newCollectionName.trim()) {
        const newCol = await CollectionRepository.create({
          name: newCollectionName.trim(),
        });
        finalCollectionId = newCol.id;
      } else if (targetCollectionOption !== 'none') {
        finalCollectionId = targetCollectionOption;
      }

      const res = await ImportService.commitImport(candidates, {
        collectionId: finalCollectionId,
        importWatchedStatus,
        importRatings,
        importNotes,
      });

      setCommitResult(res);
      setStep('success');
    } catch (err: any) {
      alert(`Import commit failed: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (activeFilter === 'needs_review')
      return c.status === 'ambiguous' || (c.confidence === 'medium' && c.status === 'matched');
    if (activeFilter === 'high') return c.confidence === 'high' && c.status === 'matched';
    if (activeFilter === 'unmatched') return c.status === 'unmatched';
    if (activeFilter === 'duplicates') return c.status === 'duplicate';
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Movies into MyCinema"
      maxWidth="max-w-3xl"
    >
      {/* Step 1: Source & Configuration */}
      {step === 'source' && (
        <div className="space-y-6">
          <div className="flex border-b border-white/10 pb-2 gap-4">
            <button
              type="button"
              onClick={() => setSourceType('file')}
              className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2 -mb-2.5 ${
                sourceType === 'file'
                  ? 'border-cinema-gold text-cinema-gold'
                  : 'border-transparent text-cinema-subtle hover:text-cinema-white'
              }`}
            >
              <FileSpreadsheet size={16} />
              <span>Movie File (CSV, XLSX, TXT)</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('clipboard')}
              className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2 -mb-2.5 ${
                sourceType === 'clipboard'
                  ? 'border-cinema-gold text-cinema-gold'
                  : 'border-transparent text-cinema-subtle hover:text-cinema-white'
              }`}
            >
              <Clipboard size={16} />
              <span>Paste Text List</span>
            </button>
          </div>

          {sourceType === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-cinema-gold/60 bg-cinema-surface/40 hover:bg-cinema-surface/70 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .txt, .json"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 rounded-2xl bg-cinema-gold/10 border border-cinema-gold/30 flex items-center justify-center text-cinema-gold mb-3 shadow-gold">
                <Upload size={28} />
              </div>
              <h4 className="text-cinema-white font-medium text-base mb-1">
                {selectedFile ? selectedFile.name : 'Select or drag your movie file here'}
              </h4>
              <p className="text-xs text-cinema-subtle max-w-sm">
                Supports CSV spreadsheets, Excel workbooks (.xlsx), and plain text lists (.txt).
                Automatically detects titles, release years, watch states, and ratings.
              </p>
              {selectedFile && (
                <div className="mt-3 px-3 py-1 rounded bg-cinema-gold/20 text-cinema-gold text-xs font-semibold">
                  File Selected ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
                Paste movie titles (one per line, e.g. "Inception (2010) - Watched [9/10]")
              </label>
              <textarea
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder={`1. The Dark Knight (2008) - Watched [9/10]\n2. Oppenheimer (2023)\n3. Interstellar (2014) - Loved the soundtrack\n4. Blade Runner 2049 [2017]`}
                className="cinema-input w-full h-44 font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {/* Target Collection Option */}
          <div className="bg-cinema-surface/40 p-4 rounded-xl border border-white/5 space-y-3">
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle font-medium">
              Target Destination
            </label>
            <select
              value={targetCollectionOption}
              onChange={(e) => setTargetCollectionOption(e.target.value)}
              className="cinema-input w-full"
            >
              <option value="none">Main Library Only</option>
              <option value="new">+ Create New Collection for this Import</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  Add to Collection: {col.name}
                </option>
              ))}
            </select>

            {targetCollectionOption === 'new' && (
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="New collection name (e.g. Nolan Films)"
                className="cinema-input w-full mt-2"
                autoFocus
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="cinema-button-secondary px-5 py-2.5 text-sm">
              Cancel
            </button>
            <button
              onClick={handleProceedFromSource}
              disabled={sourceType === 'file' ? !selectedFile : !clipboardText.trim()}
              className="cinema-button-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <span>Scan & Process</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 1B: Sheet Selection for Multi-Sheet XLSX */}
      {step === 'sheets' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Layers size={24} className="text-cinema-gold" />
            <div>
              <h3 className="font-semibold text-cinema-white text-base">Select Sheet to Import</h3>
              <p className="text-xs text-cinema-subtle">
                This workbook contains multiple sheets. Choose which sheet to scan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
            {availableSheets.map((sh) => (
              <div
                key={sh.name}
                onClick={() => handleSelectSheetAndProceed(sh.name)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedSheetName === sh.name
                    ? 'border-cinema-gold bg-cinema-gold/15'
                    : 'border-white/10 bg-cinema-surface hover:bg-cinema-surfaceElevated'
                }`}
              >
                <div className="font-bold text-cinema-white text-sm">{sh.name}</div>
                <div className="text-xs text-cinema-subtle mt-1">Approx. {sh.rowCount} rows</div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="cinema-button-secondary px-4 py-2 text-xs"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => handleSelectSheetAndProceed(selectedSheetName || availableSheets[0]?.name)}
              className="cinema-button-primary px-5 py-2 text-xs flex items-center gap-1.5"
            >
              <span>Continue with Selected Sheet</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 1C: Column Mapping UI */}
      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-cinema-gold" />
              <div>
                <h3 className="font-semibold text-cinema-white text-base">Configure Column Mapping</h3>
                <p className="text-xs text-cinema-subtle">
                  Verify or assign spreadsheet columns to MyCinema fields. Exactly one column must map to Movie Title.
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
            {columnMappings.map((mapping, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-white/10 bg-cinema-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-cinema-white text-xs flex items-center gap-2">
                    <span>{mapping.headerName}</span>
                    {mapping.mappedField === 'title' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cinema-gold/20 text-cinema-gold">
                        Title [Required]
                      </span>
                    )}
                  </div>
                  {mapping.sampleValues.length > 0 && (
                    <div className="text-[11px] text-cinema-subtle mt-0.5">
                      Sample: {mapping.sampleValues.join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={mapping.mappedField}
                    onChange={(e) => handleUpdateMappingField(idx, e.target.value as CanonicalField)}
                    className="cinema-input text-xs py-1 px-2.5 min-w-[140px]"
                  >
                    <option value="title">Movie Title</option>
                    <option value="year">Release Year</option>
                    <option value="status">Watch Status</option>
                    <option value="rating">Personal Rating</option>
                    <option value="notes">Notes / Review</option>
                    <option value="watchedDate">Watched Date</option>
                    <option value="favorite">Favorite</option>
                    <option value="ignore">Ignore Column</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="cinema-button-secondary px-4 py-2 text-xs"
            >
              Back
            </button>
            <button
              type="button"
              onClick={executeMatching}
              disabled={!columnMappings.some((m) => m.mappedField === 'title')}
              className="cinema-button-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>Scan & Match with TMDB</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Rate-Controlled Matching Progress */}
      {step === 'matching' && (
        <div className="py-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border-4 border-cinema-charcoal border-t-cinema-gold animate-spin mb-4" />
          <h3 className="font-semibold text-xl text-cinema-white mb-2">Matching with TMDB...</h3>
          <p className="text-sm text-cinema-silver mb-4">
            Processing {progress.processed} of {progress.total} movies
          </p>
          <div className="w-64 h-2 bg-cinema-charcoal rounded-full overflow-hidden">
            <div
              className="h-full bg-cinema-gold transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Step 3: Staged Non-Destructive Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                activeFilter === 'all'
                  ? 'border-cinema-gold bg-cinema-gold/15'
                  : 'border-white/5 bg-cinema-surface/50'
              }`}
            >
              <div className="text-cinema-subtle">Total Found</div>
              <div className="font-bold text-cinema-white text-base">{summary.totalDetected}</div>
            </button>

            <button
              onClick={() => setActiveFilter('high')}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                activeFilter === 'high'
                  ? 'border-cinema-gold bg-cinema-gold/15'
                  : 'border-white/5 bg-cinema-surface/50'
              }`}
            >
              <div className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> High Match
              </div>
              <div className="font-bold text-cinema-white text-base">{summary.highConfidence}</div>
            </button>

            <button
              onClick={() => setActiveFilter('needs_review')}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                activeFilter === 'needs_review'
                  ? 'border-cinema-gold bg-cinema-gold/15'
                  : 'border-white/5 bg-cinema-surface/50'
              }`}
            >
              <div className="text-cinema-amber flex items-center gap-1">
                <AlertTriangle size={12} /> Review
              </div>
              <div className="font-bold text-cinema-white text-base">{summary.needsReview}</div>
            </button>

            <button
              onClick={() => setActiveFilter('duplicates')}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                activeFilter === 'duplicates'
                  ? 'border-cinema-gold bg-cinema-gold/15'
                  : 'border-white/5 bg-cinema-surface/50'
              }`}
            >
              <div className="text-cinema-silver flex items-center gap-1">
                <Copy size={12} /> Duplicates
              </div>
              <div className="font-bold text-cinema-white text-base">{summary.duplicates}</div>
            </button>

            <button
              onClick={() => setActiveFilter('unmatched')}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                activeFilter === 'unmatched'
                  ? 'border-cinema-gold bg-cinema-gold/15'
                  : 'border-white/5 bg-cinema-surface/50'
              }`}
            >
              <div className="text-cinema-subtle flex items-center gap-1">
                <HelpCircle size={12} /> Unmatched
              </div>
              <div className="font-bold text-cinema-white text-base">{summary.unmatched}</div>
            </button>
          </div>

          {/* Candidate List */}
          <div className="h-[300px] sm:h-[360px] max-h-[48dvh] overflow-y-auto overscroll-contain space-y-2 pr-1">
            {filteredCandidates.map((candidate) => {
              const originalIdx = candidates.indexOf(candidate);
              const movie = candidate.userOverrideMovie || candidate.matchedMovie;
              const isSkipped = candidate.userSelectedOption === 'skip';
              const isAmbiguous =
                candidate.status === 'ambiguous' &&
                candidate.ambiguousOptions &&
                candidate.ambiguousOptions.length > 0;

              return (
                <div
                  key={originalIdx}
                  className={`p-3 rounded-xl border transition-all ${
                    isSkipped
                      ? 'border-white/5 bg-cinema-charcoal/20 opacity-50'
                      : candidate.status === 'duplicate'
                      ? 'border-white/10 bg-cinema-charcoal/40'
                      : candidate.confidence === 'high'
                      ? 'border-emerald-500/20 bg-cinema-surface/40'
                      : 'border-cinema-gold/30 bg-cinema-surface/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="w-10 h-14 bg-cinema-charcoal rounded overflow-hidden flex-shrink-0">
                        {movie?.posterPath ? (
                          <img
                            src={tmdbService.getImageUrl(movie.posterPath, 'w92')}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-cinema-subtle">
                            No poster
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-cinema-white text-sm truncate">
                            {movie ? movie.title : candidate.row.detectedTitle}
                          </span>
                          {movie?.releaseDate && (
                            <span className="text-xs text-cinema-subtle flex-shrink-0">
                              ({movie.releaseDate.substring(0, 4)})
                            </span>
                          )}
                          {candidate.status === 'duplicate' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cinema-charcoal text-cinema-silver flex-shrink-0">
                              Duplicate
                            </span>
                          )}
                          {candidate.isDuplicateInLibrary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex-shrink-0">
                              In Library
                            </span>
                          )}
                          {candidate.isDuplicateInCollection && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300 flex-shrink-0">
                              In Collection
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-cinema-subtle flex items-center gap-2 mt-0.5 min-w-0">
                          <span className="truncate">Source: "{candidate.row.rawText}"</span>
                          {candidate.row.detectedStatus && (
                            <span className="text-cinema-gold flex-shrink-0">
                              · {candidate.row.detectedStatus}
                            </span>
                          )}
                          {candidate.row.detectedRating && (
                            <span className="text-cinema-silver flex-shrink-0">
                              · ★ {candidate.row.detectedRating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSearchOverrideId(originalIdx);
                          setSearchOverrideQuery(candidate.row.detectedTitle);
                          handleSearchOverride(candidate.row.detectedTitle);
                        }}
                        className="text-xs px-2.5 py-1 rounded bg-cinema-charcoal hover:bg-cinema-surfaceElevated text-cinema-silver border border-white/5 flex items-center gap-1"
                      >
                        <Search size={12} />
                        <span>Change</span>
                      </button>

                      <button
                        onClick={() => handleToggleSkip(originalIdx)}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          isSkipped
                            ? 'border-cinema-gold text-cinema-gold bg-cinema-gold/10'
                            : 'border-white/10 text-cinema-subtle hover:text-cinema-white'
                        }`}
                      >
                        {isSkipped ? 'Include' : 'Skip'}
                      </button>
                    </div>
                  </div>

                  {/* Ambiguous selector prompt */}
                  {isAmbiguous && !candidate.userOverrideMovie && (
                    <div className="mt-3 pt-2.5 border-t border-cinema-gold/20">
                      <div className="text-xs text-cinema-amber font-medium mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>Multiple matches found. Select the correct movie:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.ambiguousOptions?.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectAmbiguousMatch(originalIdx, opt)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-cinema-charcoal hover:bg-cinema-gold hover:text-cinema-black border border-white/10 text-cinema-silver flex items-center gap-1 transition-all"
                          >
                            <span>{opt.title}</span>
                            <span className="text-[10px] opacity-75">
                              ({opt.releaseDate?.substring(0, 4) || 'N/A'})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual search override inline */}
                  {searchOverrideId === originalIdx && (
                    <div className="mt-3 pt-2.5 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={searchOverrideQuery}
                          onChange={(e) => setSearchOverrideQuery(e.target.value)}
                          placeholder="Search movie title..."
                          className="cinema-input flex-grow text-xs py-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearchOverride(searchOverrideQuery);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSearchOverride(searchOverrideQuery)}
                          className="cinema-button-secondary text-xs px-3 py-1"
                        >
                          Search
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchOverrideId(null)}
                          className="text-cinema-subtle hover:text-cinema-white p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {isSearchingOverride && (
                        <div className="text-xs text-cinema-subtle py-1">Searching...</div>
                      )}

                      <div className="space-y-1">
                        {searchOverrideResults.map((res) => (
                          <div
                            key={res.id}
                            onClick={() => handleApplyOverride(originalIdx, res)}
                            className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-cinema-charcoal cursor-pointer text-xs min-w-0"
                          >
                            <span className="text-cinema-white truncate min-w-0 flex-1">
                              {res.title} ({res.releaseDate?.substring(0, 4)})
                            </span>
                            <span className="text-[10px] text-cinema-gold flex-shrink-0">Select</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Options & Commit */}
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky -bottom-4 sm:-bottom-6 bg-[#131319] py-3 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="flex flex-wrap gap-4 text-xs text-cinema-silver">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importWatchedStatus}
                  onChange={(e) => setImportWatchedStatus(e.target.checked)}
                  className="cinema-checkbox"
                />
                <span>Import Watched Status</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importRatings}
                  onChange={(e) => setImportRatings(e.target.checked)}
                  className="cinema-checkbox"
                />
                <span>Import Ratings</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importNotes}
                  onChange={(e) => setImportNotes(e.target.checked)}
                  className="cinema-checkbox"
                />
                <span>Import Notes</span>
              </label>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setStep('source')}
                className="cinema-button-secondary px-4 py-2 text-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting}
                className="cinema-button-primary px-6 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Commit {candidates.filter((c) => c.userSelectedOption !== 'skip').length} Movies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <div className="py-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-cinema-gold/15 border border-cinema-gold/40 flex items-center justify-center text-cinema-gold mb-4 shadow-gold">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="font-bold text-2xl text-cinema-white mb-2">Import Complete!</h3>
          <p className="text-sm text-cinema-silver max-w-sm mb-6">
            Successfully imported {commitResult.importedCount} movies into your cinema library.
            {commitResult.collectionCount > 0 &&
              ` Added ${commitResult.collectionCount} movies to the collection.`}
          </p>

          <button
            onClick={() => {
              onComplete();
              onClose();
            }}
            className="cinema-button-primary px-8 py-2.5 text-sm"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
};
