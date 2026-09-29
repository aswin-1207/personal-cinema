import React, { useState, useEffect } from 'react';
import { useCinema } from '../context/CinemaContext';
import { StatsService, CinemaOverviewStats } from '../services/statsService';
import { BackupCenterModal } from '../components/backup/BackupCenterModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { clearAllLocalData } from '../db/database';
import { Achievement } from '../types/backup';
import {
  Film,
  Clock,
  Star,
  Trophy,
  Database,
  Upload,
  Settings,
  Volume2,
  Vibrate,
  Sliders,
  Trash2,
  Lock,
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { preferences, updatePreference, dataVersion, notifyDataChanged, showToast } = useCinema();

  const [stats, setStats] = useState<CinemaOverviewStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Settings form states
  const [displayName, setDisplayName] = useState(preferences.displayName || '');
  const [tmdbApiKey, setTmdbApiKey] = useState(preferences.tmdbApiKey || '');

  useEffect(() => {
    StatsService.getOverview().then(setStats);
    StatsService.evaluateAchievements().then(setAchievements);
  }, [dataVersion]);

  useEffect(() => {
    setDisplayName(preferences.displayName || '');
    setTmdbApiKey(preferences.tmdbApiKey || '');
  }, [preferences]);

  const handleSaveDisplayName = async () => {
    if (displayName.trim()) {
      await updatePreference('displayName', displayName.trim());
      showToast('Display name updated.');
    }
  };

  const handleSaveTmdbKey = async () => {
    await updatePreference('tmdbApiKey', tmdbApiKey.trim());
    showToast('TMDB API Key updated.');
  };

  const handleResetData = async () => {
    if (
      confirm(
        'WARNING: This will permanently delete all your local movies, watch history, and custom collections. Proceed?'
      )
    ) {
      await clearAllLocalData();
      notifyDataChanged();
      showToast('Cinema database wiped.');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-cinema-gold font-semibold mb-1">
            Personal Cinema Vault
          </div>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-cinema-white">
            {preferences.displayName || 'Aswin'}'s Cinema
          </h1>
          <p className="text-xs text-cinema-subtle mt-1">
            Private, local-first catalog. Powered by IndexedDB & TMDB.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="cinema-button-secondary px-4 py-2.5 text-xs flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span>Import Vault</span>
          </button>

          <button
            onClick={() => setIsBackupOpen(true)}
            className="cinema-button-primary px-4 py-2.5 text-xs flex items-center gap-1.5 shadow-gold"
          >
            <Database size={14} />
            <span>Backup Center</span>
          </button>
        </div>
      </div>

      {/* Stats Overview Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-cinema-surface/60 border border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cinema-gold/15 text-cinema-gold flex items-center justify-center">
              <Film size={24} />
            </div>
            <div>
              <span className="text-xs text-cinema-subtle block">Watched Films</span>
              <span className="font-bold text-cinema-white text-xl">{stats.totalWatched}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-cinema-surface/60 border border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cinema-gold/15 text-cinema-gold flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <span className="text-xs text-cinema-subtle block">Screen Time</span>
              <span className="font-bold text-cinema-white text-xl">{stats.totalRuntimeHours} hrs</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-cinema-surface/60 border border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cinema-gold/15 text-cinema-gold flex items-center justify-center">
              <Star size={24} />
            </div>
            <div>
              <span className="text-xs text-cinema-subtle block">Average Rating</span>
              <span className="font-bold text-cinema-white text-xl">
                {stats.averageRating ? `${stats.averageRating} ★` : '—'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-cinema-surface/60 border border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cinema-gold/15 text-cinema-gold flex items-center justify-center">
              <Trophy size={24} />
            </div>
            <div>
              <span className="text-xs text-cinema-subtle block">Mastered Sets</span>
              <span className="font-bold text-cinema-white text-xl">
                {stats.completedCollections} / {stats.totalCollections}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Genres Breakdown */}
      {stats && stats.topGenres.length > 0 && (
        <div className="p-6 rounded-2xl bg-cinema-surface/40 border border-white/5 space-y-4">
          <h3 className="font-serif font-bold text-lg text-cinema-white">Top Screening Genres</h3>
          <div className="space-y-2.5">
            {stats.topGenres.map((g) => {
              const maxCount = stats.topGenres[0].count;
              const percent = Math.round((g.count / maxCount) * 100);
              return (
                <div key={g.name} className="space-y-1">
                  <div className="flex justify-between text-xs text-cinema-silver">
                    <span>{g.name}</span>
                    <span className="text-cinema-subtle">
                      {g.count} {g.count === 1 ? 'film' : 'films'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-cinema-charcoal rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cinema-gold rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements / Milestones Shelf */}
      <div className="p-6 rounded-2xl bg-cinema-surface/40 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif font-bold text-lg text-cinema-white">Milestones & Accolades</h3>
            <p className="text-xs text-cinema-subtle">Earned by screening and archiving films.</p>
          </div>
          <div className="text-xs text-cinema-gold font-semibold">
            {achievements.filter((a) => a.unlockedAt).length} of {achievements.length} Unlocked
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map((ach) => {
            const isUnlocked = Boolean(ach.unlockedAt);
            return (
              <div
                key={ach.id}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  isUnlocked
                    ? 'border-cinema-gold/30 bg-cinema-surface/70'
                    : 'border-white/5 bg-cinema-charcoal/30 opacity-60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUnlocked
                      ? 'bg-cinema-gold/20 text-cinema-gold shadow-gold'
                      : 'bg-cinema-charcoal text-cinema-subtle'
                  }`}
                >
                  {isUnlocked ? <Trophy size={18} /> : <Lock size={16} />}
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-cinema-white">{ach.title}</h4>
                  <p className="text-[11px] text-cinema-subtle leading-tight mt-0.5">
                    {ach.description}
                  </p>
                  {isUnlocked && ach.unlockedAt && (
                    <span className="text-[9px] text-cinema-gold mt-1 block font-mono">
                      Unlocked {new Date(ach.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preferences & Settings */}
      <div className="p-6 rounded-2xl bg-cinema-surface/40 border border-white/5 space-y-6">
        <h3 className="font-serif font-bold text-lg text-cinema-white flex items-center gap-2">
          <Settings size={18} className="text-cinema-gold" />
          <span>Cinema Preferences</span>
        </h3>

        <div className="space-y-4 max-w-xl">
          {/* Display Name */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Aswin"
                className="cinema-input flex-grow text-xs"
              />
              <button
                type="button"
                onClick={handleSaveDisplayName}
                className="cinema-button-secondary px-4 py-2 text-xs"
              >
                Save
              </button>
            </div>
          </div>

          {/* Sound & Haptics & Reduced Motion */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
              <span className="flex items-center gap-2">
                <Volume2 size={16} className="text-cinema-gold" />
                <span>Cinematic Audio Effects (Web Audio Synthesized Chimes)</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.soundEnabled}
                onChange={(e) => updatePreference('soundEnabled', e.target.checked)}
                className="cinema-checkbox"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
              <span className="flex items-center gap-2">
                <Vibrate size={16} className="text-cinema-gold" />
                <span>Haptic Feedback (Mobile Vibrate API)</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.hapticsEnabled}
                onChange={(e) => updatePreference('hapticsEnabled', e.target.checked)}
                className="cinema-checkbox"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
              <span className="flex items-center gap-2">
                <Sliders size={16} className="text-cinema-gold" />
                <span>Reduced Motion Celebrations</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.motionReduced}
                onChange={(e) => updatePreference('motionReduced', e.target.checked)}
                className="cinema-checkbox"
              />
            </label>
          </div>

          {/* TMDB API Key config */}
          <div className="pt-2 border-t border-white/5">
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-1.5 font-medium">
              TMDB API Key (Optional Override)
            </label>
            <p className="text-[11px] text-cinema-subtle mb-2">
              Personal Cinema includes a built-in TMDB key. You can provide your own personal TMDB v3
              key if desired.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tmdbApiKey}
                onChange={(e) => setTmdbApiKey(e.target.value)}
                placeholder="Leave blank to use default key"
                className="cinema-input flex-grow text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleSaveTmdbKey}
                className="cinema-button-secondary px-4 py-2 text-xs"
              >
                Update
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-cinema-crimson/20">
            <h4 className="text-xs uppercase tracking-wider text-cinema-crimson font-bold mb-1">
              Danger Zone
            </h4>
            <p className="text-xs text-cinema-subtle mb-3">
              Clear all local database records including movies, watched dates, and collections.
            </p>
            <button
              onClick={handleResetData}
              className="px-4 py-2 rounded-lg bg-cinema-crimson/15 hover:bg-cinema-crimson/30 border border-cinema-crimson/40 text-cinema-crimson text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Wipe Local Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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
