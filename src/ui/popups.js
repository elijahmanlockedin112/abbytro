// Floating "+11", "+4 Mult", "x1.5" text (FEEL.md section 6, "Popup style").
// Popups from the same source stack upward so a fast combo stays readable.

import { C, F, font, roundRect } from './theme.js';
import { Ease } from './tween.js';
import { fmtNum, fmtMult } from './fmt.js';

const LIFETIME = 720;
const RISE = 44;
const STACK_WINDOW = 400;
const MAX_STACK = 4;
const CAP = 40;

export class Popups {
  constructor() { this.list = []; this.reduced = false; }

  /**
   * @param kind 'chips' | 'mult' | 'xmult' | 'money' | 'text'
   * @param sourceId a stable id (card id / joker uid) so stacking works
   */
  add(kind, value, x, y, sourceId, opts = {}) {
    const now = performance.now();
    let stack = 0;
    for (const p of this.list) {
      if (p.sourceId === sourceId && now - p.born < STACK_WINDOW) {
        stack++;
        p.push += 10;           // shove older popups in this stack further up
      }
    }
    stack = Math.min(stack, MAX_STACK);
    const text = opts.text ?? formatFor(kind, value);
    this.list.push({
      kind, text, x: x + (stack % 2 ? 6 : -6) * (stack > 0 ? 1 : 0),
      y: y - stack * 18, born: now, push: 0, sourceId,
      rot: this.reduced ? 0 : (Math.random() - 0.5) * 12 * Math.PI / 180,
      rise: opts.rise ?? RISE,
      color: opts.color ?? colorFor(kind),
    });
    if (this.list.length > CAP) this.list.splice(0, this.list.length - CAP);
  }

  update() {
    const now = performance.now();
    this.list = this.list.filter(p => now - p.born < LIFETIME);
  }

  draw(ctx) {
    const now = performance.now();
    for (const p of this.list) {
      const age = now - p.born;
      const t = age / LIFETIME;
      const rise = this.reduced ? 0 : p.rise * Ease.outCubic(t) + p.push;
      let scale = 1;
      if (!this.reduced) {
        if (age < 90) scale = 0.4 + 0.75 * Ease.outBack(age / 90);
        else if (age < 200) scale = 1.15 - 0.15 * ((age - 90) / 110);
      } else if (age < 120) scale = 0.85 + 0.15 * (age / 120);
      const alpha = age < 520 ? 1 : 1 - (age - 520) / 200;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y - rise);
      ctx.rotate(p.rot);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (p.kind === 'xmult') {
        ctx.font = font(26, 'display');
        const w = ctx.measureText(p.text).width + 16;
        const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        grad.addColorStop(0, '#FF5A3C');
        grad.addColorStop(1, '#FF2E7A');
        roundRect(ctx, -w / 2, -17, w, 34, 8);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.ink;
        ctx.strokeText(p.text, 0, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(p.text, 0, 1);
      } else {
        ctx.font = font(22, 'display');
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.ink;
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
      }
      ctx.restore();
    }
  }

  clear() { this.list.length = 0; }
}

function formatFor(kind, v) {
  switch (kind) {
    case 'chips': return '+' + fmtNum(v);
    case 'mult': return '+' + fmtMult(v) + ' Mult';
    case 'xmult': return '×' + fmtMult(v) + ' Mult';
    case 'money': return (v >= 0 ? '+$' : '-$') + Math.abs(v);
    default: return String(v);
  }
}

function colorFor(kind) {
  switch (kind) {
    case 'chips': return C.chips;
    case 'mult': return C.mult;
    case 'money': return C.money;
    default: return C.text;
  }
}
