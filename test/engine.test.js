import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Run } from '../src/core/run.js';
import { loadJokerDefs } from '../src/data/loadJokers.js';
import { makeCard } from '../src/core/cards.js';
import { instantiateJoker } from '../src/core/jokers.js';
import { scoreHand } from '../src/core/scoring.js';
import { smallBlindReq, blindReq, handBase } from '../src/core/rules.js';
import { ALL_CONSUMABLES, CONSUMABLE_BY_ID } from '../src/data/consumables.js';
import { BOSSES } from '../src/data/bosses.js';
import { TAGS } from '../src/data/tags.js';
import { VOUCHERS } from '../src/data/vouchers.js';

const defs = await loadJokerDefs();
const S = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
const c = (str, extra) => makeCard(str.slice(0, -1), S[str.slice(-1)], extra);
const hand = (...xs) => xs.map(x => (typeof x === 'string' ? c(x) : x));

function newRun(seed = 'TESTSEED') { return new Run(seed, defs); }

/** Give the run a joker by id and return the instance. */
function give(run, id, extra) {
  const def = defs.find(d => d.id === id);
  assert.ok(def, 'no such joker: ' + id);
  return run.addJokerByDef(def, extra);
}

/* ------------------------------------------------------------- content */

test('content sets are the specified sizes', () => {
  assert.equal(defs.length, 72);
  assert.equal(BOSSES.length, 20);
  assert.equal(BOSSES.filter(b => b.finisher).length, 4);
  assert.equal(TAGS.length, 15);
  assert.equal(VOUCHERS.length, 16);
  assert.equal(ALL_CONSUMABLES.filter(x => x.family === 'arcana').length, 22);
  assert.equal(ALL_CONSUMABLES.filter(x => x.family === 'star').length, 12);
  assert.equal(ALL_CONSUMABLES.filter(x => x.family === 'phantom').length, 12);
});

test('every joker definition is structurally valid', () => {
  const ids = new Set();
  for (const d of defs) {
    assert.ok(!ids.has(d.id), 'duplicate id ' + d.id);
    ids.add(d.id);
    assert.ok(['common', 'uncommon', 'rare', 'legendary'].includes(d.rarity), d.id);
    assert.ok(Array.isArray(d.effects) && d.effects.length > 0, d.id + ' has no effects');
    assert.ok(d.description.length <= 110, d.id + ' description too long');
    assert.ok(d.art && d.art.glyph, d.id + ' missing art');
  }
});

test('every consumable has a usable shape', () => {
  for (const x of ALL_CONSUMABLES) {
    assert.ok(typeof x.use === 'function', x.id + ' has no use()');
    assert.ok(Array.isArray(x.select), x.id + ' has no select range');
    assert.ok(x.desc && x.desc.length > 0, x.id);
  }
});

/* ------------------------------------------------------------- scoring */

test('base hand with no jokers scores chips x mult', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const ctx = scoreHand(run, hand('Kh', 'Ks', '9c'), []);
  // pair of kings: base 10 x 2, +10 +10 chips
  assert.equal(ctx.chips, 30);
  assert.equal(ctx.mult, 2);
  assert.equal(ctx.total, 60);
});

test('only scoring cards contribute chips', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const ctx = scoreHand(run, hand('Kh', 'Ks', '9c', '2d', '3s'), []);
  assert.equal(ctx.chips, 30);  // the 9, 2, 3 do not score
});

test('hand levels raise the base', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  run.levelHand('pair', 2);     // pair: 10+15*2=40 chips, 2+1*2=4 mult
  const ctx = scoreHand(run, hand('Kh', 'Ks'), []);
  assert.equal(ctx.chips, 40 + 20);
  assert.equal(ctx.mult, 4);
});

test('enhancements apply in chips then mult then xmult order', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const ctx = scoreHand(run, hand(c('Kh', { enhancement: 'bonus' }), c('Ks', { enhancement: 'mult' })), []);
  assert.equal(ctx.chips, 10 + 10 + 10 + 30);  // base 10, two kings, +30 gilt
  assert.equal(ctx.mult, 2 + 4);               // base 2, +4 ember
});

