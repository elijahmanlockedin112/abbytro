// Joker DSL interpreter. Joker definitions (src/data/jokers.json) are data;
// this module evaluates their conditions and applies their effects against a
// scoring context (during a hand) or a run context (between hands).

import { isFace, isStone, hasSuit } from './cards.js';
import { EDITION, sellValue } from './rules.js';
import { CUSTOM_JOKERS } from './custom_jokers.js';

let nextUid = 1;

export function instantiateJoker(def, extra = {}) {
  const scaleEff = def.effects.find(e => e.scale);
  return {
    uid: nextUid++,
    defId: def.id,
    def,
    edition: null,
    disabled: false,
    faceDown: false,
    counter: scaleEff ? (scaleEff.scale.start ?? 0) : 0,
    state: { triggers: 0 },
    cost: def.cost,
    ...extra,
  };
}

export function jokerSellValue(j) {
  const ed = j.edition ? (EDITION[j.edition]?.price || 0) : 0;
  return sellValue(j.cost + ed) + (j.state.sellBonus || 0);
}

/* ---------------------------------------------------------------- stats */

export function getStat(name, ctx, joker) {
  const run = ctx.run;
  const [key, arg] = name.split(':');
  const deck = run.deck;
  const held = ctx.held || run.hand || [];
  switch (key) {
    case 'deckCount': return run.drawPile.length;
    case 'fullDeckCount': return deck.length;
    case 'handSize': return run.handSize;
    case 'discardsRemaining': return run.discardsLeft;
    case 'handsRemaining': return run.handsLeft;
    case 'money': return run.money;
    case 'jokerCount': return run.jokers.length;
    case 'emptyJokerSlots': return Math.max(0, run.jokerSlots - run.jokers.filter(j => j.edition !== 'negative').length);
    case 'cardsInHand': return held.length;
    case 'consumableCount': return run.consumables.length;
    case 'stoneCardsInDeck': return deck.filter(isStone).length;
    case 'faceCardsInDeck': return deck.filter(isFace).length;
    case 'cardsInSuit': return deck.filter(c => hasSuit(c, arg, run.handOpts())).length;
    case 'enhancedCardsInDeck': return deck.filter(c => c.enhancement).length;
    case 'blindsSkipped': return run.stats.blindsSkipped;
    case 'ante': return run.ante;
    case 'level': return run.handLevels[arg] || 1;
    case 'heldFaceCards': return held.filter(isFace).length;
    case 'heldSuit': return held.filter(c => hasSuit(c, arg, run.handOpts())).length;
    case 'timesTriggered': return joker ? joker.state.triggers : 0;
    case 'counter': return joker ? joker.counter : 0;
    case 'cardsPlayed': return ctx.played ? ctx.played.length : 0;
    case 'scoringCards': return ctx.scoringCards ? ctx.scoringCards.length : 0;
    case 'handsPlayedRound': return run.handsPlayedThisRound;
    case 'round': return run.round;
    case 'jokersSold': return run.stats.jokersSold;
    case 'cardsDestroyed': return run.stats.cardsDestroyed;
    case 'rerolls': return run.stats.rerolls;
    case 'discardsUsed': return run.discardsUsedThisRound;
    default:
      console.warn('unknown stat', name);
      return 0;
  }
}

/* ----------------------------------------------------------- conditions */

