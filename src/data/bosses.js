// Boss blinds (RULES.md section 6). Each boss declares `req` (multiplier on the
// Small blind requirement) and a set of hooks the run calls at defined points.
//
// Hooks (all optional, all receive the run):
//   onStart(run)                     - when the blind begins
//   debuff(card, run)                - true if this card is debuffed this blind
//   handSizeMod(run)                 - integer added to hand size
//   handsMod(run) / discardsMod(run) - integer added to hands / discards
//   canPlay(run, selected)           - { ok, reason } gate on the Play button
//   beforeScore(run, played)         - return 'skip' to consume the hand without scoring
//   afterJokers(ctx)                 - mutate ctx.chips / ctx.mult before the final multiply
//   onPlayPressed(run)               - fires once per play, before scoring
//   afterHand(run, ctx)              - after a hand fully resolves
//   dealFaceDown                     - cards are dealt face down
//   lockJokerOrder                   - jokers cannot be reordered

export const BOSSES = [
  {
    id: 'verdigris', name: 'Verdigris', minAnte: 1, req: 2, glyph: '♣',
    desc: 'All Club cards are debuffed.',
    debuff: card => card.suit === 'clubs',
  },
  {
    id: 'ashfall', name: 'Ashfall', minAnte: 1, req: 2, glyph: '♥',
    desc: 'All Heart cards are debuffed.',
    debuff: card => card.suit === 'hearts',
  },
  {
    id: 'hush', name: 'Hush', minAnte: 1, req: 2, glyph: '✕',
    desc: 'No discards.',
    discardsMod: run => -run.baseDiscards,
  },
  {
    id: 'tithe', name: 'Tithe', minAnte: 1, req: 2, glyph: '✂',
    desc: 'Hand size reduced by 2.',
    handSizeMod: () => -2,
  },
  {
    id: 'toll', name: 'Toll', minAnte: 1, req: 2, glyph: '⚑',
    desc: 'Your first hand is discarded without scoring.',
    beforeScore: run => (run.handsPlayedThisRound === 0 ? 'skip' : null),
  },
  {
    id: 'quorum', name: 'Quorum', minAnte: 2, req: 2, glyph: '5',
    desc: 'Every played hand must contain exactly 5 cards.',
    canPlay: (run, sel) => (sel.length === 5 ? { ok: true } : { ok: false, reason: 'Quorum: play exactly 5 cards' }),
  },
  {
    id: 'blindfold', name: 'Blindfold', minAnte: 2, req: 2, glyph: '●',
    desc: 'Cards are dealt face down.',
    dealFaceDown: true,
  },
  {
    id: 'undertow', name: 'Undertow', minAnte: 2, req: 2, glyph: '≈',
    desc: 'Chips are halved before the final multiply.',
    afterJokers: (run, ctx) => {
      ctx.chips /= 2;
      ctx.log.push({ kind: 'boss_chips', value: ctx.chips, source: 'boss', after: ctx.snapshot() });
    },
  },
  {
    id: 'rampart', name: 'Rampart', minAnte: 2, req: 4, glyph: '■',
    desc: 'Extra large blind.',
  },
  {
    id: 'monocle', name: 'Monocle', minAnte: 2, req: 2, glyph: '◎',
    desc: 'A hand type already played this blind scores 0.',
    onStart: run => { run.bossState.playedTypes = new Set(); },
    beforeScore: (run, played, type) => {
      const seen = run.bossState.playedTypes;
      if (seen.has(type)) return 'zero';
      seen.add(type);
      return null;
    },
  },
  {
    id: 'gravity', name: 'Gravity', minAnte: 3, req: 2, glyph: '♛',
    desc: 'All face cards are debuffed.',
    debuff: card => ['J', 'Q', 'K'].includes(card.rank) && card.enhancement !== 'stone',
  },
  {
    id: 'litany', name: 'Litany', minAnte: 3, req: 2, glyph: '≡',
    desc: 'Only the first hand type you play scores.',
    onStart: run => { run.bossState.lockedType = null; },
    beforeScore: (run, played, type) => {
      if (run.bossState.lockedType == null) { run.bossState.lockedType = type; return null; }
      return run.bossState.lockedType === type ? null : 'zero';
    },
  },
  {
    id: 'gremlin', name: 'Gremlin', minAnte: 3, req: 2, glyph: '☠',
    desc: 'One random Joker is disabled each hand.',
    onPlayPressed: run => {
      for (const j of run.jokers) j.disabled = false;
      if (!run.jokers.length) return;
      const victim = run.jokers[run.rngInt('chance', run.jokers.length)];
      victim.disabled = true;
      run.bossState.disabledUid = victim.uid;
    },
    afterHand: run => { for (const j of run.jokers) j.disabled = false; },
  },
  {
    id: 'wane', name: 'Wane', minAnte: 3, req: 2, glyph: '◖',
    desc: 'One fewer hand this blind.',
    handsMod: () => -1,
  },
  {
    id: 'salt', name: 'Salt', minAnte: 4, req: 2, glyph: '✳',
    desc: 'Cards played earlier this ante are debuffed.',
    debuff: (card, run) => run.anteState.playedCardIds.has(card.id),
  },
  {
    id: 'bleach', name: 'Bleach', minAnte: 4, req: 2, glyph: '□',
    desc: 'Enhancements, editions and seals do nothing.',
    suppressModifiers: true,
  },
  // ---- finishers (ante 8 only) ----
  {
    id: 'eclipse', name: 'Eclipse', minAnte: 8, req: 3, finisher: true, glyph: '◑',
    desc: 'All cards are debuffed until you sell a Joker.',
    onStart: run => { run.bossState.lifted = false; },
    debuff: (card, run) => !run.bossState.lifted,
    onJokerSold: run => { run.bossState.lifted = true; },
  },
  {
    id: 'shroud', name: 'Shroud', minAnte: 8, req: 3, finisher: true, glyph: '☁',
    desc: 'Jokers are shuffled, face down, and locked in place.',
    onStart: run => {
      run.shuffleInPlace('boss', run.jokers);
      for (const j of run.jokers) j.faceDown = true;
    },
    lockJokerOrder: true,
    onEnd: run => { for (const j of run.jokers) j.faceDown = false; },
  },
  {
    id: 'basilisk', name: 'Basilisk', minAnte: 8, req: 3, finisher: true, glyph: '◉',
    desc: 'One card in hand is always selected and cannot be deselected.',
    forcedCard: true,
  },
  {
    id: 'cinder', name: 'Cinder', minAnte: 8, req: 3, finisher: true, glyph: '♨',
    desc: 'One scoring card is destroyed after each hand.',
    afterHand: (run, ctx) => {
      const survivors = ctx.scoringCards.filter(c => !ctx.destroyCards.some(d => d.card === c));
      if (!survivors.length) return;
      const victim = survivors[run.rngInt('chance', survivors.length)];
      ctx.queueDestroyCard(victim, 'cinder');
    },
  },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map(b => [b.id, b]));
export const REGULAR_BOSSES = BOSSES.filter(b => !b.finisher);
export const FINISHER_BOSSES = BOSSES.filter(b => b.finisher);
