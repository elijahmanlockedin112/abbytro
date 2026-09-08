// All pointer and keyboard handling. Hit-testing uses the same rects that
// layout.js gives the renderer, so what you see is what you can click.

import { L, W, H, BS, jokerSlot, consumSlot, bsColumn, inRect } from './layout.js';
import { titleButtons, shopSlots } from './screens.js';
import { describeJoker, jokerSellValue } from '../core/jokers.js';
import { VOUCHER_BY_ID } from '../data/vouchers.js';
import { TAG_BY_ID } from '../data/tags.js';
import { ENHANCEMENT, EDITION, SEAL } from '../core/rules.js';
import { HAND_NAMES } from '../core/hands.js';
import { C } from './theme.js';
import * as S from '../audio/sfx.js';

const DRAG_THRESHOLD = 6;

export function attachInput(game, canvas) {
  const toLogical = e => {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    return [(px - game.view.ox) / game.view.scale, (py - game.view.oy) / game.view.scale];
  };

  canvas.addEventListener('pointermove', e => {
    const [x, y] = toLogical(e);
    game.mx = x; game.my = y;
    if (game.down && game.pressTarget && !game.dragActive) {
      if (Math.hypot(x - game.downX, y - game.downY) > DRAG_THRESHOLD) startDrag(game, x, y);
    }
    if (game.dragActive) moveDrag(game, x, y);
    updateHover(game);
  });

  canvas.addEventListener('pointerdown', e => {
    const [x, y] = toLogical(e);
    game.mx = x; game.my = y;
    S.initAudio();
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    game.down = true;
    game.downX = x; game.downY = y;
    game.pressTarget = pickDraggable(game, x, y);
    game.pressT = performance.now();
  });

  canvas.addEventListener('pointerup', e => {
    const [x, y] = toLogical(e);
    game.mx = x; game.my = y;
    if (e.button !== 0) return;
    const moved = Math.hypot(x - game.downX, y - game.downY);
    if (game.dragActive) endDrag(game);
    else if (game.down && moved < DRAG_THRESHOLD) handleClick(game, x, y);
    game.down = false;
    game.pressTarget = null;
  });

  canvas.addEventListener('pointerleave', () => { game.mx = -1; game.my = -1; updateHover(game); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => handleKey(game, e));
}

/* ------------------------------------------------------------- hovering */

export function updateHover(game) {
  const { mx, my } = game;
  game.tooltip = null;
  for (const v of game.handViews) v.hovered = false;
  for (const v of game.jokerViews) v.hovered = false;
  for (const v of game.consumViews) v.hovered = false;
  if (mx < 0) return;

  if (game.paused || game.deckPeek) return;

  // jokers (topmost first, right to left so overlaps favour the visible one)
  for (let i = game.jokerViews.length - 1; i >= 0; i--) {
    const v = game.jokerViews[i];
    if (hit(v, mx, my)) {
      v.hovered = true;
      const j = v.model;
      if (!j.faceDown) {
        game.setTooltip(
          `${j.def.name}  ·  ${j.def.rarity.toUpperCase()}`,
          describeJoker(j, game.ctxForDesc()) + (j.def.flavor ? `\n"${j.def.flavor}"` : ''),
          v.pos.x + 50, v.pos.y - 6, C[j.def.rarity] || C.text,
        );
      }
      if (!v.dragging) v.scale.to(1.06);
      return;
    } else if (!v.dragging) v.scale.to(1);
  }

  for (const v of game.consumViews) {
    if (hit(v, mx, my)) {
      v.hovered = true;
      game.setTooltip(v.model.def.name, v.model.def.desc, v.pos.x + 50, v.pos.y - 6, C.legendary);
      v.scale.to(1.06);
      return;
    } else v.scale.to(1);
  }

  if (game.scene === 'playing') {
    for (let i = game.handViews.length - 1; i >= 0; i--) {
      const v = game.handViews[i];
      if (hit(v, mx, my)) {
        v.hovered = true;
        if (!v.card.faceDown) describeCard(game, v);
        if (!game.hoverSound || game.hoverSound !== v.card.id) { S.sfxHover(); game.hoverSound = v.card.id; }
        return;
      }
    }
    game.hoverSound = null;
  }

  if (game.scene === 'shop') hoverShop(game);
  if (game.scene === 'blind_select') hoverBlindSelect(game);
}

function describeCard(game, v) {
  const c = v.card;
  const parts = [];
  if (c.enhancement) parts.push(`${ENHANCEMENT[c.enhancement].name}: ${ENHANCEMENT[c.enhancement].desc}`);
  if (c.edition) parts.push(`${EDITION[c.edition].name}: ${EDITION[c.edition].desc}`);
  if (c.seal) parts.push(`${SEAL[c.seal].name}: ${SEAL[c.seal].desc}`);
  if (c.debuffed) parts.push('Debuffed: scores nothing this blind.');
  if (!parts.length) return;
  game.setTooltip(null, parts.join('  ·  '), v.pos.x + 46, v.pos.y - 6);
}

function hoverShop(game) {
  const { mx, my } = game;
  const shop = game.run.shop;
  if (!shop) return;
  shopSlots(game).forEach((slot, i) => {
    const item = shop.cards[i];
    if (!item || item.kind === 'empty') return;
    if (!inRect(mx, my, { x: slot.x, y: slot.y, w: 100, h: 140 })) return;
    if (item.kind === 'joker') {
      game.setTooltip(`${item.def.name}  ·  ${item.rarity.toUpperCase()}${item.edition ? '  ·  ' + EDITION[item.edition].name : ''}`,
        item.def.description.replace(/[{}]/g, '') + (item.def.flavor ? `\n"${item.def.flavor}"` : ''),
        slot.x + 50, slot.y - 6, C[item.rarity]);
    } else {
      game.setTooltip(item.item.name, item.item.desc, slot.x + 50, slot.y - 6, C.legendary);
    }
  });
  if (shop.voucher && !shop.voucherBought && inRect(mx, my, { x: L.voucherSlot.x, y: L.voucherSlot.y, w: 100, h: 140 })) {
    const v = VOUCHER_BY_ID[shop.voucher];
    game.setTooltip(v.name, v.desc, L.voucherSlot.x + 50, L.voucherSlot.y - 6, C.good);
  }
  [L.pack1, L.pack2].forEach((slot, i) => {
    const p = game.run.shop.packs[i];
    if (!p || p.bought) return;
    if (inRect(mx, my, { x: slot.x, y: slot.y, w: 120, h: 176 })) {
      game.setTooltip(p.name, `Reveals ${p.show}, choose ${p.pick}.`, slot.x + 60, slot.y - 6, C.money);
    }
  });
}

function hoverBlindSelect(game) {
  const { mx, my } = game;
  const info = game.run.blindInfo();
  if (!info.boss) return;
  const col = bsColumn(2, game.run.blindIndex);
  if (inRect(mx, my, { x: col.x, y: col.y, w: col.w, h: 300 })) {
    game.setTooltip(info.boss.name, info.boss.desc, col.x + col.w / 2, col.y + 60, C.legendary);
  }
}

function hit(v, x, y) {
  return x >= v.pos.x && y >= v.pos.y && x <= v.pos.x + v.w && y <= v.pos.y + v.h;
}

/* -------------------------------------------------------------- dragging */

function pickDraggable(game, x, y) {
  for (let i = game.jokerViews.length - 1; i >= 0; i--) {
    const v = game.jokerViews[i];
    if (hit(v, x, y)) return { kind: 'joker', view: v };
  }
  if (game.scene === 'playing') {
    for (let i = game.handViews.length - 1; i >= 0; i--) {
      const v = game.handViews[i];
      if (hit(v, x, y)) return { kind: 'hand', view: v };
    }
  }
  return null;
}

function startDrag(game, x, y) {
  const t = game.pressTarget;
  if (!t) return;
  if (t.kind === 'joker' && game.run.boss()?.lockJokerOrder && game.run.blind?.type === 'boss') {
    game.toast('Shroud: Jokers are locked', true);
    game.pressTarget = null;
    return;
  }
  game.dragActive = t;
  t.view.setDragging(true);
  t.offX = x - t.view.pos.x;
  t.offY = y - t.view.pos.y;
  t.lastX = x;
  t.vx = 0;
}

function moveDrag(game, x, y) {
  const d = game.dragActive;
  const v = d.view;
  d.vx = d.vx * 0.7 + (x - d.lastX) * 0.3 * 60;
  d.lastX = x;
  v.pos.to(x - d.offX, y - d.offY);
  v.rot.to(Math.max(-14, Math.min(14, d.vx / 60)) * Math.PI / 180);

  // reorder when the dragged card crosses a neighbour's midpoint
  const list = d.kind === 'joker' ? game.run.jokers : game.run.hand;
  const views = d.kind === 'joker' ? game.jokerViews : game.handViews;
  const model = v.model || v.card;
  const from = list.indexOf(model);
  if (from < 0) return;
  const step = d.kind === 'joker' ? L.jokerSlotStep : (views.length > 1 ? Math.abs(views[1].pos.tx - views[0].pos.tx) || 100 : 100);
  const origin = d.kind === 'joker' ? jokerSlot(0).x : (views[0] ? views[0].pos.tx : 0);
  let to = Math.round((v.pos.x - origin) / step);
  to = Math.max(0, Math.min(list.length - 1, to));
  if (to !== from) {
    list.splice(from, 1);
    list.splice(to, 0, model);
    if (d.kind === 'joker') game.syncJokerViews();
    else game.syncHandPositions();
  }
}

function endDrag(game) {
  const d = game.dragActive;
  d.view.setDragging(false);
  game.dragActive = null;
  if (d.kind === 'joker') game.syncJokerViews();
  else game.syncHandPositions();
  S.sfxSelect();
}

/* --------------------------------------------------------------- clicks */

function handleClick(game, x, y) {
  if (game.paused) return clickPause(game, x, y);
  if (game.deckPeek) { game.deckPeek = false; return; }

  switch (game.scene) {
    case 'title': return clickTitle(game, x, y);
    case 'blind_select': return clickBlindSelect(game, x, y);
    case 'playing': return clickTable(game, x, y);
    case 'shop': return clickShop(game, x, y);
    case 'pack': return clickPack(game, x, y);
    case 'cash_out': return clickCashOut(game, x, y);
    case 'game_over': case 'win': return clickEnd(game, x, y);
  }
}

function clickTitle(game, x, y) {
  const sf = { x: 520, y: 508, w: 240, h: 40 };
  game.seedFocus = inRect(x, y, sf);
  for (const b of titleButtons(game)) {
    if (!inRect(x, y, b.rect) || b.disabled) continue;
    S.sfxClick();
    if (b.id === 'new') game.newRun(game.seedInput.trim() || undefined);
    else if (b.id === 'continue') { if (!game.loadRun()) game.toast('No saved run', true); }
    else if (b.id === 'howto') game.showHowTo = !game.showHowTo;
    return;
  }
}

function clickBlindSelect(game, x, y) {
  const run = game.run;
  const i = run.blindIndex;
  const col = bsColumn(i, i);
  const lx = x - col.x, ly = y - col.y;
  if (inRect(lx, ly, BS.select)) {
    S.sfxClick();
    game.startBlind();
    return;
  }
  if (i !== 2 && inRect(lx, ly, BS.skip)) {
    S.sfxTagged();
    const tagId = run.blindInfo(i).tagId;
    run.skipBlind();
    handleImmediateTags(game);
    game.toast(`Tag gained: ${TAG_BY_ID[tagId].name}`);
    game.save();
    return;
  }
  if (i === 2 && inRect(lx, ly, BS.reroll)) {
    if (run.rerollBoss()) { S.sfxReroll(); game.toast('New boss: ' + run.boss().name); }
    else game.toast('Cannot reroll', true);
    return;
  }
  if (inRect(x, y, L.optionsBtn)) game.paused = true;
  if (inRect(x, y, L.runInfoBtn)) game.deckPeek = true;
}

function handleImmediateTags(game) {
  for (const ev of game.run.drainEvents()) {
    if (ev.type === 'tag_immediate' && ev.tag.openPack) {
      game.run.openPack(ev.tag.openPack.type, ev.tag.openPack.size);
      game.scene = 'pack';
      S.sfxPackOpen();
      return;
    }
  }
}

function clickTable(game, x, y) {
  const run = game.run;
  if (game.anim) { game.anim.skip(); return; }
  if (game.busy) return;

  if (inRect(x, y, L.playBtn)) { game.play(); return; }
  if (inRect(x, y, L.discardBtn)) { game.discardSelected(); return; }
  if (inRect(x, y, L.sortRank)) { game.sortMode = 'rank'; game.syncHand(); S.sfxClick(); return; }
  if (inRect(x, y, L.sortSuit)) { game.sortMode = 'suit'; game.syncHand(); S.sfxClick(); return; }
  if (inRect(x, y, L.deckPile)) { game.deckPeek = true; S.sfxClick(); return; }
  if (inRect(x, y, L.optionsBtn)) { game.paused = true; return; }
  if (inRect(x, y, L.runInfoBtn)) { game.deckPeek = true; return; }

  // consumable: click to arm, click again to use on the selection
  for (const v of game.consumViews) {
    if (!hit(v, x, y)) continue;
    const c = v.model;
    if (game.pendingConsumable === c) {
      const sel = run.hand.filter(card => game.selected.has(card));
      const res = run.useConsumable(c, sel);
      if (res.error) game.toast(res.error, true);
      else {
        game.toast(res.message || c.def.name);
        S.sfxLevelUp();
        game.particles.emit(game.fx.levelStars(v.pos.x + 50, v.pos.y + 70, 14));
        game.selected.clear();
        game.syncConsumViews();
        game.syncHand();
        game.syncJokerViews();
        game.save();
      }
      game.pendingConsumable = null;
    } else {
      game.pendingConsumable = c;
      const [min, max] = c.def.select;
      game.toast(max > 0 ? `${c.def.name}: select ${min === max ? min : `${min}-${max}`} card${max === 1 ? '' : 's'}, then click again` : `${c.def.name}: click again to use`);
      S.sfxSelect();
    }
    return;
  }

  // sell a joker by clicking its sell tag
  for (const v of game.jokerViews) {
    if (!v.hovered) continue;
    const tag = { x: v.pos.x - 50, y: v.pos.y + 12, w: 46, h: 24 };
    if (inRect(x, y, tag)) {
      const j = v.model;
      run.sellJoker(j);
      S.sfxSell();
      game.syncJokerViews();
      game.save();
      return;
    }
  }

  // toggle card selection
  for (let i = game.handViews.length - 1; i >= 0; i--) {
    const v = game.handViews[i];
    if (!hit(v, x, y)) continue;
    const card = v.card;
    if (game.forcedCard === card) { game.toast('Basilisk holds this card', true); return; }
    if (game.selected.has(card)) { game.selected.delete(card); S.sfxDeselect(); }
    else {
      if (game.selected.size >= 5) { game.toast('At most 5 cards', true); return; }
      game.selected.add(card);
      S.sfxSelect();
    }
    game.syncHandPositions();
    return;
  }
}

function clickShop(game, x, y) {
  const run = game.run;
  const shop = run.shop;
  if (!shop) return;

  if (inRect(x, y, L.nextRoundBtn)) { S.sfxClick(); game.leaveShop(); return; }
  if (inRect(x, y, L.rerollBtn)) {
    if (run.reroll()) { S.sfxReroll(); game.save(); }
    else game.toast('Not enough money', true);
    return;
  }
  if (inRect(x, y, L.optionsBtn)) { game.paused = true; return; }
  if (inRect(x, y, L.deckPile) || inRect(x, y, L.runInfoBtn)) { game.deckPeek = true; return; }

  const slots = shopSlots(game);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!inRect(x, y, { x: s.x, y: s.y, w: 100, h: 140 })) continue;
    const res = run.buyShopCard(i);
    if (res.error) { game.toast(res.error, true); return; }
    S.sfxBuy();
    const item = res.joker;
    game.particles.emit(game.fx.purchase(s.x + 50, s.y + 70, item ? C[item.def.rarity] : C.legendary));
    game.syncJokerViews();
    game.syncConsumViews();
    game.save();
    return;
  }

  if (shop.voucher && !shop.voucherBought && inRect(x, y, { x: L.voucherSlot.x, y: L.voucherSlot.y, w: 100, h: 140 })) {
    const res = run.buyVoucher();
    if (res.error) game.toast(res.error, true);
    else {
      S.sfxBuy();
      game.toast(VOUCHER_BY_ID[shop.voucher].name + ' acquired');
      game.particles.emit(game.fx.purchase(L.voucherSlot.x + 50, L.voucherSlot.y + 70, C.good));
      game.save();
    }
    return;
  }

  [L.pack1, L.pack2].forEach((slot, i) => {
    if (!inRect(x, y, { x: slot.x, y: slot.y, w: 120, h: 176 })) return;
    const res = run.buyPack(i);
    if (res.error) { game.toast(res.error, true); return; }
    S.sfxPackOpen();
    game.scene = 'pack';
    game.selected.clear();
    game.save();
  });

  // sell jokers / use consumables from the shop too
  for (const v of game.jokerViews) {
    if (!v.hovered) continue;
    const tag = { x: v.pos.x - 50, y: v.pos.y + 12, w: 46, h: 24 };
    if (inRect(x, y, tag)) { run.sellJoker(v.model); S.sfxSell(); game.syncJokerViews(); game.save(); return; }
  }
  for (const v of game.consumViews) {
    if (!hit(v, x, y)) continue;
    const c = v.model;
    const res = run.useConsumable(c, []);
    if (res.error) game.toast(res.error, true);
    else { game.toast(res.message || c.def.name); S.sfxLevelUp(); game.syncConsumViews(); game.syncJokerViews(); game.save(); }
    return;
  }
}

