// Damped springs drive every card's position, rotation and scale.
// Semi-implicit Euler with a fixed sub-step so it is stable at any frame rate.

export class Spring {
  /**
   * @param {number} value initial value
   * @param {number} stiffness (k) higher = snappier
   * @param {number} damping  (c) higher = less overshoot
   */
  constructor(value = 0, stiffness = 180, damping = 18) {
    this.x = value;
    this.target = value;
    this.v = 0;
    this.k = stiffness;
    this.c = damping;
  }

  set(value) { this.x = value; this.target = value; this.v = 0; return this; }
  to(target) { this.target = target; return this; }
  /** add an impulse to velocity (for punches and jiggles) */
  kick(dv) { this.v += dv; return this; }

  update(dt) {
    // sub-step at 1/240s max so stiff springs never explode on a hitch
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 240);
      const a = (this.target - this.x) * this.k - this.v * this.c;
      this.v += a * h;
      this.x += this.v * h;
      remaining -= h;
    }
    return this.x;
  }

  get settled() { return Math.abs(this.x - this.target) < 0.01 && Math.abs(this.v) < 0.01; }
}

/** A 2D spring pair (x, y). */
export class Spring2 {
  constructor(x = 0, y = 0, stiffness = 180, damping = 18) {
    this.sx = new Spring(x, stiffness, damping);
    this.sy = new Spring(y, stiffness, damping);
  }
  get x() { return this.sx.x; }
  get y() { return this.sy.x; }
  get tx() { return this.sx.target; }
  get ty() { return this.sy.target; }
  set(x, y) { this.sx.set(x); this.sy.set(y); return this; }
  to(x, y) { this.sx.to(x); this.sy.to(y); return this; }
  kick(dx, dy) { this.sx.kick(dx); this.sy.kick(dy); return this; }
  update(dt) { this.sx.update(dt); this.sy.update(dt); return this; }
  get settled() { return this.sx.settled && this.sy.settled; }
}
