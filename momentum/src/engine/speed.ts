import { smoothstep } from './util';

/** A speed change, in the same clock as performance.now() (ms). */
export interface SpeedRamp {
  from: number;
  to: number;
  start: number;
  duration: number;
}

export type SpeedListener = (ramp: SpeedRamp) => void;

/**
 * Time-based speed model. The value is computed from the clock, not stepped
 * per frame, so it stays correct while rendering is paused (hidden tab) and
 * audio can schedule the same ramp on its own thread.
 */
export class SpeedModel {
  private ramp: SpeedRamp;
  private readonly listeners = new Set<SpeedListener>();

  constructor(
    initial = 0,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.ramp = { from: initial, to: initial, start: now(), duration: 0 };
  }

  valueAt(t: number = this.now()): number {
    const r = this.ramp;
    if (r.duration <= 0 || t >= r.start + r.duration) return r.to;
    if (t <= r.start) return r.from;
    return r.from + (r.to - r.from) * smoothstep((t - r.start) / r.duration);
  }

  get target(): number {
    return this.ramp.to;
  }

  isSettled(t: number = this.now()): boolean {
    return t >= this.ramp.start + this.ramp.duration;
  }

  /** Ease from the current value to `to` over `seconds`. */
  setTarget(to: number, seconds: number): void {
    const t = this.now();
    const from = this.valueAt(t);
    if (from === to && this.isSettled(t) && to === this.ramp.to) return;
    this.ramp = { from, to, start: t, duration: Math.max(0, seconds * 1000) };
    for (const fn of this.listeners) fn(this.ramp);
  }

  subscribe(fn: SpeedListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