function clickPack(game, x, y) {
  const run = game.run;
  const pack = run.pack;
  if (!pack) return;

  const done = { x: 540, y: 620, w: 200, h: 48 };
  if (inRect(x, y, done)) {
    S.sfxClick();
    run.closePack();
    game.scene = run.phase === 'shop' ? 'shop' : (run.blind ? 'playing' : 'blind_select');
    game.selected.clear();
    game.syncConsumViews();
    game.syncJokerViews();
    game.save();
    return;
  }

  const n = pack.items.length;
  const cw = pack.type === 'deck' ? 92 : 100;
  const chh = pack.type === 'deck' ? 128 : 140;
  const spacing = Math.min(140, 900 / n);
  for (let i = 0; i < n; i++) {
    const px = 640 + (i - (n - 1) / 2) * spacing - cw / 2;
    if (!inRect(x, y, { x: px, y: 200, w: cw, h: chh })) continue;
    const item = pack.items[i];
    // a consumable can be used straight out of the pack, on the shown hand
    if (item.kind === 'consumable' && game.selected.size > 0) {
      const sel = run.hand.filter(c => game.selected.has(c));
      const tmp = { id: item.item.id, def: item.item, cost: 3 };
      const gate = run.canUseConsumable(tmp, sel);
      if (gate.ok) {
        run.useConsumable(tmp, sel);
        pack.taken.add(i);
        pack.picksLeft--;
        game.selected.clear();
        game.toast(`Used ${item.item.name}`);
        S.sfxLevelUp();
        game.save();
        return;
      }
    }
    const res = run.takePackItem(i);
    if (res.error) game.toast(res.error, true);
    else {
      S.sfxBuy();
      game.particles.emit(game.fx.purchase(px + cw / 2, 270, C.money));
      game.syncJokerViews();
      game.syncConsumViews();
      game.save();
      if (pack.picksLeft <= 0) {
        game.timeline.delay(420, () => {
          run.closePack();
          game.scene = run.phase === 'shop' ? 'shop' : (run.blind ? 'playing' : 'blind_select');
          game.selected.clear();
        });
      }
    }
    return;
  }

  // selecting cards in the shown hand (for targeted consumables)
  if (run.hand.length) {
    const hs = Math.min(96, 800 / Math.max(1, run.hand.length - 1));
    run.hand.forEach((card, i) => {
      const px = 640 + (i - (run.hand.length - 1) / 2) * hs - 46;
      if (!inRect(x, y, { x: px, y: 420, w: 92 * 0.85, h: 128 * 0.85 })) return;
      if (game.selected.has(card)) game.selected.delete(card);
      else game.selected.add(card);
      S.sfxSelect();
    });
  }
}

