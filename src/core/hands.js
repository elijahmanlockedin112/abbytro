// Poker hand evaluation. Pure function of the played cards and rule options.
// Returns the detected hand type, which cards score, and the set of hand
// types the played hand "contains" (used by joker conditions).

import { RANK_ORDER, SUITS, isStone, isWild, hasSuit } from './cards.js';

export const HAND_TYPES = [
  'high_card', 'pair', 'two_pair', 'three_kind', 'straight', 'flush',
  'full_house', 'four_kind', 'straight_flush', 'five_kind', 'flush_house', 'flush_five',
];

export const HAND_NAMES = {
  high_card: 'High Card', pair: 'Pair', two_pair: 'Two Pair', three_kind: 'Three of a Kind',
  straight: 'Straight', flush: 'Flush', full_house: 'Full House', four_kind: 'Four of a Kind',
  straight_flush: 'Straight Flush', five_kind: 'Five of a Kind', flush_house: 'Flush House',
  flush_five: 'Flush Five',
};

const DEFAULT_OPTS = {
  fourCardStraights: false, // straights may be made with 4 cards
  fourCardFlushes: false,   // flushes may be made with 4 cards
  straightGap: false,       // straights may skip one rank between cards
  smearedSuits: false,      // hearts=diamonds, clubs=spades
};

/** Group cards by rank, ignoring stone cards. Sorted by size desc, then rank desc. */
function rankGroups(cards) {
  const map = new Map();
  for (const c of cards) {
    if (isStone(c)) continue;
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank).push(c);
  }
  return [...map.entries()]
    .map(([rank, cs]) => ({ rank, cards: cs, n: cs.length, order: RANK_ORDER[rank] }))
    .sort((a, b) => b.n - a.n || b.order - a.order);
}

/** Cards forming a flush, or null. Wild cards count as any suit; stone cards never. */
function findFlush(cards, opts) {
  const eligible = cards.filter(c => !isStone(c));
  const minLen = opts.fourCardFlushes ? 4 : 5;
  if (eligible.length < minLen) return null;
  for (const suit of SUITS) {
    if (eligible.every(c => hasSuit(c, suit, opts))) return eligible;
  }
  // With 4-card flushes, 4 of 5 may match while the 5th does not; that 5th card does not score.
  if (opts.fourCardFlushes && eligible.length === 5) {
    for (const suit of SUITS) {
      const m = eligible.filter(c => hasSuit(c, suit, opts));
      if (m.length >= 4) return m;
    }
  }
  return null;
}

/** Cards forming a straight (one card per rank), or null. */
function findStraight(cards, opts) {
  const eligible = cards.filter(c => !isStone(c));
  const minLen = opts.fourCardStraights ? 4 : 5;
  if (eligible.length < minLen) return null;
  const byOrder = new Map();
  for (const c of eligible) {
    const o = RANK_ORDER[c.rank];
    if (!byOrder.has(o)) byOrder.set(o, c);
    if (c.rank === 'A' && !byOrder.has(1)) byOrder.set(1, c);
  }
  const orders = [...byOrder.keys()].sort((a, b) => a - b);
  const maxGap = opts.straightGap ? 2 : 1;
  let best = null;
  let run = [orders[0]];
  const consider = () => {
    if (run.length >= minLen) {
      const unique = [...new Set(run.map(o => byOrder.get(o)))]; // an Ace may sit at 1 and 14
      if (unique.length >= minLen && (!best || unique.length > best.length)) best = unique;
    }
  };
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] - orders[i - 1] <= maxGap) run.push(orders[i]);
    else { consider(); run = [orders[i]]; }
  }
  consider();
  return best;
}

export function evaluateHand(played, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  const cards = played.slice();
  const stones = cards.filter(isStone);
  const groups = rankGroups(cards);
  const flush = findFlush(cards, opts);
  const straight = findStraight(cards, opts);
  const contains = new Set();

  const top = groups[0];
  const second = groups[1];
  const hasFive = !!top && top.n >= 5;
  const hasQuad = !!top && top.n >= 4;
  const hasTrip = !!top && top.n >= 3;
  const hasPair = !!top && top.n >= 2;
  const twoPair = hasPair && !!second && second.n >= 2;
  const fullHouse = hasTrip && !!second && second.n >= 2;

  if (hasPair) contains.add('pair');
  if (twoPair || hasQuad) contains.add('two_pair');
  if (hasTrip) contains.add('three_kind');
  if (hasQuad) contains.add('four_kind');
  if (hasFive) contains.add('five_kind');
  if (fullHouse) contains.add('full_house');
  if (straight) contains.add('straight');
  if (flush) contains.add('flush');
  if (straight && flush) contains.add('straight_flush');
  if (fullHouse && flush) contains.add('flush_house');
  if (hasFive && flush) contains.add('flush_five');
  contains.add('high_card');

  let type, scoring;
  if (hasFive && flush) { type = 'flush_five'; scoring = top.cards; }
  else if (fullHouse && flush) { type = 'flush_house'; scoring = [...top.cards, ...second.cards]; }
  else if (hasFive) { type = 'five_kind'; scoring = top.cards; }
  else if (straight && flush) { type = 'straight_flush'; scoring = union(straight, flush); }
  else if (hasQuad) { type = 'four_kind'; scoring = top.cards; }
  else if (fullHouse) { type = 'full_house'; scoring = [...top.cards, ...second.cards]; }
  else if (flush) { type = 'flush'; scoring = flush; }
  else if (straight) { type = 'straight'; scoring = straight; }
  else if (hasTrip) { type = 'three_kind'; scoring = top.cards; }
  else if (twoPair) { type = 'two_pair'; scoring = [...top.cards, ...second.cards]; }
  else if (hasPair) { type = 'pair'; scoring = top.cards; }
  else {
    type = 'high_card';
    let hi = null;
    for (const c of cards) {
      if (isStone(c)) continue;
      if (!hi || RANK_ORDER[c.rank] > RANK_ORDER[hi.rank]) hi = c;
    }
    scoring = hi ? [hi] : [];
  }

  // Stone cards always score. Keep played order for the scoring list.
  const scoringSet = new Set([...scoring, ...stones]);
  const scoringCards = cards.filter(c => scoringSet.has(c));
  return { type, scoringCards, contains, groups };
}

function union(a, b) {
  const s = new Set(a);
  for (const c of b) s.add(c);
  return [...s];
}

export function sortByRank(cards) {
  return cards.slice().sort((a, b) => {
    if (isStone(a) !== isStone(b)) return isStone(a) ? 1 : -1;
    return (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

export function sortBySuit(cards) {
  return cards.slice().sort((a, b) => {
    if (isStone(a) !== isStone(b)) return isStone(a) ? 1 : -1;
    const sa = isWild(a) ? -1 : SUITS.indexOf(a.suit);
    const sb = isWild(b) ? -1 : SUITS.indexOf(b.suit);
    return sa - sb || (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0);
  });
}
