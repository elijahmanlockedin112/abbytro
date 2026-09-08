// Spring-backed view objects. Game logic owns the cards; these own where the
// cards *appear*, so nothing ever snaps (FEEL.md section 5, "the wobble").

import { Spring, Spring2 } from './spring.js';

const POS = { k: 320, d: 22 };
const ROT = { k: 260, d: 18 };
const SCALE = { k: 400, d: 20 };
const DRAG = { k: 900, d: 40 };

let seq = 0;

export class View {
  constructor(model, x = 0, y = 0) {
    this.model = model;
    this.pos = new Spring2(x, y, POS.k, POS.d);
    this.rot = new Spring(0, ROT.k, ROT.d);
    this.scale = new Spring(1, SCALE.k, SCALE.d);
    this.phase = (seq++ * 0.9) % (Math.PI * 2);
    this.index = 0;
    this.selected = false;
    this.hovered = false;
    this.dragging = false;
    this.alpha = 1;
    this.z = 0;
    this.flying = null;       // { from, to, ctrl, t, dur, ease, spin, onDone }
    this.dead = false;
    this.sway = true;
    this.shadowDy = 3;
  }

  target(x, y, rot = 0) { this.pos.to(x, y); this.rot.to(rot); return this; }
  place(x, y, rot = 0) { this.pos.set(x, y); this.rot.set(rot); return this; }

  /** Scale punch: the card pops and settles (used on every scoring beat). */
  punch(v = 2.4) { this.scale.kick(v); return this; }
  /** Vertical impulse. */
  hop(v = -260) { this.pos.sy.kick(v); return this; }
  /** Rotational shake, used when a joker reacts. */
  jiggle(v = 9) { this.rot.kick(v); return this; }

  setDragging(on) {
    this.dragging = on;
    const k = on ? DRAG : POS;
    this.pos.sx.k = k.k; this.pos.sx.c = k.d;
    this.pos.sy.k = k.k; this.pos.sy.c = k.d;
    this.shadowDy = on ? 10 : 3;
    this.scale.to(on ? 1.12 : 1);
  }

  update(dt, t) {
    if (this.flying) {
      const f = this.flying;
      f.t += dt * 1000;
      const p = Math.min(1, f.t / f.dur);
      const e = f.ease ? f.ease(p) : p;
      // quadratic Bezier so dealt cards arc instead of sliding
      const mt = 1 - e;
      this.pos.sx.set(mt * mt * f.from.x + 2 * mt * e * f.ctrl.x + e * e * f.to.x);
      this.pos.sy.set(mt * mt * f.from.y + 2 * mt * e * f.ctrl.y + e * e * f.to.y);
      if (f.spin != null) this.rot.set(f.rot0 + (f.spin - f.rot0) * e);
      if (f.scaleTo != null) this.scale.set(f.scale0 + (f.scaleTo - f.scale0) * e);
      if (f.alphaTo != null) this.alpha = f.alpha0 + (f.alphaTo - f.alpha0) * e;
      this.flipT = e;
      if (p >= 1) {
        const done = f.onDone;
        this.flying = null;
        this.flipT = undefined;
        if (f.landImpulse) this.pos.sy.kick(f.landImpulse);
        if (done) done(this);
      }
      return;
    }
    this.pos.update(dt);
    this.rot.update(dt);
    this.scale.update(dt);
  }

  /** Idle sway is added on top of the springs so it never fights them. */
  drawPose(t, reduced) {
    let { x, y } = this.pos;
    let rot = this.rot.x;
    if (this.sway && !reduced && !this.dragging) {
      rot += (1.2 * Math.PI / 180) * Math.sin(t / 2600 * Math.PI * 2 + this.phase);
      y += 1.5 * Math.sin(t / 3100 * Math.PI * 2 + this.phase * 1.4);
    }
    return { x, y, rot, scale: this.scale.x, alpha: this.alpha };
  }

  /** Fly along an arc to (x,y). */
  flyTo(x, y, opts = {}) {
    const from = { x: this.pos.x, y: this.pos.y };
    const to = { x, y };
    this.flying = {
      from, to,
      ctrl: opts.ctrl || { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (opts.arc ?? -140) },
      t: 0, dur: opts.dur ?? 380, ease: opts.ease,
      rot0: this.rot.x, spin: opts.spin,
      scale0: this.scale.x, scaleTo: opts.scale,
      alpha0: this.alpha, alphaTo: opts.alpha,
      landImpulse: opts.landImpulse,
      onDone: opts.onDone,
    };
    this.pos.to(x, y);
    if (opts.spin != null) this.rot.to(opts.spin);
    return this;
  }
}

/** A playing card in hand, staging, or a pack. */
export class CardView extends View {
  constructor(card, x, y) { super(card, x, y); this.card = card; }
  get w() { return 92; }
  get h() { return 128; }
}

/** A joker or consumable in its slot. */
export class TokenView extends View {
  constructor(model, x, y) { super(model, x, y); this.phase = (seq++ * 1.1) % (Math.PI * 2); }
  get w() { return 100; }
  get h() { return 140; }
  drawPose(t, reduced) {
    let { x, y } = this.pos;
    let rot = this.rot.x;
    if (this.sway && !reduced && !this.dragging) {
      rot += (0.8 * Math.PI / 180) * Math.sin(t / 3400 * Math.PI * 2 + this.phase);
    }
    return { x, y, rot, scale: this.scale.x, alpha: this.alpha };
  }
}
