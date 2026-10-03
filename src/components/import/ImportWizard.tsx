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
  FolderPlus,
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
      setTargetCollectionOption(initialCollectionId || 'none');
      setNewCollectionName('');
      CollectionRepository.getAll().then(setCollections);
    }
  }, [isOpen, initialCollectionId]);

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
      alert(`Import commit failed: ${err?.message || 'Unknown error'}`);
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

  const getStepTitle = () => {
    switch (step) {
      case 'source':
        return 'Import Movies into MyCinema';
      case 'sheets':
        return 'Select Sheet to Import';
      case 'mapping':
        return 'Configure Column Mapping';
      case 'matching':
        return 'Matching with TMDB & Local Vault';
      case 'review':
        return 'Review & Confirm Matches';
      case 'success':
        return 'Import Complete';
    }
  };

  // Fixed footer content rendered for every step
  const renderFooter = () => {
    switch (step) {
      case 'source':
        return (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={onClose}
              className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProceedFromSource}
              disabled={sourceType === 'file' ? !selectedFile : !clipboardText.trim()}
              className="cinema-button-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-gold"
            >
              <span>Scan & Process</span>
              <ArrowRight size={14} />
            </button>
          </div>
        );
      case 'sheets':
        return (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => handleSelectSheetAndProceed(selectedSheetName || availableSheets[0]?.name)}
              className="cinema-button-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-gold"
            >
              <span>Continue with Sheet</span>
              <ArrowRight size={14} />
            </button>
          </div>
        );
      case 'mapping':
        return (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={executeMatching}
              disabled={!columnMappings.some((m) => m.mappedField === 'title')}
              className="cinema-button-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-gold"
            >
              <span>Match with TMDB</span>
              <ArrowRight size={14} />
            </button>
          </div>
        );
      case 'matching':
        return (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-[#9E9DA5]">
              Scanning TMDB & Local Catalog...
            </span>
            <span className="text-xs font-mono text-[#E0AD52] font-semibold">
              {progress.processed} / {progress.total}
            </span>
          </div>
        );
      case 'review': {
        const importableCount = candidates.filter((c) => c.userSelectedOption !== 'skip').length;
        return (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setStep('source')}
              className="cinema-button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
              disabled={isCommitting}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={isCommitting || importableCount === 0}
              className="cinema-button-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-gold"
            >
              {isCommitting ? (
                <span>Importing...</span>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Import {importableCount} Movie{importableCount === 1 ? '' : 's'}</span>
                </>
              )}
            </button>
          </div>
        );
      }
      case 'success':
        return (
          <div className="flex items-center justify-end w-full">
            <button
              type="button"
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="cinema-button-primary px-6 py-2 text-xs font-bold cursor-pointer shadow-gold"
            >
              Done
            </button>
          </div>
        );
    }
  };

  const targetCollectionName =
    targetCollectionOption !== 'none' && targetCollectionOption !== 'new'
      ? collections.find((c) => c.id === targetCollectionOption)?.name
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getStepTitle()}
      maxWidth="max-w-3xl"
      footer={renderFooter()}
    >
      {/* Step 1: Source & Destination Selection */}
      {step === 'source' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Tabs: File vs Clipboard */}
          <div className="flex border-b border-white/10 pb-2 gap-4">
            <button
              type="button"
              onClick={() => setSourceType('file')}
              className={`flex items-center gap-2 pb-2 text-xs sm:text-sm font-semibold transition-colors border-b-2 -mb-2.5 cursor-pointer ${
                sourceType === 'file'
                  ? 'border-[#E0AD52] text-[#E0AD52]'
                  : 'border-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              <FileSpreadsheet size={16} />
              <span>Movie File (CSV, XLSX, TXT)</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('clipboard')}
              className={`flex items-center gap-2 pb-2 text-xs sm:text-sm font-semibold transition-colors border-b-2 -mb-2.5 cursor-pointer ${
                sourceType === 'clipboard'
                  ? 'border-[#E0AD52] text-[#E0AD52]'
                  : 'border-transparent text-[#9E9DA5] hover:text-[#F5F3EB]'
              }`}
            >
              <Clipboard size={16} />
              <span>Paste Text List</span>
            </button>
          </div>

          {sourceType === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-[#E0AD52]/60 bg-[#171924]/40 hover:bg-[#171924]/70 rounded-2xl p-5 sm:p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, .txt, .json"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-[#E0AD52]/10 border border-[#E0AD52]/30 flex items-center justify-center text-[#E0AD52] mb-2.5 shadow-gold">
                <Upload size={24} />
              </div>
              <h4 className="text-[#F5F3EB] font-semibold text-sm sm:text-base mb-1">
                {selectedFile ? selectedFile.name : 'Select or drop your movie file here'}
              </h4>
              <p className="text-[11px] sm:text-xs text-[#9E9DA5] max-w-sm">
                Supports CSV spreadsheets, Excel workbooks (.xlsx), and plain text lists (.txt).
                Automatically detects titles, release years, watch states, and ratings.
              </p>
              {selectedFile && (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-[#E0AD52]/20 text-[#E0AD52] text-xs font-semibold border border-[#E0AD52]/30">
                  ✓ File Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9E9DA5] mb-1.5 font-semibold">
                Paste movie titles (one per line, e.g. "Inception (2010) - Watched [9/10]")
              </label>
              <textarea
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder={`1. The Dark Knight (2008) - Watched [9/10]\n2. Oppenheimer (2023)\n3. Interstellar (2014) - Loved the soundtrack\n4. Blade Runner 2049 [2017]`}
                className="cinema-input w-full h-36 font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {/* Target Collection Destination */}
          <div className="bg-[#171924]/40 p-3.5 sm:p-4 rounded-xl border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-[#9E9DA5] font-semibold flex items-center gap-1.5">
                <FolderPlus size={13} className="text-[#E0AD52]" />
                <span>Target Destination</span>
              </label>
              {targetCollectionName && (
                <span className="text-[11px] text-[#E0AD52] font-semibold truncate max-w-[200px]">
                  Collection: {targetCollectionName}
                </span>
              )}
            </div>

            <select
              value={targetCollectionOption}
              onChange={(e) => setTargetCollectionOption(e.target.value)}
              className="cinema-input w-full text-xs sm:text-sm"
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
                placeholder="New collection name (e.g. Nolan Films, Sci-Fi Classics)"
                className="cinema-input w-full text-xs sm:text-sm mt-1.5"
                autoFocus
              />
            )}
          </div>
        </div>
      )}

      {/* Step 1B: Sheet Selection for Multi-Sheet XLSX */}
      {step === 'sheets' && (
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <Layers size={22} className="text-[#E0AD52]" />
            <div>
              <h3 className="font-semibold text-[#F5F3EB] text-sm sm:text-base">Select Sheet to Import</h3>
              <p className="text-xs text-[#9E9DA5]">
                This workbook contains multiple sheets. Choose which sheet to scan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {availableSheets.map((sh) => (
              <div
                key={sh.name}
                onClick={() => setSelectedSheetName(sh.name)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedSheetName === sh.name
                    ? 'border-[#E0AD52] bg-[#E0AD52]/15'
                    : 'border-white/10 bg-[#171924]/50 hover:bg-[#171924]'
                }`}
              >
                <div className="font-bold text-[#F5F3EB] text-sm">{sh.name}</div>
                <div className="text-xs text-[#9E9DA5] mt-1">Approx. {sh.rowCount} rows</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1C: Column Mapping UI */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-[#E0AD52]" />
            <div>
              <h3 className="font-semibold text-[#F5F3EB] text-sm sm:text-base">Configure Column Mapping</h3>
              <p className="text-xs text-[#9E9DA5]">
                Verify or assign columns to MyCinema fields. Exactly one column must map to Movie Title.
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {columnMappings.map((mapping, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-white/10 bg-[#171924]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div>
                  <div className="font-semibold text-[#F5F3EB] text-xs flex items-center gap-2">
                    <span>{mapping.headerName}</span>
                    {mapping.mappedField === 'title' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E0AD52]/20 text-[#E0AD52] font-bold">
                        Title [Required]
                      </span>
                    )}
                  </div>
                  {mapping.sampleValues.length > 0 && (
                    <div className="text-[11px] text-[#9E9DA5] mt-0.5 truncate max-w-sm">
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
        </div>
      )}

      {/* Step 2: Rate-Controlled Matching Progress */}
      {step === 'matching' && (
        <div className="py-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full border-3 border-[#1C1C24] border-t-[#E0AD52] animate-spin mb-4" />
          <h3 className="font-semibold text-lg text-[#F5F3EB] mb-1.5">Matching with TMDB & Local Catalog...</h3>
          <p className="text-xs text-[#9E9DA5] mb-4">
            Processing {progress.processed} of {progress.total} movies
          </p>
          <div className="w-56 h-2 bg-[#1C1C24] rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#D99C33] to-[#E0AD52] transition-all duration-300 rounded-full"
              style={{
                width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Step 3: Non-Destructive Match Review */}
      {step === 'review' && (
        <div className="space-y-3.5">
          {/* Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'border-[#E0AD52] bg-[#E0AD52]/15 text-[#E0AD52]'
                  : 'border-white/5 bg-[#171924]/50 text-[#9E9DA5]'
              }`}
            >
              <div className="text-[10px] uppercase font-semibold">Total Found</div>
              <div className="font-bold text-[#F5F3EB] text-base mt-0.5">{summary.totalDetected}</div>
            </button>

            <button
              onClick={() => setActiveFilter('high')}
              className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                activeFilter === 'high'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-white/5 bg-[#171924]/50 text-[#9E9DA5]'
              }`}
            >
              <div className="text-[10px] uppercase font-semibold flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={11} /> Matched
              </div>
              <div className="font-bold text-[#F5F3EB] text-base mt-0.5">{summary.highConfidence}</div>
            </button>

            <button
              onClick={() => setActiveFilter('needs_review')}
              className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                activeFilter === 'needs_review'
                  ? 'border-[#E0AD52] bg-[#E0AD52]/15 text-[#E0AD52]'
                  : 'border-white/5 bg-[#171924]/50 text-[#9E9DA5]'
              }`}
            >
              <div className="text-[10px] uppercase font-semibold flex items-center gap-1 text-[#E0AD52]">
                <AlertTriangle size={11} /> Review
              </div>
              <div className="font-bold text-[#F5F3EB] text-base mt-0.5">{summary.needsReview}</div>
            </button>

            <button
              onClick={() => setActiveFilter('duplicates')}
              className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                activeFilter === 'duplicates'
                  ? 'border-white/40 bg-white/10 text-white'
                  : 'border-white/5 bg-[#171924]/50 text-[#9E9DA5]'
              }`}
            >
              <div className="text-[10px] uppercase font-semibold flex items-center gap-1">
                <Copy size={11} /> Duplicates
              </div>
              <div className="font-bold text-[#F5F3EB] text-base mt-0.5">{summary.duplicates}</div>
            </button>

            <button
              onClick={() => setActiveFilter('unmatched')}
              className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                activeFilter === 'unmatched'
                  ? 'border-white/40 bg-white/10 text-white'
                  : 'border-white/5 bg-[#171924]/50 text-[#9E9DA5]'
              }`}
            >
              <div className="text-[10px] uppercase font-semibold flex items-center gap-1">
                <HelpCircle size={11} /> Unmatched
              </div>
              <div className="font-bold text-[#F5F3EB] text-base mt-0.5">{summary.unmatched}</div>
            </button>
          </div>

          {/* Options Toggles */}
          <div className="p-2.5 rounded-xl bg-[#171924]/40 border border-white/5 flex flex-wrap gap-4 text-xs text-[#9E9DA5]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={importWatchedStatus}
                onChange={(e) => setImportWatchedStatus(e.target.checked)}
                className="cinema-checkbox"
              />
              <span className="text-[#F5F3EB]">Import Watch Status</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={importRatings}
                onChange={(e) => setImportRatings(e.target.checked)}
                className="cinema-checkbox"
              />
              <span className="text-[#F5F3EB]">Import Ratings</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={importNotes}
                onChange={(e) => setImportNotes(e.target.checked)}
                className="cinema-checkbox"
              />
              <span className="text-[#F5F3EB]">Import Notes</span>
            </label>
          </div>

          {/* Candidate List */}
          <div className="max-h-[38dvh] overflow-y-auto overscroll-contain space-y-2 pr-1">
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
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                    isSkipped
                      ? 'border-white/5 bg-[#171924]/20 opacity-50'
                      : candidate.status === 'duplicate'
                      ? 'border-white/10 bg-[#171924]/40'
                      : candidate.confidence === 'high'
                      ? 'border-emerald-500/20 bg-[#171924]/40'
                      : 'border-[#E0AD52]/30 bg-[#171924]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="w-9 h-13 sm:w-10 sm:h-14 bg-[#09090D] rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                        {movie?.posterPath ? (
                          <img
                            src={tmdbService.getImageUrl(movie.posterPath, 'w92')}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-[#5C5B64] text-center">
                            No poster
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-semibold text-[#F5F3EB] text-xs sm:text-sm truncate">
                            {movie ? movie.title : candidate.row.detectedTitle}
                          </span>
                          {movie?.releaseDate && (
                            <span className="text-[11px] text-[#9E9DA5] flex-shrink-0">
                              ({movie.releaseDate.substring(0, 4)})
                            </span>
                          )}
                          {candidate.status === 'duplicate' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-[#9E9DA5] flex-shrink-0">
                              Duplicate
                            </span>
                          )}
                          {candidate.isDuplicateInLibrary && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex-shrink-0">
                              In Vault
                            </span>
                          )}
                          {candidate.isDuplicateInCollection && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300 flex-shrink-0">
                              In Collection
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#9E9DA5] flex items-center gap-1.5 mt-0.5 min-w-0 truncate">
                          <span className="truncate">Source: "{candidate.row.rawText}"</span>
                          {candidate.row.detectedStatus && (
                            <span className="text-[#E0AD52] flex-shrink-0">
                              · {candidate.row.detectedStatus}
                            </span>
                          )}
                          {candidate.row.detectedRating && (
                            <span className="text-[#F5F3EB] flex-shrink-0">
                              · ★ {candidate.row.detectedRating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSearchOverrideId(originalIdx);
                          setSearchOverrideQuery(candidate.row.detectedTitle);
                          handleSearchOverride(candidate.row.detectedTitle);
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#9E9DA5] hover:text-[#F5F3EB] border border-white/5 flex items-center gap-1 cursor-pointer"
                      >
                        <Search size={11} />
                        <span>Change</span>
                      </button>

                      <button
                        onClick={() => handleToggleSkip(originalIdx)}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                          isSkipped
                            ? 'border-[#E0AD52] text-[#E0AD52] bg-[#E0AD52]/10'
                            : 'border-white/10 text-[#9E9DA5] hover:text-[#F5F3EB]'
                        }`}
                      >
                        {isSkipped ? 'Include' : 'Skip'}
                      </button>
                    </div>
                  </div>

                  {/* Ambiguous selector prompt */}
                  {isAmbiguous && !candidate.userOverrideMovie && (
                    <div className="mt-2.5 pt-2 border-t border-[#E0AD52]/20">
                      <div className="text-[11px] text-[#E0AD52] font-semibold mb-1 flex items-center gap-1">
                        <AlertTriangle size={11} />
                        <span>Select the matching movie:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.ambiguousOptions?.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectAmbiguousMatch(originalIdx, opt)}
                            className="text-[11px] px-2 py-0.5 rounded-lg bg-black/40 hover:bg-[#E0AD52] hover:text-black border border-white/10 text-[#F5F3EB] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>{opt.title}</span>
                            <span className="text-[10px] opacity-70">
                              ({opt.releaseDate?.substring(0, 4) || 'N/A'})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual search override inline */}
                  {searchOverrideId === originalIdx && (
                    <div className="mt-2.5 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5 mb-2">
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
                          className="cinema-button-secondary text-xs px-2.5 py-1 cursor-pointer"
                        >
                          Search
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchOverrideId(null)}
                          className="text-[#9E9DA5] hover:text-[#F5F3EB] p-1 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {isSearchingOverride && (
                        <div className="text-xs text-[#9E9DA5] py-1">Searching TMDB...</div>
                      )}

                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {searchOverrideResults.map((res) => (
                          <div
                            key={res.id}
                            onClick={() => handleApplyOverride(originalIdx, res)}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-xs"
                          >
                            <span className="text-[#F5F3EB] truncate flex-1">
                              {res.title} ({res.releaseDate?.substring(0, 4) || 'N/A'})
                            </span>
                            <span className="text-[10px] text-[#E0AD52] font-bold flex-shrink-0">Select</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Success Result */}
      {step === 'success' && (
        <div className="py-6 sm:py-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#E0AD52]/15 border border-[#E0AD52]/40 flex items-center justify-center text-[#E0AD52] mb-3.5 shadow-gold">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="font-bold text-xl sm:text-2xl text-[#F5F3EB] mb-2">Import Complete!</h3>
          <p className="text-xs sm:text-sm text-[#9E9DA5] max-w-sm">
            Successfully imported {commitResult.importedCount} movie{commitResult.importedCount === 1 ? '' : 's'} into your cinema library.
            {commitResult.collectionCount > 0 &&
              ` Added ${commitResult.collectionCount} movie${commitResult.collectionCount === 1 ? '' : 's'} to the collection.`}
          </p>
        </div>
      )}
    </Modal>
  );
};
