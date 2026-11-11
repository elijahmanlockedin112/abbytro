import type { Theme, View } from '../types';
import { inInner } from '../types';
import { clamp, makeGlow, rng } from '../util';

// World units are metres. The camera sits fairly high and moves slowly so the
// flow in the bottom band reads as calm texture, not strobing lines.
const H = 3; // camera height above the road
const MPS = 6; // metres per second at normalised speed 1
const NEAR = 0.8;
const LANES = [-5.4, -1.8, 1.8, 5.4];
const DASH_LEN = 3;
const DASH_PERIOD = 7.5;
const DASH_W = 0.16;
const POST_X = 7.5;
const POST_H = 1;
const POST_PERIOD = 12;
const LAMP_X = 11;
const LAMP_H = 9;
const LAMP_PERIOD = 36;
const GANTRY_PERIOD = 260;
const GANTRY_H = 6.8;
const GANTRY_HALF = 13;

/** Night highway: lane dashes, reflector posts, sodium lamps and the odd overhead gantry. */
export function createRoadTheme(initialDensity: number): Theme {
  const rand = rng(7);
  const amber = makeGlow('255,190,110');
  const cool = makeGlow('215,225,240');
  let f = 1;
  let cx = 0;
  let cy = 0;
  let width = 0;
  let height = 0;
  let distance = 0;
  let speedNow = 0;
  // Two speckle populations: road surface under the bottom band, and the verges
  // that pass through the side bands. Each wraps over its own depth range.
  let zRoad = 10;
  let zRoadNear = NEAR;
  let zVerge = 30;
  let half = 0;
  let density = initialDensity;
  let xs = new Float32Array(0);
  let zs = new Float32Array(0);

  const spawnX = (i: number): number =>
    i < half ? (rand() * 2 - 1) * 9 : (rand() < 0.5 ? -1 : 1) * (6 + rand() * 14);

  function seedSpeckles(): void {
    const n = Math.round(120 + density * 420);
    half = Math.floor(n * 0.55);
    xs = new Float32Array(n);
    zs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = spawnX(i);
      zs[i] = i < half ? zRoadNear + rand() * (zRoad - zRoadNear) : NEAR + rand() * (zVerge - NEAR);
    }
  }

  const px = (x: number, z: number): number => cx + (x * f) / z;
  const py = (y: number, z: number): number => cy + (y * f) / z;

  function drawSpeckles(ctx: CanvasRenderingContext2D, view: View): void {
    const tail = 0.15 + speedNow * 0.5;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = pass; i < xs.length; i += 2) {
        const z = zs[i];
        const hx = px(xs[i], z);
        const hy = py(H, z);
        if (hy > height + 4 || hx < -4 || hx > width + 4 || inInner(view, hx, hy)) continue;
        const zt = z + tail;
        ctx.moveTo(px(xs[i], zt), py(H, zt));
        ctx.lineTo(hx, hy);
      }
      ctx.strokeStyle = pass ? 'rgba(150,160,178,0.2)' : 'rgba(195,203,218,0.32)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawDashes(ctx: CanvasRenderingContext2D): void {
    const off = distance % DASH_PERIOD;
    ctx.beginPath();
    for (const lx of LANES) {
      for (let z0 = -off; z0 < 40; z0 += DASH_PERIOD) {
        const zn = Math.max(z0, NEAR);
        const zf = z0 + DASH_LEN;
        if (zf <= zn) continue;
        const a = lx - DASH_W / 2;
        const b = lx + DASH_W / 2;
        ctx.moveTo(px(a, zn), py(H, zn));
        ctx.lineTo(px(b, zn), py(H, zn));
        ctx.lineTo(px(b, zf), py(H, zf));
        ctx.lineTo(px(a, zf), py(H, zf));
        ctx.closePath();
      }
    }
    ctx.fillStyle = 'rgba(222,226,233,0.55)';
    ctx.fill();
    // Cat's-eye road studs sit in the gaps between dashes.
    for (const lx of LANES) {
      for (let z = DASH_LEN + 3 - off; z < 30; z += DASH_PERIOD) {
        if (z < NEAR) continue;
        const r = clamp((0.22 * f) / z, 1.2, 16);
        ctx.drawImage(cool, px(lx, z) - r, py(H, z) - r, r * 2, r * 2);
      }
    }
  }

  function drawPosts(ctx: CanvasRenderingContext2D): void {
    const off = distance % POST_PERIOD;
    ctx.beginPath();
    const glows: [number, number, number, number][] = [];
    for (let z = POST_PERIOD - off; z < 30; z += POST_PERIOD) {
      if (z < NEAR) continue;
      for (const s of [-1, 1]) {
        const x = px(s * POST_X, z);
        if (x < -40 || x > width + 40) continue;
        const base = py(H, z);
        const top = py(H - POST_H, z);
        ctx.moveTo(x, base);
        ctx.lineTo(x, top);
        glows.push([x, top, clamp((0.45 * f) / z, 2, 36), s]);
      }
    }
    ctx.strokeStyle = 'rgba(110,118,132,0.5)';
    ctx.lineWidth = clamp((0.06 * f) / 12, 1, 3);
    ctx.stroke();
    for (const [x, y, r, s] of glows) ctx.drawImage(s > 0 ? amber : cool, x - r, y - r, r * 2, r * 2);
  }

  function drawLamps(ctx: CanvasRenderingContext2D): void {
    const off = distance % LAMP_PERIOD;
    const base = Math.floor(distance / LAMP_PERIOD);
    for (let j = 0, z = -off; z < 60; j++, z += LAMP_PERIOD) {
      if (z < NEAR) continue;
      const s = (base + j) % 2 === 0 ? 1 : -1;
      const poleX = px(s * LAMP_X, z);
      const headX = px(s * (LAMP_X - 2.2), z);
      if (headX < -200 || headX > width + 200) continue;
      const groundY = py(H, z);
      const topY = py(H - LAMP_H, z);
      const fade = clamp((60 - z) / 25, 0, 1);
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.moveTo(poleX, groundY);
      ctx.lineTo(poleX, topY);
      ctx.lineTo(headX, topY);
      ctx.strokeStyle = 'rgba(70,76,88,0.8)';
      ctx.lineWidth = clamp((0.18 * f) / z, 1, 6);
      ctx.stroke();
      const r = clamp((2.4 * f) / z, 6, 260);
      ctx.drawImage(amber, headX - r, topY - r, r * 2, r * 2);
      // Light pool on the road under the lamp.
      const pw = (11 * f) / z;
      ctx.globalAlpha = fade * 0.22;
      ctx.drawImage(amber, headX - pw / 2, groundY - pw * 0.08, pw, pw * 0.16);
    }
    ctx.globalAlpha = 1;
  }

  function drawGantry(ctx: CanvasRenderingContext2D): void {
    const z = GANTRY_PERIOD - (distance % GANTRY_PERIOD);
    if (z < NEAR || z > 50) return;
    const fade = clamp((50 - z) / 20, 0, 1);
    const l = px(-GANTRY_HALF, z);
    const r = px(GANTRY_HALF, z);
    const top = py(H - GANTRY_H, z);
    const bot = py(H - GANTRY_H + 0.7, z);
    const ground = py(H, z);
    const leg = (0.35 * f) / z;
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(22,27,35,0.95)';
    ctx.fillRect(l, top, r - l, bot - top);
    ctx.fillRect(l - leg, top, leg, ground - top);
    ctx.fillRect(r, top, leg, ground - top);
    const gr = clamp((0.8 * f) / z, 3, 90);
    for (const gx of [-6, -1.5, 3]) ctx.drawImage(cool, px(gx, z) - gr, bot - gr, gr * 2, gr * 2);
    ctx.globalAlpha = 1;
  }

  return {
    id: 'road',
    resize(view) {
      width = view.width;
      height = view.height;
      f = height * 0.9;
      cx = view.cx;
      cy = height * 0.46;
      zRoadNear = Math.max(NEAR, ((H * f) / Math.max(40, height - cy)) * 0.9);
      zRoad = clamp(((H * f) / Math.max(40, height - cy - view.bandY)) * 1.35, 4, 40);
      zVerge = clamp(((20 * f) / Math.max(40, width / 2 - view.bandX)) * 1.1, 8, 60);
      seedSpeckles();
    },
    setDensity(d) {
      density = d;
      seedSpeckles();
    },
    update(dt, speed) {
      speedNow = speed;
      const ds = speed * MPS * dt;
      distance += ds;
      for (let i = 0; i < zs.length; i++) {
        let z = zs[i] - ds;
        const lo = i < half ? zRoadNear : NEAR;
        if (z < lo) {
          z += (i < half ? zRoad : zVerge) - lo;
          xs[i] = spawnX(i);
        }
        zs[i] = z;
      }
    },
    draw(ctx, view) {
      drawSpeckles(ctx, view);
      drawDashes(ctx);
      drawPosts(ctx);
      drawGantry(ctx);
      drawLamps(ctx);
    },
  };
}
