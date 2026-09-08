// The game controller: owns the Run, the views, input, and the frame loop.
// Rendering of the non-table screens lives in screens.js.

import { Run } from '../core/run.js';
import { previewHand } from '../core/scoring.js';
import { sortByRank, sortBySuit, HAND_NAMES } from '../core/hands.js';
import { describeJoker } from '../core/jokers.js';
import { makeRunCtx } from '../core/scoring.js';
import { TAG_BY_ID } from '../data/tags.js';

import { C, F, font, outlineText, roundRect, shadowRect } from './theme.js';
import { drawCard, drawJokerCard, drawConsumableCard, drawCardBack, drawPanel, drawButton, drawProgressBar, drawEmptySlot } from './draw.js';
import { L, W, H, jokerSlot, consumSlot, handLayout, stagingLayout, inRect } from './layout.js';
import { CardView, TokenView } from './entities.js';
import { Popups } from './popups.js';
import { Particles } from './particles.js';
import { Timeline, Ease, clamp } from './tween.js';
import { fmtScore, fmtNum, fmtMult, fmtMoney } from './fmt.js';
import { fx } from './fx.js';
import { ScoringAnim } from './scoring_anim.js';
import * as S from '../audio/sfx.js';
import { drawScreens } from './screens.js';

export class Game {
  constructor(canvas, jokerDefs) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.jokerDefs = jokerDefs;
    this.view = { scale: 1, ox: 0, oy: 0 };

    this.popups = new Popups();
    this.particles = new Particles();
    this.timeline = new Timeline();
    this.fx = fx;

    this.scene = 'title';
    this.run = null;
    this.t = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.shakeEnabled = true;

    this.handViews = [];
    this.stageViews = [];
    this.jokerViews = [];
    this.consumViews = [];
    this.packViews = [];

    this.selected = new Set();
    this.counters = { chips: 0, mult: 0 };
    this.chipsPunch = 1; this.multPunch = 1;
    this.chipsFlash = 0; this.multFlash = 0;
    this.displayScore = 0;
    this.displayMoney = 0;
    this.collide = 0;
    this.banner = null;
    this.anim = null;
    this.sortMode = 'rank';
    this.hover = null;
    this.tooltip = null;
    this.hoverStart = 0;
    this.drag = null;
    this.message = null;
    this.pendingConsumable = null;
    this.cashRows = null;
    this.seedInput = '';
    this.paused = false;
    this.busy = false;
    this.deckPeek = false;

