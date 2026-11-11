import type { Theme } from '../types';
import { inInner } from '../types';
import { rng } from '../util';

const Z_SPEED = 0.11; // depth units per second at speed 1
const Z_NEAR = 0.035;

const BUCKETS = [
  { stroke: 'rgba(170,186,225,0.35)', width: 1 },
  { stroke: 'rgba(205,215,245,0.6)', width: 1.3 },
  { stroke: 'rgba(240,244,255,0.9)', width: 1.9 },
];

/** Classic starfield: streaks stretch with speed, flowing out of the centre. */
export function createStarsTheme(initialDensity: number): Theme {
  const rand = rng(42);
  let density = initialDensity;
  let aspect = 1;
  let f = 1;
  let cx = 0;
  let cy = 0;
  let w = 0;
  let h = 0;
  let speedNow = 0;
  let xs = new Float32Array(0);
  let ys = new Float32Array(0);
  let zs = new Float32Array(0);

  function spawn(i: number, z: number): void {
    xs[i] = (rand() * 2 - 1) * aspect;
    ys[i] = rand() * 2 - 1;
    zs[i] = z;
  }

  function seed(): void {
    const n = Math.round(180 + density * 820);
    xs = new Float32Array(n);
    ys = new Float32Array(n);
    zs = new Float32Array(n);
    for (let i = 0; i < n; i++) spawn(i, 0.08 + rand() * 0.92);
  }

  return {
    id: 'stars',
    resize(view) {
      w = view.width;
      h = view.height;
      cx = view.cx;
      cy = view.cy;
      f = h / 2;
      aspect = w / h;
      seed();
    },
    setDensity(d) {
      density = d;
      seed();
    },
    update(dt, speed) {
      speedNow = speed;
      const dz = speed * Z_SPEED * dt;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i] - dz;
        const sx = cx + (xs[i] / z) * f;
        const sy = cy + (ys[i] / z) * f;
        if (z < Z_NEAR || sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) spawn(i, 1);
        else zs[i] = z;
      }
    },
    draw(ctx, view) {
      const tail = 0.004 + speedNow * 0.028;
      ctx.lineCap = 'round';
      for (let b = 0; b < BUCKETS.length; b++) {
        ctx.beginPath();
        for (let i = 0; i < zs.length; i++) {
          const z = zs[i];
          const bucket = z > 0.6 ? 0 : z > 0.28 ? 1 : 2;
          if (bucket !== b) continue;
          const hx = cx + (xs[i] / z) * f;
          const hy = cy + (ys[i] / z) * f;
          if (inInner(view, hx, hy)) continue;
          const zt = z + tail;
          ctx.moveTo(cx + (xs[i] / zt) * f, cy + (ys[i] / zt) * f);
          ctx.lineTo(hx + 0.01, hy);
        }
        ctx.strokeStyle = BUCKETS[b].stroke;
        ctx.lineWidth = BUCKETS[b].width;
        ctx.stroke();
      }
    },
  };
}
