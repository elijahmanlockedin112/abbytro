import { applyEdgeMask, clearEdgeMask } from './mask';
import { SpeedModel, type SpeedListener } from './speed';
import { THEMES, type ThemeId } from './themes';
import type { Theme, ThemeFactory, View } from './types';
import { clamp } from './util';

export interface FlowOptions {
  /** A built-in theme id or your own factory. */
  theme: ThemeId | ThemeFactory;
  /** Speed multiplier. 1 = normal cruise. */
  speed: number;
  /** 0..1, how many moving objects. */
  density: number;
  /** 0..1, overall layer opacity. */
  opacity: number;
  /** Fraction of each screen dimension used for motion, per side (0.18 = outer 18%). */
  edge: number;
  /** When false nothing is drawn (audio-only / reduced motion). Speed still updates. */
  visible: boolean;
  /** Cap on devicePixelRatio. Peripheral motion does not need retina sharpness. */
  maxDpr: number;
  /** Frame cap so 120 Hz displays do not double the CPU cost. */
  maxFps: number;
  /** Apply the soft CSS edge mask to the canvas. */
  mask: boolean;
}

export const DEFAULT_FLOW_OPTIONS: FlowOptions = {
  theme: 'road',
  speed: 1,
  density: 0.6,
  opacity: 0.85,
  edge: 0.18,
  visible: true,
  maxDpr: 1,
  maxFps: 60,
  mask: true,
};

/**
 * Peripheral motion renderer. It owns one canvas, draws only in the outer
 * band of the screen, sleeps when the scene is still or the tab is hidden,
 * and exposes a time-based speed model other systems (audio) can follow.
 */
export class FlowEngine {
  readonly speed = new SpeedModel(0);
  private opts: FlowOptions;
  private readonly ctx: CanvasRenderingContext2D;
  private theme: Theme;
  private view: View = { width: 0, height: 0, cx: 0, cy: 0, bandX: 0, bandY: 0, inner: { x: 0, y: 0, w: 0, h: 0 } };
  private frame: Path2D | null = null;
  private scale = 1;
  private throttle = 0;
  private raf = 0;
  private lastTime = 0;
  private lastDraw = 0;
  private dirty = true;
  private running = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: Partial<FlowOptions> = {},
  ) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Momentum: Canvas 2D is not available');
    this.ctx = ctx;
    this.opts = { ...DEFAULT_FLOW_OPTIONS, ...options };
    this.theme = this.makeTheme(this.opts.theme);
    this.applyStyle();
  }

  /** Normalised velocity right now (0 = stopped). Valid even while not rendering. */
  get velocity(): number {
    return this.speed.valueAt();
  }

  get options(): Readonly<FlowOptions> {
    return this.opts;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener('resize', this.measure);
    }
    this.measure();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.measure);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  destroy(): void {
    this.stop();
    clearEdgeMask(this.canvas);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 0..1 accelerator. 1 = drive at `speed`, 0 = coast to a stop.
   * `seconds` is how long the change takes.
   */
  setThrottle(value: number, seconds = 2): void {
    this.throttle = clamp(value, 0, 4);
    this.speed.setTarget(this.throttle * this.opts.speed, seconds);
    this.wake();
  }

  getThrottle(): number {
    return this.throttle;
  }

  /** Follow speed changes (e.g. to drive audio). Returns an unsubscribe function. */
  onSpeedChange(fn: SpeedListener): () => void {
    return this.speed.subscribe(fn);
  }

  setOptions(next: Partial<FlowOptions>): void {
    const prev = this.opts;
    this.opts = { ...prev, ...next };
    const o = this.opts;
    if (next.theme !== undefined && next.theme !== prev.theme) {
      this.theme = this.makeTheme(o.theme);
      if (this.view.width) this.theme.resize(this.view);
    }
    if (next.density !== undefined && next.density !== prev.density) this.theme.setDensity(clamp(o.density, 0, 1));
    if (next.speed !== undefined && next.speed !== prev.speed) this.speed.setTarget(this.throttle * o.speed, 0.8);
    if ((next.edge !== undefined && next.edge !== prev.edge) || (next.maxDpr !== undefined && next.maxDpr !== prev.maxDpr) || next.mask !== undefined) {
      this.measure();
    }
    this.applyStyle();
    this.dirty = true;
    this.wake();
  }

  /** Force one redraw (e.g. after the host changed layout). */
  redraw(): void {
    this.dirty = true;
    this.wake();
  }

  private makeTheme(theme: ThemeId | ThemeFactory): Theme {
    const factory = typeof theme === 'function' ? theme : THEMES[theme] ?? THEMES.road;
    return factory(clamp(this.opts.density, 0, 1));
  }

  private applyStyle(): void {
    const s = this.canvas.style;
    s.opacity = String(clamp(this.opts.opacity, 0, 1));
    s.visibility = this.opts.visible ? 'visible' : 'hidden';
  }

  private readonly measure = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width < 1 || height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, this.opts.maxDpr));
    this.scale = dpr;
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;

    const edge = clamp(this.opts.edge, 0.04, 0.45);
    const bandX = Math.round(width * edge);
    const bandY = Math.round(height * edge);
    const inner = { x: bandX, y: bandY, w: width - 2 * bandX, h: height - 2 * bandY };
    this.view = { width, height, cx: width / 2, cy: height / 2, bandX, bandY, inner };

    const frame = new Path2D();
    frame.rect(0, 0, width, height);
    frame.rect(inner.x, inner.y, inner.w, inner.h);
    this.frame = frame;

    if (this.opts.mask) applyEdgeMask(this.canvas, bandX, bandY);
    else clearEdgeMask(this.canvas);

    this.theme.resize(this.view);
    this.dirty = true;
    this.wake();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      this.dirty = true;
      this.wake();
    }
  };

  private canRender(): boolean {
    return this.running && this.opts.visible && !document.hidden && this.view.width > 0;
  }

  private wake(): void {
    if (this.raf || !this.canRender()) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (ts: number): void => {
    this.raf = 0;
    if (!this.canRender()) return;
    const minGap = 1000 / Math.max(1, this.opts.maxFps) - 1.5;
    if (!this.dirty && this.lastDraw && ts - this.lastDraw < minGap) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    const dt = clamp((ts - this.lastTime) / 1000, 0, 0.1);
    this.lastTime = ts;
    this.lastDraw = ts;
    const now = performance.now();
    const v = this.speed.valueAt(now);
    this.theme.update(dt, v, this.view);
    this.render();
    this.dirty = false;
    // Sleep once the scene is still: a stopped vehicle costs no CPU.
    if (v > 0.0005 || !this.speed.isSettled(now)) this.raf = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const { ctx, view } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.save();
    if (this.frame) ctx.clip(this.frame, 'evenodd');
    this.theme.draw(ctx, view);
    ctx.restore();
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
