// Headless balance simulator. Plays complete runs with a simple greedy bot and
// reports how far it gets, so the ante curve can be checked without playing.
//
//   node tools/sim.js [runs] [--verbose] [--seed=ABC]

import { Run } from '../src/core/run.js';
import { loadJokerDefs } from '../src/data/loadJokers.js';
import { evaluateHand, HAND_NAMES, HAND_TYPES } from '../src/core/hands.js';
import { previewHand, scoreHand } from '../src/core/scoring.js';
import { fmtScore } from '../src/ui/fmt.js';

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) || 200);
const VERBOSE = args.includes('--verbose');
const SEED_ARG = (args.find(a => a.startsWith('--seed=')) || '').slice(7);

const defs = await loadJokerDefs();

/**
 * Score a candidate hand for real, then put the run back as it was. Jokers,
 * enhancements and boss debuffs all matter, and approximating them badly is
 * what made an earlier version of this bot play single debuffed cards.
 */
function estimate(run, sel) {
  const snap = {
    money: run.money,
    levels: { ...run.handLevels },
    hands: run.handsLeft,
    discards: run.discardsLeft,
    handSize: run.baseHandSize,
    counters: run.jokers.map(j => j.counter),
    triggers: run.jokers.map(j => j.state.triggers),
    streams: run.streams,
  };
  // evaluation must not consume the run's real randomness
  run.streams = new Map();
  let total = 0;
  try {
    const held = run.hand.filter(c => !sel.includes(c));
    total = scoreHand(run, sel, held).total;
  } catch { total = 0; }
  run.streams = snap.streams;
  run.money = snap.money;
  run.handLevels = snap.levels;
  run.handsLeft = snap.hands;
  run.discardsLeft = snap.discards;
  run.baseHandSize = snap.handSize;
  run.jokers.forEach((j, i) => {
    if (snap.counters[i] !== undefined) j.counter = snap.counters[i];
    if (snap.triggers[i] !== undefined) j.state.triggers = snap.triggers[i];
  });
  return Number.isFinite(total) ? total : Number.MAX_VALUE;
}

/** Every 1..5 card subset of the hand, best-scoring first. */
function bestPlay(run) {
  const hand = run.hand;
  let best = null;
  const n = hand.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let count = 0;
    for (let b = mask; b; b &= b - 1) count++;
    if (count > 5) continue;
    const sel = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sel.push(hand[i]);
    if (!run.canPlay(sel).ok) continue;
    const est = estimate(run, sel);
    if (!best || est > best.est) {
      const p = previewHand(run, sel);
      best = { sel, est, type: p ? p.type : 'high_card' };
    }
  }
  return best;
}

const RANK_CHIPS = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10, A: 11 };