    this.titleT = 0;
    this.tipIndex = 0;
    this.tipT = 0;
    this.ambientInit = false;
  }

  /* ------------------------------------------------------------ lifecycle */

  newRun(seed) {
    this.run = new Run(seed || undefined, this.jokerDefs);
    this.scene = 'blind_select';
    this.selected.clear();
    this.handViews = []; this.stageViews = [];
    this.displayScore = 0;
    this.displayMoney = this.run.money;
    this.syncJokerViews();
    this.syncConsumViews();
    this.save();
  }

  save() {
    if (!this.run || this.run.dead) return;
    try { localStorage.setItem('abbytro.save', JSON.stringify(this.run.toJSON())); } catch { /* private mode */ }
  }
  hasSave() {
    try { return !!localStorage.getItem('abbytro.save'); } catch { return false; }
  }
  loadRun() {
    try {
      const data = JSON.parse(localStorage.getItem('abbytro.save'));
      if (!data) return false;
      this.run = Run.fromJSON(data, this.jokerDefs);
      this.scene = 'blind_select';
      this.displayMoney = this.run.money;
      this.syncJokerViews(); this.syncConsumViews();
      return true;
    } catch { return false; }
  }
  clearSave() { try { localStorage.removeItem('abbytro.save'); } catch { /* ignore */ } }

  /* -------------------------------------------------------------- views */

  syncJokerViews() {
    const next = [];
    this.run.jokers.forEach((j, i) => {
      const slot = jokerSlot(i);
      let v = this.jokerViews.find(x => x.model === j);
      if (!v) { v = new TokenView(j, slot.x, slot.y - 40); v.alpha = 0; this.timeline.tween(200, p => { v.alpha = p; }); }
      v.index = i;
      if (!v.dragging) v.target(slot.x, slot.y);
      next.push(v);
    });
    this.jokerViews = next;
  }

  syncConsumViews() {
    const next = [];
    this.run.consumables.forEach((c, i) => {
      const slot = consumSlot(i);
      let v = this.consumViews.find(x => x.model === c);
      if (!v) { v = new TokenView(c, slot.x, slot.y - 40); v.alpha = 0; this.timeline.tween(200, p => { v.alpha = p; }); }
      v.index = i;
      if (!v.dragging) v.target(slot.x, slot.y);
      next.push(v);
    });
    this.consumViews = next;
  }

  /** Rebuild hand views from run.hand, dealing in any new cards from the deck pile. */
  syncHand(deal = false) {
    const run = this.run;
    const order = this.sortMode === 'rank' ? sortByRank(run.hand) : sortBySuit(run.hand);
    run.hand = order;
    const next = [];
    let dealIndex = 0;
    order.forEach((card, i) => {
      const pose = handLayout(order.length, i);
      let v = this.handViews.find(x => x.card === card);
      if (!v) {
        v = new CardView(card, L.deckPile.x, L.deckPile.y);
        if (deal && !this.reduced) {
          const delay = dealIndex++ * 70;
          v.alpha = 0;
          this.timeline.delay(delay, () => {
            v.alpha = 1;
            v.scale.set(0.85);
            v.scale.to(1);
            v.flyTo(pose.x - 46, pose.y - 64, {
              dur: 380, ease: Ease.outCubic, arc: -140, spin: pose.rot,
              scale: 1, landImpulse: 180,
            });
            S.sfxDeal(i);
          });
        } else {
          v.place(pose.x - 46, pose.y - 64, pose.rot);
        }
      }
      v.index = i;
      v.selected = this.selected.has(card);
      if (!v.dragging && !v.flying) {
        const lift = v.selected ? -36 : 0;
        v.target(pose.x - 46, pose.y - 64 + lift, pose.rot);
      }
      next.push(v);
    });
    this.handViews = next;
  }

  /** Re-target hand views without creating or dealing any (after select/reorder). */
  syncHandPositions() {
    const n = this.run.hand.length;
    this.run.hand.forEach((card, i) => {
      const v = this.handViews.find(x => x.card === card);
      if (!v) return;
      v.index = i;
      const wasSelected = v.selected;
      v.selected = this.selected.has(card);
      if (v.selected && !wasSelected) { v.pos.sy.kick(-600); v.scale.kick(1.8); }
      if (!v.selected && wasSelected) v.pos.sy.kick(240);
      if (v.dragging || v.flying) return;
      const pose = handLayout(n, i);
      v.target(pose.x - 46, pose.y - 64 + (v.selected ? -36 : 0), pose.rot);
    });
  }

  viewFor(b) {
    if (b.cardId != null) {
      return this.stageViews.find(v => v.card.id === b.cardId)
        || this.handViews.find(v => v.card.id === b.cardId);
    }
    if (b.jokerUid != null) return this.jokerView(b.jokerUid);
    return null;
  }
  jokerView(uid) { return this.jokerViews.find(v => v.model.uid === uid); }

  /** Where a popup for this view should appear, and how far it rises. */
  popupAnchor(v, b) {
    const isJoker = b.jokerUid != null && !b.cardId;
    if (isJoker) return { x: v.pos.x + 50, y: 94, rise: 32 };
    return { x: v.pos.x + v.w / 2, y: v.pos.y - 4, rise: 44 };
  }

  /* ------------------------------------------------------------ feedback */

  punchChips(v = 2) { this.chipsPunch = Math.max(this.chipsPunch, 1 + v * 0.09); this.chipsFlash = performance.now(); }
  punchMult(v = 2) { this.multPunch = Math.max(this.multPunch, 1 + v * 0.09); this.multFlash = performance.now(); }

  shake(amp) {
    if (!this.shakeEnabled || this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, clamp(amp, 0, 24));
    this.shakeT = 260;
  }

  coinBurst(x, y, amount) {
    const target = { x: L.moneyBox.x + 108, y: L.moneyBox.y + 26 };
    this.particles.emit({ ...fx.coins(x, y, Math.abs(amount)), attract: target, onArrive: () => S.sfxCoin() });
  }

  burnCard(v, reason) {
    const cx = v.pos.x + v.w / 2, cy = v.pos.y + v.h / 2;
    if (reason === 'shatter') this.particles.emit(fx.shatter(cx, cy));
    else { this.particles.emit(fx.burn(cx, cy)); this.particles.emit(fx.ash(cx, cy)); }
    v.dead = true;
    this.timeline.tween(360, p => { v.alpha = 1 - p; v.scale.set(1 - p * 0.4); });
  }

  toast(text, bad = false) {
    this.message = { text, born: performance.now(), bad };
    if (bad) S.sfxError();
  }

  /* ---------------------------------------------------------- game flow */

  startBlind() {
    const run = this.run;
    run.startBlind();
    this.selected.clear();
    this.stageViews = [];
    this.handViews = [];
    this.displayScore = 0;
    this.counters = { chips: 0, mult: 0 };
    this.scene = 'playing';
    this.banner = null;
    this.syncHand(true);
    this.syncJokerViews();
    if (run.boss()?.forcedCard) this.pickForcedCard();
    this.save();
  }

  pickForcedCard() {
    const run = this.run;
    const pool = run.hand.filter(c => !this.forcedCard || c !== this.forcedCard);
    if (!pool.length) { this.forcedCard = null; return; }
    this.forcedCard = pool[run.rngInt('chance', pool.length)];
    this.selected.add(this.forcedCard);
  }

  play() {
    const run = this.run;
    const sel = run.hand.filter(c => this.selected.has(c));
    const gate = run.canPlay(sel);
    if (!gate.ok) return this.toast(gate.reason, true);

    this.busy = true;
    S.sfxPlayHand();
    S.resetChipStep();

    // move selected cards into the staging area
    const preview = previewHand(run, sel);
    const scoringIds = new Set(preview.scoringCards.map(c => c.id));
    this.stageViews = [];
    sel.forEach((card, k) => {
      const v = this.handViews.find(x => x.card === card) || new CardView(card, 640, 500);
      const isScoring = scoringIds.has(card.id);
      const pose = stagingLayout(sel.length, k, isScoring);
      v.selected = false;
      v.sway = false;
      v.alpha = isScoring ? 1 : 0.85;
      this.timeline.delay(k * 60, () => {
        v.target(pose.x - 46, pose.y - 64, 0);
        v.pos.sy.kick(-300);
      });
      this.stageViews.push(v);
    });
    this.handViews = this.handViews.filter(v => !sel.includes(v.card));
    this.selected.clear();
    this.forcedCard = null;

    const res = run.playHand(sel);
    if (res.error) { this.busy = false; return this.toast(res.error, true); }

    this.syncJokerViews();
    this.syncConsumViews();
    this.syncHand();

    if (res.skipped) {
      this.toast(`${run.boss().name}: hand discarded`, true);
      this.timeline.delay(600, () => this.afterHand(res));
      return;
    }

    this.timeline.delay(this.reduced ? 200 : 420, () => {
      this.anim = new ScoringAnim(this, res.ctx, () => {
        this.anim = null;
        this.afterHand(res);
      });
    });
  }

  afterHand(res) {
    const run = this.run;
    // clear out any cards destroyed mid-hand
    this.stageViews = this.stageViews.filter(v => run.deck.includes(v.card) || !v.dead);
    this.displayScore = run.score;

    if (res.cleared) { this.clearBlind(); return; }
    if (res.dead) { this.gameOver(); return; }

    // discard the played cards and refill
    this.stageViews.forEach((v, k) => {
      this.timeline.delay(k * 40, () => {
        if (this.reduced) { this.timeline.tween(160, p => { v.alpha = 1 - p; }); return; }
        v.flyTo(1380, v.pos.y - 60, { dur: 420, ease: Ease.inCubic, arc: -40, spin: v.rot.x + 6.6, scale: 0.8, alpha: 0 });
      });
    });
    this.timeline.delay(this.reduced ? 200 : 480, () => {
      this.stageViews = [];
      run.finishHand();
      this.syncHand(true);
      if (run.boss()?.forcedCard) this.pickForcedCard();
      this.busy = false;
      this.save();
    });
  }

  discardSelected() {
    const run = this.run;
    const sel = run.hand.filter(c => this.selected.has(c));
    const gate = run.canDiscard(sel);
    if (!gate.ok) return this.toast(gate.reason, true);
    this.busy = true;
    S.sfxDiscard();
    const views = this.handViews.filter(v => sel.includes(v.card));
    views.forEach((v, k) => {
      this.timeline.delay(k * 50, () => {
        if (this.reduced) this.timeline.tween(160, p => { v.alpha = 1 - p; });
        else v.flyTo(1380, v.pos.y - 60, { dur: 420, ease: Ease.inCubic, arc: -40, spin: v.rot.x + 6.6, scale: 0.8, alpha: 0 });
      });
    });
    const res = run.discard(sel);
    if (res.error) { this.busy = false; return this.toast(res.error, true); }
    this.selected.clear();
    this.forcedCard = null;
    this.handViews = this.handViews.filter(v => !sel.includes(v.card));
    this.timeline.delay(this.reduced ? 180 : 400, () => {
      this.syncHand(true);
      if (run.boss()?.forcedCard) this.pickForcedCard();
      this.busy = false;
      this.save();
    });
  }

  clearBlind() {
    const run = this.run;
    const boss = run.blind.type === 'boss';
    this.blindCleared = performance.now();
    this.shake(boss ? 24 : 14);
    this.particles.emit(fx.confetti(132, 40, boss ? 220 : 120));
    this.particles.emit(fx.confetti(720, 320, boss ? 120 : 70));
    if (boss) { this.particles.emit(fx.bossSparks(132, 90)); S.sfxBossCleared(); }
    else S.sfxBlindCleared();

    this.stageViews.forEach((v, k) => {
      this.timeline.delay(k * 40, () => {
        if (!this.reduced) v.flyTo(1380, v.pos.y - 60, { dur: 420, ease: Ease.inCubic, spin: v.rot.x + 6.6, scale: 0.8, alpha: 0 });
        else this.timeline.tween(160, p => { v.alpha = 1 - p; });
      });
    });

    this.timeline.delay(this.reduced ? 400 : 900, () => {
      this.cashRows = run.cashOut();
      this.cashShown = 0;
      this.scene = 'cash_out';
      this.stageViews = [];
      this.busy = false;
      this.syncJokerViews();
      this.syncConsumViews();
      this.save();
    });
  }

  finishCashOut() {
    const run = this.run;
    const wasBoss = run.blind && run.blind.type === 'boss';
    this.cashRows = null;
    run.blind = null;
    if (wasBoss && run.ante >= 8 && !run.endless) {
      run.won = true;
      this.scene = 'win';
      S.sfxWin();
      this.clearSave();
      return;
    }
    run.advanceBlind();
    this.openShop();
  }

  openShop() {
    this.run.openShop();
    this.scene = 'shop';
    this.syncJokerViews();
    this.syncConsumViews();
    this.save();
  }

  leaveShop() {
    this.run.shop = null;
    this.scene = 'blind_select';
    this.save();
  }

  gameOver() {
    this.run.dead = true;
    this.scene = 'game_over';
    this.busy = false;
    S.sfxGameOver();
    this.clearSave();
  }

  /* ------------------------------------------------------------- update */

  update(dt) {
    this.t += dt * 1000;
    this.timeline.update(dt * 1000);
    this.popups.reduced = this.reduced;
    this.particles.reducedMotion = this.reduced;
    this.popups.update();
    this.particles.update(dt);

    if (this.anim) this.anim.update(dt);

    for (const v of this.handViews) v.update(dt, this.t);
    for (const v of this.stageViews) v.update(dt, this.t);
    for (const v of this.jokerViews) v.update(dt, this.t);
    for (const v of this.consumViews) v.update(dt, this.t);
    for (const v of this.packViews) v.update(dt, this.t);

    // counter punches decay toward 1
    this.chipsPunch += (1 - this.chipsPunch) * Math.min(1, dt * 14);
    this.multPunch += (1 - this.multPunch) * Math.min(1, dt * 14);

    if (this.run && this.scene !== 'playing') this.displayScore = this.run.score;
    if (this.run) this.displayMoney += (this.run.money - this.displayMoney) * Math.min(1, dt * 10);

    if (this.shakeT > 0) {
      this.shakeT -= dt * 1000;
      if (this.shakeT <= 0) { this.shakeAmp = 0; this.shakeT = 0; }
    }

    if (this.message && performance.now() - this.message.born > 2200) this.message = null;

    this.tipT += dt * 1000;
    if (this.tipT > 6000) { this.tipT = 0; this.tipIndex = (this.tipIndex + 1) % TIPS.length; }

    if (this.scene === 'title') this.titleT += dt * 1000;

    // ambient dust: barely there, just enough that the table is not dead still
    if (!this.reduced && this.scene !== 'title' && this.particles.count < 34 && Math.random() < dt * 4) {
      this.particles.emit({
        n: 1, x: 264 + Math.random() * 1000, y: 18 + Math.random() * 686,
        speed: [3, 8], arc: Math.PI * 2, gravity: 0, drag: 1, life: [5000, 9000],
        size: [1.5, 2.5], colors: ['#F7F1E3'], blend: 'lighter', shrink: false,
        spin: [0, 0], alphaMul: 0.12,
      });
    }
  }

  /* --------------------------------------------------------------- draw */

  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    const scale = Math.min(cw / W, ch / H);
    this.view.scale = scale;
    this.view.ox = (cw - W * scale) / 2;
    this.view.oy = (ch - H * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(this.view.ox, this.view.oy);
    ctx.scale(scale, scale);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // screen shake wraps everything except the flash layer
    let sx = 0, sy = 0, srot = 0;
    if (this.shakeAmp > 0 && this.shakeT > 0) {
      const k = Math.pow(this.shakeT / 260, 2);
      sx = (Math.random() * 2 - 1) * this.shakeAmp * k;
      sy = (Math.random() * 2 - 1) * this.shakeAmp * k;
      srot = (Math.random() * 2 - 1) * 0.4 * Math.PI / 180 * (this.shakeAmp / 24) * k;
    }
    ctx.save();
    ctx.translate(640 + sx, 360 + sy);
    ctx.rotate(srot);
    ctx.translate(-640, -360);

    this.drawFelt(ctx);

    if (this.scene === 'title') {
      drawScreens.title(this, ctx);
    } else {
      this.drawSidebar(ctx);
      if (this.scene === 'blind_select') drawScreens.blindSelect(this, ctx);
      else if (this.scene === 'shop') drawScreens.shop(this, ctx);
      else this.drawTable(ctx);

      this.drawJokerRow(ctx);
      this.drawConsumables(ctx);

      if (this.scene === 'cash_out') drawScreens.cashOut(this, ctx);
      if (this.scene === 'pack') drawScreens.pack(this, ctx);
      if (this.scene === 'game_over') drawScreens.gameOver(this, ctx);
      if (this.scene === 'win') drawScreens.win(this, ctx);
      if (this.deckPeek) drawScreens.deckPeek(this, ctx);
    }

    this.particles.draw(ctx);
    this.popups.draw(ctx);
    this.drawTooltip(ctx);
    this.drawMessage(ctx);
    ctx.restore();

    if (this.paused) drawScreens.pause(this, ctx);
    this.drawFlash(ctx);
    ctx.restore();
  }

  drawFelt(ctx) {
    ctx.fillStyle = C.felt;
    ctx.fillRect(0, 0, W, H);
    const spot = ctx.createRadialGradient(720, 520, 0, 720, 520, 520);
    spot.addColorStop(0, 'rgba(255,240,210,0.06)');
    spot.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(720, 380, 260, 720, 380, 900);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawFlash(ctx) {
    if (!this.blindCleared) return;
    const age = performance.now() - this.blindCleared;
    const dur = 260;
    if (age > dur) { this.blindCleared = 0; return; }
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - age / dur)})`;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------- sidebar */

  drawSidebar(ctx) {
    const run = this.run;
    const blind = run.blind || run.blindInfo();
    drawPanel(ctx, L.sidebar.x, L.sidebar.y, L.sidebar.w, L.sidebar.h);

    // blind panel
    const bp = L.blindPanel;
    drawPanel(ctx, bp.x, bp.y, bp.w, bp.h, { fill: C.well, r: 10 });
    const bcol = blind.type === 'small' ? C.chips : blind.type === 'big' ? C.money : C.legendary;
    outlineText(ctx, blind.name.toUpperCase(), bp.x + 8, 44, { size: 13, family: 'ui', weight: 800, fill: C.text2, align: 'left', maxWidth: 200 });
    ctx.beginPath();
    ctx.arc(L.blindDisc.cx, L.blindDisc.cy, L.blindDisc.r, 0, Math.PI * 2);
    ctx.fillStyle = bcol; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    if (blind.boss) outlineText(ctx, blind.boss.glyph, L.blindDisc.cx, L.blindDisc.cy + 1, { size: 22, fill: C.ink, stroke: null });
    outlineText(ctx, fmtScore(blind.req), 96, 80, { size: 26, fill: C.text, align: 'left', lineWidth: 3, maxWidth: 140 });
    outlineText(ctx, '$' + blind.reward, 96, 106, { size: 12, family: 'ui', weight: 800, fill: C.money, align: 'left', stroke: null });
    const frac = blind.req > 0 ? clamp(this.displayScore / blind.req, 0, 1) : 0;
    drawProgressBar(ctx, L.blindBar.x, L.blindBar.y, L.blindBar.w, L.blindBar.h, frac, bcol);

    // round score
    const sp = L.scorePanel;
    drawPanel(ctx, sp.x, sp.y, sp.w, sp.h, { fill: C.well, r: 10 });
    outlineText(ctx, 'ROUND SCORE', sp.x + 8, 166, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2 });
    outlineText(ctx, fmtScore(this.displayScore), 132, 196, { size: 40, fill: C.text, lineWidth: 5, maxWidth: 200 });

    // chips x mult
    this.drawChipsMult(ctx);

    // hand type + level
    const ht = L.handType;
    const type = this.currentHandType();
    drawPanel(ctx, ht.x, ht.y, ht.w, ht.h, { fill: C.well, r: 8 });
    outlineText(ctx, type ? HAND_NAMES[type] : '—', ht.x + 8, ht.y + 18, { size: 16, fill: type ? C.text : C.textMuted, align: 'left', lineWidth: 3, maxWidth: 150 });
    if (type) {
      const lvl = run.handLevels[type] || 1;
      const flash = this.levelFlash && performance.now() - this.levelFlash < 400;
      roundRect(ctx, 190, ht.y + 9, 44, 18, 5);
      ctx.fillStyle = flash ? '#FFFFFF' : C.money; ctx.fill();
      outlineText(ctx, 'LVL ' + lvl, 212, ht.y + 18, { size: 11, family: 'ui', weight: 800, fill: C.moneyInk, stroke: null });
    }

    // hands / discards
    const hb = L.handsBox, db = L.discardsBox;
    drawPanel(ctx, hb.x, hb.y, hb.w, hb.h, { fill: C.well, r: 8 });
    drawPanel(ctx, db.x, db.y, db.w, db.h, { fill: C.well, r: 8 });
    outlineText(ctx, 'HANDS', hb.x + hb.w / 2, 362, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2 });
    outlineText(ctx, 'DISCARDS', db.x + db.w / 2, 362, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2 });
    outlineText(ctx, String(run.blind ? run.handsLeft : run.maxHands), hb.x + hb.w / 2, 388, { size: 24, fill: C.chips, lineWidth: 3 });
    outlineText(ctx, String(run.blind ? run.discardsLeft : run.maxDiscards), db.x + db.w / 2, 388, { size: 24, fill: C.mult, lineWidth: 3 });

    // money
    const mb = L.moneyBox;
    drawPanel(ctx, mb.x, mb.y, mb.w, mb.h, { fill: C.well, r: 8 });
    outlineText(ctx, fmtMoney(Math.round(this.displayMoney)), mb.x + mb.w / 2, mb.y + 26, { size: 26, fill: C.money, lineWidth: 3, maxWidth: 190 });

    // ante / round
    const ab = L.anteBox, rb = L.roundBox;
    drawPanel(ctx, ab.x, ab.y, ab.w, ab.h, { fill: C.well, r: 8 });
    drawPanel(ctx, rb.x, rb.y, rb.w, rb.h, { fill: C.well, r: 8 });
    outlineText(ctx, 'ANTE', ab.x + ab.w / 2, ab.y + 14, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2 });
    outlineText(ctx, 'ROUND', rb.x + rb.w / 2, rb.y + 14, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2 });
    outlineText(ctx, `${run.ante}${run.endless ? '' : '/8'}`, ab.x + ab.w / 2, ab.y + 34, { size: 20, fill: C.text, lineWidth: 3 });
    outlineText(ctx, String(run.round), rb.x + rb.w / 2, rb.y + 34, { size: 20, fill: C.text, lineWidth: 3 });

    drawButton(ctx, L.runInfoBtn, 'RUN INFO', { fill: C.panelBorder, bevel: '#2A2648', textColor: C.text, size: 14, hover: inRect(this.mx, this.my, L.runInfoBtn) });
    drawButton(ctx, L.optionsBtn, 'OPTIONS', { fill: C.panelBorder, bevel: '#2A2648', textColor: C.text, size: 14, hover: inRect(this.mx, this.my, L.optionsBtn) });

    // pending tags
    if (run.tags.length) {
      let tx = L.sidebar.x + 8;
      for (const id of run.tags.slice(0, 6)) {
        const tag = TAG_BY_ID[id];
        ctx.beginPath(); ctx.arc(tx + 10, 646, 11, 0, Math.PI * 2);
        ctx.fillStyle = C.panelBorder; ctx.fill();
        ctx.strokeStyle = C.money; ctx.lineWidth = 1.5; ctx.stroke();
        outlineText(ctx, tag.glyph, tx + 10, 647, { size: 12, family: 'emoji', stroke: null });
        if (Math.hypot(this.mx - (tx + 10), this.my - 646) < 12) this.setTooltip(tag.name, tag.desc, tx + 10, 630);
        tx += 26;
      }
    }
  }

  drawChipsMult(ctx) {
    const cb = L.chipsBox, mb = L.multBox;
    const slide = this.collide * 20;
    const now = performance.now();
    const cFlash = Math.max(0, 1 - (now - this.chipsFlash) / 160);
    const mFlash = Math.max(0, 1 - (now - this.multFlash) / 160);

    // chips
    ctx.save();
    ctx.translate(cb.x + cb.w / 2 + slide, cb.y + cb.h / 2);
    ctx.scale(this.chipsPunch, this.chipsPunch);
    roundRect(ctx, -cb.w / 2, -cb.h / 2, cb.w, cb.h, 8);
    ctx.fillStyle = C.chipsDark; ctx.fill();
    if (cFlash > 0) { ctx.fillStyle = `rgba(79,163,255,${cFlash * 0.5})`; ctx.fill(); }
    outlineText(ctx, fmtNum(this.counters.chips), 0, 1, { size: 30, fill: '#FFFFFF', lineWidth: 4, maxWidth: 82 });
    ctx.restore();

    // x
    ctx.save();
    const xs = 1 + this.collide * 0.6;
    ctx.translate(L.timesSign.x, L.timesSign.y);
    ctx.scale(xs, xs);
    ctx.globalAlpha = 1 - this.collide;
    outlineText(ctx, '×', 0, 0, { size: 26, fill: C.text, lineWidth: 3 });
    ctx.restore();

    // mult
    ctx.save();
    ctx.translate(mb.x + mb.w / 2 - slide, mb.y + mb.h / 2);
    ctx.scale(this.multPunch, this.multPunch);
    roundRect(ctx, -mb.w / 2, -mb.h / 2, mb.w, mb.h, 8);
    ctx.fillStyle = C.multDark; ctx.fill();
    if (mFlash > 0) { ctx.fillStyle = `rgba(255,90,60,${mFlash * 0.5})`; ctx.fill(); }
    outlineText(ctx, fmtMult(this.counters.mult), 0, 1, { size: 30, fill: '#FFFFFF', lineWidth: 4, maxWidth: 82 });
    ctx.restore();
  }

  /** Hand type of the current selection, or of the hand being scored. */
  currentHandType() {
    if (this.banner) return Object.keys(HAND_NAMES).find(k => HAND_NAMES[k] === this.banner.text);
    if (!this.run.blind) return null;
    const sel = this.run.hand.filter(c => this.selected.has(c));
    if (!sel.length) return null;
    const p = previewHand(this.run, sel);
    return p ? p.type : null;
  }

  /* --------------------------------------------------------------- table */

  drawTable(ctx) {
    const run = this.run;

    // deck pile
    const dp = L.deckPile;
    for (let i = 0; i < 3; i++) drawCardBack(ctx, dp.x, dp.y - (2 - i), { rot: [0, -0.026, 0.017][i], t: this.t });
    outlineText(ctx, `${run.drawPile.length}/${run.deck.length}`, L.deckCount.x, L.deckCount.y - 6, { size: 16, fill: C.text2, lineWidth: 3 });
    if (inRect(this.mx, this.my, dp)) this.setTooltip('Deck', `${run.drawPile.length} cards left to draw of ${run.deck.length}. Click to inspect.`, dp.x + 46, dp.y - 10);

    // banner
    if (this.banner) {
      const age = performance.now() - this.banner.born;
      if (age < 4000) {
        const inScale = age < 180 ? 1.6 - 0.6 * Ease.outBack(age / 180) : 1;
        const alpha = age < 60 ? age / 60 : 1;
        // whip to the sidebar between 340 and 560ms
        let bx = 720, by = 216, bs = inScale;
        if (age > 340) {
          const p = Math.min(1, (age - 340) / 220);
          const e = Ease.inCubic(p);
          bx = 720 + (132 - 720) * e;
          by = 216 + (322 - 216) * e;
          bs = inScale * (1 - 0.43 * e);
        }
        if (age < 620) {
          ctx.save();
          ctx.globalAlpha = alpha * (age > 560 ? 1 - (age - 560) / 60 : 1);
          ctx.translate(bx, by);
          ctx.scale(bs, bs);
          outlineText(ctx, this.banner.text.toUpperCase(), 0, 0, { size: 28, fill: C.text, lineWidth: 4, letterSpacing: 1 });
          roundRect(ctx, -22, 20, 44, 18, 5);
          ctx.fillStyle = C.money; ctx.fill();
          outlineText(ctx, 'LVL ' + this.banner.level, 0, 29, { size: 11, family: 'ui', weight: 800, fill: C.moneyInk, stroke: null });
          ctx.restore();
        }
      }
    }

    // staging then hand (hovered card last). The pack screen draws its own
    // copy of the hand at a smaller scale, so skip these while it is open.
    if (this.scene !== 'pack') {
      for (const v of this.stageViews) this.drawCardView(ctx, v);
      const hovered = this.handViews.find(v => v.hovered);
      for (const v of this.handViews) if (v !== hovered) this.drawCardView(ctx, v);
      if (hovered) this.drawCardView(ctx, hovered);
    }

    // buttons
    const selCount = this.selected.size;
    const canPlay = !this.busy && run.canPlay(run.hand.filter(c => this.selected.has(c))).ok;
    const canDisc = !this.busy && run.canDiscard(run.hand.filter(c => this.selected.has(c))).ok;
    drawButton(ctx, L.playBtn, 'PLAY HAND', {
      fill: '#2F7BE0', bevel: '#1E5AB0', textColor: '#FFFFFF',
      disabled: !canPlay, hover: canPlay && inRect(this.mx, this.my, L.playBtn),
    });
    drawButton(ctx, L.discardBtn, 'DISCARD', {
      fill: '#E04A3C', bevel: '#A8302A', textColor: '#FFFFFF',
      disabled: !canDisc, hover: canDisc && inRect(this.mx, this.my, L.discardBtn),
    });
    drawPanel(ctx, L.sortPanel.x, L.sortPanel.y, L.sortPanel.w, L.sortPanel.h, { r: 10 });
    this.drawSortPill(ctx, L.sortRank, 'RANK', this.sortMode === 'rank');
    this.drawSortPill(ctx, L.sortSuit, 'SUIT', this.sortMode === 'suit');
  }

  drawSortPill(ctx, r, label, active) {
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    if (active) { ctx.fillStyle = C.paper; ctx.fill(); }
    else { ctx.strokeStyle = C.textMuted; ctx.lineWidth = 1; ctx.stroke(); }
    outlineText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, {
      size: 11, family: 'ui', weight: 800, fill: active ? '#2B2740' : C.text2, stroke: null, letterSpacing: 0.5,
    });
  }

  drawCardView(ctx, v) {
    const pose = v.drawPose(this.t, this.reduced);
    const scoring = this.stageViews.includes(v) && v.alpha >= 1;
    drawCard(ctx, v.card, pose.x, pose.y, {
      t: this.t, scale: pose.scale, rot: pose.rot, alpha: pose.alpha,
      shadowDy: v.shadowDy, selected: v.selected,
      highlight: v.selected ? C.money : (scoring && this.anim ? C.chips : null),
      flip: v.flipT,
    });
  }

  drawJokerRow(ctx) {
    const run = this.run;
    const slots = run.jokerSlots;
    drawPanel(ctx, L.jokerPanel.x, L.jokerPanel.y, Math.max(L.jokerPanel.w, slots * L.jokerSlotStep + 12), L.jokerPanel.h);
    for (let i = run.jokers.length; i < slots; i++) {
      const s = jokerSlot(i);
      drawEmptySlot(ctx, s.x, s.y, 100, 140);
    }
    const dragged = this.jokerViews.find(v => v.dragging);
    for (const v of this.jokerViews) if (v !== dragged) this.drawTokenView(ctx, v, 'joker');
    if (dragged) this.drawTokenView(ctx, dragged, 'joker');
    outlineText(ctx, `JOKERS ${run.jokers.length}/${slots}`, L.jokerLabel.x, L.jokerLabel.y, {
      size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2,
    });
  }

  drawConsumables(ctx) {
    const run = this.run;
    const slots = run.consumableSlots;
    drawPanel(ctx, L.consumPanel.x, L.consumPanel.y, Math.max(L.consumPanel.w, slots * L.consumSlotStep + 12), L.consumPanel.h);
    for (let i = run.consumables.length; i < slots; i++) {
      const s = consumSlot(i);
      drawEmptySlot(ctx, s.x, s.y, 100, 140);
    }
    for (const v of this.consumViews) this.drawTokenView(ctx, v, 'consumable');
    outlineText(ctx, `CONSUMABLES ${run.consumables.length}/${slots}`, L.consumLabel.x, L.consumLabel.y, {
      size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2,
    });
  }

  drawTokenView(ctx, v, kind) {
    const pose = v.drawPose(this.t, this.reduced);
    if (kind === 'joker') {
      const j = v.model;
      drawJokerCard(ctx, j, pose.x, pose.y, {
        t: this.t, scale: pose.scale, rot: pose.rot, alpha: pose.alpha,
        shadowDy: v.shadowDy, hovered: v.hovered,
        description: describeJoker(j, this.ctxForDesc()),
        sellValue: v.hovered && !this.busy ? this.jokerSell(j) : null,
        slotIndex: v.hovered ? v.index + 1 : null,
        faceDown: j.faceDown,
      });
    } else {
      const c = v.model;
      const sel = this.pendingConsumable === c;
      drawConsumableCard(ctx, { family: c.def.family, name: c.def.name, glyph: c.def.glyph, description: c.def.desc }, pose.x, pose.y, {
        t: this.t, scale: pose.scale, rot: pose.rot, alpha: pose.alpha,
        shadowDy: v.shadowDy, hovered: v.hovered,
        highlight: sel ? C.money : null,
        description: c.def.desc,
      });
    }
  }

  jokerSell(j) {
    const { jokerSellValue } = globalThis.__abbytroJokerMod || {};
    return jokerSellValue ? jokerSellValue(j) : Math.max(1, Math.floor(j.cost / 2));
  }

  ctxForDesc() {
    if (!this._descCtx || this._descCtx.run !== this.run) this._descCtx = makeRunCtx(this.run);
    return this._descCtx;
  }

  /* ------------------------------------------------------------ tooltips */

  setTooltip(title, body, x, y, color) {
    this.tooltip = { title, body, x, y, color };
  }

  drawTooltip(ctx) {
    if (!this.tooltip) return;
    const { title, body, x, y, color } = this.tooltip;
    ctx.font = font(12, 'ui', 600);
    const maxW = 220;
    const words = String(body).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW - 16 && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const h = 10 + (title ? 18 : 0) + lines.length * 16 + 8;
    const w = maxW;
    let tx = clamp(x - w / 2, 8, W - w - 8);
    let ty = y - h - 10;
    if (ty < 8) ty = y + 20;
    roundRect(ctx, tx, ty, w, h, 8);
    ctx.fillStyle = 'rgba(23,20,38,0.96)'; ctx.fill();
    ctx.strokeStyle = C.panelBorder; ctx.lineWidth = 1; ctx.stroke();
    let cy = ty + 8;
    if (title) {
      outlineText(ctx, title, tx + 8, cy + 8, { size: 12, family: 'ui', weight: 800, fill: color || C.text, align: 'left', stroke: null });
      cy += 18;
    }
    for (const l of lines) {
      outlineText(ctx, l, tx + 8, cy + 9, { size: 12, family: 'ui', weight: 600, fill: C.text2, align: 'left', stroke: null });
      cy += 16;
    }
  }

  drawMessage(ctx) {
    if (!this.message) return;
    const age = performance.now() - this.message.born;
    const alpha = age > 1800 ? 1 - (age - 1800) / 400 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    const text = this.message.text;
    ctx.font = font(14, 'ui', 800);
    const w = ctx.measureText(text).width + 28;
    roundRect(ctx, 640 - w / 2, 654, w, 32, 8);
    ctx.fillStyle = 'rgba(23,20,38,0.94)'; ctx.fill();
    ctx.strokeStyle = this.message.bad ? C.bad : C.panelBorder;
    ctx.lineWidth = 1.5; ctx.stroke();
    outlineText(ctx, text, 640, 670, { size: 14, family: 'ui', weight: 800, fill: this.message.bad ? C.bad : C.text, stroke: null });
    ctx.restore();
  }
}

export const TIPS = [
  'Play fewer, bigger hands. Every unused hand pays $1.',
  'Mult multiplies Chips. ×Mult multiplies Mult. Order matters.',
  'Jokers trigger left to right. Drag to reorder them.',
  'Save a discard for the boss. You will want it.',
  'Star cards level a hand forever. Level the one you actually play.',
  'Interest pays $1 per $5 held, up to $5. Being rich is a strategy.',
];
