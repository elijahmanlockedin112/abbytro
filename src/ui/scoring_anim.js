// Replays a scoring log as an animation (FEEL.md section 6).
//
// scoreHand() returns an ordered log of exactly what the maths did. This player
// walks that log one beat at a time, so what the player watches *is* the
// calculation. The beat shortens by 10% per trigger (floor 40ms) so a 40-trigger
// combo accelerates into a crescendo instead of dragging.

import { Ease } from './tween.js';
import { HAND_NAMES } from '../core/hands.js';
import * as S from '../audio/sfx.js';

const BEAT0 = 120;
const BEAT_MIN = 40;
const BEAT_DECAY = 0.9;

export class ScoringAnim {
  /**
   * @param game the Game (for views, popups, particles, counters)
   * @param ctx  the ScoreCtx returned by scoreHand()
   */
  constructor(game, ctx, onDone) {
    this.game = game;
    this.ctx = ctx;
    this.onDone = onDone;
    this.queue = this.build(ctx.log);
    this.i = 0;
    this.timer = 0;
    this.beat = game.reduced ? 90 : BEAT0;
    this.done = false;
    this.phase = 'beats';
    this.finalT = 0;
    game.counters.chips = 0;
    game.counters.mult = 0;
    S.resetChipStep();
  }

  /** Turn the log into a flat list of visual beats. */
  build(log) {
    const out = [];
    for (const e of log) {
      switch (e.kind) {
        case 'hand':
          out.push({ type: 'hand', handType: e.handType, level: e.level, chips: e.chips, mult: e.mult, hold: 340 });
          break;
        case 'chips': case 'mult': case 'xmult':
          out.push({ type: e.kind, value: e.value, cardId: e.cardId, jokerUid: e.jokerUid, source: e.source, after: e.after });
          break;
        case 'money':
          out.push({ type: 'money', value: e.value, cardId: e.cardId, jokerUid: e.jokerUid });
          break;
        case 'retrigger':
          out.push({ type: 'retrigger', cardId: e.cardId, held: e.held });
          break;
        case 'retrigger_src':
          out.push({ type: 'again', jokerUid: e.joker?.uid, cardId: e.card?.id });
          break;
        case 'grow':
          out.push({ type: 'grow', jokerUid: e.joker?.uid, stat: e.stat, value: e.value });
          break;
        case 'level':
          out.push({ type: 'level', handType: e.type, level: e.level, jokerUid: e.jokerUid });
          break;
        case 'debuffed':
          out.push({ type: 'debuffed', cardId: e.cardId });
          break;
        case 'lucky_miss':
          out.push({ type: 'miss', cardId: e.cardId });
          break;
        case 'destroy_card':
          out.push({ type: 'destroy_card', cardId: e.cardId, reason: e.reason });
          break;
        case 'destroy_joker':
          out.push({ type: 'destroy_joker', jokerUid: e.jokerUid });
          break;
        case 'boss_chips':
          out.push({ type: 'boss_chips', value: e.value });
          break;
        case 'boss_zero':
          out.push({ type: 'boss_zero', name: e.name, hold: 500 });
          break;
        case 'hands': case 'discards':
          out.push({ type: 'resource', which: e.kind, delta: e.delta, jokerUid: e.joker?.uid });
          break;
        case 'create':
          out.push({ type: 'create', jokerUid: e.jokerUid, cardId: e.cardId });
          break;
        case 'final':
          out.push({ type: 'final', chips: e.chips, mult: e.mult, total: e.total });
          break;
        default: break;
      }
    }
    return out;
  }

  update(dt) {
    if (this.done) return;
    const g = this.game;
    this.timer -= dt * 1000;
    if (this.phase === 'final') { this.updateFinal(dt); return; }

    let guard = 0;
    while (this.timer <= 0 && this.i < this.queue.length && guard++ < 64) {
      const beat = this.queue[this.i++];
      const hold = this.step(beat);
      if (beat.type !== 'final') {
        this.beat = Math.max(BEAT_MIN, this.beat * BEAT_DECAY);
        this.timer += hold ?? this.beat;
      } else break;
    }
    if (this.i >= this.queue.length && this.phase === 'beats') this.finish();
  }