export function checkWhen(when, ctx, extra, joker, jokerIndex) {
  if (!when) return true;
  const run = ctx.run;
  const card = extra.card;
  const opts = run.handOpts();
  for (const key of Object.keys(when)) {
    const v = when[key];
    switch (key) {
      case 'suit': if (!card || !hasSuit(card, v, opts)) return false; break;
      case 'suitIn': if (!card || !v.some(s => hasSuit(card, s, opts))) return false; break;
      case 'rank': if (!card || isStone(card) || card.rank !== v) return false; break;
      case 'rankIn': if (!card || isStone(card) || !v.includes(card.rank)) return false; break;
      case 'rankNotIn': if (!card || isStone(card) || v.includes(card.rank)) return false; break;
      case 'face': if (!card || isFace(card) !== v) return false; break;
      case 'numbered': if (!card || isStone(card) || isFace(card) || card.rank === 'A') return false; break;
      case 'even': if (!card || isStone(card) || !['2', '4', '6', '8', '10'].includes(card.rank)) return false; break;
      case 'odd': if (!card || isStone(card) || !['A', '3', '5', '7', '9'].includes(card.rank)) return false; break;
      case 'enhancement': if (!card || card.enhancement !== v) return false; break;
      case 'edition': if (!card || card.edition !== v) return false; break;
      case 'seal': if (!card || card.seal !== v) return false; break;
      case 'hasEnhancement': if (!card || !!card.enhancement !== v) return false; break;
      case 'hasSeal': if (!card || !!card.seal !== v) return false; break;
      case 'hasEdition': if (!card || !!card.edition !== v) return false; break;
      case 'handType': if (ctx.handType !== v) return false; break;
      case 'handTypeIn': if (!v.includes(ctx.handType)) return false; break;
      case 'handContains': if (!ctx.contains || !ctx.contains.has(v)) return false; break;
      case 'handNotContains': if (ctx.contains && ctx.contains.has(v)) return false; break;
      case 'cardsPlayed': if (!ctx.played || ctx.played.length !== v) return false; break;
      case 'cardsPlayedLte': if (!ctx.played || ctx.played.length > v) return false; break;
      case 'cardsPlayedGte': if (!ctx.played || ctx.played.length < v) return false; break;
      case 'scoringCardsLte': if (!ctx.scoringCards || ctx.scoringCards.length > v) return false; break;
      case 'firstHand': if ((run.handsPlayedThisRound === 0) !== v) return false; break;
      case 'lastHand': if ((run.handsLeft === 0) !== v) return false; break;
      case 'handsRemaining': if (run.handsLeft !== v) return false; break;
      case 'handsRemainingGte': if (run.handsLeft < v) return false; break;
      case 'discardsRemaining': if (run.discardsLeft !== v) return false; break;
      case 'discardsRemainingGte': if (run.discardsLeft < v) return false; break;
      case 'firstDiscard': if ((run.discardsUsedThisRound === 0) !== v) return false; break;
      case 'deckCountLte': if (run.drawPile.length > v) return false; break;
      case 'deckCountGte': if (run.drawPile.length < v) return false; break;
      case 'handCountLte': if ((ctx.held || run.hand).length > v) return false; break;
      case 'jokerCountLte': if (run.jokers.length > v) return false; break;
      case 'jokerCountGte': if (run.jokers.length < v) return false; break;
      case 'emptyJokerSlot': if ((run.jokers.length < run.jokerSlots) !== v) return false; break;
      case 'money': if (v.gte != null && run.money < v.gte) return false; if (v.lte != null && run.money > v.lte) return false; break;
      case 'moneyLte': if (run.money > v) return false; break;
      case 'moneyGte': if (run.money < v) return false; break;
      case 'chance': if (!run.chance(v.num, v.den)) return false; break;
      case 'blindType': if (run.blind?.type !== v) return false; break;
      case 'isBoss': if ((run.blind?.type === 'boss') !== v) return false; break;
      case 'position':
        if (v === 'leftmost' && jokerIndex !== 0) return false;
        if (v === 'rightmost' && jokerIndex !== run.jokers.length - 1) return false;
        break;
      case 'counterGte': if (!joker || joker.counter < v) return false; break;
      case 'counterLte': if (!joker || joker.counter > v) return false; break;
      case 'consumableCountGte': if (run.consumables.length < v) return false; break;
      case 'noConsumables': if ((run.consumables.length === 0) !== v) return false; break;
      case 'discardedCount': if (extra.count !== v) return false; break;
      case 'discardedCountLte': if (extra.count == null || extra.count > v) return false; break;
      case 'debuffed': if (!card || !!card.debuffed !== v) return false; break;
      case 'faceDown': if (!card || !!card.faceDown !== v) return false; break;
      case 'levelGte': if ((run.handLevels[ctx.handType] || 1) < v) return false; break;
      default:
        console.warn('unknown when key', key);
    }
  }
  return true;
}

/* -------------------------------------------------------------- actions */

function fmt(v) { return Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString(); }

