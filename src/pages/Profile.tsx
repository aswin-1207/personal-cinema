import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { StatsService } from '../services/statsService';
import { BackupCenterModal } from '../components/backup/BackupCenterModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { Modal } from '../components/common/Modal';
import { CinemaButton } from '../components/common/CinemaButton';
import { CinemaToggle } from '../components/common/CinemaToggle';
import { clearAllLocalData } from '../db/database';
import { tmdbService, TMDBDiagnostics } from '../services/tmdbService';
import { Achievement } from '../types/backup';
import { CinemaHeader } from '../components/ui/CinemaHeader';
import {
  Trophy,
  Database,
  Upload,
  Volume2,
  Vibrate,
  Sliders,
  Trash2,
  Lock,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { preferences, updatePreference, dataVersion, notifyDataChanged, showToast } = useCinema();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Settings form states
  const [displayName, setDisplayName] = useState(preferences.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // TMDB advanced states
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [tmdbApiKey, setTmdbApiKey] = useState(preferences.tmdbApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [diagnostics, setDiagnostics] = useState<TMDBDiagnostics | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const res = await tmdbService.runDiagnostics();
      setDiagnostics(res);
      if (res.isConnected) {
        showToast('TMDB Connection: OK (200)');
      } else {
        showToast(`TMDB Connection: ${res.lastError}`);
      }
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  useEffect(() => {
    StatsService.evaluateAchievements().then(setAchievements);
  }, [dataVersion]);

  useEffect(() => {
    setDisplayName(preferences.displayName || '');
    setTmdbApiKey(preferences.tmdbApiKey || '');
  }, [preferences]);

  const handleSaveDisplayName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (displayName.trim()) {
      setIsSavingName(true);
      await updatePreference('displayName', displayName.trim());
      setIsSavingName(false);
      showToast('Display name updated.');
    }
  };

  const handleSaveTmdbKey = async () => {
    await updatePreference('tmdbApiKey', tmdbApiKey.trim());
    showToast(tmdbApiKey.trim() ? 'Personal TMDB key updated.' : 'Using default built-in TMDB key.');
  };

  const handleResetTmdbKey = async () => {
    setTmdbApiKey('');
    await updatePreference('tmdbApiKey', '');
    showToast('Reset to default TMDB configuration.');
  };

  const handleConfirmClear = async () => {
    setIsConfirmClearOpen(false);
    await clearAllLocalData();
    notifyDataChanged();
    showToast('All local cinema data wiped.');
  };

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="space-y-6 pb-28 select-none animate-cinema-fade max-w-3xl mx-auto">
      {/* Header matching Figma 2:451 */}
      <CinemaHeader
        badge="VAULT & PREFERENCES"
        title="My Cinema"
        subtitle="Your profile, preferences and private data."
      />

      {/* User Profile Card matching Figma 2:451 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131319] border border-white/[0.08] flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="w-14 h-14 rounded-2xl bg-[#1B1B22] border border-[#E0AD52]/30 flex items-center justify-center font-bold text-lg text-[#E0AD52] shadow-[0_0_16px_rgba(224,173,82,0.15)] flex-shrink-0">
          {displayName ? displayName.substring(0, 2).toUpperCase() : 'AS'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-base sm:text-lg text-[#F5F3EB] tracking-wide uppercase truncate">
            {displayName || 'ASWIN'}
          </div>
          <div className="text-xs text-[#9E9DA5] mt-0.5">
            MyCinema member
          </div>
        </div>
      </div>

      {/* PREFERENCES matching Figma 2:451 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] px-1">
          Preferences
        </h2>
        <div className="p-2 sm:p-3 rounded-2xl bg-[#131319] border border-white/[0.08] space-y-1 divide-y divide-white/[0.04]">
          <CinemaToggle
            icon={<Volume2 size={18} className="text-[#E0AD52]" />}
            label="Sound"
            description="Synthesized harmonic chimes and audio interactions."
            checked={preferences.soundEnabled}
            onChange={(checked) => updatePreference('soundEnabled', checked)}
          />

          <CinemaToggle
            icon={<Vibrate size={18} className="text-[#E0AD52]" />}
            label="Haptics"
            description="Tactile vibration pulses on supported mobile devices."
            checked={preferences.hapticsEnabled}
            onChange={(checked) => updatePreference('hapticsEnabled', checked)}
          />

          <CinemaToggle
            icon={<Sliders size={18} className="text-[#E0AD52]" />}
            label="Reduced Motion"
            description="Minimize complex cinematic zooms and animations."
            checked={preferences.motionReduced}
            onChange={(checked) => updatePreference('motionReduced', checked)}
          />
        </div>
      </section>

      {/* DATA & BACKUP matching Figma 2:451 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] px-1">
          Data & Backup
        </h2>
        <div className="rounded-2xl bg-[#131319] border border-white/[0.08] divide-y divide-white/[0.04] overflow-hidden">
          <button
            onClick={() => setIsBackupOpen(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer border-none bg-transparent"
          >
            <div className="flex items-center gap-3">
              <Database size={18} className="text-[#E0AD52]" />
              <div>
                <div className="text-sm font-semibold text-[#F5F3EB]">Backup Center</div>
                <div className="text-xs text-[#9E9DA5]">Protect your catalog with encrypted snapshots and restore.</div>
              </div>
            </div>
            <span className="text-[#9E9DA5] text-lg font-mono">›</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer border-none bg-transparent"
          >
            <div className="flex items-center gap-3">
              <Upload size={18} className="text-[#E0AD52]" />
              <div>
                <div className="text-sm font-semibold text-[#F5F3EB]">Import / Export</div>
                <div className="text-xs text-[#9E9DA5]">Ingest external lists or export structured JSON / CSV.</div>
              </div>
            </div>
            <span className="text-[#9E9DA5] text-lg font-mono">›</span>
          </button>
        </div>
      </section>

      {/* Milestones & Accolades (Section 21) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5]">
              Milestones & Accolades
            </h2>
            <p className="text-xs text-[#5C5B64] mt-0.5">
              {unlockedCount === 0
                ? 'Your first screening starts everything.'
                : `${unlockedCount} of ${achievements.length} achievements unlocked.`}
            </p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              unlockedCount > 0
                ? 'bg-[#E0AD52]/20 text-[#E0AD52] border border-[#E0AD52]/40'
                : 'bg-white/5 text-[#9E9DA5] border border-white/5'
            }`}
          >
            {unlockedCount > 0 ? `${unlockedCount} Unlocked` : 'Waiting for 1st Film'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map((ach) => {
            const isUnlocked = Boolean(ach.unlockedAt);
            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-3 ${
                  isUnlocked
                    ? 'border-[#E0AD52]/30 bg-[#131319] shadow-[0_4px_16px_rgba(224,173,82,0.12)]'
                    : 'border-white/[0.06] bg-[#0E0E14]/60 opacity-60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUnlocked
                      ? 'bg-[#E0AD52] text-[#09090B] shadow-sm'
                      : 'bg-white/5 text-[#5C5B64]'
                  }`}
                >
                  {isUnlocked ? <Trophy size={18} /> : <Lock size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-[#F5F3EB] truncate">{ach.title}</h4>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        isUnlocked
                          ? 'bg-[#E0AD52]/20 text-[#E0AD52]'
                          : 'bg-white/5 text-[#5C5B64]'
                      }`}
                    >
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9E9DA5] leading-snug mt-0.5">
                    {ach.description}
                  </p>
                  {isUnlocked && ach.unlockedAt && (
                    <span className="text-[10px] text-[#E0AD52] mt-1 block font-mono">
                      ✓ Earned {new Date(ach.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ACCOUNT matching Figma 2:451 */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E9DA5] px-1">
          Account
        </h2>
        <div className="p-4 sm:p-5 rounded-2xl bg-[#131319] border border-white/[0.08]">
          <form onSubmit={handleSaveDisplayName} className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-[#9E9DA5] font-semibold">
              Display Name
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Aswin"
                className="cinema-input flex-1 text-sm bg-[#1B1B22]"
              />
              <CinemaButton
                type="submit"
                variant="secondary"
                size="md"
                isLoading={isSavingName}
                className="sm:w-auto w-full"
              >
                Save
              </CinemaButton>
            </div>
          </form>
        </div>
      </section>

      {/* Advanced TMDB Configuration (Section 27) */}
      <section className="rounded-2xl bg-[#131319]/70 border border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between text-left text-xs text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/[0.02] cursor-pointer transition-colors border-none bg-transparent"
        >
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound size={15} className="text-[#E0AD52]" />
            <span>Advanced Configuration (TMDB Key Override)</span>
          </div>
          {isAdvancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isAdvancedOpen && (
          <div className="p-5 pt-0 border-t border-white/[0.04] space-y-3 mt-3 animate-cinema-fade">
            <p className="text-xs text-[#9E9DA5] leading-relaxed">
              Personal Cinema includes a built-in TMDB key. You only need to enter your personal v3 key
              if you exceed rate limits or prefer custom proxy routing.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={tmdbApiKey}
                  onChange={(e) => setTmdbApiKey(e.target.value)}
                  placeholder="Leave empty for default key"
                  className="cinema-input text-xs font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9DA5] hover:text-[#F5F3EB] border-none bg-transparent cursor-pointer"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="flex gap-2">
                <CinemaButton variant="secondary" size="sm" onClick={handleSaveTmdbKey}>
                  Update
                </CinemaButton>
                {tmdbApiKey && (
                  <CinemaButton variant="ghost" size="sm" onClick={handleResetTmdbKey}>
                    Reset
                  </CinemaButton>
                )}
              </div>
            </div>

            {/* Live Diagnostics Tool (Section 20) */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F5F3EB]">Connection Diagnostics</span>
                <CinemaButton
                  variant="secondary"
                  size="sm"
                  isLoading={isRunningDiagnostics}
                  onClick={handleRunDiagnostics}
                >
                  Test TMDB Connection
                </CinemaButton>
              </div>

              {diagnostics && (
                <div className="p-3 rounded-xl bg-[#09090B] border border-white/10 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#9E9DA5]">TMDB Configured:</span>
                    <span className={diagnostics.isConfigured ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                      {diagnostics.isConfigured ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9DA5]">Auth Mechanism:</span>
                    <span className="text-[#E0AD52]">
                      {diagnostics.authType === 'bearer_token' ? 'Read Access Token (Bearer)' : 'v3 API Key'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9DA5]">Credential Source:</span>
                    <span className="text-[#F5F2F0]">
                      {diagnostics.authSource === 'user_override'
                        ? 'User Override (Saved)'
                        : diagnostics.authSource === 'environment'
                        ? 'Vite Environment'
                        : 'Built-in Master Key'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9E9DA5]">Connection Status:</span>
                    <span className={diagnostics.isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnostics.isConnected ? `CONNECTED (${diagnostics.latencyMs}ms)` : 'FAILED'}
                    </span>
                  </div>
                  {diagnostics.sampleMovieTitle && (
                    <div className="flex justify-between">
                      <span className="text-[#9E9DA5]">Sample Query:</span>
                      <span className="text-[#F5F2F0]">"{diagnostics.sampleMovieTitle}" (TMDB ID 27205)</span>
                    </div>
                  )}
                  {diagnostics.lastError && (
                    <div className="pt-1 text-rose-400 text-[11px]">
                      Error: {diagnostics.lastError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Danger Zone (Section 28 & 29) */}
      <section className="p-5 rounded-2xl bg-[#B81C28]/10 border border-[#B81C28]/25 space-y-3">
        <div className="flex items-center gap-2 text-[#D94048]">
          <AlertTriangle size={18} />
          <h3 className="text-xs uppercase tracking-wider font-extrabold">Danger Zone</h3>
        </div>
        <p className="text-xs text-[#9E9DA5] leading-relaxed">
          These actions can permanently remove local cinema records, ratings, collections, and screening history from this device.
        </p>

        <CinemaButton
          variant="danger"
          size="md"
          icon={<Trash2 size={15} />}
          onClick={() => setIsConfirmClearOpen(true)}
        >
          Clear Local Cinema
        </CinemaButton>
      </section>

      {/* Clear Database Confirmation Modal (Section 29) */}
      <Modal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear Local Cinema"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-left">
          <div className="p-3.5 rounded-xl bg-[#B81C28]/15 border border-[#B81C28]/30 flex items-start gap-3">
            <AlertTriangle size={20} className="text-[#D94048] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#F5F2F0] leading-relaxed">
              This will permanently delete your movies, watched history, custom collections, personal ratings, and notes from IndexedDB.
            </p>
          </div>

          <p className="text-xs text-[#9E9DA5]">
            Consider creating a backup first via <strong>Backup Center</strong> before proceeding.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <CinemaButton
              variant="ghost"
              size="md"
              onClick={() => setIsConfirmClearOpen(false)}
            >
              Cancel
            </CinemaButton>
            <CinemaButton
              variant="danger"
              size="md"
              onClick={handleConfirmClear}
            >
              Clear Everything
            </CinemaButton>
          </div>
        </div>
      </Modal>

      {/* Backup and Import Modals */}
      <BackupCenterModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={() => {
          notifyDataChanged();
          showToast('Import completed successfully!');
        }}
      />
    </div>
  );
};
