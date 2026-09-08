// Easing functions and a tiny tween/timeline scheduler.

export const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  /** punch: quickly up to 1 then settles back to 0 */
  punch: t => Math.sin(t * Math.PI) * (1 - t),
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const clamp01 = v => clamp(v, 0, 1);

/**
 * Scheduler for timed callbacks and tweens. All times in milliseconds of game time,
 * so pausing the game pauses everything.
 */
export class Timeline {
  constructor() { this.now = 0; this.items = []; }

  update(dtMs) {
    this.now += dtMs;
    const keep = [];
    for (const it of this.items) {
      if (it.cancelled) continue;
      if (it.kind === 'delay') {
        if (this.now >= it.at) { it.fn(); }
        else keep.push(it);
      } else {
        const t = clamp01((this.now - it.start) / it.dur);
        it.fn(it.ease(t), t);
        if (t < 1) keep.push(it);
        else if (it.done) it.done();
      }
    }
    this.items = keep;
  }

  /** run fn after ms */
  delay(ms, fn) {
    const it = { kind: 'delay', at: this.now + ms, fn, cancelled: false };
    this.items.push(it);
    return it;
  }

  /** call fn(easedT, rawT) every frame for dur ms */
  tween(dur, fn, ease = Ease.outCubic, done) {
    const it = { kind: 'tween', start: this.now, dur: Math.max(1, dur), fn, ease, done, cancelled: false };
    this.items.push(it);
    return it;
  }

  /** promise-flavoured delay for scripting sequences */
  wait(ms) { return new Promise(res => this.delay(ms, res)); }

  clear() { this.items = []; }
}
