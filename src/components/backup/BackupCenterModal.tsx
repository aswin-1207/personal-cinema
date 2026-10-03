import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { BackupService } from '../../services/backupService';
import { ExportService } from '../../services/exportService';
import { BackupValidationResult, ConflictItem } from '../../types/backup';
import { useCinema } from '../../context/CinemaContext';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Database,
} from 'lucide-react';

interface BackupCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupCenterModal: React.FC<BackupCenterModalProps> = ({ isOpen, onClose }) => {
  const { notifyDataChanged, showToast } = useCinema();

  // Health state
  const [health, setHealth] = useState<{
    moviesCount: number;
    watchedCount: number;
    collectionsCount: number;
    ratingsCount: number;
    lastBackupDate: string | null;
    daysSinceLastBackup: number | null;
    isBackupOverdue: boolean;
  } | null>(null);

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BackupValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'current' | 'backup'>>(
    new Map()
  );
  const [isRestoring, setIsRestoring] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshHealth = async () => {
    const h = await BackupService.getHealthSummary();
    setHealth(h);
  };

  useEffect(() => {
    if (isOpen) {
      refreshHealth();
      setRestoreFile(null);
      setValidation(null);
      setConflicts([]);
      setConflictResolutions(new Map());
      setShowReplaceConfirm(false);
    }
  }, [isOpen]);

  const handleDownloadFullBackup = async () => {
    const filename = await BackupService.downloadBackupFile();
    showToast(`Backup downloaded: ${filename}`);
    await refreshHealth();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setRestoreFile(file);

    try {
      const text = await file.text();
      const val = BackupService.validateBackupJSON(text);
      setValidation(val);

      if (val.isValid && val.backupData) {
        const detected = await BackupService.detectConflicts(val.backupData);
        setConflicts(detected);

        // Default resolutions to 'current'
        const initialResolutions = new Map<string, 'current' | 'backup'>();
        detected.forEach((c) => {
          initialResolutions.set(`${c.movieId}_${c.field}`, 'backup');
        });
        setConflictResolutions(initialResolutions);
      }
    } catch (err) {
      setValidation({
        isValid: false,
        backupVersion: 0,
        createdAt: '',
        counts: { movies: 0, watched: 0, collections: 0, ratings: 0 },
        errors: ['Could not read file.'],
        warnings: [],
      });
    }
  };

  const handleConflictResolve = (key: string, choice: 'current' | 'backup') => {
    setConflictResolutions((prev) => {
      const next = new Map(prev);
      next.set(key, choice);
      return next;
    });
  };