/** Discard the cards least likely to help: keep pairs, suits and high cards. */
function worstCards(run, k) {
  const counts = {}, suits = {};
  for (const c of run.hand) {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
    suits[c.suit] = (suits[c.suit] || 0) + 1;
  }
  return run.hand
    .map(c => ({ c, score: (counts[c.rank] - 1) * 10 + suits[c.suit] * 2 + (RANK_CHIPS[c.rank] || 0) / 20 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, k)
    .map(x => x.c);
}

function shop(run) {
  // jokers first (they are the whole build), then packs, then vouchers
  for (let i = 0; i < run.shop.cards.length; i++) {
    const slot = run.shop.cards[i];
    if (!slot || slot.kind === 'empty') continue;
    if (slot.kind === 'joker' && run.freeJokerSlots() > 0 && run.money - slot.price >= 0) {
      run.buyShopCard(i);
    } else if (slot.kind === 'consumable' && run.freeConsumableSlots() > 0 && run.money - slot.price >= 0) {
      run.buyShopCard(i);
    }
  }

  // packs: take whatever they offer, preferring Stars (levels are permanent)
  for (let i = 0; i < run.shop.packs.length; i++) {
    const p = run.shop.packs[i];
    if (!p || p.bought) continue;
    const want = p.type === 'star' || p.type === 'joker' || p.type === 'arcana' || p.type === 'deck';
    if (!want || run.money - p.price < 2) continue;
    const res = run.buyPack(i);
    if (res.error) continue;
    takeFromPack(run);
  }

  if (run.shop.voucher && !run.shop.voucherBought && run.money >= run.price(10) + 5) run.buyVoucher();
  useConsumables(run);
  run.leaveShop();
}

/** Take what fits, preferring Stars for the hand we actually play. */
function takeFromPack(run) {
  const pack = run.pack;
  if (!pack) return;
  let guard = 0;
  while (pack.picksLeft > 0 && guard++ < 10) {
    let picked = false;
    const order = pack.items
      .map((it, i) => ({ it, i }))
      .filter(x => !pack.taken.has(x.i))
      .sort((a, b) => rankPackItem(run, b.it) - rankPackItem(run, a.it));
    for (const { i } of order) {
      if (!run.takePackItem(i).error) { picked = true; break; }
    }
    if (!picked) break;
  }
  run.closePack();
  useConsumables(run);
}

function rankPackItem(run, item) {
  if (item.kind === 'joker') return run.freeJokerSlots() > 0 ? 100 : -1;
  if (item.kind === 'card') return 20;
  const d = item.item;
  if (d.family === 'star') return 90 + (run.handPlays[d.handType] || 0) * 5;
  if (d.family === 'phantom') return 10;
  return 30;
}

/** Use every consumable that needs no target (levels, money, jokers). */
function useConsumables(run) {
  for (const c of run.consumables.slice()) {
    const [min] = c.def.select || [0, 0];
    if (min !== 0) continue;
    if (run.canUseConsumable(c, []).ok) run.useConsumable(c, []);
  }
}

function playRun(seed) {
  const run = new Run(seed, defs);
  const log = [];
  let guard = 0;
  while (!run.won && !run.dead && guard++ < 400) {
    if (run.phase === 'blind_select') { run.startBlind(); continue; }
    if (run.phase !== 'playing') break;

    while (run.handsLeft > 0 && run.score < run.blind.req) {
      const best = bestPlay(run);
      // discard weak hands early if we can afford to
      if (best && run.discardsLeft > 0 && run.handsLeft > 1 && best.est * 1.6 < (run.blind.req - run.score) / run.handsLeft) {
        const junk = worstCards(run, Math.min(5, Math.max(1, Math.floor(run.hand.length / 2))));
        if (junk.length) { run.discard(junk); continue; }
      }
      if (!best) break;
      const res = run.playHand(best.sel);
      if (res.error) break;
      run.finishHand();
      if (res.cleared || res.dead) break;
    }

    if (run.score >= run.blind.req) {
      log.push({ ante: run.ante, blind: run.blind.type, score: run.score, req: run.blind.req });
      run.cashOut();
      const wasBoss = run.blind.type === 'boss';
      run.blind = null;
      if (wasBoss && run.ante >= 8 && !run.endless) { run.won = true; break; }
      run.advanceBlind();
      if (run.phase === 'blind_select') { run.openShop(); shop(run); }
    } else {
      run.dead = true;
    }
  }
  return { run, log };
}

/* ------------------------------------------------------------------ main */

if (SEED_ARG) {
  const { run, log } = playRun(SEED_ARG);
  console.log(`seed ${SEED_ARG}: ${run.won ? 'WON' : 'died'} at ante ${run.ante} (${run.blindIndex})`);
  for (const e of log) console.log(`  ante ${e.ante} ${e.blind.padEnd(5)} ${fmtScore(e.score).padStart(12)} / ${fmtScore(e.req)}`);
  console.log('  jokers:', run.jokers.map(j => j.def.name).join(', ') || 'none');
  console.log('  hand levels:', HAND_TYPES.filter(t => run.handLevels[t] > 1).map(t => `${HAND_NAMES[t]} ${run.handLevels[t]}`).join(', ') || 'none');
  process.exit(0);
}

const deaths = new Array(12).fill(0);
let wins = 0, errors = 0;
const bestByAnte = {};
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const seed = 'SIM' + i;
  try {
    const { run, log } = playRun(seed);
    if (run.won) wins++;
    else deaths[Math.min(11, run.ante)]++;
    for (const e of log) {
      const k = e.ante;
      if (!bestByAnte[k]) bestByAnte[k] = { n: 0, ratio: 0 };
      bestByAnte[k].n++;
      bestByAnte[k].ratio += e.score / e.req;
    }
    if (VERBOSE) console.log(`${seed}: ${run.won ? 'WON' : 'ante ' + run.ante}`);
  } catch (err) {
    errors++;
    console.error(`${seed} threw:`, err.message);
    if (errors > 5) throw err;
  }
}

console.log(`\n${N} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`errors: ${errors}` + (errors ? '  <-- FIX THESE' : '  (no crashes)'));
console.log(`bot reached ante 8: ${wins} of ${N}`);
console.log('\nThe bot plays the highest-scoring hand available and buys the first');
console.log('thing it can afford. It does not build synergies, so how far it gets is');
console.log('a floor, not a balance verdict. This tool is here to catch crashes and');
console.log('to show the shape of the score/requirement curve.');
console.log('\nwhere the bot died:');
for (let a = 1; a <= 8; a++) {
  const d = deaths[a];
  if (!d && a > 8) continue;
  const bar = '#'.repeat(Math.round(d / N * 60));
  console.log(`  ante ${a}: ${String(d).padStart(4)}  ${bar}`);
}
console.log('\naverage score / requirement when a blind is beaten:');
for (const a of Object.keys(bestByAnte).sort((x, y) => x - y)) {
  const b = bestByAnte[a];
  console.log(`  ante ${a}: ${(b.ratio / b.n).toFixed(2)}x  (${b.n} blinds)`);
}
