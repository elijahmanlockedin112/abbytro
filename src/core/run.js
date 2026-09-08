// The run: all game state and every mutation the game can make to it.
// This module is UI-free and deterministic given a seed and a sequence of
// player actions, so a headless simulator can drive it (tools/sim.js).

import { Rng } from './rng.js';
import { standardDeck, makeCard, cloneCard, isFace, RANKS, SUITS, ENHANCEMENTS } from './cards.js';
import { HAND_TYPES, evaluateHand } from './hands.js';
import {
  RUN_START, SHOP, PACKS, DECK_PACK, JOKER_COST, JOKER_FREE_COST, EDITION, SEAL,
  ENHANCEMENT, blindReq, smallBlindReq, BLIND_REWARD, sellValue, rollEdition,
} from './rules.js';
import { scoreHand, makeRunCtx } from './scoring.js';
import {
  instantiateJoker, jokerSellValue, fireTrigger, tickScalers, passiveTotal, passiveFlag,
} from './jokers.js';
import { REGULAR_BOSSES, FINISHER_BOSSES, BOSS_BY_ID } from '../data/bosses.js';
import { TAGS, TAG_BY_ID } from '../data/tags.js';
import { VOUCHERS, VOUCHER_BY_ID } from '../data/vouchers.js';
import { FAMILY, CONSUMABLE_BY_ID, ALL_CONSUMABLES } from '../data/consumables.js';

const BLIND_ORDER = ['small', 'big', 'boss'];

export class Run {
  /** @param {object[]} jokerDefs parsed from data/jokers.json */
  constructor(seed, jokerDefs, opts = {}) {
    this.seed = String(seed || Rng.randomSeed()).toUpperCase();
    this.jokerDefs = jokerDefs;
    this.jokerDefById = Object.fromEntries(jokerDefs.map(d => [d.id, d]));
    this.streams = new Map();
    this.events = [];               // things the UI should react to since the last drain

    this.deck = standardDeck();
    this.drawPile = [];
    this.hand = [];
    this.discardPile = [];
    this.playedThisBlind = [];

    this.jokers = [];
    this.consumables = [];
    this.vouchers = new Set();
    this.tags = [];                 // pending tag ids
    this.ownedVoucherOrder = [];

    this.money = RUN_START.money;
    this.ante = 1;
    this.round = 1;
    this.blindIndex = 0;            // 0 small, 1 big, 2 boss
    this.blind = null;
    this.bossId = null;
    this.bossState = {};
    this.anteState = { playedCardIds: new Set(), bossRerolls: 0 };
    this.seenBosses = new Set();
    this.won = false;
    this.dead = false;
    this.endless = false;

    this.baseHandSize = RUN_START.handSize;
    this.baseHands = RUN_START.hands;
    this.baseDiscards = RUN_START.discards;
    this.baseJokerSlots = RUN_START.jokerSlots;
    this.baseConsumableSlots = RUN_START.consumableSlots;

    this.handLevels = Object.fromEntries(HAND_TYPES.map(t => [t, 1]));
    this.handPlays = Object.fromEntries(HAND_TYPES.map(t => [t, 0]));

    this.handsLeft = 0;
    this.discardsLeft = 0;
    this.handsPlayedThisRound = 0;
    this.discardsUsedThisRound = 0;
    this.score = 0;

    this.shop = null;
    this.pack = null;
    this.lastConsumableId = null;
    this.rerollCount = 0;

    this.stats = {
      handsPlayed: 0, discardsUsed: 0, cardsDestroyed: 0, jokersSold: 0,
      blindsSkipped: 0, rerolls: 0, bestHand: 0, bestHandType: null, roundsCleared: 0,
    };

    this.rollAnte();
    if (opts.autoStart !== false) this.phase = 'blind_select';
  }

  /* ------------------------------------------------------------- randomness */

  stream(name) {
    let r = this.streams.get(name);
    if (!r) { r = new Rng(this.seed + '|' + name); this.streams.set(name, r); }
    return r;
  }
  get rng() { return this.stream('chance'); }
  rngInt(name, n) { return this.stream(name).int(n); }
  chance(num, den) { return this.stream('chance').chance(num, den); }
  shuffleInPlace(name, arr) { return this.stream(name).shuffle(arr); }
  weightedPick(name, items) { return this.stream(name).weighted(items); }
  pickFrom(name, arr) { return arr.length ? arr[this.stream(name).int(arr.length)] : undefined; }

  /* ------------------------------------------------------------- derived */

  boss() { return this.bossId ? BOSS_BY_ID[this.bossId] : null; }

  voucherGrant(key, fallback = 0) {
    let v = fallback;
    for (const id of this.vouchers) {
      const g = VOUCHER_BY_ID[id].grants || {};
      if (g[key] === undefined) continue;
      if (typeof g[key] === 'boolean') { if (g[key]) v = true; }
      else if (key === 'interestCap' || key === 'bossRerollsPerAnte') v = Math.max(v === true ? 0 : v, g[key]);
      else if (key === 'priceScale') v = Math.min(v === 0 ? 1 : v, g[key]);
      else v += g[key];
    }
    return v;
  }

