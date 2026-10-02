// Haptics Service using Navigator Vibration API

class HapticsService {
  private hapticsEnabled: boolean = true;

  constructor() {
    this.hapticsEnabled = localStorage.getItem('cinema_haptics_enabled') !== 'false';
  }

  setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
    localStorage.setItem('cinema_haptics_enabled', enabled ? 'true' : 'false');
  }

  isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  tap() {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(10);
    } catch {}
  }

  confirm() {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(25);
    } catch {}
  }

  success() {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate([20, 40, 30]);
    } catch {}
  }

  error() {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate([40, 60, 40]);
    } catch {}
  }
}

export const hapticsService = new HapticsService();
