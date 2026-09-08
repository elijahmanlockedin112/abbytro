// Consumables (RULES.md section 9): Arcana (22), Stars (12), Phantom (12).
//
// Each card declares:
//   select: [min, max]  cards that must be selected from hand (0 = untargeted)
//   needsBlind: true    usable only during a blind or with a pack open
//   canUse(run, sel)    extra gate; returns true/false
//   use(run, sel)       performs the effect; returns a short log string
//
// `run` supplies the mutation helpers these call (see src/core/run.js).

import { HAND_TYPES, HAND_NAMES } from '../core/hands.js';
import { RANKS } from '../core/cards.js';

const enhance = (id) => (run, sel) => {
  for (const c of sel) run.setEnhancement(c, id);
  return `${sel.length} card${sel.length === 1 ? '' : 's'} enhanced`;
};

const convertSuit = (suit) => (run, sel) => {
  for (const c of sel) run.setSuit(c, suit);
  return `${sel.length} card${sel.length === 1 ? '' : 's'} → ${suit}`;
};

export const ARCANA = [
  { id: 'seer', name: 'The Seer', numeral: 'I', glyph: '🔮', select: [0, 0],
    desc: 'Creates up to 2 random Star cards.',
    canUse: run => run.freeConsumableSlots() >= 1,
    use: run => { const n = Math.min(2, run.freeConsumableSlots() + 1); for (let i = 0; i < n; i++) run.createConsumable('star'); return `Created ${n} Star cards`; } },

  { id: 'forge', name: 'The Forge', numeral: 'II', glyph: '⚒', select: [1, 2], desc: 'Enhances up to 2 cards to Gilt (+30 Chips).', use: enhance('bonus') },
  { id: 'pyre', name: 'The Pyre', numeral: 'III', glyph: '🔥', select: [1, 2], desc: 'Enhances up to 2 cards to Ember (+4 Mult).', use: enhance('mult') },
  { id: 'mask', name: 'The Mask', numeral: 'IV', glyph: '🎭', select: [1, 2], desc: 'Enhances up to 2 cards to Chameleon (any suit).', use: enhance('wild') },
  { id: 'lens', name: 'The Lens', numeral: 'V', glyph: '🔎', select: [1, 1], desc: 'Enhances 1 card to Crystal (×2 Mult, may shatter).', use: enhance('glass') },
  { id: 'anvil', name: 'The Anvil', numeral: 'VI', glyph: '🔨', select: [1, 1], desc: 'Enhances 1 card to Iron (×1.5 Mult held in hand).', use: enhance('steel') },
  { id: 'monolith', name: 'The Monolith', numeral: 'VII', glyph: '🗿', select: [1, 2], desc: 'Enhances up to 2 cards to Slab (+50 Chips, no rank).', use: enhance('stone') },
  { id: 'mint_card', name: 'The Mint', numeral: 'VIII', glyph: '🪙', select: [1, 2], desc: 'Enhances up to 2 cards to Coin ($3 when held).', use: enhance('gold') },
  { id: 'dice', name: 'The Dice', numeral: 'IX', glyph: '🎲', select: [1, 2], desc: 'Enhances up to 2 cards to Charm (lucky).', use: enhance('lucky') },

  { id: 'tide', name: 'The Tide', numeral: 'X', glyph: '🌊', select: [1, 3], desc: 'Converts up to 3 cards to Spades.', use: convertSuit('spades') },
  { id: 'bloom', name: 'The Bloom', numeral: 'XI', glyph: '🌹', select: [1, 3], desc: 'Converts up to 3 cards to Hearts.', use: convertSuit('hearts') },
  { id: 'thicket', name: 'The Thicket', numeral: 'XII', glyph: '🌿', select: [1, 3], desc: 'Converts up to 3 cards to Clubs.', use: convertSuit('clubs') },
  { id: 'kiln', name: 'The Kiln', numeral: 'XIII', glyph: '🏺', select: [1, 3], desc: 'Converts up to 3 cards to Diamonds.', use: convertSuit('diamonds') },

  { id: 'scythe', name: 'The Scythe', numeral: 'XIV', glyph: '⚰', select: [1, 2],
    desc: 'Destroys up to 2 selected cards.',
    use: (run, sel) => { for (const c of sel) run.destroyCard(c); return `Destroyed ${sel.length}`; } },

  { id: 'ladder', name: 'The Ladder', numeral: 'XV', glyph: '🪜', select: [1, 2],
    desc: 'Increases the rank of up to 2 cards by 1.',
    use: (run, sel) => { for (const c of sel) run.setRank(c, RANKS[(RANKS.indexOf(c.rank) + 1) % RANKS.length]); return 'Ranks raised'; } },

  { id: 'twin_card', name: 'The Twin', numeral: 'XVI', glyph: '👯', select: [2, 2],
    desc: 'The left selected card becomes a copy of the right one.',
    use: (run, sel) => { run.copyOnto(sel[0], sel[1]); return 'Card copied'; } },

  { id: 'alms', name: 'The Alms', numeral: 'XVII', glyph: '🫴', select: [0, 0],
    desc: 'Gain money equal to your current money, up to $20.',
    use: run => { const g = Math.min(20, run.money); run.addMoney(g, 'The Alms'); return `+$${g}`; } },

  { id: 'purse', name: 'The Purse', numeral: 'XVIII', glyph: '👛', select: [0, 0],
    desc: 'Gain the total sell value of your Jokers, up to $50.',
    use: run => { const g = Math.min(50, run.totalJokerSellValue()); run.addMoney(g, 'The Purse'); return `+$${g}`; } },

  { id: 'mirror', name: 'The Mirror', numeral: 'XIX', glyph: '🪞', select: [0, 0],
    desc: 'Copies the last Arcana or Star card you used.',
    canUse: run => !!run.lastConsumableId && run.freeConsumableSlots() >= 1,
    use: run => { run.createConsumableById(run.lastConsumableId); return 'Copied'; } },

  { id: 'jester', name: 'The Jester', numeral: 'XX', glyph: '🃏', select: [0, 0],
    desc: 'Creates a random Common Joker.',
    canUse: run => run.freeJokerSlots() >= 1,
    use: run => { const j = run.createJoker('common'); return j ? `Created ${j.def.name}` : 'No room'; } },

  { id: 'gambler', name: 'The Gambler', numeral: 'XXI', glyph: '🎰', select: [0, 0],
    desc: '1 in 4 chance to give a Joker a random edition.',
    canUse: run => run.jokers.some(j => !j.edition),
    use: run => {
      if (!run.chance(1, 4)) return 'Nothing happened';
      const pool = run.jokers.filter(j => !j.edition);
      const j = pool[run.rngInt('chance', pool.length)];
      j.edition = run.weightedPick('chance', [{ item: 'foil', w: 50 }, { item: 'holo', w: 35 }, { item: 'poly', w: 15 }]);
      return `${j.def.name} gained an edition`;
    } },

  { id: 'herald', name: 'The Herald', numeral: 'XXII', glyph: '📯', select: [0, 0],
    desc: 'Creates up to 2 random Arcana cards.',
    canUse: run => run.freeConsumableSlots() >= 1,
    use: run => { const n = Math.min(2, run.freeConsumableSlots() + 1); for (let i = 0; i < n; i++) run.createConsumable('arcana'); return `Created ${n} Arcana`; } },
];