  get jokerSlots() {
    return this.baseJokerSlots
      + this.jokers.filter(j => j.edition === 'negative').length
      + passiveTotal(this, 'jokerSlots');
  }
  get consumableSlots() {
    return this.baseConsumableSlots + this.voucherGrant('consumableSlots') + passiveTotal(this, 'consumableSlots');
  }
  get handSize() {
    const boss = this.boss();
    const bossMod = boss && boss.handSizeMod && this.blind?.type === 'boss' ? boss.handSizeMod(this) : 0;
    return Math.max(1, this.baseHandSize + this.voucherGrant('handSize') + passiveTotal(this, 'handSize') + bossMod);
  }
  set handSize(v) { this.baseHandSize = v; }
  get maxHands() {
    const boss = this.boss();
    const bossMod = boss && boss.handsMod && this.blind?.type === 'boss' ? boss.handsMod(this) : 0;
    return Math.max(1, this.baseHands + this.voucherGrant('hands') + passiveTotal(this, 'hands') + bossMod);
  }
  get maxDiscards() {
    const boss = this.boss();
    const bossMod = boss && boss.discardsMod && this.blind?.type === 'boss' ? boss.discardsMod(this) : 0;
    return Math.max(0, this.baseDiscards + this.voucherGrant('discards') + passiveTotal(this, 'discards') + bossMod);
  }
  get interestCap() {
    return Math.max(this.voucherGrant('interestCap', SHOP.interestCap), SHOP.interestCap + passiveTotal(this, 'interestCap'));
  }
  get priceScale() { return this.voucherGrant('priceScale', 1); }

  freeJokerSlots() { return Math.max(0, this.jokerSlots - this.jokers.length); }
  freeConsumableSlots() { return Math.max(0, this.consumableSlots - this.consumables.length); }
  totalJokerSellValue() { return this.jokers.reduce((a, j) => a + jokerSellValue(j), 0); }

  /** Rule options for hand evaluation (vouchers + joker passives). */
  handOpts() {
    return {
      fourCardFlushes: !!this.voucherGrant('fourCardFlushes') || passiveFlag(this, 'fourCardFlushes'),
      fourCardStraights: !!this.voucherGrant('fourCardStraights') || passiveFlag(this, 'fourCardStraights'),
      straightGap: !!this.voucherGrant('straightGap') || passiveFlag(this, 'straightGap'),
      smearedSuits: passiveFlag(this, 'smearedSuits'),
    };
  }

  /** False while the Bleach boss suppresses enhancements/editions/seals. */
  modifiersActive() {
    const b = this.boss();
    return !(b && b.suppressModifiers && this.blind?.type === 'boss');
  }

  bossHook(name, ...args) {
    const b = this.boss();
    if (b && b[name] && this.blind?.type === 'boss') return b[name](this, ...args);
    return undefined;
  }

  emit(type, data) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /* --------------------------------------------------------------- money */

  addMoney(v, reason) {
    if (!v) return;
    this.money = Math.max(0, this.money + v);
    this.emit('money', { delta: v, reason, total: this.money });
  }
  setMoney(v) { this.money = Math.max(0, v); this.emit('money', { delta: 0, total: this.money }); }
  canAfford(price) { return this.money >= price; }
  price(base) { return Math.max(1, Math.floor(base * this.priceScale)); }

  /* ------------------------------------------------------------ ante flow */

  /** Pick this ante's boss, both skip tags, and the voucher on offer. */
  rollAnte() {
    const finisher = this.ante % 8 === 0;
    const pool = (finisher ? FINISHER_BOSSES : REGULAR_BOSSES)
      .filter(b => b.minAnte <= this.ante && !this.seenBosses.has(b.id));
    let eligible = pool;
    if (!eligible.length) {
      // endless: recycle the pool
      for (const b of (finisher ? FINISHER_BOSSES : REGULAR_BOSSES)) this.seenBosses.delete(b.id);
      eligible = (finisher ? FINISHER_BOSSES : REGULAR_BOSSES).filter(b => b.minAnte <= this.ante);
    }
    this.bossId = this.pickFrom(`boss:${this.ante}`, eligible).id;

    const tagPool = TAGS.filter(t => t.minAnte <= this.ante);
    this.offeredTags = [
      this.pickFrom(`tag:${this.ante}:a`, tagPool).id,
      this.pickFrom(`tag:${this.ante}:b`, tagPool).id,
    ];

    const vPool = VOUCHERS.filter(v => !this.vouchers.has(v.id) && (!v.requires || this.vouchers.has(v.requires)));
    this.offeredVoucher = vPool.length ? this.pickFrom(`voucher:${this.ante}`, vPool).id : null;
    this.anteState = { playedCardIds: new Set(), bossRerolls: 0 };
  }

