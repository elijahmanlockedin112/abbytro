// Card model and constants. Pure data; no rendering.

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Numeric order for straights (A is 14, and also 1 for the wheel). */
export const RANK_ORDER = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

/** Chips a card contributes when scored. */
export const RANK_CHIPS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11,
};

export const FACE_RANKS = new Set(['J', 'Q', 'K']);

export const ENHANCEMENTS = ['bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];
export const EDITIONS = ['foil', 'holo', 'poly', 'negative'];
export const SEALS = ['red', 'blue', 'purple', 'gold'];

let nextId = 1;
export function resetCardIds(n = 1) { nextId = n; }
export function allocId() { return nextId++; }

export function makeCard(rank, suit, extra = {}) {
  return {
    id: nextId++,
    rank,
    suit,
    enhancement: null,
    edition: null,
    seal: null,
    bonusChips: 0,      // permanent extra chips (from consumables)
    debuffed: false,
    faceDown: false,
    ...extra,
  };
}

export function cloneCard(card, keepId = false) {
  return { ...card, id: keepId ? card.id : nextId++ };
}

export function isFace(card) { return FACE_RANKS.has(card.rank) && !isStone(card); }
export function isStone(card) { return card.enhancement === 'stone'; }
export function isWild(card) { return card.enhancement === 'wild' && !card.debuffed; }

/** Does the card count as `suit`? Wild cards count as every suit. Stone cards have no suit. */
export function hasSuit(card, suit, opts = {}) {
  if (isStone(card)) return false;
  if (isWild(card)) return true;
  if (card.suit === suit) return true;
  if (opts.smearedSuits) {
    const red = suit === 'hearts' || suit === 'diamonds';
    const cardRed = card.suit === 'hearts' || card.suit === 'diamonds';
    return red === cardRed;
  }
  return false;
}

export function cardChips(card) {
  if (card.debuffed) return 0;
  if (isStone(card)) return 50 + card.bonusChips;
  return RANK_CHIPS[card.rank] + card.bonusChips;
}

export function standardDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(makeCard(rank, suit));
  return deck;
}

export const SUIT_GLYPH = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };

export function cardLabel(card) {
  if (isStone(card)) return 'Stone';
  return card.rank + SUIT_GLYPH[card.suit];
}