/** Apply a `do` block. Returns true if anything happened. */
export function applyDo(d, ctx, extra, joker, effect) {
  if (!d) return false;
  const run = ctx.run;
  const src = { joker, card: extra.card };
  let did = false;
  const val = (v) => (v === 'counter' && joker ? joker.counter : v);

  if (d.chips) { ctx.addChips(val(d.chips), src); did = true; }
  if (d.mult) { ctx.addMult(val(d.mult), src); did = true; }
  if (d.xmult && val(d.xmult) !== 1) { ctx.mulMult(val(d.xmult), src); did = true; }
  if (d.chipsPer) { const v = getStat(d.chipsPer.stat, ctx, joker) * d.chipsPer.x; if (v) { ctx.addChips(v, src); did = true; } }
  if (d.multPer) { const v = getStat(d.multPer.stat, ctx, joker) * d.multPer.x; if (v) { ctx.addMult(v, src); did = true; } }
  if (d.xmultPer) {
    const s = getStat(d.xmultPer.stat, ctx, joker);
    const v = (d.xmultPer.base ?? 1) + s * d.xmultPer.x;
    if (v !== 1 && s !== 0) { ctx.mulMult(v, src); did = true; }
  }
  if (d.money) { ctx.addMoney(val(d.money), src); did = true; }
  if (d.destroySelf) { ctx.queueDestroyJoker(joker, 'self'); did = true; }
  if (d.destroyCard && extra.card) { ctx.queueDestroyCard(extra.card, joker); did = true; }
  if (d.createConsumable) { ctx.queueCreate({ kind: 'consumable', family: d.createConsumable, source: joker }); did = true; }
  if (d.createJoker) { ctx.queueCreate({ kind: 'joker', rarity: d.createJoker, source: joker }); did = true; }
  if (d.levelHand) {
    const type = d.levelHand === 'played' ? ctx.handType : d.levelHand;
    if (type) { ctx.levelHand(type, d.levelAmount || 1, joker); did = true; }
  }
  if (d.addHands) { run.handsLeft += d.addHands; ctx.log.push({ kind: 'hands', delta: d.addHands, joker }); did = true; }
  if (d.addDiscards) { run.discardsLeft += d.addDiscards; ctx.log.push({ kind: 'discards', delta: d.addDiscards, joker }); did = true; }
  if (d.copyCardToDeck && extra.card) { ctx.queueCreate({ kind: 'cardCopy', card: extra.card, source: joker }); did = true; }
  if (d.addHandSize) { run.handSize += d.addHandSize; did = true; }
  if (d.setCounter != null && joker) { joker.counter = d.setCounter; did = true; }
  if (d.counterAdd != null && joker) { joker.counter += d.counterAdd; did = true; }
  if (d.sellBonus && joker) { joker.state.sellBonus = (joker.state.sellBonus || 0) + d.sellBonus; ctx.log.push({ kind: 'sellBonus', joker, delta: d.sellBonus }); did = true; }
  if (d.sellBonusAll) { for (const j of run.jokers) j.state.sellBonus = (j.state.sellBonus || 0) + d.sellBonusAll; did = true; }
  return did;
}

/* ----------------------------------------------------------- triggers */

/**
 * Fire `trigger` on every active joker, left to right. `extra` may carry the card
 * being scored/held/discarded. Jokers with a `scale` on a matching effect grow.
 */
export function fireTrigger(ctx, trigger, extra = {}) {
  const run = ctx.run;
  const jokers = run.jokers.slice(); // effects may add/remove jokers
  for (let i = 0; i < jokers.length; i++) {
    const j = jokers[i];
    if (j.disabled) continue;
    fireJoker(ctx, j, i, trigger, extra);
  }
}

export function fireJoker(ctx, j, index, trigger, extra = {}) {
  for (const eff of j.def.effects) {
    if (eff.trigger === 'custom') {
      const impl = CUSTOM_JOKERS[eff.customId];
      if (impl && impl[trigger]) {
        const r = impl[trigger](ctx, j, extra, eff);
        if (r) j.state.triggers++;
      }
      continue;
    }
    if (eff.trigger !== trigger) continue;
    if (eff.do && eff.do.retrigger && Object.keys(eff.do).length === 1) continue; // pure retriggers are counted separately
    if (!checkWhen(eff.when, ctx, extra, j, index)) continue;
    j.state.triggers++;
    let did = false;
    // a scaling effect on the joker's own turn applies its current value first, then grows
    if (eff.scale && trigger === 'independent') did = applyCounter(ctx, j, eff, extra) || did;
    if (eff.do) did = applyDo(eff.do, ctx, extra, j, eff) || did;
    if (eff.scale) {
      const before = j.counter;
      j.counter = round4(j.counter + (eff.scale.step ?? 1));
      if (eff.scale.max != null) j.counter = Math.min(j.counter, eff.scale.max);
      if (j.counter !== before) ctx.log.push({ kind: 'grow', joker: j, stat: eff.scale.stat, value: j.counter, after: ctx.snapshot() });
      did = true;
    }
    if (!did && !eff.do && !eff.scale) ctx.log.push({ kind: 'joker_noop', joker: j });
  }
}

/** Apply a joker's accumulated counter to its stat (chips/mult/xmult). */
function applyCounter(ctx, j, eff, extra) {
  const stat = eff.scale.stat;
  const v = j.counter;
  const src = { joker: j, card: extra.card };
  if (stat === 'chips' && v) { ctx.addChips(v, src); return true; }
  if (stat === 'mult' && v) { ctx.addMult(v, src); return true; }
  if (stat === 'xmult' && v !== 1) { ctx.mulMult(v, src); return true; }
  return false;
}