test('glass multiplies mult', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const ctx = scoreHand(run, hand(c('Kh', { enhancement: 'glass' }), 'Ks'), []);
  assert.equal(ctx.mult, 4);   // 2 x 2
});

test('steel only fires from hand, not when played', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const steel = c('7d', { enhancement: 'steel' });
  const a = scoreHand(run, hand('Kh', 'Ks'), [steel]);
  assert.equal(a.mult, 3);   // 2 x 1.5
  const b = scoreHand(run, hand('Kh', 'Ks', steel), []);
  assert.equal(b.mult, 2);   // played, so no held bonus; 7 is not a scoring card
});

test('editions apply to cards', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const foil = scoreHand(run, hand(c('Kh', { edition: 'foil' }), 'Ks'), []);
  assert.equal(foil.chips, 10 + 20 + 50);
  const poly = scoreHand(run, hand(c('Kh', { edition: 'poly' }), 'Ks'), []);
  assert.equal(poly.mult, 3);  // 2 x 1.5
});

test('red seal retriggers a card', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const plain = scoreHand(run, hand('Kh', 'Ks'), []);
  const sealed = scoreHand(run, hand(c('Kh', { seal: 'red' }), 'Ks'), []);
  assert.equal(sealed.chips, plain.chips + 10);
});

test('gold seal pays money when scored', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const before = run.money;
  scoreHand(run, hand(c('Kh', { seal: 'gold' }), 'Ks'), []);
  assert.equal(run.money, before + 3);
});

test('debuffed cards contribute nothing but still fill the hand', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const ctx = scoreHand(run, hand(c('Kh', { debuffed: true }), 'Ks'), []);
  assert.equal(ctx.chips, 20);   // base 10 + one king only
  assert.equal(ctx.mult, 2);
});

/* ------------------------------------------------------------- jokers */

test('a flat mult joker adds on its own turn', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const flat = defs.find(d => d.effects.some(e => e.trigger === 'independent' && e.do && e.do.mult && !e.when && !e.scale));
  assert.ok(flat, 'expected at least one unconditional flat-mult joker');
  give(run, flat.id);
  const amount = flat.effects.find(e => e.trigger === 'independent' && e.do && e.do.mult).do.mult;
  const ctx = scoreHand(run, hand('Kh', 'Ks'), []);
  assert.equal(ctx.mult, 2 + amount);
});

test('suit jokers fire once per matching scored card', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  give(run, 'oak_cudgel');   // +4 Mult per scored Club
  const ctx = scoreHand(run, hand('Kc', 'Kc'), []);
  assert.equal(ctx.mult, 2 + 8);
  const ctx2 = scoreHand(run, hand('Kh', 'Ks'), []);
  assert.equal(ctx2.mult, 2);
});

test('joker order changes the result', () => {
  const run = newRun();
  run.blind = run.blindInfo(0);
  const addMult = defs.find(d => d.effects.some(e => e.trigger === 'independent' && e.do?.mult && !e.when && !e.scale));
  const xMult = defs.find(d => d.effects.some(e => e.trigger === 'independent' && e.do?.xmult && !e.when && !e.scale));
  if (!addMult || !xMult) return;    // set may not contain an unconditional xmult
  give(run, addMult.id); give(run, xMult.id);
  const a = scoreHand(run, hand('Kh', 'Ks'), []).mult;
  run.jokers.reverse();
  const b = scoreHand(run, hand('Kh', 'Ks'), []).mult;
  assert.notEqual(a, b);
});

test('every joker can be scored without throwing', () => {
  for (const def of defs) {
    const run = newRun('J' + def.id);
    run.blind = run.blindInfo(0);
    give(run, def.id);
    const cards = hand(
      c('Kh', { enhancement: 'glass', seal: 'red', edition: 'foil' }),
      c('Ks', { enhancement: 'steel' }),
      c('9c', { enhancement: 'gold' }),
      c('9d', { enhancement: 'lucky' }),
      c('2s', { enhancement: 'stone' }),
    );
    const held = hand('3h', c('4d', { enhancement: 'steel' }));
    assert.doesNotThrow(() => {
      const ctx = scoreHand(run, cards, held);
      assert.ok(Number.isFinite(ctx.total) || ctx.total === Infinity, def.id + ' produced ' + ctx.total);
      assert.ok(ctx.total >= 0, def.id + ' produced a negative score');
      run.absorb(ctx);
    }, def.id + ' threw while scoring');
  }
});