  /** Execute one beat. Returns an optional custom hold time in ms. */
  step(b) {
    const g = this.game;
    switch (b.type) {
      case 'hand': {
        g.banner = { text: HAND_NAMES[b.handType], level: b.level, born: performance.now() };
        g.counters.chips = b.chips;
        g.counters.mult = b.mult;
        g.punchChips(); g.punchMult();
        S.sfxChip(); S.sfxMult();
        return b.hold;
      }
      case 'chips': {
        const v = g.viewFor(b);
        g.counters.chips += b.value;
        g.punchChips();
        if (v) {
          v.punch(b.cardId ? 2.4 : 1.6);
          if (b.cardId) v.hop(-260); else v.jiggle(this.altSign());
          const p = g.popupAnchor(v, b);
          g.popups.add('chips', b.value, p.x, p.y, b.cardId ?? b.jokerUid, { rise: p.rise });
          g.particles.emit(g.fx.chipSparkle(p.x, p.y));
        }
        S.sfxChip();
        return null;
      }
      case 'mult': {
        const v = g.viewFor(b);
        g.counters.mult += b.value;
        g.punchMult();
        if (v) {
          v.punch(b.cardId ? 2.4 : 1.6);
          if (b.cardId) v.hop(-220); else v.jiggle(this.altSign());
          const p = g.popupAnchor(v, b);
          g.popups.add('mult', b.value, p.x, p.y, b.cardId ?? b.jokerUid, { rise: p.rise });
          g.particles.emit(g.fx.multEmber(p.x, p.y));
        }
        S.sfxMult();
        return null;
      }
      case 'xmult': {
        const v = g.viewFor(b);
        g.counters.mult *= b.value;
        g.punchMult(3);
        if (v) {
          v.punch(2.0);
          v.jiggle(this.altSign(12));
          const p = g.popupAnchor(v, b);
          g.popups.add('xmult', b.value, p.x, p.y, b.cardId ?? b.jokerUid, { rise: p.rise });
          g.particles.emit(g.fx.shockwave(p.x, p.y));
        }
        S.sfxXMult();
        return Math.max(60, this.beat * 1.5);
      }
      case 'money': {
        const v = g.viewFor(b);
        const p = v ? g.popupAnchor(v, b) : { x: 640, y: 300, rise: 44 };
        g.popups.add('money', b.value, p.x, p.y, b.cardId ?? b.jokerUid, { rise: p.rise });
        g.coinBurst(p.x, p.y, b.value);
        if (v) v.punch(1.2);
        return null;
      }
      case 'retrigger': {
        const v = g.viewFor(b);
        if (v) {
          v.punch(1.8);
          const p = g.popupAnchor(v, b);
          g.popups.add('text', 0, p.x, p.y, b.cardId, { text: 'AGAIN', color: '#FFFFFF', rise: p.rise });
        }
        S.sfxClick();
        return null;
      }
      case 'again': {
        const v = g.jokerView(b.jokerUid);
        if (v) {
          v.jiggle(this.altSign());
          const p = g.popupAnchor(v, b);
          g.popups.add('text', 0, p.x, p.y, b.jokerUid, { text: 'AGAIN', color: '#FFFFFF', rise: p.rise });
        }
        return null;
      }
      case 'grow': {
        const v = g.jokerView(b.jokerUid);
        if (v) {
          v.punch(1.4);
          const p = g.popupAnchor(v, b);
          const label = b.stat === 'xmult' ? `×${round2(b.value)}` : `${b.stat === 'chips' ? '' : ''}${round2(b.value)}`;
          g.popups.add('text', 0, p.x, p.y, b.jokerUid, { text: label + '!', color: '#F5C542', rise: p.rise });
          g.particles.emit(g.fx.levelStars(p.x, p.y, 8));
        }
        S.sfxLevelUp();
        return null;
      }
      case 'level': {
        g.popups.add('text', 0, 132, 322, 'level', { text: 'LEVEL UP', color: '#F5C542' });
        g.particles.emit(g.fx.levelStars(132, 322, 16));
        g.levelFlash = performance.now();
        S.sfxLevelUp();
        return null;
      }
      case 'debuffed': {
        const v = g.viewFor(b);
        if (v) {
          const p = g.popupAnchor(v, b);
          g.popups.add('text', 0, p.x, p.y, b.cardId, { text: 'NULL', color: '#FF3860', rise: p.rise });
        }
        S.sfxError();
        return null;
      }
      case 'miss': return null;
      case 'destroy_card': {
        const v = g.viewFor(b);
        if (v) {
          g.burnCard(v, b.reason);
          if (b.reason === 'shatter') S.sfxShatter(); else S.sfxBurn();
        }
        return Math.max(80, this.beat);
      }
      case 'destroy_joker': {
        const v = g.jokerView(b.jokerUid);
        if (v) { v.alpha = 0.2; g.particles.emit(g.fx.burn(v.pos.x + 50, v.pos.y + 70)); }
        S.sfxBurn();
        return null;
      }
      case 'boss_chips': {
        g.counters.chips = b.value;
        g.punchChips(3);
        g.popups.add('text', 0, 77, 236, 'boss', { text: 'HALVED', color: '#FF3860' });
        S.sfxError();
        return 260;
      }
      case 'boss_zero': {
        g.counters.chips = 0;
        g.counters.mult = 0;
        g.popups.add('text', 0, 640, 300, 'boss', { text: b.name.toUpperCase() + ' BLOCKS IT', color: '#FF3860' });
        S.sfxError();
        return b.hold;
      }
      case 'resource': {
        const v = g.jokerView(b.jokerUid);
        const p = v ? g.popupAnchor(v, b) : { x: 640, y: 300, rise: 44 };
        g.popups.add('text', 0, p.x, p.y, b.jokerUid, {
          text: `${b.delta > 0 ? '+' : ''}${b.delta} ${b.which === 'hands' ? 'Hand' : 'Discard'}`,
          color: b.which === 'hands' ? '#4FA3FF' : '#FF5A3C', rise: p.rise,
        });
        return null;
      }
      case 'create': {
        const v = b.jokerUid ? g.jokerView(b.jokerUid) : g.viewFor(b);
        if (v) { v.punch(1.6); g.particles.emit(g.fx.levelStars(v.pos.x + v.w / 2, v.pos.y + 20, 10)); }
        return null;
      }
      case 'final': {
        this.startFinal(b);
        return null;
      }
      default: return null;
    }
  }