function clickCashOut(game, x, y) {
  const r = L.cashOut;
  const btn = { x: r.x + 32, y: r.y + r.h - 72, w: r.w - 64, h: 52 };
  if (inRect(x, y, btn)) {
    S.sfxCoin();
    game.finishCashOut();
  }
}

function clickEnd(game, x, y) {
  const b1 = { x: 390, y: 528, w: 240, h: 56 };
  const b2 = { x: 650, y: 528, w: 240, h: 56 };
  if (inRect(x, y, b1)) {
    S.sfxClick();
    if (game.scene === 'win') {
      game.run.endless = true;
      game.run.won = false;
      game.run.advanceBlind();
      game.scene = 'blind_select';
      game.save();
    } else game.newRun(game.seedInput.trim() || undefined);
    return;
  }
  if (inRect(x, y, b2)) { S.sfxClick(); game.scene = 'title'; game.run = null; }
}

function clickPause(game, x, y) {
  const track = { x: 472, y: 216, w: 336, h: 24 };
  if (inRect(x, y, { ...track, y: track.y - 8, h: track.h + 16 })) {
    S.setMasterVolume(Math.round(((x - track.x) / track.w) * 100));
    S.sfxClick();
    return;
  }
  const rows = [[262, () => S.setMuted(!S.isMuted())], [302, () => { game.reduced = !game.reduced; }], [342, () => { game.shakeEnabled = !game.shakeEnabled; }]];
  for (const [ry, fn] of rows) {
    if (inRect(x, y, { x: 472, y: ry, w: 336, h: 26 })) { fn(); S.sfxClick(); return; }
  }
  if (inRect(x, y, { x: 472, y: 470, w: 336, h: 48 })) { game.paused = false; S.sfxClick(); return; }
  if (inRect(x, y, { x: 472, y: 530, w: 336, h: 40 })) {
    game.paused = false;
    game.clearSave();
    game.scene = 'title';
    game.run = null;
    S.sfxClick();
  }
}