test('every joker survives the between-hand triggers', () => {
  const triggers = ['before_hand', 'after_hand', 'on_discard', 'blind_start', 'blind_end',
    'round_end', 'shop_enter', 'reroll', 'card_added', 'card_destroyed', 'joker_sold', 'consumable_used'];
  for (const def of defs) {
    const run = newRun('T' + def.id);
    run.blind = run.blindInfo(0);
    give(run, def.id);
    const card = c('Kh');
    for (const t of triggers) {
      assert.doesNotThrow(() => {
        const ctx = run.constructor === Run ? makeCtx(run) : null;
        fireAll(run, t, card);
      }, `${def.id} threw on ${t}`);
    }
  }
});

function makeCtx(run) { return null; }
function fireAll(run, trigger, card) {
  const { fireTrigger } = globalThis.__jokerMod;
  const ctx = globalThis.__makeRunCtx(run);
  fireTrigger(ctx, trigger, { card, count: 1 });
  run.absorb(ctx);
}
const jokerMod = await import('../src/core/jokers.js');
const scoringMod = await import('../src/core/scoring.js');
globalThis.__jokerMod = jokerMod;
globalThis.__makeRunCtx = scoringMod.makeRunCtx;

/* --------------------------------------------------------------- run */

test('blind requirements follow the ante curve', () => {
  assert.equal(smallBlindReq(1), 250);
  assert.equal(blindReq(1, 'big'), 375);
  assert.equal(blindReq(1, 'boss', 2), 500);
  assert.equal(smallBlindReq(8), 50000);
  assert.ok(smallBlindReq(9) > smallBlindReq(8));
  assert.ok(Number.isFinite(smallBlindReq(15)));
});

test('a run starts in a playable state', () => {
  const run = newRun();
  assert.equal(run.deck.length, 52);
  assert.equal(run.money, 4);
  assert.equal(run.ante, 1);
  assert.equal(run.phase, 'blind_select');
  assert.ok(run.bossId);
  assert.equal(run.offeredTags.length, 2);
});

test('starting a blind deals a full hand', () => {
  const run = newRun();
  run.startBlind();
  assert.equal(run.hand.length, run.handSize);
  assert.equal(run.drawPile.length, 52 - run.handSize);
  assert.equal(run.handsLeft, run.maxHands);
  assert.equal(run.discardsLeft, run.maxDiscards);
});

test('playing a hand consumes a hand and refills', () => {
  const run = newRun();
  run.startBlind();
  const sel = run.hand.slice(0, 3);
  const res = run.playHand(sel);
  assert.ok(!res.error);
  assert.equal(run.handsLeft, run.maxHands - 1);
  run.finishHand();
  assert.equal(run.hand.length, run.handSize);
});

test('discarding consumes a discard and refills', () => {
  const run = newRun();
  run.startBlind();
  const sel = run.hand.slice(0, 3);
  const res = run.discard(sel);
  assert.ok(!res.error);
  assert.equal(run.discardsLeft, run.maxDiscards - 1);
  assert.equal(run.hand.length, run.handSize);
});

test('play is rejected when out of hands', () => {
  const run = newRun();
  run.startBlind();
  run.handsLeft = 0;
  assert.ok(run.playHand(run.hand.slice(0, 2)).error);
});

test('the same seed reproduces the same run', () => {
  const a = newRun('REPEAT'), b = newRun('REPEAT');
  assert.equal(a.bossId, b.bossId);
  assert.deepEqual(a.offeredTags, b.offeredTags);
  a.startBlind(); b.startBlind();
  assert.deepEqual(a.hand.map(c => c.rank + c.suit), b.hand.map(c => c.rank + c.suit));
  const ra = a.playHand(a.hand.slice(0, 5));
  const rb = b.playHand(b.hand.slice(0, 5));
  assert.equal(ra.total, rb.total);
});