  altSign(mag = 9) {
    this._sign = -(this._sign || 1);
    return mag * this._sign;
  }

  startFinal(b) {
    this.phase = 'final';
    this.final = b;
    this.finalT = 0;
    this.game.counters.chips = b.chips;
    this.game.counters.mult = b.mult;
    this.game.collide = 0;
    this.scoreFrom = this.game.displayScore;
    this.scoreTo = this.game.run.score;
  }

  /** The counters slide together, collide, and the score counts up. */
  updateFinal(dt) {
    const g = this.game;
    this.finalT += dt * 1000;
    const t = this.finalT;
    const SLIDE = g.reduced ? 60 : 180;
    const COUNT = g.reduced ? 200 : 400;

    if (t < SLIDE) {
      g.collide = Ease.inQuad(t / SLIDE);
    } else if (!this.collided) {
      this.collided = true;
      g.collide = 1;
      g.flashPanel = performance.now();
      g.particles.emit(g.fx.shockwave(128, 260));
      const req = g.run.blind ? g.run.blind.req : 1;
      g.shake(Math.min(24, 4 + 14 * (this.final.total / Math.max(1, req))) + (this.final.total >= req ? 6 : 0));
      S.sfxXMult();
      S.sfxScoreCountUp(COUNT);
    } else if (t < SLIDE + COUNT) {
      const p = Ease.outQuart((t - SLIDE) / COUNT);
      g.displayScore = this.scoreFrom + (this.scoreTo - this.scoreFrom) * p;
      g.collide = 1 - (t - SLIDE) / COUNT;
    } else if (!this.slammed) {
      this.slammed = true;
      g.displayScore = this.scoreTo;
      g.collide = 0;
      g.barSlam = performance.now();
      g.shake(4);
      S.sfxScoreSlam();
      g.counters.chips = 0;
      g.counters.mult = 0;
    } else if (t > SLIDE + COUNT + 220) {
      this.finish();
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.game.displayScore = this.game.run.score;
    this.game.collide = 0;
    S.resetChipStep();
    if (this.onDone) this.onDone();
  }

  /** Skip to the end (player clicked through). */
  skip() {
    while (this.i < this.queue.length) {
      const b = this.queue[this.i++];
      if (b.type === 'final') { this.game.counters.chips = b.chips; this.game.counters.mult = b.mult; }
    }
    this.game.popups.clear();
    this.finish();
  }
}

function round2(v) { return Math.round(v * 100) / 100; }
