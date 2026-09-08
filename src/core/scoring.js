// The scoring pipeline (RULES.md section 4). Runs synchronously and produces an
// ordered event log; the UI replays that log beat by beat so the animation is
// exactly the math.

import { evaluateHand } from './hands.js';
import { isStone, RANK_CHIPS } from './cards.js';
import { handBase, ENHANCEMENT, EDITION, SEAL } from './rules.js';
import { fireTrigger, fireIndependent, countRetriggers } from './jokers.js';

/** Chips from rank (+ permanent bonus). Slab cards have no rank. */
export function rankChips(card) {
  const bonus = card.bonusChips || 0;
  if (isStone(card)) return bonus;
  return RANK_CHIPS[card.rank] + bonus;
}

function srcInfo(src = {}) {
  return {
    jokerUid: src.joker ? src.joker.uid : undefined,
    cardId: src.card ? src.card.id : undefined,
    source: src.source || (src.edition ? 'edition' : src.joker ? 'joker' : undefined),
    edition: src.edition,
  };
}

/** Context shared by scoring and between-hand triggers. */
export class RunCtx {
  constructor(run) {
    this.run = run;
    this.rng = run.rng;
    this.log = [];
    this.chips = 0;
    this.mult = 0;
    this.scoring = false;
    this.destroyCards = [];
    this.destroyJokers = [];
    this.creates = [];
  }
  snapshot() { return { chips: this.chips, mult: this.mult }; }
  addChips(v, src) {
    if (!this.scoring || !v) return;
    this.chips += v;
    this.log.push({ kind: 'chips', value: v, ...srcInfo(src), after: this.snapshot() });
  }
  addMult(v, src) {
    if (!this.scoring || !v) return;
    this.mult += v;
    this.log.push({ kind: 'mult', value: v, ...srcInfo(src), after: this.snapshot() });
  }
  mulMult(v, src) {
    if (!this.scoring || v === 1) return;
    this.mult *= v;
    this.log.push({ kind: 'xmult', value: v, ...srcInfo(src), after: this.snapshot() });
  }
  addMoney(v, src) {
    if (!v) return;
    this.run.money = Math.max(0, this.run.money + v);
    this.log.push({ kind: 'money', value: v, ...srcInfo(src), after: this.snapshot() });
  }
  queueDestroyJoker(joker, reason) {
    if (!this.destroyJokers.some(d => d.joker === joker)) this.destroyJokers.push({ joker, reason });
    this.log.push({ kind: 'destroy_joker', jokerUid: joker.uid, reason });
  }
  queueDestroyCard(card, source) {
    if (this.destroyCards.some(d => d.card === card)) return;
    this.destroyCards.push({ card, source });
    this.log.push({ kind: 'destroy_card', cardId: card.id, jokerUid: source && source.uid, reason: typeof source === 'string' ? source : 'joker' });
  }
  queueCreate(spec) {
    this.creates.push(spec);
    this.log.push({ kind: 'create', ...spec, jokerUid: spec.source && spec.source.uid, cardId: spec.source && spec.source.id });
  }
  levelHand(type, n, source) {
    this.run.handLevels[type] = (this.run.handLevels[type] || 1) + n;
    this.log.push({ kind: 'level', type, level: this.run.handLevels[type], jokerUid: source && source.uid });
  }
}

export function makeRunCtx(run) { return new RunCtx(run); }

export class ScoreCtx extends RunCtx {
  constructor(run, played, held, ev) {
    super(run);
    this.scoring = true;
    this.played = played;
    this.held = held;
    this.handType = ev.type;
    this.contains = ev.contains;
    this.scoringCards = ev.scoringCards;
    this.total = 0;
  }
}

/**
 * Score a played hand. Mutates run state (money, joker counters, hand levels,
 * hands/discards) and returns the ScoreCtx with `total` and `log`.
 * Card destruction and creation are queued on the ctx for the run to apply.
 */
