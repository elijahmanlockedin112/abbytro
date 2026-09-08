import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';

test('same seed gives same sequence', () => {
  const a = new Rng('ABBY'), b = new Rng('ABBY');
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different seeds differ', () => {
  const a = new Rng('ABBY'), b = new Rng('ABBZ');
  let same = 0;
  for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 3);
});

test('int and range bounds', () => {
  const r = new Rng('x');
  for (let i = 0; i < 1000; i++) {
    const v = r.int(7); assert.ok(v >= 0 && v < 7 && Number.isInteger(v));
    const w = r.range(3, 5); assert.ok(w >= 3 && w <= 5);
  }
});

test('chance approximates probability', () => {
  const r = new Rng('chance');
  let hits = 0;
  for (let i = 0; i < 20000; i++) if (r.chance(1, 4)) hits++;
  assert.ok(Math.abs(hits / 20000 - 0.25) < 0.02);
});

test('weighted pick respects weights', () => {
  const r = new Rng('w');
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 10000; i++) counts[r.weighted([{ item: 'a', w: 3 }, { item: 'b', w: 1 }])]++;
  assert.ok(Math.abs(counts.a / 10000 - 0.75) < 0.03);
});

test('shuffle is a permutation', () => {
  const r = new Rng('s');
  assert.deepEqual(r.shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice().sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
});