  rerollBoss() {
    const allowed = this.voucherGrant('bossRerollsPerAnte', 0);
    if (this.anteState.bossRerolls >= allowed) return false;
    if (!this.canAfford(10)) return false;
    this.addMoney(-10, 'Boss reroll');
    this.anteState.bossRerolls++;
    const finisher = this.ante % 8 === 0;
    const pool = (finisher ? FINISHER_BOSSES : REGULAR_BOSSES)
      .filter(b => b.minAnte <= this.ante && !this.seenBosses.has(b.id) && b.id !== this.bossId);
    if (pool.length) this.bossId = this.pickFrom(`bossreroll:${this.ante}:${this.anteState.bossRerolls}`, pool).id;
    this.emit('boss_rerolled', { bossId: this.bossId });
    return true;
  }

  blindInfo(index = this.blindIndex) {
    const type = BLIND_ORDER[index];
    const boss = type === 'boss' ? BOSS_BY_ID[this.bossId] : null;
    const req = blindReq(this.ante, type, boss ? boss.req : 2);
    const reward = type === 'boss' ? (boss?.finisher ? BLIND_REWARD.finisher : BLIND_REWARD.boss) : BLIND_REWARD[type];
    return {
      type, index, req, reward, boss,
      name: boss ? boss.name : type === 'small' ? 'Small Blind' : 'Big Blind',
      desc: boss ? boss.desc : type === 'small' ? 'A gentle opener.' : 'A real bet.',
      tagId: type === 'boss' ? null : this.offeredTags[index],
    };
  }

  /* ------------------------------------------------------------ blind flow */