/* ------------------------------------------------------------- keyboard */

function handleKey(game, e) {
  const k = e.key;
  if (game.scene === 'title' && game.seedFocus) {
    if (k === 'Backspace') { game.seedInput = game.seedInput.slice(0, -1); e.preventDefault(); return; }
    if (k === 'Enter') { game.seedFocus = false; game.newRun(game.seedInput.trim() || undefined); return; }
    if (k.length === 1 && /[A-Za-z0-9]/.test(k) && game.seedInput.length < 16) { game.seedInput += k.toUpperCase(); return; }
  }
  if (k === 'Escape') { game.paused = !game.paused; game.deckPeek = false; return; }
  if (!game.run) return;

  if (game.scene === 'playing' && !game.busy) {
    if (k === 'Enter' || k === ' ') { e.preventDefault(); game.play(); return; }
    if (k === 'Backspace' || k === 'x' || k === 'X') { e.preventDefault(); game.discardSelected(); return; }
    if (k === 'r' || k === 'R') { game.sortMode = 'rank'; game.syncHand(); return; }
    if (k === 's' || k === 'S') { game.sortMode = 'suit'; game.syncHand(); return; }
    if (k === 'd' || k === 'D') { game.deckPeek = !game.deckPeek; return; }
    if (/^[1-9]$/.test(k)) {
      const card = game.run.hand[Number(k) - 1];
      if (card) {
        if (game.selected.has(card)) game.selected.delete(card);
        else if (game.selected.size < 5) game.selected.add(card);
        game.syncHandPositions();
        S.sfxSelect();
      }
      return;
    }
    if (k === 'a' || k === 'A') { game.selected.clear(); game.syncHandPositions(); return; }
  }
  if (game.anim && (k === 'Enter' || k === ' ')) { e.preventDefault(); game.anim.skip(); }
}
