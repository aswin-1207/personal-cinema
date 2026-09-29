import { getDB } from '../database';
import { UserPreferences, Achievement } from '../../types/backup';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'cinematic-dark',
  soundEnabled: true,
  hapticsEnabled: true,
  motionReduced: false,
  tmdbApiKey: 'b8b7e2d9b936e7ec548679d98bc19d3e', // Default demo key, customizable in profile
  backupReminderDays: 30,
  lastBackupDate: null,
};

export class PreferencesRepository {
  static async getPreferences(): Promise<UserPreferences> {
    try {
      const db = await getDB();
      const stored = await db.get('preferences', 'user_preferences');
      if (stored && stored.value) {
        return { ...DEFAULT_PREFERENCES, ...stored.value };
      }
    } catch {
      // Fallback if DB is initializing
    }
    return DEFAULT_PREFERENCES;
  }

  static async savePreferences(prefs: UserPreferences): Promise<void> {
    const db = await getDB();
    await db.put('preferences', { key: 'user_preferences', value: prefs });
  }

  static async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<UserPreferences> {
    const current = await this.getPreferences();
    current[key] = value;
    await this.savePreferences(current);
    return current;
  }

  static async getAchievements(): Promise<Achievement[]> {
    const db = await getDB();
    return db.getAll('achievements');
  }

  static async saveAchievements(achievements: Achievement[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('achievements', 'readwrite');
    for (const a of achievements) {
      await tx.objectStore('achievements').put(a);
    }
    await tx.done;
  }
}
