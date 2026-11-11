export interface FocusWatchOptions {
  /** strict: tab hidden or window blurred. lenient: tab hidden only. */
  mode(): 'strict' | 'lenient';
  /** Attention left: start slowing down. */
  onLeave(at: number): void;
  /** Attention has been away for the grace period: it is a pull-over. */
  onPullOver(at: number): void;
  /** Came back within the grace period: carry on as if nothing happened. */
  onQuickReturn(): void;
  /** Came back after a pull-over. */
  onReturn(): void;
  graceMs: number;
}

/**
 * Watches tab visibility and window focus. Leaving starts a coast-down; if
 * attention is still away when the vehicle would have stopped, that counts
 * as one pull-over.
 */
export class FocusWatch {
  private away = false;
  private pulled = false;
  private leftAt = 0;
  private timer = 0;

  constructor(private readonly o: FocusWatchOptions) {
    document.addEventListener('visibilitychange', this.check);
    window.addEventListener('blur', this.check);
    window.addEventListener('focus', this.check);
  }

  /** Re-evaluate, e.g. after the mode setting changed. */
  readonly check = (): void => {
    const isAway = document.hidden || (this.o.mode() === 'strict' && !document.hasFocus());
    if (isAway === this.away) return;
    this.away = isAway;
    if (isAway) {
      this.leftAt = Date.now();
      this.pulled = false;
      this.o.onLeave(this.leftAt);
      this.timer = window.setTimeout(() => {
        this.pulled = true;
        this.o.onPullOver(this.leftAt);
      }, this.o.graceMs);
    } else {
      window.clearTimeout(this.timer);
      if (this.pulled) this.o.onReturn();
      else if (Date.now() - this.leftAt >= this.o.graceMs) {
        // Timers can be throttled in background tabs; treat a late return as a pull-over.
        this.o.onPullOver(this.leftAt);
        this.o.onReturn();
      } else this.o.onQuickReturn();
      this.pulled = false;
    }
  };

  get isAway(): boolean {
    return this.away;
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.check);
    window.removeEventListener('blur', this.check);
    window.removeEventListener('focus', this.check);
  }
}