const STAR_NAMES = {
  high_card: 'Sirius', pair: 'Vega', two_pair: 'Altair', three_kind: 'Deneb',
  straight: 'Rigel', flush: 'Antares', full_house: 'Polaris', four_kind: 'Betelgeuse',
  straight_flush: 'Arcturus', five_kind: 'Canopus', flush_house: 'Aldebaran', flush_five: 'Capella',
};

const STAR_GLYPHS = {
  high_card: '☄', pair: '⭐', two_pair: '✨', three_kind: '🌟', straight: '💫', flush: '🌠',
  full_house: '🪐', four_kind: '🌞', straight_flush: '🌌', five_kind: '🔆', flush_house: '🌜', flush_five: '🌕',
};

export const STARS = HAND_TYPES.map(type => ({
  id: 'star_' + type,
  name: STAR_NAMES[type],
  handType: type,
  glyph: STAR_GLYPHS[type],
  select: [0, 0],
  desc: `Levels up ${HAND_NAMES[type]}.`,
  use: (run) => { run.levelHand(type, 1); return `${HAND_NAMES[type]} → level ${run.handLevels[type]}`; },
}));

export const PHANTOMS = [
  { id: 'apparition', name: 'Apparition', glyph: '👁', select: [0, 0], weight: 0.4,
    desc: 'Creates a Legendary Joker, then destroys one other Joker.',
    canUse: run => run.freeJokerSlots() >= 1,
    use: run => {
      const j = run.createJoker('legendary');
      const others = run.jokers.filter(x => x !== j);
      if (others.length) run.destroyJoker(others[run.rngInt('chance', others.length)]);
      return j ? `Summoned ${j.def.name}` : 'Nothing';
    } },

  { id: 'hollow', name: 'Hollow', glyph: '🕯', select: [0, 0],
    desc: 'Destroys a random Joker. Gain $20.',
    canUse: run => run.jokers.length >= 1,
    use: run => { run.destroyJoker(run.jokers[run.rngInt('chance', run.jokers.length)]); run.addMoney(20, 'Hollow'); return '+$20' } },

  { id: 'sigil', name: 'Sigil', glyph: '🔯', select: [1, 1],
    desc: 'Adds an Echo seal to 1 card, then destroys another card in hand.',
    use: (run, sel) => {
      run.setSeal(sel[0], 'red');
      const others = run.hand.filter(c => c !== sel[0]);
      if (others.length) run.destroyCard(others[run.rngInt('chance', others.length)]);
      return 'Echo seal added';
    } },

  { id: 'ingot', name: 'Ingot', glyph: '🧱', select: [1, 2],
    desc: 'Adds a Mint seal to selected cards, destroys every other card in hand.',
    use: (run, sel) => {
      for (const c of sel) run.setSeal(c, 'gold');
      for (const c of run.hand.filter(c => !sel.includes(c))) run.destroyCard(c);
      return 'Mint seals added';
    } },

  { id: 'umbra', name: 'Umbra', glyph: '🌑', select: [0, 0],
    desc: 'A Joker gains Void (+1 slot). Your money is set to $0.',
    canUse: run => run.jokers.some(j => !j.edition),
    use: run => {
      const pool = run.jokers.filter(j => !j.edition);
      const j = pool[run.rngInt('chance', pool.length)];
      j.edition = 'negative';
      run.setMoney(0);
      return `${j.def.name} is now Void`;
    } },

  { id: 'iris', name: 'Iris', glyph: '🌈', select: [0, 0],
    desc: 'A Joker gains Aurora. Every other Joker is destroyed.',
    canUse: run => run.jokers.length >= 1,
    use: run => {
      const j = run.jokers[run.rngInt('chance', run.jokers.length)];
      j.edition = 'poly';
      for (const other of run.jokers.filter(x => x !== j)) run.destroyJoker(other);
      return `${j.def.name} is Aurora`;
    } },

  { id: 'doppel', name: 'Doppel', glyph: '⧉', select: [0, 0],
    desc: 'Copies a Joker (no edition). Every other Joker is destroyed.',
    canUse: run => run.jokers.length >= 1,
    use: run => {
      const j = run.jokers[run.rngInt('chance', run.jokers.length)];
      for (const other of run.jokers.filter(x => x !== j)) run.destroyJoker(other);
      run.addJokerByDef(j.def, { edition: null });
      return `${j.def.name} duplicated`;
    } },

  { id: 'monotone', name: 'Monotone', glyph: '🎵', select: [1, 1], needsBlind: true,
    desc: 'Every card in hand becomes the selected rank. Hand size −1 permanently.',
    use: (run, sel) => {
      for (const c of run.hand) run.setRank(c, sel[0].rank);
      run.baseHandSize = Math.max(1, run.baseHandSize - 1);
      return `All ${sel[0].rank}s`;
    } },

  { id: 'legion', name: 'Legion', glyph: '⚔', select: [1, 1], needsBlind: true,
    desc: 'Every card in hand becomes the selected suit. The selected card is destroyed.',
    use: (run, sel) => {
      const suit = sel[0].suit;
      for (const c of run.hand) if (c !== sel[0]) run.setSuit(c, suit);
      run.destroyCard(sel[0]);
      return `All ${suit}`;
    } },

  { id: 'bonfire', name: 'Bonfire', glyph: '🔥', select: [0, 0], needsBlind: true,
    desc: 'Destroys 5 random cards in hand. Gain $20.',
    canUse: run => run.hand.length > 0,
    use: run => {
      const pool = run.hand.slice();
      run.shuffleInPlace('chance', pool);
      const n = Math.min(5, pool.length);
      for (let i = 0; i < n; i++) run.destroyCard(pool[i]);
      run.addMoney(20, 'Bonfire');
      return `Burned ${n}, +$20`;
    } },

  { id: 'retinue', name: 'Retinue', glyph: '👥', select: [0, 0], needsBlind: true,
    desc: 'Destroys 1 card in hand, adds 3 enhanced face cards to your deck.',
    canUse: run => run.hand.length > 0,
    use: run => {
      run.destroyCard(run.hand[run.rngInt('chance', run.hand.length)]);
      for (let i = 0; i < 3; i++) run.addRandomFaceCard();
      return '3 face cards added';
    } },

  { id: 'nova', name: 'Nova', glyph: '💥', select: [0, 0],
    desc: 'Levels up every hand type. Discards −1 permanently.',
    use: run => {
      for (const t of HAND_TYPES) run.levelHand(t, 1);
      run.baseDiscards = Math.max(0, run.baseDiscards - 1);
      return 'All hands leveled';
    } },
];

export const ALL_CONSUMABLES = [
  ...ARCANA.map(c => ({ ...c, family: 'arcana' })),
  ...STARS.map(c => ({ ...c, family: 'star' })),
  ...PHANTOMS.map(c => ({ ...c, family: 'phantom' })),
];

export const CONSUMABLE_BY_ID = Object.fromEntries(ALL_CONSUMABLES.map(c => [c.id, c]));

export const FAMILY = {
  arcana: ALL_CONSUMABLES.filter(c => c.family === 'arcana'),
  star: ALL_CONSUMABLES.filter(c => c.family === 'star'),
  phantom: ALL_CONSUMABLES.filter(c => c.family === 'phantom'),
};
