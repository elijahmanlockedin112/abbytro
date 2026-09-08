// Tunable game rules. Single source of truth for balance (see design/RULES.md).

export const HAND_BASE = {
  high_card:      { chips: 5,   mult: 1,  dChips: 10, dMult: 1 },
  pair:           { chips: 10,  mult: 2,  dChips: 15, dMult: 1 },
  two_pair:       { chips: 20,  mult: 2,  dChips: 20, dMult: 1 },
  three_kind:     { chips: 30,  mult: 3,  dChips: 20, dMult: 2 },
  straight:       { chips: 30,  mult: 4,  dChips: 30, dMult: 3 },
  flush:          { chips: 35,  mult: 4,  dChips: 15, dMult: 2 },
  full_house:     { chips: 40,  mult: 4,  dChips: 25, dMult: 2 },
  four_kind:      { chips: 60,  mult: 7,  dChips: 30, dMult: 3 },
  straight_flush: { chips: 100, mult: 8,  dChips: 40, dMult: 4 },
  five_kind:      { chips: 120, mult: 12, dChips: 35, dMult: 3 },
  flush_house:    { chips: 140, mult: 14, dChips: 40, dMult: 4 },
  flush_five:     { chips: 160, mult: 16, dChips: 50, dMult: 3 },
};

export function handBase(type, level = 1) {
  const b = HAND_BASE[type];
  return { chips: b.chips + b.dChips * (level - 1), mult: b.mult + b.dMult * (level - 1) };
}

// Internal ids stay generic (bonus/mult/...); display names are Abbytro's.
export const ENHANCEMENT = {
  bonus: { name: 'Gilt',      chips: 30,  desc: '+30 Chips' },
  mult:  { name: 'Ember',     mult: 4,    desc: '+4 Mult' },
  wild:  { name: 'Chameleon', desc: 'Counts as every suit' },
  glass: { name: 'Crystal',   xmult: 2, shatter: { num: 1, den: 4 }, desc: '\u00d72 Mult, 1 in 4 chance to shatter' },
  steel: { name: 'Iron',      heldXmult: 1.5, desc: '\u00d71.5 Mult while held in hand' },
  stone: { name: 'Slab',      chips: 50,  desc: '+50 Chips, no rank or suit' },
  gold:  { name: 'Coin',      heldMoney: 3, desc: '$3 if held in hand at end of round' },
  lucky: { name: 'Charm',     multChance: { num: 1, den: 5, mult: 20 }, moneyChance: { num: 1, den: 15, money: 20 }, desc: '1 in 5: +20 Mult. 1 in 15: +$20' },
};

export const EDITION = {
  foil:     { name: 'Gleam',  chips: 50,  price: 2, roll: 0.043, desc: '+50 Chips' },
  holo:     { name: 'Prism',  mult: 10,   price: 3, roll: 0.023, desc: '+10 Mult' },
  poly:     { name: 'Aurora', xmult: 1.5, price: 5, roll: 0.009, desc: '\u00d71.5 Mult' },
  negative: { name: 'Void',   jokerSlots: 1, price: 5, roll: 0.003, desc: '+1 Joker slot' },
};

/** Roll a joker edition from one uniform r (RULES 5.2). */
export function rollEdition(r, allowNegative = true) {
  if (allowNegative && r < 0.003) return 'negative';
  if (r < 0.009) return 'poly';
  if (r < 0.023) return 'holo';
  if (r < 0.043) return 'foil';
  return null;
}

export const SEAL = {
  red:    { name: 'Echo',  color: '#e0452f', retrigger: 1, desc: 'Triggers 1 extra time' },
  gold:   { name: 'Mint',  color: '#e8b830', money: 3,     desc: '+$3 when scored' },
  blue:   { name: 'Augur', color: '#3f7fe0', createStar: true, desc: 'Creates the Star for the played hand when scored' },
  purple: { name: 'Twin',  color: '#9a4fd6', copyOnDiscard: true, desc: 'Copies itself into your deck when discarded' },
};

export const RUN_START = {
  money: 4,
  handSize: 8,
  hands: 4,
  discards: 3,
  jokerSlots: 5,
  consumableSlots: 2,
  antesToWin: 8,
};

/** Small blind requirement per ante (RULES 2.2). */
export const ANTE_SMALL = [null, 250, 700, 1800, 4200, 9000, 17000, 30000, 50000];

export function smallBlindReq(ante) {
  if (ante < ANTE_SMALL.length) return ANTE_SMALL[ante];
  let v = ANTE_SMALL[ANTE_SMALL.length - 1];
  for (let n = ANTE_SMALL.length; n <= ante; n++) v = Math.floor(v * (1.5 + 0.25 * (n - 8)));
  return v;
}

export function blindReq(ante, type, bossMult = 2) {
  const s = smallBlindReq(ante);
  if (type === 'small') return s;
  if (type === 'big') return Math.floor(s * 1.5);
  return s * bossMult;
}

export const BLIND_REWARD = { small: 3, big: 4, boss: 5, finisher: 8 };

export const SHOP = {
  cardSlots: 2,
  packSlots: 2,
  rerollBase: 5,
  rerollStep: 1,
  slotWeights: [{ item: 'joker', w: 70 }, { item: 'arcana', w: 20 }, { item: 'star', w: 10 }],
  rarityWeights: [{ item: 'common', w: 70 }, { item: 'uncommon', w: 25 }, { item: 'rare', w: 5 }],
  consumablePrice: 3,
  interestPer: 5,
  interestCap: 5,
  packWeights: [
    { item: 'arcana', w: 25 }, { item: 'star', w: 20 }, { item: 'deck', w: 25 },
    { item: 'joker', w: 15 }, { item: 'phantom', w: 8 }, { item: 'grab', w: 7 },
  ],
  jumboChance: 0.25,
};

export const PACKS = {
  arcana:  { name: 'Arcana Pack',  std: { price: 4, show: 3, pick: 1 }, jumbo: { price: 6, show: 5, pick: 2 } },
  star:    { name: 'Star Pack',    std: { price: 4, show: 3, pick: 1 }, jumbo: { price: 6, show: 5, pick: 2 } },
  deck:    { name: 'Deck Pack',    std: { price: 4, show: 3, pick: 1 }, jumbo: { price: 6, show: 5, pick: 2 } },
  joker:   { name: 'Joker Pack',   std: { price: 6, show: 2, pick: 1 }, jumbo: { price: 8, show: 4, pick: 2 } },
  phantom: { name: 'Phantom Pack', std: { price: 6, show: 2, pick: 1 }, jumbo: { price: 8, show: 4, pick: 2 } },
  grab:    { name: 'Grab Bag',     std: { price: 5, show: 4, pick: 1 }, jumbo: { price: 7, show: 6, pick: 2 } },
};

/** Deck-pack playing card generation (RULES 8.5). */
export const DECK_PACK = { enhanceChance: 0.4, editionChance: 0.08, editionWeights: [{ item: 'foil', w: 5 }, { item: 'holo', w: 2 }, { item: 'poly', w: 1 }], sealChance: 0.2 };

export const JOKER_COST = { common: [3, 5], uncommon: [6, 8], rare: [8, 10], legendary: [20, 20] };
export const JOKER_FREE_COST = { common: 4, uncommon: 7, rare: 9, legendary: 20 };

export function sellValue(cost) { return Math.max(1, Math.floor(cost / 2)); }
