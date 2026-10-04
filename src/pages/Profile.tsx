import React, { useEffect, useState } from 'react';
import { ChevronRight, DatabaseBackup, FileUp, Heart, Layers, PenLine, Trash2, Volume2, Vibrate, Sparkles } from 'lucide-react';
import { useCinema } from '../context/CinemaContext';
import { BackupCenterModal } from '../components/backup/BackupCenterModal';
import { ImportWizard } from '../components/import/ImportWizard';
import { Modal } from '../components/common/Modal';
import { clearAllLocalData } from '../db/database';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { getInitials } from '../components/ui/ProfileButton';
import { UserPreferences } from '../types/backup';

const Toggle: React.FC<{
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, icon, checked, onChange }) => (
  <label className="flex items-center gap-3 min-h-[60px] px-4 cursor-pointer">
    <span className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center text-muted shrink-0" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[14px] font-semibold text-text">{label}</span>
      {description && <span className="block text-[12px] text-muted">{description}</span>}
    </span>
    <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
    <span
      className="relative w-11 h-6 rounded-full bg-line-strong transition-colors peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-text after:transition-transform peer-checked:after:translate-x-5"
      aria-hidden="true"
    />
  </label>
);

const RowButton: React.FC<{ icon: React.ReactNode; label: string; description?: string; onClick: () => void; danger?: boolean }> = ({
  icon,
  label,
  description,
  onClick,
  danger,
}) => (
  <button type="button" onClick={onClick} className="w-full flex items-center gap-3 min-h-[60px] px-4 text-left hover:bg-white/[0.03]">
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-[#F0848A]/10 text-[#F0848A]' : 'bg-surface-2 text-gold'}`} aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-[14px] font-semibold ${danger ? 'text-[#F0848A]' : 'text-text'}`}>{label}</span>
      {description && <span className="block text-[12px] text-muted">{description}</span>}
    </span>
    <ChevronRight size={16} className="text-subtle" aria-hidden="true" />
  </button>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2" aria-label={title}>
    <h2 className="font-caps-label text-muted px-1">{title}</h2>
    <div className="rounded-2xl bg-surface border border-line divide-y divide-line overflow-hidden">{children}</div>
  </section>
);

export const Profile: React.FC = () => {
  const { preferences, updatePreference, notifyDataChanged, showToast, setActiveTab, dataVersion } = useCinema();
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [displayName, setDisplayName] = useState(preferences.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [summary, setSummary] = useState({ titles: 0, favorites: 0, reviews: 0, collections: 0 });

  useEffect(() => setDisplayName(preferences.displayName || ''), [preferences.displayName]);

  useEffect(() => {
    let alive = true;
    Promise.all([UserMovieRepository.getAll(), CollectionRepository.getAll()])
      .then(([rows, cols]) => {
        if (!alive) return;
        const tracked = rows.filter((r) => r.status && r.status !== 'none');
        setSummary({
          titles: tracked.length,
          favorites: rows.filter((r) => r.isFavorite).length,
          reviews: rows.filter((r) => r.review?.trim()).length,
          collections: cols.length,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dataVersion]);

  const nameDirty = displayName.trim() !== (preferences.displayName || '').trim();

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameDirty) return;
    setSavingName(true);
    try {
      await updatePreference('displayName', displayName.trim());
      showToast('Name saved');
    } finally {
      setSavingName(false);
    }
  };

  const setPref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => updatePreference(key, value);

  const clearAll = async () => {
    setClearing(true);
    try {
      await clearAllLocalData();
      notifyDataChanged();
      setIsClearOpen(false);
      showToast('All data on this device was erased');
    } catch {
      showToast("Couldn't erase data. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  const lastBackup = preferences.lastBackupDate
    ? new Date(preferences.lastBackupDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6 pb-6 max-w-2xl">
      <PageHeader title="My Cinema" showProfile={false} />

      <section className="rounded-[20px] bg-surface border border-line p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <span
            className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-[#9B6B1E] text-ink text-[22px] font-bold flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            {getInitials(preferences.displayName)}
          </span>
          <form onSubmit={saveName} className="min-w-0 flex-1 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="display-name" className="block text-[12px] text-muted mb-1">
                Display name
              </label>
              <input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                autoComplete="nickname"
                placeholder="Your name"
                className="cinema-input w-full"
              />
            </div>
            {nameDirty && (
              <Button type="submit" size="sm" isLoading={savingName} className="min-h-11">
                Save
              </Button>
            )}
          </form>
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ['Titles', summary.titles],
            ['Favorites', summary.favorites],
            ['Reviews', summary.reviews],
            ['Collections', summary.collections],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-2 py-2">
              <dd className="text-[17px] font-bold text-text tabular-nums">{value}</dd>
              <dt className="text-[10.5px] text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <Group title="Your cinema">
        <RowButton icon={<PenLine size={17} />} label="Reviews" description="Everything you have written" onClick={() => setActiveTab('reviews')} />
        <RowButton icon={<Heart size={17} />} label="Favorites" onClick={() => setActiveTab('watched', 'favorites')} />
        <RowButton icon={<Layers size={17} />} label="Collections" onClick={() => setActiveTab('collections')} />
      </Group>

      <Group title="Data & backup">
        <RowButton
          icon={<DatabaseBackup size={17} />}
          label="Backup & restore"
          description={lastBackup ? `Last backup ${lastBackup}` : 'No backup yet'}
          onClick={() => setIsBackupOpen(true)}
        />
        <RowButton icon={<FileUp size={17} />} label="Import a list" description="CSV, Excel or text file" onClick={() => setIsImportOpen(true)} />
      </Group>

      <Group title="Preferences">
        <Toggle icon={<Volume2 size={17} />} label="Sound" checked={preferences.soundEnabled} onChange={(v) => setPref('soundEnabled', v)} />
        <Toggle icon={<Vibrate size={17} />} label="Haptics" description="On supported phones" checked={preferences.hapticsEnabled} onChange={(v) => setPref('hapticsEnabled', v)} />
        <Toggle icon={<Sparkles size={17} />} label="Reduce motion" checked={preferences.motionReduced} onChange={(v) => setPref('motionReduced', v)} />
      </Group>

      <Group title="Device">
        <RowButton icon={<Trash2 size={17} />} label="Erase all data" description="Removes everything saved on this device" onClick={() => setIsClearOpen(true)} danger />
      </Group>

      <p className="text-[11px] text-subtle text-center">Title data and images provided by TMDB.</p>

      <BackupCenterModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={() => {
          setIsImportOpen(false);
          notifyDataChanged();
        }}
      />
      <Modal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title="Erase all data?"
        maxWidth={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={clearing} onClick={clearAll}>
              Erase
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">
          Your watchlist, watch history, ratings, reviews and collections will be permanently removed from this device. Create a backup first if you
          may want them back.
        </p>
      </Modal>
    </div>
  );
};
