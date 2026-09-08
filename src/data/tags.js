// Skip tags (RULES.md section 7). A tag is granted when a Small or Big blind is
// skipped. Tags either fire immediately (`immediate`) or sit in run.tags until
// their trigger consumes them.
//
// `on` values: 'shop' (next shop opens), 'blindWon' (any blind beaten),
// 'bossWon' (boss beaten), 'packBuy' (next booster purchase), 'tagGained'.

export const TAGS = [
  {
    id: 'bounty', name: 'Bounty', minAnte: 1, glyph: '💰',
    desc: '+$25 after defeating the next Boss.',
    on: 'bossWon', apply: run => { run.addMoney(25, 'Bounty Tag'); },
  },
  {
    id: 'double_down', name: 'Double Down', minAnte: 1, glyph: '✖',
    desc: 'Doubles the base reward of the next blind you beat.',
    on: 'blindWon', modifiesReward: true,
  },
  {
    id: 'patron', name: 'Patron', minAnte: 1, glyph: '👑',
    desc: 'Next shop: a free Rare Joker.',
    on: 'shop', shopGift: { kind: 'joker', rarity: 'rare' },
  },
  {
    id: 'guild', name: 'Guild', minAnte: 1, glyph: '🛡',
    desc: 'Next shop: a free Uncommon Joker.',
    on: 'shop', shopGift: { kind: 'joker', rarity: 'uncommon' },
  },
  {
    id: 'gleam_tag', name: 'Gleam Tag', minAnte: 1, glyph: '✦',
    desc: 'Next shop: a free Joker with the Gleam edition.',
    on: 'shop', shopGift: { kind: 'joker', edition: 'foil' },
  },
  {
    id: 'prism_tag', name: 'Prism Tag', minAnte: 1, glyph: '✧',
    desc: 'Next shop: a free Joker with the Prism edition.',
    on: 'shop', shopGift: { kind: 'joker', edition: 'holo' },
  },
  {
    id: 'aurora_tag', name: 'Aurora Tag', minAnte: 2, glyph: '🌈',
    desc: 'Next shop: a free Joker with the Aurora edition.',
    on: 'shop', shopGift: { kind: 'joker', edition: 'poly' },
  },
  {
    id: 'void_tag', name: 'Void Tag', minAnte: 2, glyph: '🕳',
    desc: 'Next shop: a free Joker with the Void edition.',
    on: 'shop', shopGift: { kind: 'joker', edition: 'negative' },
  },
  {
    id: 'ledger', name: 'Ledger', minAnte: 1, glyph: '📕',
    desc: 'Next shop: cards in the card slots are free.',
    on: 'shop', freeCards: true,
  },
  {
    id: 'barker', name: 'Barker', minAnte: 1, glyph: '📣',
    desc: 'Next shop: rerolls start at $0.',
    on: 'shop', freeReroll: true,
  },
  {
    id: 'trove', name: 'Trove', minAnte: 1, glyph: '🃏',
    desc: 'Immediately open a free Jumbo Arcana Pack.',
    immediate: true, openPack: { type: 'arcana', size: 'jumbo' },
  },
  {
    id: 'zenith', name: 'Zenith', minAnte: 1, glyph: '🌟',
    desc: 'Immediately open a free Jumbo Star Pack.',
    immediate: true, openPack: { type: 'star', size: 'jumbo' },
  },
  {
    id: 'shade', name: 'Shade', minAnte: 2, glyph: '👻',
    desc: 'Immediately open a free Phantom Pack.',
    immediate: true, openPack: { type: 'phantom', size: 'std' },
  },
  {
    id: 'bulk', name: 'Bulk', minAnte: 1, glyph: '📦',
    desc: 'The next Booster Pack you buy is free and one size larger.',
    on: 'packBuy', freePack: true,
  },
  {
    id: 'twin_tag', name: 'Twin Tag', minAnte: 1, glyph: '⧉',
    desc: 'The next tag you receive is duplicated.',
    on: 'tagGained', duplicates: true,
  },
];

export const TAG_BY_ID = Object.fromEntries(TAGS.map(t => [t.id, t]));