/**
 * The joker's own turn in the scoring sequence (step d): Gleam/Prism edition,
 * independent effects, the counter of any scaling effect not on `independent`,
 * then Aurora edition.
 */
export function fireIndependent(ctx, j, index) {
  if (j.disabled) return;
  const ed = j.edition ? EDITION[j.edition] : null;
  const src = { joker: j, edition: j.edition };
  if (ed && ed.chips) ctx.addChips(ed.chips, src);
  if (ed && ed.mult) ctx.addMult(ed.mult, src);
  fireJoker(ctx, j, index, 'independent');
  for (const eff of j.def.effects) {
    if (!eff.scale || eff.trigger === 'independent') continue;
    if (eff.scale.stat === 'money') continue;
    applyCounter(ctx, j, eff, {});
  }
  if (ed && ed.xmult) ctx.mulMult(ed.xmult, src);
}

/** Count how many extra times a card should trigger for `trigger`. Logs retrigger sources. */
export function countRetriggers(ctx, trigger, extra) {
  const run = ctx.run;
  let n = 0;
  run.jokers.forEach((j, i) => {
    if (j.disabled) return;
    for (const eff of j.def.effects) {
      if (eff.trigger === 'custom') {
        const impl = CUSTOM_JOKERS[eff.customId];
        if (impl && impl.retrigger) {
          const r = impl.retrigger(ctx, j, { ...extra, trigger });
          if (r) { n += r; j.state.triggers++; ctx.log.push({ kind: 'retrigger_src', joker: j, card: extra.card, times: r }); }
        }
        continue;
      }
      if (eff.trigger !== trigger || !eff.do || !eff.do.retrigger) continue;
      if (!checkWhen(eff.when, ctx, extra, j, i)) continue;
      n += eff.do.retrigger;
      j.state.triggers++;
      ctx.log.push({ kind: 'retrigger_src', joker: j, card: extra.card, times: eff.do.retrigger });
    }
  });
  return n;
}

/** Reset / decay counters at lifecycle points ('hand_played' | 'blind_end' | 'round_end'). */
export function tickScalers(run, event) {
  for (const j of run.jokers) {
    for (const eff of j.def.effects) {
      if (!eff.scale) continue;
      if (eff.scale.resetOn === event) j.counter = eff.scale.start ?? 0;
      if (eff.scale.decay && eff.scale.decay.on === event) {
        const start = eff.scale.start ?? 0;
        j.counter = round4(start + (j.counter - start) * (1 - eff.scale.decay.by));
      }
    }
  }
}

/** Sum of numeric passive modifiers across jokers, e.g. passiveTotal(run, 'handSize'). */
export function passiveTotal(run, key) {
  let t = 0;
  for (const j of run.jokers) {
    if (j.disabled) continue;
    for (const eff of j.def.effects) if (eff.passive && typeof eff.passive[key] === 'number') t += eff.passive[key];
  }
  return t;
}

export function passiveFlag(run, key) {
  for (const j of run.jokers) {
    if (j.disabled) continue;
    for (const eff of j.def.effects) if (eff.passive && eff.passive[key] === true) return true;
  }
  return false;
}

/* ---------------------------------------------------------- description */

/** Resolve {tokens} in a joker's description with live values. */
export function describeJoker(j, ctx = null) {
  const def = j.def;
  return def.description.replace(/\{(\w+)\}/g, (m, name) => {
    if (name === 'counter') return fmt(j.counter);
    for (const eff of def.effects) {
      if (eff.scale && eff.scale.stat === name) return fmt(j.counter);
    }
    for (const eff of def.effects) {
      if (eff.do && eff.do[name] != null) return fmt(eff.do[name] === 'counter' ? j.counter : eff.do[name]);
      const per = eff.do && eff.do[name + 'Per'];
      if (per && ctx) {
        const s = getStat(per.stat, ctx, j);
        return fmt(name === 'xmult' ? (per.base ?? 1) + s * per.x : s * per.x);
      }
      if (eff.passive && eff.passive[name] != null) return fmt(eff.passive[name]);
    }
    const impl = def.effects.find(e => e.trigger === 'custom');
    if (impl && CUSTOM_JOKERS[impl.customId]?.token) {
      const t = CUSTOM_JOKERS[impl.customId].token(name, j, ctx);
      if (t != null) return fmt(t);
    }
    return m;
  });
}

function round4(v) { return Math.round(v * 10000) / 10000; }