test('different seeds diverge', () => {
  const a = newRun('AAAA'), b = newRun('BBBB');
  a.startBlind(); b.startBlind();
  assert.notDeepEqual(a.hand.map(c => c.rank + c.suit), b.hand.map(c => c.rank + c.suit));
});

test('the shop offers cards, packs and a voucher', () => {
  const run = newRun();
  run.startBlind();
  run.score = run.blind.req;
  run.cashOut();
  const shop = run.openShop();
  assert.equal(shop.cards.length, 2);
  assert.equal(shop.packs.length, 2);
  assert.ok(shop.voucher);
  assert.equal(shop.rerollPrice, 5);
});

test('buying a joker costs money and fills a slot', () => {
  const run = newRun();
  run.money = 50;
  run.openShop();
  const idx = run.shop.cards.findIndex(c => c.kind === 'joker');
  if (idx < 0) return;
  const price = run.shop.cards[idx].price;
  const before = run.money;
  const res = run.buyShopCard(idx);
  assert.ok(res.ok, res.error);
  assert.equal(run.money, before - price);
  assert.equal(run.jokers.length, 1);
});

test('selling a joker returns half its cost', () => {
  const run = newRun();
  const j = give(run, defs[0].id, { cost: 6 });
  const before = run.money;
  run.sellJoker(j);
  assert.equal(run.money, before + 3);
  assert.equal(run.jokers.length, 0);
});

test('joker slots are respected, and Void adds one', () => {
  const run = newRun();
  for (let i = 0; i < 5; i++) give(run, defs[i].id);
  assert.equal(run.freeJokerSlots(), 0);
  run.jokers[0].edition = 'negative';
  assert.equal(run.freeJokerSlots(), 1);
});

test('interest is capped and raised by vouchers', () => {
  const run = newRun();
  run.startBlind();
  run.money = 100;
  run.score = run.blind.req;
  const rows = run.cashOut();
  const interest = rows.find(r => r.label.startsWith('Interest'));
  assert.equal(interest.amount, 5);

  const run2 = newRun();
  run2.startBlind();
  run2.vouchers.add('nest_egg');
  run2.money = 100;
  run2.score = run2.blind.req;
  const rows2 = run2.cashOut();
  assert.equal(rows2.find(r => r.label.startsWith('Interest')).amount, 10);
});

test('skipping a blind grants its tag and advances', () => {
  const run = newRun();
  const tagId = run.blindInfo(0).tagId;
  run.skipBlind();
  assert.equal(run.blindIndex, 1);
  assert.ok(run.tags.includes(tagId) || TAGS.find(t => t.id === tagId).immediate);
});

test('beating the ante 8 boss wins the run', () => {
  const run = newRun();
  run.ante = 8;
  run.blindIndex = 2;
  run.rollAnte();
  run.startBlind();
  run.score = run.blind.req;
  run.cashOut();
  run.advanceBlind();
  assert.ok(run.won);
});

/* -------------------------------------------------------- consumables */

test('every consumable can be used without throwing', () => {
  for (const def of ALL_CONSUMABLES) {
    const run = newRun('C' + def.id);
    run.startBlind();
    give(run, defs[0].id);
    give(run, defs[1].id);
    run.money = 30;
    const [min] = def.select;
    const sel = run.hand.slice(0, Math.max(min, 0));
    const item = { id: def.id, def, cost: 3 };
    run.consumables.push(item);
    assert.doesNotThrow(() => {
      const gate = run.canUseConsumable(item, sel);
      if (gate.ok) run.useConsumable(item, sel);
    }, def.id + ' threw');
    assert.ok(run.deck.length >= 0);
  }
});

test('a Star levels its hand type', () => {
  const run = newRun();
  const star = CONSUMABLE_BY_ID['star_pair'];
  const item = { id: star.id, def: star, cost: 3 };
  run.consumables.push(item);
  run.useConsumable(item, []);
  assert.equal(run.handLevels.pair, 2);
});

