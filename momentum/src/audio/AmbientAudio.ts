import type { SpeedRamp } from '../engine';
import { brownNoise, whiteNoise } from './noise';
import { VOICES, glide, type SoundProfile, type Voice } from './voices';

export type { SoundProfile } from './voices';

/** Anything with a clock-based velocity, e.g. FlowEngine. */
export interface SpeedSource {
  readonly velocity: number;
  onSpeedChange(fn: (ramp: SpeedRamp) => void): () => void;
}

const LOOKAHEAD = 0.35;
const TICK_MS = 120;
const SLEEP_AFTER_MS = 20_000;

/**
 * Procedural ambience: a speed-following bed (road / rail / space) plus
 * scheduled events: rail-joint clacks and occasional passing whooshes.
 * Pitch, filter and level all track the visual speed.
 */
export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  private master!: GainNode;
  private brown!: AudioBuffer;
  private white!: AudioBuffer;
  private voice: Voice | null = null;
  private profile: SoundProfile = 'road';
  private volume = 0.6;
  private muted = false;
  private source: SpeedSource | null = null;
  private unsubscribe: (() => void) | null = null;
  private timer = 0;
  private nextClack = 0;
  private nextWhoosh = 0;
  private stillSince = 0;
  private sleeping = false;

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Create or resume the AudioContext. Call from a user gesture. */
  async start(): Promise<void> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.brown = brownNoise(ctx);
      this.white = whiteNoise(ctx);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      comp.knee.value = 12;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.bus = ctx.createGain();
      this.bus.connect(this.master).connect(comp).connect(ctx.destination);
      this.setProfile(this.profile, true);
      this.timer = window.setInterval(this.tick, TICK_MS);
    }
    await this.wake();
  }

  attach(source: SpeedSource): void {
    this.unsubscribe?.();
    this.source = source;
    this.unsubscribe = source.onSpeedChange((r) => this.onRamp(r));
  }

  setProfile(profile: SoundProfile, force = false): void {
    if (profile === this.profile && !force && this.voice) return;
    this.profile = profile;
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const old = this.voice;
    if (old) {
      glide(old.output.gain, 0, now, 1.2);
      old.stop(now + 1.6);
      window.setTimeout(() => old.output.disconnect(), 1800);
    }
    const voice = VOICES[profile](ctx, this.brown);
    voice.output.connect(this.bus);
    voice.apply(this.source?.velocity ?? 0, now, 0.05);
    glide(voice.output.gain, 1, now, 1.2);
    this.voice = voice;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMaster(0.15);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMaster(0.15);
  }

  /** A soft bell. `arrive` is a rising three-note figure, `ready` a single pair. */
  chime(kind: 'arrive' | 'ready'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    void this.wake();
    const notes = kind === 'arrive' ? [523.25, 659.25, 783.99] : [659.25, 987.77];
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((hz, i) => {
      const t = t0 + i * 0.32;
      for (const [mult, amp] of [[1, 0.16], [2.01, 0.05], [3.02, 0.02]] as const) {
        const o = ctx.createOscillator();
        o.frequency.value = hz * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 2.7);
      }
    });
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.unsubscribe?.();
    void this.ctx?.close();
    this.ctx = null;
    this.voice = null;
  }

  private applyMaster(seconds: number): void {
    if (!this.ctx) return;
    const target = this.muted || this.sleeping ? 0 : this.volume * this.volume;
    glide(this.master.gain, target, this.ctx.currentTime, seconds);
  }

  private onRamp(r: SpeedRamp): void {
    const ctx = this.ctx;
    if (!ctx || !this.voice) return;
    if (r.to > 0) void this.wake();
    this.voice.apply(r.to, ctx.currentTime, Math.max(0.05, r.duration / 1000));
  }

  private async wake(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    this.stillSince = 0;
    if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    if (this.sleeping || this.master.gain.value === 0) {
      this.sleeping = false;
      this.applyMaster(0.6);
    }
  }

  /** Fade out and suspend after a long stop, so a parked trip costs no CPU. */
  private sleep(): void {
    const ctx = this.ctx;
    if (!ctx || this.sleeping) return;
    this.sleeping = true;
    this.applyMaster(0.4);
    window.setTimeout(() => {
      if (this.sleeping && ctx.state === 'running') void ctx.suspend();
    }, 1500);
  }

  private readonly tick = (): void => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sleeping) return;
    const v = this.source?.velocity ?? 0;
    const now = ctx.currentTime;
    const wall = performance.now();

    if (v < 0.01) {
      if (!this.stillSince) this.stillSince = wall;
      else if (wall - this.stillSince > SLEEP_AFTER_MS) this.sleep();
    } else {
      this.stillSince = 0;
    }

    if (this.profile === 'rail') this.scheduleClacks(v, now);

    if (!this.nextWhoosh) this.nextWhoosh = now + 12 + Math.random() * 20;
    if (now >= this.nextWhoosh) {
      if (v > 0.3) this.whoosh(v, now + 0.05);
      const gap = this.profile === 'space' ? 45 + Math.random() * 60 : 18 + Math.random() * 35;
      this.nextWhoosh = now + gap / Math.max(0.5, v);
    }
  };

  private scheduleClacks(v: number, now: number): void {
    if (v < 0.08) {
      this.nextClack = 0;
      return;
    }
    if (!this.nextClack || this.nextClack < now) this.nextClack = now + 0.05;
    while (this.nextClack < now + LOOKAHEAD) {
      // Two bogies pass each rail joint: ta-dum ... ta-dum, then a car length of quiet.
      const t = this.nextClack;
      const k = 1 / Math.min(v, 2.5);
      const amp = Math.min(1, v) * (0.85 + Math.random() * 0.3);
      this.clack(t, amp);
      this.clack(t + 0.11 * k, amp * 0.8);
      this.clack(t + 0.36 * k, amp * 0.9);
      this.clack(t + 0.47 * k, amp * 0.75);
      this.nextClack = t + 1.25 * k;
    }
  }

  private clack(t: number, amp: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500 + Math.random() * 500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13 * amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(bp).connect(g).connect(this.bus);
    n.start(t, Math.random() * 1.5, 0.08);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(85, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.22 * amp, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(this.bus);
    o.start(t);
    o.stop(t + 0.13);
  }

  /** Something passing on one side: filtered noise sweeping up then away. */
  private whoosh(v: number, t: number): void {
    const ctx = this.ctx!;
    const p = this.profile;
    const dur = p === 'rail' ? 5.5 : p === 'space' ? 4.5 : 3.2;
    const [lo, hi] = p === 'rail' ? [120, 520] : p === 'space' ? [500, 1400] : [260, 950];
    const side = Math.random() < 0.5 ? -1 : 1;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = p === 'space' ? 4 : 0.8;
    bp.frequency.setValueAtTime(lo, t);
    bp.frequency.exponentialRampToValueAtTime(hi, t + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(lo * 1.2, t + dur);
    const g = ctx.createGain();
    const peak = (p === 'space' ? 0.08 : 0.2) * Math.min(1.2, v);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(side * 0.9, t);
    pan.pan.linearRampToValueAtTime(side * 0.25, t + dur);
    src.connect(bp).connect(g).connect(pan).connect(this.bus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}
