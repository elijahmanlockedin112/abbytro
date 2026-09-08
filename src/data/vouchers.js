// Vouchers (RULES.md section 10). Eight pairs; the upgrade requires its base.
// Effects are read by the run through `run.voucher(id)` and the passive getters,
// so a voucher is pure data except for the few that need an explicit hook.

export const VOUCHERS = [
  { id: 'stockpile', name: 'Stockpile', price: 10, glyph: '🎒', desc: '+1 consumable slot.', grants: { consumableSlots: 1 } },
  { id: 'hoard', name: 'Hoard', price: 10, glyph: '🏺', requires: 'stockpile', desc: '+1 consumable slot.', grants: { consumableSlots: 1 } },

  { id: 'nest_egg', name: 'Nest Egg', price: 10, glyph: '🥚', desc: 'Interest cap raised to $10.', grants: { interestCap: 10 } },
  { id: 'trust_fund', name: 'Trust Fund', price: 10, glyph: '🏦', requires: 'nest_egg', desc: 'Interest cap raised to $20.', grants: { interestCap: 20 } },

  { id: 'haggle', name: 'Haggle', price: 10, glyph: '🤝', desc: 'Shop prices reduced by 25%.', grants: { priceScale: 0.75 } },
  { id: 'fleece', name: 'Fleece', price: 10, glyph: '🧾', requires: 'haggle', desc: 'Shop prices reduced by 50%.', grants: { priceScale: 0.5 } },

  { id: 'grip', name: 'Grip', price: 10, glyph: '✋', desc: '+1 hand size.', grants: { handSize: 1 } },
  { id: 'vise', name: 'Vise', price: 10, glyph: '🗜', requires: 'grip', desc: '+1 hand size.', grants: { handSize: 1 } },

  { id: 'tempo', name: 'Tempo', price: 10, glyph: '⏱', desc: '+1 hand each blind.', grants: { hands: 1 } },
  { id: 'cadence', name: 'Cadence', price: 10, glyph: '🎼', requires: 'tempo', desc: '+1 hand each blind.', grants: { hands: 1 } },

  { id: 'spare', name: 'Spare', price: 10, glyph: '♻', desc: '+1 discard each blind.', grants: { discards: 1 } },
  { id: 'surplus', name: 'Surplus', price: 10, glyph: '📈', requires: 'spare', desc: '+1 discard each blind.', grants: { discards: 1 } },

  { id: 'nimble', name: 'Nimble', price: 10, glyph: '🏃', desc: 'Flushes and Straights need only 4 cards.', grants: { fourCardFlushes: true, fourCardStraights: true } },
  { id: 'skipstone', name: 'Skipstone', price: 10, glyph: '🪨', requires: 'nimble', desc: 'Straights may skip one rank.', grants: { straightGap: true } },

  { id: 'rehearsal', name: 'Rehearsal', price: 10, glyph: '🎭', desc: 'Reroll the Boss once per ante for $10.', grants: { bossRerollsPerAnte: 1, bossRerollPrice: 10 } },
  { id: 'encore', name: 'Encore', price: 10, glyph: '🎬', requires: 'rehearsal', desc: 'Reroll the Boss any number of times for $10.', grants: { bossRerollsPerAnte: Infinity } },
];

export const VOUCHER_BY_ID = Object.fromEntries(VOUCHERS.map(v => [v.id, v]));
