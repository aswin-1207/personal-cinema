// Centralized, Reference-Counted Scroll Lock Manager
// Prevents ghost locks, tab-switching desynchronizations, and mobile freeze bugs.

export class ScrollLockManager {
  private static lockCount = 0;
  private static originalBodyOverflow = '';
  private static originalHtmlOverflow = '';

  /**
   * Acquire a scroll lock (called when a modal, drawer, or dialog opens)
   */
  static lock(): void {
    if (typeof document === 'undefined') return;
    this.lockCount++;

    if (this.lockCount === 1) {
      this.originalBodyOverflow = document.body.style.overflow;
      this.originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');

      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Release a scroll lock (called when a modal closes or unmounts)
   */
  static unlock(): void {
    if (typeof document === 'undefined') return;
    this.lockCount = Math.max(0, this.lockCount - 1);

    if (this.lockCount === 0) {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');

      document.body.style.overflow = this.originalBodyOverflow || '';
      document.documentElement.style.overflow = this.originalHtmlOverflow || '';
    }
  }

  /**
   * Force unlock all locks (called during tab change, route change, or error recovery)
   */
  static forceUnlockAll(): void {
    if (typeof document === 'undefined') return;
    this.lockCount = 0;

    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');

    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  /**
   * Check if any modal lock is currently active
   */
  static isLocked(): boolean {
    return this.lockCount > 0;
  }
}
