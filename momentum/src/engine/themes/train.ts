import type { Theme, View } from '../types';
import { makeSurface, rng, type AnyCanvas } from '../util';

interface Layer {
  tile: AnyCanvas;
  y: number;
  /** Fraction of the view width travelled per second at speed 1. */
  rate: number;
  offset: number;
}

const POLE_RATE = 0.26;
const GROUND_RATE = 0.6;

/** A periodic ridge line: integer frequencies make the tile wrap seamlessly. */
function ridge(seed: number, tileW: number, amp: number): (x: number) => number {
  const r = rng(seed);
  const waves = [2, 3, 5, 8, 13, 21].map((k, i) => ({ k, a: amp / (i + 1.4), p: r() * Math.PI * 2 }));
  return (x) => waves.reduce((s, w) => s + w.a * Math.sin((2 * Math.PI * w.k * x) / tileW + w.p), 0);
}

function fillRidge(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, tileW: number, tileH: number, top: (x: number) => number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(0, tileH);
  for (let x = 0; x <= tileW; x += 4) ctx.lineTo(x, top(x));
  ctx.lineTo(tileW, tileH);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Looking out of a train window at dusk: parallax hills, trees, catenary poles, rushing ballast. */
export function createTrainTheme(initialDensity: number): Theme {
  let density = initialDensity;
  let layers: Layer[] = [];
  let sky: CanvasGradient | null = null;
  let tileW = 0;
  let w = 0;
  let h = 0;
  let horizon = 0;
  let poleOffset = 0;
  let poleGap = 0;
  let speedNow = 0;
  let gx = new Float32Array(0);
  let gy = new Float32Array(0);
  let gl = new Float32Array(0);

  function build(view: View): void {
    w = view.width;
    h = view.height;
    horizon = h * 0.58;
    tileW = Math.ceil(Math.max(w, 1200));
    poleGap = Math.max(260, w * 0.55);
    const r = rng(11);

    // Far mountains.
    const farTop = horizon - h * 0.3;
    const far = makeSurface(tileW, horizon - farTop + 2);
    const farRidge = ridge(3, tileW, h * 0.07);
    fillRidge(far.ctx, tileW, far.canvas.height, (x) => h * 0.16 + farRidge(x), '#1a2232');

    // Mid hills with conifers and a few town lights.
    const midTop = horizon - h * 0.16;
    const midH = horizon - midTop + h * 0.06;
    const mid = makeSurface(tileW, midH);
    const midRidge = ridge(5, tileW, h * 0.03);
    const midLine = (x: number): number => h * 0.1 + midRidge(x);
    fillRidge(mid.ctx, tileW, midH, midLine, '#121a25');
    const trees = Math.round(30 + density * 90);
    mid.ctx.fillStyle = '#121a25';
    for (let i = 0; i < trees; i++) {
      const x = r() * tileW;
      const th = h * (0.012 + r() * 0.025);
      const base = midLine(x) + 2;
      for (const ox of [0, -tileW, tileW]) {
        mid.ctx.beginPath();
        mid.ctx.moveTo(x + ox - th * 0.3, base);
        mid.ctx.lineTo(x + ox, base - th);
        mid.ctx.lineTo(x + ox + th * 0.3, base);
        mid.ctx.fill();
      }
    }
    for (let i = 0; i < 6; i++) {
      const x0 = r() * (tileW - 80);
      for (let j = 0; j < 4 + r() * 6; j++) {
        const x = x0 + r() * 70;
        mid.ctx.fillStyle = `rgba(255,${190 + Math.round(r() * 40)},120,${0.45 + r() * 0.4})`;
        mid.ctx.fillRect(x, midLine(x) + 4 + r() * h * 0.04, 1.6, 1.6);
      }
    }

    // Near bushes and trees, dark and fast.
    const nearTop = horizon - h * 0.32;
    const nearH = h * 0.86 - nearTop;
    const near = makeSurface(tileW, nearH);
    const nearRidge = ridge(9, tileW, h * 0.025);
    const nearLine = (x: number): number => h * 0.4 + nearRidge(x);
    fillRidge(near.ctx, tileW, nearH, nearLine, '#0a0e14');
    const big = Math.round(4 + density * 10);
    near.ctx.fillStyle = '#0a0e14';
    for (let i = 0; i < big; i++) {
      const x = r() * tileW;
      const rad = h * (0.04 + r() * 0.07);
      const base = nearLine(x);
      for (const ox of [0, -tileW, tileW]) {
        near.ctx.beginPath();
        near.ctx.ellipse(x + ox, base - rad * 0.9, rad * 0.75, rad * 1.1, 0, 0, Math.PI * 2);
        near.ctx.fill();
        near.ctx.fillRect(x + ox - rad * 0.08, base - rad * 0.3, rad * 0.16, rad);
      }
    }

    layers = [
      { tile: far.canvas, y: farTop, rate: 0.006, offset: layers[0]?.offset ?? 0 },
      { tile: mid.canvas, y: midTop, rate: 0.03, offset: layers[1]?.offset ?? 0 },
      { tile: near.canvas, y: nearTop, rate: 0.11, offset: layers[2]?.offset ?? 0 },
    ];


    const n = Math.round(40 + density * 140);
    gx = new Float32Array(n);
    gy = new Float32Array(n);
    gl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      gx[i] = r() * w;
      gy[i] = h * (0.86 + r() * 0.14);
      gl[i] = 8 + r() * 40;
    }
  }

  let pending: View | null = null;

  return {
    id: 'train',
    resize(view) {
      // The sky gradient needs a context, so it is rebuilt lazily on the next draw.
      pending = view;
      build(view);
      sky = null;
    },
    setDensity(d) {
      density = d;
      if (pending) build(pending);
      sky = null;
    },
    update(dt, speed) {
      speedNow = speed;
      for (const l of layers) l.offset = (l.offset + speed * l.rate * w * dt) % tileW;
      poleOffset = (poleOffset + speed * POLE_RATE * w * dt) % poleGap;
      for (let i = 0; i < gx.length; i++) {
        const depth = (gy[i] - h * 0.86) / (h * 0.14); // 0 far .. 1 near
        let x = gx[i] - speed * GROUND_RATE * w * (0.6 + depth * 0.8) * dt;
        if (x < -60) x += w + 120;
        gx[i] = x;
      }
    },
    draw(ctx) {
      if (!sky) {
        sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#0a1020');
        sky.addColorStop(0.6, '#1d2238');
        sky.addColorStop(1, '#3a2f3a');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon + 2);

      for (const l of layers) {
        const x = -l.offset;
        ctx.drawImage(l.tile, x, l.y);
        ctx.drawImage(l.tile, x + tileW, l.y);
      }

      // Trackside ground.
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, h * 0.85, w, h * 0.15);
      ctx.beginPath();
      const blur = 1 + speedNow * 1.4;
      for (let i = 0; i < gx.length; i++) {
        ctx.moveTo(gx[i], gy[i]);
        ctx.lineTo(gx[i] + gl[i] * blur, gy[i]);
      }
      ctx.strokeStyle = 'rgba(120,112,104,0.28)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Catenary poles and sagging wires.
      const poleW = Math.max(3, h * 0.007);
      const wireY = [h * 0.07, h * 0.115];
      const xs: number[] = [];
      for (let x = -poleOffset - poleGap; x < w + poleGap * 2; x += poleGap) xs.push(x);
      ctx.fillStyle = '#05070a';
      for (const x of xs) {
        ctx.fillRect(x - poleW / 2, h * 0.04, poleW, h * 0.96);
        ctx.fillRect(x - poleW * 6, wireY[0] - poleW * 0.5, poleW * 9, poleW * 0.8);
      }
      ctx.beginPath();
      for (const y of wireY) {
        for (let i = 0; i < xs.length - 1; i++) {
          const a = xs[i];
          const b = xs[i + 1];
          ctx.moveTo(a, y);
          ctx.quadraticCurveTo((a + b) / 2, y + h * 0.035, b, y);
        }
      }
      ctx.strokeStyle = 'rgba(8,10,14,0.95)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    },
  };
}