  startBlind() {
    this.blind = this.blindInfo();
    this.bossState = {};
    this.score = 0;
    this.handsPlayedThisRound = 0;
    this.discardsUsedThisRound = 0;
    this.playedThisBlind = [];
    this.bossHook('onStart');
    this.handsLeft = this.maxHands;
    this.discardsLeft = this.maxDiscards;

    this.drawPile = this.deck.slice();
    this.shuffleInPlace(`shuffle:${this.ante}:${this.blind.type}`, this.drawPile);
    this.hand = [];
    this.discardPile = [];
    this.applyDebuffs();
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'blind_start');
    this.absorb(ctx);
    this.phase = 'playing';
    this.drawTo(this.handSize);
    this.emit('blind_start', { blind: this.blind });
    return this.blind;
  }

  applyDebuffs() {
    const boss = this.boss();
    const active = boss && boss.debuff && this.blind?.type === 'boss';
    for (const c of this.deck) c.debuffed = active ? !!boss.debuff(c, this) : false;
  }

  /** Draw up to n cards in hand. Returns the newly drawn cards. */
  drawTo(n) {
    const drawn = [];
    const faceDown = !!(this.boss()?.dealFaceDown && this.blind?.type === 'boss');
    while (this.hand.length < n && this.drawPile.length) {
      const c = this.drawPile.pop();
      c.faceDown = faceDown;
      this.hand.push(c);
      drawn.push(c);
    }
    if (drawn.length) this.emit('draw', { cards: drawn });
    return drawn;
  }

  /** Gate for the Play button. */
  canPlay(selected) {
    if (this.phase !== 'playing') return { ok: false, reason: 'Not your turn' };
    if (!selected.length) return { ok: false, reason: 'Select cards to play' };
    if (selected.length > 5) return { ok: false, reason: 'At most 5 cards' };
    if (this.handsLeft <= 0) return { ok: false, reason: 'No hands left' };
    const boss = this.boss();
    if (boss && boss.canPlay && this.blind.type === 'boss') {
      const r = boss.canPlay(this, selected);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  canDiscard(selected) {
    if (this.phase !== 'playing') return { ok: false, reason: 'Not your turn' };
    if (!selected.length) return { ok: false, reason: 'Select cards to discard' };
    if (selected.length > 5) return { ok: false, reason: 'At most 5 cards' };
    if (this.discardsLeft <= 0) return { ok: false, reason: 'No discards left' };
    return { ok: true };
  }

  /**
   * Play a hand. Returns { ctx, skipped, zeroed, cleared, dead, drawn }.
   * The UI animates ctx.log, then calls finishHand() to draw replacements.
   */
  playHand(selected) {
    const gate = this.canPlay(selected);
    if (!gate.ok) return { error: gate.reason };

    this.bossHook('onPlayPressed');
    for (const c of selected) c.faceDown = false;
    const held = this.hand.filter(c => !selected.includes(c));
    const ev = evaluateHand(selected, this.handOpts());

    this.handsLeft--;
    this.handsPlayedThisRound++;
    this.stats.handsPlayed++;
    for (const c of selected) this.anteState.playedCardIds.add(c.id);

    const skip = this.bossHook('beforeScore', selected, ev.type);
    let ctx = null;
    let total = 0;

    if (skip === 'skip') {
      this.emit('hand_skipped', { reason: this.boss().name });
    } else {
      ctx = scoreHand(this, selected, held);
      total = skip === 'zero' ? 0 : ctx.total;
      if (skip === 'zero') {
        ctx.total = 0;
        ctx.log.push({ kind: 'boss_zero', name: this.boss().name });
      }
      this.handPlays[ev.type]++;
      if (total > this.stats.bestHand) { this.stats.bestHand = total; this.stats.bestHandType = ev.type; }
      this.score += total;
      this.bossHook('afterHand', ctx);
      this.absorb(ctx);
    }

    this.playedThisBlind.push(...selected);
    this.hand = held;
    this.discardPile.push(...selected.filter(c => this.deck.includes(c)));
    tickScalers(this, 'hand_played');

    const cleared = this.score >= this.blind.req;
    const dead = !cleared && this.handsLeft <= 0;
    return { ctx, skipped: skip === 'skip', zeroed: skip === 'zero', total, cleared, dead, handType: ev.type };
  }

  /** Called by the UI after the scoring animation, to refill the hand. */
  finishHand() {
    if (this.phase !== 'playing') return [];
    return this.drawTo(this.handSize);
  }

  discard(selected) {
    const gate = this.canDiscard(selected);
    if (!gate.ok) return { error: gate.reason };
    const ctx = makeRunCtx(this);
    // Twin seal copies itself into the deck when discarded.
    const copies = [];
    if (this.modifiersActive()) {
      for (const c of selected) {
        if (c.seal === 'purple') {
          const copy = cloneCard(c);
          copy.seal = null;
          copies.push(copy);
        }
      }
    }
    for (const c of selected) fireTrigger(ctx, 'on_discard', { card: c, count: selected.length });
    this.absorb(ctx);

    this.discardsLeft--;
    this.discardsUsedThisRound++;
    this.stats.discardsUsed++;
    this.hand = this.hand.filter(c => !selected.includes(c));
    this.discardPile.push(...selected);
    for (const copy of copies) { this.deck.push(copy); this.hand.push(copy); }
    this.emit('discard', { cards: selected, copies });
    const drawn = this.drawTo(this.handSize);
    return { ok: true, drawn, copies, ctx };
  }

  /** Cash out a beaten blind. Returns the itemised reward rows. */
  cashOut() {
    const rows = [];
    // 1. Coin cards held in hand
    if (this.modifiersActive()) {
      let coin = 0;
      for (const c of this.hand) if (c.enhancement === 'gold' && !c.debuffed) coin += ENHANCEMENT.gold.heldMoney;
      if (coin) { this.addMoney(coin, 'Coin cards'); rows.push({ label: 'Coin cards', amount: coin }); }
    }
    // 2. interest on money held now
    const interest = Math.min(this.interestCap, Math.floor(this.money / SHOP.interestPer));
    // 3. base reward (Double Down tag)
    let reward = this.blind.reward;
    const ddIdx = this.tags.indexOf('double_down');
    if (ddIdx >= 0) { reward *= 2; this.tags.splice(ddIdx, 1); rows.push({ label: 'Double Down tag', amount: 0, note: true }); }
    this.addMoney(reward, 'Blind reward');
    rows.push({ label: `${this.blind.name} reward`, amount: reward });
    // 4. unused hands
    if (this.handsLeft > 0) { this.addMoney(this.handsLeft, 'Unused hands'); rows.push({ label: `${this.handsLeft} unused hand${this.handsLeft === 1 ? '' : 's'}`, amount: this.handsLeft }); }
    if (interest) { this.addMoney(interest, 'Interest'); rows.push({ label: `Interest (max $${this.interestCap})`, amount: interest }); }

    if (this.blind.type === 'boss') {
      this.seenBosses.add(this.bossId);
      this.bossHook('onEnd');
      for (const id of this.tags.slice()) {
        const t = TAG_BY_ID[id];
        if (t.on === 'bossWon') { t.apply(this); this.tags.splice(this.tags.indexOf(id), 1); rows.push({ label: t.name, amount: 25 }); }
      }
    }
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'blind_end');
    fireTrigger(ctx, 'round_end');
    this.absorb(ctx);
    tickScalers(this, 'blind_end');
    tickScalers(this, 'round_end');
    for (const c of this.deck) c.debuffed = false;
    this.stats.roundsCleared++;
    return rows;
  }

  /** Advance past a beaten (or skipped) blind. */
  advanceBlind() {
    const wasBoss = this.blindIndex === 2;
    this.round++;
    if (wasBoss) {
      if (this.ante >= RUN_START.antesToWin && !this.endless) { this.won = true; this.phase = 'won'; return; }
      this.ante++;
      this.blindIndex = 0;
      this.rollAnte();
    } else {
      this.blindIndex++;
    }
    this.blind = null;
    this.phase = 'blind_select';
  }

  skipBlind() {
    if (this.blindIndex === 2) return false;
    const info = this.blindInfo();
    this.stats.blindsSkipped++;
    this.grantTag(info.tagId);
    this.blindIndex++;
    this.round++;
    this.phase = 'blind_select';
    this.emit('blind_skipped', { tagId: info.tagId });
    return true;
  }

  grantTag(id) {
    const t = TAG_BY_ID[id];
    if (!t) return;
    let copies = 1;
    const twinIdx = this.tags.indexOf('twin_tag');
    if (twinIdx >= 0 && id !== 'twin_tag') { copies = 2; this.tags.splice(twinIdx, 1); }
    for (let i = 0; i < copies; i++) {
      if (t.immediate) { this.emit('tag_immediate', { tagId: id, tag: t }); }
      else this.tags.push(id);
    }
    this.emit('tag_gained', { tagId: id, copies });
  }

  /* ------------------------------------------------------------- the shop */

  openShop() {
    this.phase = 'shop';
    this.rerollCount = 0;
    const shopTags = this.tags.filter(id => TAG_BY_ID[id].on === 'shop');
    this.tags = this.tags.filter(id => TAG_BY_ID[id].on !== 'shop');
    this.shop = {
      cards: [],
      packs: [],
      voucher: this.offeredVoucher && !this.vouchers.has(this.offeredVoucher) ? this.offeredVoucher : null,
      voucherBought: false,
      rerollPrice: shopTags.some(id => TAG_BY_ID[id].freeReroll) ? 0 : this.price(SHOP.rerollBase),
      freeCards: shopTags.some(id => TAG_BY_ID[id].freeCards),
      gifts: shopTags.map(id => TAG_BY_ID[id].shopGift).filter(Boolean),
    };
    this.fillShopCards();
    const seed = `pack:${this.ante}:${this.blindIndex}`;
    for (let i = 0; i < SHOP.packSlots; i++) this.shop.packs.push(this.rollPack(`${seed}:${i}`));
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'shop_enter');
    this.absorb(ctx);
    this.emit('shop_open', {});
    return this.shop;
  }

  shopCardSlots() { return SHOP.cardSlots + passiveTotal(this, 'shopSlots'); }

  fillShopCards() {
    const stream = `shop:${this.ante}:${this.blindIndex}:${this.rerollCount}`;
    const n = this.shopCardSlots();
    this.shop.cards = [];
    for (let i = 0; i < n; i++) {
      const gift = this.shop.gifts.shift();
      this.shop.cards.push(gift ? this.makeShopJoker(stream + ':g' + i, gift) : this.rollShopCard(stream + ':' + i));
    }
  }

  rollShopCard(stream) {
    const kind = this.weightedPick(stream + ':kind', SHOP.slotWeights);
    if (kind === 'joker') return this.makeShopJoker(stream);
    const item = this.rollConsumable(kind, stream);
    return { kind: 'consumable', item, price: this.shop.freeCards ? 0 : this.price(SHOP.consumablePrice) };
  }

  makeShopJoker(stream, gift = null) {
    const rarity = gift?.rarity || this.weightedPick(stream + ':rarity', SHOP.rarityWeights);
    const def = this.rollJokerDef(rarity, stream);
    if (!def) return { kind: 'empty' };
    const edition = gift ? (gift.edition || null) : rollEdition(this.stream(stream + ':ed').next());
    const [lo, hi] = JOKER_COST[rarity];
    const base = this.stream(stream + ':cost').range(lo, hi) + (edition ? EDITION[edition].price : 0);
    const free = gift || this.shop.freeCards;
    return {
      kind: 'joker', def, rarity, edition,
      price: free ? 0 : this.price(base),
      cost: free ? JOKER_FREE_COST[rarity] : base,
    };
  }

  /** A joker definition not already owned or on offer. */
  rollJokerDef(rarity, stream) {
    const owned = new Set(this.jokers.map(j => j.defId));
    const onOffer = new Set((this.shop?.cards || []).filter(c => c.kind === 'joker').map(c => c.def.id));
    let pool = this.jokerDefs.filter(d => d.rarity === rarity && !owned.has(d.id) && !onOffer.has(d.id));
    if (!pool.length) pool = this.jokerDefs.filter(d => d.rarity === rarity && !owned.has(d.id));
    if (!pool.length) pool = this.jokerDefs.filter(d => d.rarity === rarity);
    return this.pickFrom(stream + ':def', pool);
  }

  rollConsumable(family, stream) {
    let pool = FAMILY[family];
    if (family === 'star') {
      // Stars for hands you have never played are withheld
      pool = pool.filter(s => !['five_kind', 'flush_house', 'flush_five'].includes(s.handType) || this.handPlays[s.handType] > 0);
    }
    if (family === 'phantom') return this.weightedPick(stream + ':ph', pool.map(p => ({ item: p, w: p.weight ?? 1 })));
    return this.pickFrom(stream + ':c', pool);
  }

  rollPack(stream) {
    const type = this.weightedPick(stream + ':type', SHOP.packWeights);
    const size = this.stream(stream + ':size').next() < SHOP.jumboChance ? 'jumbo' : 'std';
    const spec = PACKS[type][size];
    return { type, size, name: PACKS[type].name + (size === 'jumbo' ? ' (Jumbo)' : ''), price: this.price(spec.price), show: spec.show, pick: spec.pick, stream };
  }

  reroll() {
    if (!this.canAfford(this.shop.rerollPrice)) return false;
    this.addMoney(-this.shop.rerollPrice, 'Reroll');
    this.rerollCount++;
    this.stats.rerolls++;
    this.shop.rerollPrice = this.price(SHOP.rerollBase + SHOP.rerollStep * this.rerollCount);
    const disc = passiveTotal(this, 'rerollDiscount');
    if (disc) this.shop.rerollPrice = Math.max(0, this.shop.rerollPrice - disc);
    this.fillShopCards();
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'reroll');
    this.absorb(ctx);
    this.emit('reroll', {});
    return true;
  }

  buyShopCard(index) {
    const slot = this.shop.cards[index];
    if (!slot || slot.kind === 'empty') return { error: 'Nothing there' };
    if (!this.canAfford(slot.price)) return { error: 'Not enough money' };
    if (slot.kind === 'joker') {
      if (this.freeJokerSlots() < 1 && slot.edition !== 'negative') return { error: 'No Joker slots' };
      this.addMoney(-slot.price, 'Bought joker');
      const j = this.addJokerByDef(slot.def, { edition: slot.edition, cost: slot.cost });
      this.shop.cards[index] = { kind: 'empty' };
      return { ok: true, joker: j };
    }
    if (this.freeConsumableSlots() < 1) return { error: 'No consumable slots' };
    this.addMoney(-slot.price, 'Bought consumable');
    this.consumables.push({ id: slot.item.id, def: slot.item, cost: SHOP.consumablePrice });
    this.shop.cards[index] = { kind: 'empty' };
    return { ok: true };
  }

  buyVoucher() {
    const id = this.shop.voucher;
    if (!id || this.shop.voucherBought) return { error: 'Nothing there' };
    const price = this.price(VOUCHER_BY_ID[id].price);
    if (!this.canAfford(price)) return { error: 'Not enough money' };
    this.addMoney(-price, 'Bought voucher');
    this.vouchers.add(id);
    this.ownedVoucherOrder.push(id);
    this.shop.voucherBought = true;
    this.emit('voucher_bought', { id });
    return { ok: true };
  }

  buyPack(index) {
    const pack = this.shop.packs[index];
    if (!pack || pack.bought) return { error: 'Nothing there' };
    let price = pack.price;
    let size = pack.size;
    const bulkIdx = this.tags.indexOf('bulk');
    if (bulkIdx >= 0) { price = 0; size = 'jumbo'; this.tags.splice(bulkIdx, 1); }
    if (!this.canAfford(price)) return { error: 'Not enough money' };
    this.addMoney(-price, 'Bought pack');
    pack.bought = true;
    return this.openPack(pack.type, size, pack.stream);
  }

  /** Build a pack's contents and enter the pack-open phase. */
  openPack(type, size, stream = `packOpen:${this.stats.handsPlayed}:${this.round}`) {
    const spec = PACKS[type][size];
    const items = [];
    for (let i = 0; i < spec.show; i++) {
      const s = `${stream}:${size}:${i}`;
      if (type === 'deck') items.push({ kind: 'card', card: this.rollDeckCard(s) });
      else if (type === 'joker') items.push(this.makeShopJoker(s));
      else if (type === 'grab') {
        const fam = this.weightedPick(s + ':fam', [{ item: 'arcana', w: 45 }, { item: 'star', w: 40 }, { item: 'phantom', w: 15 }]);
        items.push({ kind: 'consumable', item: this.rollConsumable(fam, s) });
      } else items.push({ kind: 'consumable', item: this.rollConsumable(type, s) });
    }
    this.pack = { type, size, items, picksLeft: spec.pick, name: PACKS[type].name, taken: new Set() };
    this.prevPhase = this.phase;
    this.phase = 'pack';
    // Packs let you use targeted consumables on a fresh hand.
    if (!this.hand.length) {
      this.drawPile = this.deck.slice();
      this.shuffleInPlace(stream + ':hand', this.drawPile);
      this.hand = [];
      this.drawTo(this.handSize);
      this.packDrewHand = true;
    }
    this.emit('pack_open', { pack: this.pack });
    return { ok: true, pack: this.pack };
  }

  rollDeckCard(stream) {
    const rank = this.pickFrom(stream + ':r', RANKS);
    const suit = this.pickFrom(stream + ':s', SUITS);
    const card = makeCard(rank, suit);
    const r = this.stream(stream + ':mods');
    if (r.next() < DECK_PACK.enhanceChance) card.enhancement = this.pickFrom(stream + ':enh', ENHANCEMENTS);
    if (r.next() < DECK_PACK.editionChance) card.edition = this.weightedPick(stream + ':ed', DECK_PACK.editionWeights);
    if (r.next() < DECK_PACK.sealChance) card.seal = this.pickFrom(stream + ':seal', ['red', 'gold', 'blue', 'purple']);
    return card;
  }

  takePackItem(index) {
    const item = this.pack.items[index];
    if (!item || this.pack.taken.has(index) || this.pack.picksLeft <= 0) return { error: 'Cannot take' };
    if (item.kind === 'card') {
      this.deck.push(item.card);
      this.pack.taken.add(index);
      this.pack.picksLeft--;
      this.emit('card_added', { card: item.card });
      const ctx = makeRunCtx(this);
      fireTrigger(ctx, 'card_added', { card: item.card });
      this.absorb(ctx);
      return { ok: true };
    }
    if (item.kind === 'joker') {
      if (this.freeJokerSlots() < 1 && item.edition !== 'negative') return { error: 'No Joker slots' };
      this.addJokerByDef(item.def, { edition: item.edition, cost: JOKER_FREE_COST[item.rarity] });
      this.pack.taken.add(index);
      this.pack.picksLeft--;
      return { ok: true };
    }
    if (this.freeConsumableSlots() < 1) return { error: 'No consumable slots' };
    this.consumables.push({ id: item.item.id, def: item.item, cost: SHOP.consumablePrice });
    this.pack.taken.add(index);
    this.pack.picksLeft--;
    return { ok: true };
  }

  closePack() {
    if (this.packDrewHand) {
      for (const c of this.hand) this.drawPile.push(c);
      this.hand = [];
      this.packDrewHand = false;
    }
    this.pack = null;
    this.phase = this.prevPhase === 'pack' ? 'shop' : (this.prevPhase || 'shop');
    this.emit('pack_close', {});
  }

  /**
   * Close the shop. The blind was already advanced during cash-out, so this
   * only clears the shop state; calling advanceBlind() here would skip a blind.
   */
  leaveShop() {
    this.shop = null;
    this.phase = 'blind_select';
  }

  /* --------------------------------------------------------- jokers & cards */

  addJokerByDef(def, extra = {}) {
    const j = instantiateJoker(def, { cost: extra.cost ?? def.cost, ...extra });
    this.jokers.push(j);
    this.emit('joker_added', { joker: j });
    return j;
  }

  createJoker(rarity) {
    if (this.freeJokerSlots() < 1) return null;
    const def = this.rollJokerDef(rarity === 'random' ? this.weightedPick('chance:rar', SHOP.rarityWeights) : rarity, 'create:' + this.stats.handsPlayed + ':' + this.jokers.length);
    return def ? this.addJokerByDef(def, { cost: JOKER_FREE_COST[def.rarity] }) : null;
  }

  sellJoker(j) {
    const v = jokerSellValue(j);
    const idx = this.jokers.indexOf(j);
    if (idx < 0) return false;
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'joker_sold', { joker: j });
    this.jokers.splice(idx, 1);
    this.addMoney(v, 'Sold ' + j.def.name);
    this.stats.jokersSold++;
    this.bossHook('onJokerSold');
    this.absorb(ctx);
    this.emit('joker_sold', { joker: j, value: v });
    return true;
  }

  destroyJoker(j) {
    const idx = this.jokers.indexOf(j);
    if (idx < 0) return false;
    this.jokers.splice(idx, 1);
    this.emit('joker_destroyed', { joker: j });
    return true;
  }

  sellConsumable(c) {
    const idx = this.consumables.indexOf(c);
    if (idx < 0) return false;
    this.consumables.splice(idx, 1);
    this.addMoney(sellValue(c.cost), 'Sold ' + c.def.name);
    return true;
  }

  createConsumable(family) {
    if (this.freeConsumableSlots() < 1) return null;
    const item = this.rollConsumable(family === 'random' ? this.pickFrom('chance:fam', ['arcana', 'star', 'phantom']) : family, 'create:' + this.consumables.length + ':' + this.stats.handsPlayed);
    if (!item) return null;
    const c = { id: item.id, def: item, cost: SHOP.consumablePrice };
    this.consumables.push(c);
    this.emit('consumable_created', { consumable: c });
    return c;
  }

  createConsumableById(id) {
    if (this.freeConsumableSlots() < 1) return null;
    const item = CONSUMABLE_BY_ID[id];
    if (!item) return null;
    const c = { id, def: item, cost: SHOP.consumablePrice };
    this.consumables.push(c);
    return c;
  }

  /** Create the Star that levels `handType` (Augur seal). */
  createStarFor(handType) {
    if (this.freeConsumableSlots() < 1) return null;
    return this.createConsumableById('star_' + handType);
  }

  canUseConsumable(c, selected = []) {
    const d = c.def;
    const [min, max] = d.select || [0, 0];
    if (selected.length < min || selected.length > max) return { ok: false, reason: min === max ? `Select ${min}` : `Select ${min}-${max} cards` };
    if (d.needsBlind && this.phase !== 'playing' && this.phase !== 'pack') return { ok: false, reason: 'Only during a blind' };
    if (max > 0 && this.phase !== 'playing' && this.phase !== 'pack') return { ok: false, reason: 'Only during a blind' };
    if (d.canUse && !d.canUse(this)) return { ok: false, reason: 'No valid target' };
    return { ok: true };
  }

  useConsumable(c, selected = []) {
    const gate = this.canUseConsumable(c, selected);
    if (!gate.ok) return { error: gate.reason };
    const msg = c.def.use(this, selected);
    const idx = this.consumables.indexOf(c);
    if (idx >= 0) this.consumables.splice(idx, 1);
    if (c.def.family !== 'phantom') this.lastConsumableId = c.id;
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'consumable_used', { consumable: c });
    this.absorb(ctx);
    this.emit('consumable_used', { consumable: c, message: msg });
    return { ok: true, message: msg };
  }

  levelHand(type, n = 1) {
    this.handLevels[type] = Math.max(1, (this.handLevels[type] || 1) + n);
    this.emit('hand_leveled', { type, level: this.handLevels[type] });
  }

  /* ------------------------------------------------------- card mutation */

  setEnhancement(card, id) { card.enhancement = id; this.emit('card_changed', { card }); }
  setSeal(card, id) { card.seal = id; this.emit('card_changed', { card }); }
  setEdition(card, id) { card.edition = id; this.emit('card_changed', { card }); }
  setSuit(card, suit) { card.suit = suit; if (card.enhancement === 'stone') card.enhancement = null; this.emit('card_changed', { card }); }
  setRank(card, rank) { card.rank = rank; if (card.enhancement === 'stone') card.enhancement = null; this.emit('card_changed', { card }); }

  copyOnto(target, source) {
    target.rank = source.rank;
    target.suit = source.suit;
    target.enhancement = source.enhancement;
    target.edition = source.edition;
    target.seal = source.seal;
    this.emit('card_changed', { card: target });
  }

  destroyCard(card) {
    const di = this.deck.indexOf(card);
    if (di >= 0) this.deck.splice(di, 1);
    this.hand = this.hand.filter(c => c !== card);
    this.drawPile = this.drawPile.filter(c => c !== card);
    this.discardPile = this.discardPile.filter(c => c !== card);
    this.stats.cardsDestroyed++;
    this.emit('card_destroyed', { card });
    const ctx = makeRunCtx(this);
    fireTrigger(ctx, 'card_destroyed', { card });
    this.absorb(ctx);
  }

  addCard(card) { this.deck.push(card); this.emit('card_added', { card }); return card; }

  addRandomFaceCard() {
    const rank = this.pickFrom('chance:face', ['J', 'Q', 'K']);
    const suit = this.pickFrom('chance:facesuit', SUITS);
    const card = makeCard(rank, suit, { enhancement: this.pickFrom('chance:faceenh', ENHANCEMENTS.filter(e => e !== 'stone')) });
    this.addCard(card);
    if (this.hand.length < this.handSize) this.hand.push(card);
    return card;
  }

  /**
   * Apply the deferred effects a scoring context queued: destroyed cards,
   * destroyed jokers, and created jokers/consumables/card copies.
   */
  absorb(ctx) {
    for (const { card } of ctx.destroyCards) this.destroyCard(card);
    for (const { joker } of ctx.destroyJokers) this.destroyJoker(joker);
    for (const spec of ctx.creates) {
      if (spec.kind === 'consumable') {
        if (spec.family === 'star' && spec.handType) this.createStarFor(spec.handType);
        else this.createConsumable(spec.family);
      } else if (spec.kind === 'joker') {
        this.createJoker(spec.rarity);
      } else if (spec.kind === 'cardCopy' && spec.card) {
        this.addCard(cloneCard(spec.card));
      }
    }
    ctx.destroyCards = [];
    ctx.destroyJokers = [];
    ctx.creates = [];
  }

  /* ------------------------------------------------------------ serialize */

  toJSON() {
    return {
      seed: this.seed, money: this.money, ante: this.ante, round: this.round,
      blindIndex: this.blindIndex, bossId: this.bossId, phase: this.phase,
      handLevels: this.handLevels, stats: this.stats,
      vouchers: [...this.vouchers], tags: this.tags,
      jokers: this.jokers.map(j => ({ defId: j.defId, edition: j.edition, counter: j.counter, cost: j.cost, state: j.state })),
      consumables: this.consumables.map(c => ({ id: c.id, cost: c.cost })),
      deck: this.deck.map(c => ({ id: c.id, rank: c.rank, suit: c.suit, enhancement: c.enhancement, edition: c.edition, seal: c.seal, bonusChips: c.bonusChips })),
      seenBosses: [...this.seenBosses], endless: this.endless,
      baseHandSize: this.baseHandSize, baseHands: this.baseHands, baseDiscards: this.baseDiscards,
      offeredTags: this.offeredTags, offeredVoucher: this.offeredVoucher,
    };
  }

  static fromJSON(data, jokerDefs) {
    const run = new Run(data.seed, jokerDefs, { autoStart: false });
    Object.assign(run, {
      money: data.money, ante: data.ante, round: data.round, blindIndex: data.blindIndex,
      bossId: data.bossId, handLevels: data.handLevels, stats: data.stats,
      vouchers: new Set(data.vouchers), tags: data.tags, seenBosses: new Set(data.seenBosses),
      endless: data.endless, baseHandSize: data.baseHandSize, baseHands: data.baseHands,
      baseDiscards: data.baseDiscards, offeredTags: data.offeredTags, offeredVoucher: data.offeredVoucher,
      phase: 'blind_select',
    });
    run.deck = data.deck.map(c => makeCard(c.rank, c.suit, c));
    run.jokers = data.jokers.map(j => {
      const inst = instantiateJoker(run.jokerDefById[j.defId], { edition: j.edition, cost: j.cost });
      inst.counter = j.counter;
      inst.state = j.state;
      return inst;
    });
    run.consumables = data.consumables.map(c => ({ id: c.id, def: CONSUMABLE_BY_ID[c.id], cost: c.cost }));
    return run;
  }
}