  const handleExecuteRestore = async () => {
    if (!validation?.backupData) return;

    if (restoreMode === 'replace' && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }

    try {
      setIsRestoring(true);
      if (restoreMode === 'replace') {
        await BackupService.restoreWithReplace(validation.backupData);
        showToast('Cinema completely replaced from backup.');
      } else {
        const res = await BackupService.restoreWithMerge(
          validation.backupData,
          conflictResolutions
        );
        showToast(
          `Smart Merge complete: restored ${res.mergedMovies} movies, ${res.mergedCollections} collections.`
        );
      }

      notifyDataChanged();
      onClose();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
      setShowReplaceConfirm(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Backup & Restore Center"
      maxWidth="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="cinema-button-secondary px-5 py-2 text-xs font-semibold cursor-pointer"
        >
          Close
        </button>
      }
    >
      <div className="space-y-6">
        {/* Health Monitoring Status Banner */}
        {health && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              health.isBackupOverdue
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {health.isBackupOverdue ? (
                <ShieldAlert size={28} className="text-amber-400 flex-shrink-0" />
              ) : (
                <ShieldCheck size={28} className="text-emerald-400 flex-shrink-0" />
              )}
              <div>
                <h4 className="font-semibold text-sm text-cinema-white">
                  {health.isBackupOverdue ? 'Backup Recommended' : 'Cinema Data Secured'}
                </h4>
                <p className="text-xs text-cinema-silver mt-0.5">
                  {health.lastBackupDate
                    ? `Last backed up ${health.daysSinceLastBackup} days ago (${new Date(
                        health.lastBackupDate
                      ).toLocaleDateString()})`
                    : 'No backup has been created yet for your cinema.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadFullBackup}
              className="cinema-button-primary px-4 py-2 text-xs flex items-center gap-1.5 flex-shrink-0"
            >
              <Download size={14} />
              <span>Back Up Now</span>
            </button>
          </div>
        )}

        {/* Section 1: Full Export */}
        <div className="bg-cinema-surface/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <h4 className="font-semibold text-cinema-white text-sm">Full Library JSON Backup</h4>
          <button
            onClick={handleDownloadFullBackup}
            className="cinema-button-secondary px-4 py-2 text-xs flex items-center gap-1.5 flex-shrink-0 ml-4"
          >
            <Database size={14} />
            <span>Export JSON</span>
          </button>
        </div>

        {/* Section 2: Restore from Backup */}
        <div className="bg-cinema-surface/40 p-4 rounded-xl border border-white/5 space-y-3">
          <h4 className="font-semibold text-cinema-white text-sm">Restore from Backup</h4>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-white/15 hover:border-cinema-gold/60 p-4 rounded-xl text-center cursor-pointer bg-cinema-charcoal/30 hover:bg-cinema-charcoal/60 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex items-center justify-center gap-2 text-xs text-cinema-silver">
              <Upload size={16} className="text-cinema-gold" />
              <span>{restoreFile ? restoreFile.name : 'Select or drop JSON backup file here'}</span>
            </div>
          </div>

          {/* Validation & Preview Card */}
          {validation && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                validation.isValid
                  ? 'border-emerald-500/30 bg-emerald-950/15'
                  : 'border-cinema-crimson/30 bg-cinema-crimson/10'
              }`}
            >
              {validation.isValid ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <CheckCircle size={14} /> Valid MyCinema Backup (v{validation.backupVersion})
                    </span>
                    <span className="text-cinema-subtle">
                      Created: {new Date(validation.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-emerald-500/15 text-cinema-silver">
                    <div>
                      <span className="text-cinema-subtle block">Movies</span>
                      <span className="font-semibold text-cinema-white text-sm">
                        {validation.counts.movies}
                      </span>
                    </div>
                    <div>
                      <span className="text-cinema-subtle block">Watched</span>
                      <span className="font-semibold text-cinema-white text-sm">
                        {validation.counts.watched}
                      </span>
                    </div>
                    <div>
                      <span className="text-cinema-subtle block">Collections</span>
                      <span className="font-semibold text-cinema-white text-sm">
                        {validation.counts.collections}
                      </span>
                    </div>
                    <div>
                      <span className="text-cinema-subtle block">Ratings</span>
                      <span className="font-semibold text-cinema-white text-sm">
                        {validation.counts.ratings}
                      </span>
                    </div>
                  </div>

                  {/* Restore Mode Switch */}
                  <div className="pt-2 border-t border-emerald-500/15">
                    <label className="block text-[11px] uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
                      Restore Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRestoreMode('merge')}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          restoreMode === 'merge'
                            ? 'border-cinema-gold bg-cinema-gold/15 text-cinema-gold font-semibold'
                            : 'border-white/10 bg-cinema-surface text-cinema-silver'
                        }`}
                      >
                        Smart Merge (Recommended)
                        <div className="text-[10px] text-cinema-subtle font-normal mt-0.5">
                          Preserves local data, adds missing movies, resolves conflicts.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode('replace')}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          restoreMode === 'replace'
                            ? 'border-cinema-crimson bg-cinema-crimson/15 text-cinema-crimson font-semibold'
                            : 'border-white/10 bg-cinema-surface text-cinema-silver'
                        }`}
                      >
                        Replace My Cinema
                        <div className="text-[10px] text-cinema-subtle font-normal mt-0.5">
                          Wipes current local database and restores exact backup.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Conflict Resolver UI (if Smart Merge & conflicts exist) */}
                  {restoreMode === 'merge' && conflicts.length > 0 && (
                    <div className="pt-2 border-t border-emerald-500/15">
                      <div className="text-[11px] text-cinema-amber font-semibold mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={13} />
                        <span>{conflicts.length} conflicting items found. Choose values to keep:</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {conflicts.map((c) => {
                          const key = `${c.movieId}_${c.field}`;
                          const currentChoice = conflictResolutions.get(key) || 'backup';
                          return (
                            <div
                              key={key}
                              className="p-2 rounded bg-cinema-charcoal flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-semibold text-cinema-white">{c.movieTitle}</span>
                                <span className="text-cinema-subtle ml-2">
                                  Field: <span className="text-cinema-gold">{c.field}</span>
                                </span>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleConflictResolve(key, 'current')}
                                  className={`px-2 py-0.5 rounded text-[11px] border ${
                                    currentChoice === 'current'
                                      ? 'bg-cinema-gold text-cinema-black border-cinema-gold font-medium'
                                      : 'bg-cinema-surface text-cinema-subtle border-white/10'
                                  }`}
                                >
                                  Keep Local ({String(c.currentValue)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConflictResolve(key, 'backup')}
                                  className={`px-2 py-0.5 rounded text-[11px] border ${
                                    currentChoice === 'backup'
                                      ? 'bg-cinema-gold text-cinema-black border-cinema-gold font-medium'
                                      : 'bg-cinema-surface text-cinema-subtle border-white/10'
                                  }`}
                                >
                                  Use Backup ({String(c.backupValue)})
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Replace Confirmation Alert */}
                  {showReplaceConfirm && (
                    <div className="p-3 rounded-lg bg-cinema-crimson/20 border border-cinema-crimson text-cinema-white space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-cinema-crimson">
                        <AlertTriangle size={16} />
                        <span>Warning: Permanent Overwrite</span>
                      </div>
                      <p className="text-xs text-cinema-silver">
                        This action will erase all currently stored local movies, watched dates, and custom
                        collections, replacing them completely with this backup. This cannot be undone.
                      </p>
                    </div>
                  )}

                  {/* Restore Execute Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        restoreMode === 'replace'
                          ? 'bg-cinema-crimson hover:bg-cinema-crimsonSoft text-cinema-white shadow-lg'
                          : 'cinema-button-primary'
                      }`}
                    >
                      <RefreshCw size={14} className={isRestoring ? 'animate-spin' : ''} />
                      <span>
                        {showReplaceConfirm
                          ? 'Confirm & Overwrite All Data'
                          : restoreMode === 'replace'
                          ? 'Replace My Cinema'
                          : 'Execute Smart Merge'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-cinema-crimson space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle size={14} /> Invalid Backup File
                  </div>
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-cinema-silver text-[11px]">
                      • {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Partial Exports */}
        <div className="bg-cinema-surface/40 p-4 rounded-xl border border-white/5 space-y-3">
          <h4 className="font-semibold text-cinema-white text-sm">Partial Table Exports</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-cinema-charcoal/50 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-medium text-cinema-white text-xs block">Full Cinema Library</span>
                <span className="text-[11px] text-cinema-subtle">All movies & statuses</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => ExportService.exportLibrary('csv')}
                  className="px-2.5 py-1 rounded bg-cinema-surface hover:bg-cinema-gold hover:text-cinema-black text-cinema-silver text-[11px] border border-white/5 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => ExportService.exportLibrary('json')}
                  className="px-2.5 py-1 rounded bg-cinema-surface hover:bg-cinema-gold hover:text-cinema-black text-cinema-silver text-[11px] border border-white/5 transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-cinema-charcoal/50 border border-white/5 flex items-center justify-between">
              <div>
                <span className="font-medium text-cinema-white text-xs block">Watched History</span>
                <span className="text-[11px] text-cinema-subtle">Ratings, dates, reviews</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => ExportService.exportWatchHistory('csv')}
                  className="px-2.5 py-1 rounded bg-cinema-surface hover:bg-cinema-gold hover:text-cinema-black text-cinema-silver text-[11px] border border-white/5 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => ExportService.exportWatchHistory('json')}
                  className="px-2.5 py-1 rounded bg-cinema-surface hover:bg-cinema-gold hover:text-cinema-black text-cinema-silver text-[11px] border border-white/5 transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