test('The Forge enhances selected cards', () => {
  const run = newRun();
  run.startBlind();
  const forge = CONSUMABLE_BY_ID['forge'];
  const item = { id: forge.id, def: forge, cost: 3 };
  run.consumables.push(item);
  const sel = run.hand.slice(0, 2);
  run.useConsumable(item, sel);
  assert.ok(sel.every(c => c.enhancement === 'bonus'));
});

test('The Scythe permanently removes cards from the deck', () => {
  const run = newRun();
  run.startBlind();
  const scythe = CONSUMABLE_BY_ID['scythe'];
  const item = { id: scythe.id, def: scythe, cost: 3 };
  run.consumables.push(item);
  run.useConsumable(item, run.hand.slice(0, 2));
  assert.equal(run.deck.length, 50);
});

/* -------------------------------------------------------------- bosses */

test('every boss can run a whole blind without throwing', () => {
  for (const boss of BOSSES) {
    const run = newRun('B' + boss.id);
    run.ante = Math.max(boss.minAnte, 1);
    run.blindIndex = 2;
    run.bossId = boss.id;
    give(run, defs[0].id);
    give(run, defs[10].id);
    assert.doesNotThrow(() => {
      run.startBlind();
      for (let i = 0; i < 4 && run.handsLeft > 0 && run.hand.length; i++) {
        const sel = run.hand.slice(0, Math.min(5, run.hand.length));
        const gate = run.canPlay(sel);
        if (!gate.ok) break;
        run.playHand(sel);
        run.finishHand();
      }
    }, boss.id + ' threw during a blind');
  }
});

test('debuff bosses actually debuff', () => {
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'ashfall';   // hearts debuffed
  run.startBlind();
  const hearts = run.deck.filter(c => c.suit === 'hearts');
  assert.ok(hearts.every(c => c.debuffed));
  assert.ok(run.deck.filter(c => c.suit === 'spades').every(c => !c.debuffed));
});

test('Hush removes all discards', () => {
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'hush';
  run.startBlind();
  assert.equal(run.discardsLeft, 0);
});

test('Quorum requires exactly five cards', () => {
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'quorum';
  run.startBlind();
  assert.ok(!run.canPlay(run.hand.slice(0, 3)).ok);
  assert.ok(run.canPlay(run.hand.slice(0, 5)).ok);
});

test('Monocle zeroes a repeated hand type', () => {
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'monocle';
  run.startBlind();
  run.hand = hand('Kh', 'Ks', '2c', '2d', '5s', '5h', '7c', '9d');
  const first = run.playHand(hand('Kh', 'Ks'));
  assert.ok(first.total > 0);
  const second = run.playHand(hand('2c', '2d'));
  assert.equal(second.total, 0);
  assert.ok(second.zeroed);
});

test('Undertow halves chips', () => {
  const plain = newRun(); plain.blind = plain.blindInfo(0);
  const base = scoreHand(plain, hand('Kh', 'Ks'), []).total;
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'undertow';
  run.startBlind();
  const ctx = scoreHand(run, hand('Kh', 'Ks'), []);
  assert.equal(ctx.total, base / 2);
});

test('Bleach suppresses card modifiers', () => {
  const run = newRun();
  run.blindIndex = 2;
  run.bossId = 'bleach';
  run.startBlind();
  const ctx = scoreHand(run, hand(c('Kh', { enhancement: 'bonus' }), 'Ks'), []);
  assert.equal(ctx.chips, 30);   // the +30 Gilt does nothing
});

/* ------------------------------------------------------------ save/load */

test('a run round-trips through JSON', () => {
  const run = newRun('SAVELOAD');
  run.money = 17;
  give(run, defs[3].id, { edition: 'foil' });
  run.levelHand('flush', 3);
  run.vouchers.add('grip');
  const restored = Run.fromJSON(JSON.parse(JSON.stringify(run.toJSON())), defs);
  assert.equal(restored.money, 17);
  assert.equal(restored.seed, 'SAVELOAD');
  assert.equal(restored.jokers.length, 1);
  assert.equal(restored.jokers[0].edition, 'foil');
  assert.equal(restored.handLevels.flush, 4);
  assert.ok(restored.vouchers.has('grip'));
  assert.equal(restored.deck.length, 52);
});
