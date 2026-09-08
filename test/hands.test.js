import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand } from '../src/core/hands.js';
import { makeCard } from '../src/core/cards.js';

const S = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
const c = (str, extra) => makeCard(str.slice(0, -1), S[str.slice(-1)], extra);
const hand = (...xs) => xs.map(x => (typeof x === 'string' ? c(x) : x));
const tags = cards => cards.map(x => x.rank + x.suit[0]).sort();

test('high card scores only the highest card', () => {
  const r = evaluateHand(hand('2h', '9s', 'Kd', '4c', '7h'));
  assert.equal(r.type, 'high_card');
  assert.deepEqual(tags(r.scoringCards), ['Kd']);
});

test('pair scores exactly the paired cards', () => {
  const r = evaluateHand(hand('2h', '9s', '9d', '4c', '7h'));
  assert.equal(r.type, 'pair');
  assert.deepEqual(tags(r.scoringCards), ['9d', '9s']);
  assert.ok(r.contains.has('pair'));
  assert.ok(!r.contains.has('two_pair'));
});

test('two pair', () => {
  const r = evaluateHand(hand('2h', '9s', '9d', '2c', '7h'));
  assert.equal(r.type, 'two_pair');
  assert.deepEqual(tags(r.scoringCards), ['2c', '2h', '9d', '9s']);
});

test('three of a kind', () => {
  const r = evaluateHand(hand('5h', '5s', '5d', '2c', '7h'));
  assert.equal(r.type, 'three_kind');
  assert.equal(r.scoringCards.length, 3);
  assert.ok(r.contains.has('pair'));
});

test('straight, ace high', () => {
  const r = evaluateHand(hand('10h', 'Js', 'Qd', 'Kc', 'Ah'));
  assert.equal(r.type, 'straight');
  assert.equal(r.scoringCards.length, 5);
});

test('straight, ace low (wheel)', () => {
  const r = evaluateHand(hand('Ah', '2s', '3d', '4c', '5h'));
  assert.equal(r.type, 'straight');
  assert.equal(r.scoringCards.length, 5);
});

test('no wraparound straight', () => {
  const r = evaluateHand(hand('Qh', 'Ks', 'Ad', '2c', '3h'));
  assert.equal(r.type, 'high_card');
});

test('flush', () => {
  const r = evaluateHand(hand('2h', '9h', 'Kh', '4h', '7h'));
  assert.equal(r.type, 'flush');
  assert.equal(r.scoringCards.length, 5);
});

test('full house contains two pair and three of a kind', () => {
  const r = evaluateHand(hand('9h', '9s', '9d', '4c', '4h'));
  assert.equal(r.type, 'full_house');
  assert.equal(r.scoringCards.length, 5);
  assert.ok(r.contains.has('two_pair'));
  assert.ok(r.contains.has('three_kind'));
});

test('four of a kind contains two pair', () => {
  const r = evaluateHand(hand('9h', '9s', '9d', '9c', '4h'));
  assert.equal(r.type, 'four_kind');
  assert.equal(r.scoringCards.length, 4);
  assert.ok(r.contains.has('two_pair'));
});

test('straight flush', () => {
  const r = evaluateHand(hand('5h', '6h', '7h', '8h', '9h'));
  assert.equal(r.type, 'straight_flush');
  assert.ok(r.contains.has('straight'));
  assert.ok(r.contains.has('flush'));
});

test('five of a kind and flush five', () => {
  assert.equal(evaluateHand(hand('9h', '9s', '9d', '9c', '9h')).type, 'five_kind');
  assert.equal(evaluateHand(hand('9h', '9h', '9h', '9h', '9h')).type, 'flush_five');
});

test('flush house', () => {
  assert.equal(evaluateHand(hand('9h', '9h', '9h', '4h', '4h')).type, 'flush_house');
});

test('wild cards complete a flush', () => {
  const r = evaluateHand(hand('2h', '9h', c('Ks', { enhancement: 'wild' }), '4h', '7h'));
  assert.equal(r.type, 'flush');
});

test('stone cards always score and never form ranks', () => {
  const stone = c('Ks', { enhancement: 'stone' });
  const r = evaluateHand(hand('9h', '9s', stone, '4c', '7h'));
  assert.equal(r.type, 'pair');
  assert.equal(r.scoringCards.length, 3);
  assert.ok(r.scoringCards.includes(stone));
  const r2 = evaluateHand(hand('Kh', stone, c('Kd', { enhancement: 'stone' })));
  assert.equal(r2.type, 'high_card');
  assert.equal(r2.scoringCards.length, 3);
});

test('stone cards do not count toward flushes', () => {
  const stone = c('2s', { enhancement: 'stone' });
  assert.equal(evaluateHand(hand('2h', '9h', 'Kh', '4h', stone)).type, 'high_card');
  const r2 = evaluateHand(hand('2h', '9h', 'Kh', '4h', stone), { fourCardFlushes: true });
  assert.equal(r2.type, 'flush');
  assert.equal(r2.scoringCards.length, 5);
});

test('four card straights option', () => {
  assert.equal(evaluateHand(hand('5h', '6s', '7d', '8c'), { fourCardStraights: true }).type, 'straight');
  const r2 = evaluateHand(hand('5h', '6s', '7d', '8c', 'Kd'), { fourCardStraights: true });
  assert.equal(r2.type, 'straight');
  assert.equal(r2.scoringCards.length, 4);
  assert.equal(evaluateHand(hand('5h', '6s', '7d', '8c')).type, 'high_card');
});

test('straight gap option', () => {
  assert.equal(evaluateHand(hand('2h', '4s', '6d', '8c', '10h'), { straightGap: true }).type, 'straight');
  assert.equal(evaluateHand(hand('2h', '4s', '6d', '8c', '10h')).type, 'high_card');
});

test('smeared suits', () => {
  assert.equal(evaluateHand(hand('2h', '9d', 'Kh', '4d', '7h'), { smearedSuits: true }).type, 'flush');
  assert.equal(evaluateHand(hand('2h', '9d', 'Kh', '4d', '7h')).type, 'high_card');
});

test('scoring cards preserve play order', () => {
  const r = evaluateHand(hand('9s', '2h', '9d', '2c', '7h'));
  assert.deepEqual(r.scoringCards.map(x => x.rank + x.suit[0]), ['9s', '2h', '9d', '2c']);
});

test('single card is high card', () => {
  const r = evaluateHand(hand('Ah'));
  assert.equal(r.type, 'high_card');
  assert.equal(r.scoringCards.length, 1);
});

test('debuffed wild does not act wild', () => {
  const r = evaluateHand(hand('2h', '9h', c('Ks', { enhancement: 'wild', debuffed: true }), '4h', '7h'));
  assert.equal(r.type, 'high_card');
});
