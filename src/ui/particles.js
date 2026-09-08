// Pooled particle system. Config-driven emitters; budget-capped.

const MAX = 400;

export class Particles {
  constructor() {
    this.pool = [];
    this.live = [];
    this.reducedMotion = false;
  }

  get count() { return this.live.length; }

  /**
   * Spawn particles.
   * cfg: { n, x, y, spread (px radius), angle (rad center), arc (rad width), speed:[min,max],
   *        gravity, drag, life:[min,max] ms, size:[min,max], colors:[...], shape:'circle'|'square'|'spark'|'confetti'|'ring'|'star',
   *        blend:'lighter'|null, spin:[min,max] rad/s, shrink:true|false, fade:true|false, vx, vy (additive) }
   */
  emit(cfg) {
    const n = this.reducedMotion ? Math.ceil((cfg.n || 1) / 4) : (cfg.n || 1);
    for (let i = 0; i < n; i++) {
      if (this.live.length >= MAX) this.live.shift();
      const p = this.pool.pop() || {};
      const ang = (cfg.angle ?? -Math.PI / 2) + ((Math.random() - 0.5) * (cfg.arc ?? Math.PI * 2));
      const spd = rnd(cfg.speed || [60, 160]);
      const spread = cfg.spread || 0;
      const sa = Math.random() * Math.PI * 2, sr = Math.sqrt(Math.random()) * spread;
      p.x = cfg.x + Math.cos(sa) * sr;
      p.y = cfg.y + Math.sin(sa) * sr;
      p.vx = Math.cos(ang) * spd + (cfg.vx || 0);
      p.vy = Math.sin(ang) * spd + (cfg.vy || 0);
      p.g = cfg.gravity ?? 300;
      p.drag = cfg.drag ?? 0.98;
      p.life = rnd(cfg.life || [400, 800]);
      p.age = 0;
      p.size = rnd(cfg.size || [3, 6]);
      p.color = cfg.colors ? cfg.colors[Math.floor(Math.random() * cfg.colors.length)] : '#fff';
      p.shape = cfg.shape || 'circle';
      p.blend = cfg.blend || null;
      p.rot = Math.random() * Math.PI * 2;
      p.spin = rnd(cfg.spin || [-4, 4]);
      p.shrink = cfg.shrink ?? true;
      p.fade = cfg.fade ?? true;
      p.wobble = Math.random() * Math.PI * 2;
      // coins fly out, then home in on the money readout (FEEL.md section 7)
      p.attract = cfg.attract || null;
      p.attractAt = cfg.attractAt ?? 360;
      p.ax = p.x; p.ay = p.y;
      p.onArrive = cfg.onArrive || null;
      p.arrived = false;
      p.homed = false;
      p.alphaMul = cfg.alphaMul ?? 1;
      this.live.push(p);
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.live) {
      p.age += dt * 1000;
      if (p.age >= p.life) {
        if (p.onArrive && !p.arrived) { p.arrived = true; p.onArrive(); }
        this.pool.push(p);
        continue;
      }
      if (p.attract && p.age >= p.attractAt) {
        // home in on the target over the rest of the lifetime
        const k = (p.age - p.attractAt) / Math.max(1, p.life - p.attractAt);
        const e = k * k;
        if (!p.homed) { p.homed = true; p.hx = p.x; p.hy = p.y; }
        p.x = p.hx + (p.attract.x - p.hx) * e;
        p.y = p.hy + (p.attract.y - p.hy) * e;
      } else {
        p.vy += p.g * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      p.rot += p.spin * dt;
      if (p.shape === 'confetti') p.x += Math.sin(p.age / 120 + p.wobble) * 30 * dt;
      keep.push(p);
    }
    this.live = keep;
  }

  draw(ctx) {
    for (const p of this.live) {
      const t = p.age / p.life;
      const alpha = (p.fade ? 1 - t * t : 1) * (p.alphaMul ?? 1);
      const s = p.shrink ? p.size * (1 - t * 0.8) : p.size;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.blend) ctx.globalCompositeOperation = p.blend;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'square': ctx.fillRect(-s / 2, -s / 2, s, s); break;
        case 'confetti': ctx.fillRect(-s / 2, -s / 4, s, s / 2); break;
        case 'spark':
          ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(0, -s / 3); ctx.lineTo(s, 0); ctx.lineTo(0, s / 3); ctx.closePath(); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s / 6);
          ctx.beginPath(); ctx.arc(0, 0, s * (0.4 + t * 2.2), 0, Math.PI * 2); ctx.stroke();
          break;
        case 'coin': {
          ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#F5C542'; ctx.fill();
          ctx.strokeStyle = '#B98A1C'; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, s / 2 - 3, Math.PI * 0.9, Math.PI * 1.6);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
          break;
        }
        case 'star': {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? s * 0.45 : s;
            const a = (i / 10) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath(); ctx.fill();
          break;
        }
        default: ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  clear() { this.pool.push(...this.live); this.live = []; }
}

function rnd([a, b]) { return a + Math.random() * (b - a); }