export function scoreHand(run, played, held) {
  const ev = evaluateHand(played, run.handOpts());
  const ctx = new ScoreCtx(run, played, held, ev);
  const level = run.handLevels[ev.type] || 1;
  const base = handBase(ev.type, level);
  ctx.chips = base.chips;
  ctx.mult = base.mult;
  ctx.log.push({ kind: 'hand', handType: ev.type, level, chips: base.chips, mult: base.mult, after: ctx.snapshot() });
  const mods = run.modifiersActive();

  fireTrigger(ctx, 'before_hand');

  // b. scoring cards
  for (const card of ctx.scoringCards) {
    const echo = mods && card.seal === 'red' ? SEAL.red.retrigger : 0;
    const times = 1 + echo + countRetriggers(ctx, 'card_scored', { card });
    for (let t = 0; t < times; t++) {
      if (t > 0) ctx.log.push({ kind: 'retrigger', cardId: card.id, n: t });
      if (card.debuffed) { ctx.log.push({ kind: 'debuffed', cardId: card.id }); continue; }
      scoreCard(ctx, card, mods);
    }
  }

  // c. held cards
  for (const card of held) {
    const echo = mods && card.seal === 'red' ? SEAL.red.retrigger : 0;
    const times = 1 + echo + countRetriggers(ctx, 'card_held', { card });
    for (let t = 0; t < times; t++) {
      if (card.debuffed) continue;
      if (t > 0) ctx.log.push({ kind: 'retrigger', cardId: card.id, n: t, held: true });
      heldCard(ctx, card, mods);
    }
  }

  // d. jokers
  run.jokers.slice().forEach((j, i) => fireIndependent(ctx, j, i));
  run.bossHook('afterJokers', ctx);

  // e. final
  ctx.chips = Math.max(0, ctx.chips);
  ctx.mult = Math.max(0, ctx.mult);
  ctx.total = (!Number.isFinite(ctx.chips) || !Number.isFinite(ctx.mult)) ? Infinity : ctx.chips * ctx.mult;
  ctx.log.push({ kind: 'final', chips: ctx.chips, mult: ctx.mult, total: ctx.total });

  // post-scoring: crystal shatter rolls (one per card per hand)
  if (mods) {
    for (const card of ctx.scoringCards) {
      if (card.enhancement === 'glass' && !card.debuffed && run.chance(ENHANCEMENT.glass.shatter.num, ENHANCEMENT.glass.shatter.den)) {
        ctx.queueDestroyCard(card, 'shatter');
      }
    }
  }
  fireTrigger(ctx, 'after_hand');
  return ctx;
}

function scoreCard(ctx, card, mods) {
  const run = ctx.run;
  const rc = rankChips(card);
  if (rc) ctx.addChips(rc, { card, source: 'rank' });
  if (mods) {
    const en = card.enhancement;
    const esrc = { card, source: 'enhancement' };
    if (en === 'bonus') ctx.addChips(ENHANCEMENT.bonus.chips, esrc);
    else if (en === 'mult') ctx.addMult(ENHANCEMENT.mult.mult, esrc);
    else if (en === 'glass') ctx.mulMult(ENHANCEMENT.glass.xmult, esrc);
    else if (en === 'stone') ctx.addChips(ENHANCEMENT.stone.chips, esrc);
    else if (en === 'lucky') {
      const L = ENHANCEMENT.lucky;
      if (run.chance(L.multChance.num, L.multChance.den)) ctx.addMult(L.multChance.mult, esrc);
      else ctx.log.push({ kind: 'lucky_miss', cardId: card.id });
      if (run.chance(L.moneyChance.num, L.moneyChance.den)) ctx.addMoney(L.moneyChance.money, esrc);
    }
    if (card.edition) {
      const e = EDITION[card.edition];
      const src = { card, edition: card.edition, source: 'edition' };
      if (e.chips) ctx.addChips(e.chips, src);
      if (e.mult) ctx.addMult(e.mult, src);
      if (e.xmult) ctx.mulMult(e.xmult, src);
    }
    if (card.seal === 'gold') ctx.addMoney(SEAL.gold.money, { card, source: 'seal' });
    if (card.seal === 'blue') ctx.queueCreate({ kind: 'consumable', family: 'star', handType: ctx.handType, source: card });
  }
  fireTrigger(ctx, 'card_scored', { card });
}

function heldCard(ctx, card, mods) {
  if (mods && card.enhancement === 'steel') ctx.mulMult(ENHANCEMENT.steel.heldXmult, { card, source: 'enhancement', held: true });
  fireTrigger(ctx, 'card_held', { card });
}

/** Preview: hand type and base chips/mult for a selection (no side effects). */
export function previewHand(run, selected) {
  if (!selected.length) return null;
  const ev = evaluateHand(selected, run.handOpts());
  const level = run.handLevels[ev.type] || 1;
  const base = handBase(ev.type, level);
  return { type: ev.type, level, chips: base.chips, mult: base.mult, scoringCards: ev.scoringCards };
}
