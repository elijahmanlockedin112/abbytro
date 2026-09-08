// Every screen other than the table: title, blind select, shop, pack opening,
// cash out, game over, win, pause, deck inspector. (FEEL.md sections 3 and 11.)

import { C, F, font, outlineText, roundRect, shadowRect } from './theme.js';
import {
  drawCard, drawJokerCard, drawConsumableCard, drawCardBack, drawPanel,
  drawButton, drawProgressBar, drawEmptySlot, drawPack,
} from './draw.js';
import { L, W, H, BS, bsColumn, inRect } from './layout.js';
import { Ease, clamp } from './tween.js';
import { fmtScore, fmtNum, fmtMoney } from './fmt.js';
import { HAND_NAMES, HAND_TYPES } from '../core/hands.js';
import { TAG_BY_ID } from '../data/tags.js';
import { VOUCHER_BY_ID } from '../data/vouchers.js';
import { sortByRank } from '../core/hands.js';
import * as S from '../audio/sfx.js';

const LOGO = 'ABBYTRO';
const LOGO_COLORS = ['#F7F1E3', '#4FA3FF', '#FF5A3C', '#F5C542', '#1FA8A0', '#B36BFF', '#3E9E5A'];

/* ============================================================== drawing */

export const drawScreens = {

  title(g, ctx) {
    const t = g.titleT;
    // drifting card silhouettes
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 233 + t * 0.006) % (W + 200)) - 100;
      const y = 80 + ((i * 137) % 480) + Math.sin(t / 3000 + i) * 20;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t / 4000 + i * 2) * 0.3);
      roundRect(ctx, -60, -84, 120, 168, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // logo
    ctx.save();
    ctx.font = font(96, 'display');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const widths = [...LOGO].map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = 640 - total / 2;
    [...LOGO].forEach((ch, i) => {
      const cx = x + widths[i] / 2;
      const bob = g.reduced ? 0 : 4 * Math.sin(t / 2400 * Math.PI * 2 + i * 0.5);
      ctx.save();
      ctx.translate(cx, 230 + bob);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(ch, 0, 6);
      ctx.fillStyle = C.ink;
      ctx.fillText(ch, 0, 6);
      ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = LOGO_COLORS[i % LOGO_COLORS.length];
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += widths[i];
    });
    ctx.restore();

    outlineText(ctx, 'Poker hands. Absurd numbers. One deck.', 640, 296, {
      size: 14, family: 'ui', weight: 600, fill: C.text2, stroke: null,
    });

    const btns = titleButtons(g);
    for (const b of btns) {
      drawButton(ctx, b.rect, b.label, {
        fill: b.primary ? '#2F7BE0' : C.panelBorder,
        bevel: b.primary ? '#1E5AB0' : '#2A2648',
        textColor: b.disabled ? C.disabledText : '#FFFFFF',
        disabled: b.disabled,
        hover: !b.disabled && inRect(g.mx, g.my, b.rect),
        size: 16,
      });
      if (b.sub) outlineText(ctx, b.sub, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 11, { size: 10, family: 'ui', weight: 600, fill: C.textMuted, stroke: null });
    }

    // seed field
    const sf = { x: 520, y: 508, w: 240, h: 40 };
    roundRect(ctx, sf.x, sf.y, sf.w, sf.h, 8);
    ctx.fillStyle = C.well; ctx.fill();
    ctx.strokeStyle = g.seedFocus ? C.money : C.panelBorder;
    ctx.lineWidth = g.seedFocus ? 2 : 1; ctx.stroke();
    const seedText = g.seedInput || 'SEED — blank for random';
    outlineText(ctx, seedText + (g.seedFocus && Math.floor(t / 500) % 2 ? '|' : ''), sf.x + 12, sf.y + 20, {
      size: 13, family: 'ui', weight: 700, fill: g.seedInput ? C.text : C.textMuted, align: 'left', stroke: null, maxWidth: 216,
    });

    outlineText(ctx, TIPS_TITLE[g.tipIndex % TIPS_TITLE.length], 640, 620, {
      size: 13, family: 'ui', weight: 600, fill: C.textMuted, stroke: null,
    });
    outlineText(ctx, 'v0.1', W - 16, H - 14, { size: 10, family: 'ui', weight: 600, fill: C.textMuted, align: 'right', stroke: null });
  },

  blindSelect(g, ctx) {
    const run = g.run;
    outlineText(ctx, 'CHOOSE YOUR BLIND', L.bsHeader.x, L.bsHeader.y, { size: 26, fill: C.text, lineWidth: 4, letterSpacing: 1 });
    outlineText(ctx, `Ante ${run.ante} · Round ${run.round}`, L.bsHeader.x, L.bsHeader.y + 24, {
      size: 13, family: 'ui', weight: 600, fill: C.text2, stroke: null,
    });

    for (let i = 0; i < 3; i++) {
      const col = bsColumn(i, run.blindIndex);
      const info = run.blindInfo(i);
      const done = i < run.blindIndex;
      const current = i === run.blindIndex;
      ctx.save();
      ctx.globalAlpha = done ? 0.4 : col.alpha;
      ctx.translate(col.x + col.w / 2, col.y + col.h / 2);
      ctx.scale(col.scale, col.scale);
      ctx.translate(-col.w / 2, -col.h / 2);

      drawPanel(ctx, 0, 0, col.w, col.h, { r: 14 });
      const bcol = info.type === 'small' ? C.chips : info.type === 'big' ? C.money : C.legendary;
      roundRect(ctx, 0, 0, BS.band.w, BS.band.h, [14, 14, 0, 0]);
      ctx.fillStyle = bcol; ctx.fill();
      outlineText(ctx, info.type === 'boss' ? 'BOSS BLIND' : info.type === 'small' ? 'SMALL BLIND' : 'BIG BLIND', col.w / 2, BS.band.h / 2, {
        size: 15, fill: info.type === 'big' ? C.moneyInk : '#FFFFFF',
        stroke: info.type === 'big' ? null : C.ink, lineWidth: 2,
      });

      ctx.beginPath(); ctx.arc(BS.disc.cx, BS.disc.cy, BS.disc.r, 0, Math.PI * 2);
      ctx.fillStyle = bcol; ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
      if (info.boss) outlineText(ctx, info.boss.glyph, BS.disc.cx, BS.disc.cy + 1, { size: 28, fill: C.ink, stroke: null });

      if (info.boss) outlineText(ctx, info.boss.name, col.w / 2, BS.name.y, { size: 19, fill: C.text, lineWidth: 3, maxWidth: 260 });
      outlineText(ctx, fmtScore(info.req), col.w / 2, BS.req.y, { size: 28, fill: C.text, lineWidth: 4, maxWidth: 260 });
      outlineText(ctx, `Reward $${info.reward}`, col.w / 2, BS.reward.y, { size: 13, family: 'ui', weight: 800, fill: C.money, stroke: null });

      drawPanel(ctx, BS.desc.x, BS.desc.y, BS.desc.w, BS.desc.h, { fill: C.well, r: 8 });
      wrapInto(ctx, info.desc, BS.desc.x + 12, BS.desc.y + 18, BS.desc.w - 24, 16, { size: 12, family: 'ui', weight: 600, fill: C.text2 });

      if (info.type !== 'boss') {
        const tag = TAG_BY_ID[info.tagId];
        drawPanel(ctx, BS.tag.x, BS.tag.y, BS.tag.w, BS.tag.h, { fill: C.well, r: 8 });
        outlineText(ctx, (tag.glyph || '') + '  ' + tag.name, BS.tag.x + 12, BS.tag.y + 16, {
          size: 12, family: 'ui', weight: 800, fill: C.money, align: 'left', stroke: null,
        });
        wrapInto(ctx, tag.desc, BS.tag.x + 12, BS.tag.y + 34, BS.tag.w - 24, 14, { size: 11, family: 'ui', weight: 600, fill: C.text2 });
      } else if (current && run.voucherGrant('bossRerollsPerAnte', 0) > run.anteState.bossRerolls) {
        drawButton(ctx, BS.reroll, 'REROLL BOSS $10', {
          fill: C.panelBorder, bevel: '#2A2648', textColor: C.text, size: 12,
          hover: inRect(g.mx - col.x, g.my - col.y, BS.reroll),
        });
      }

      if (current) {
        drawButton(ctx, BS.select, 'SELECT', {
          fill: C.money, bevel: C.moneyDark, textColor: C.moneyInk,
          hover: inRect(g.mx - col.x, g.my - col.y, BS.select),
        });
        if (info.type !== 'boss') {
          drawButton(ctx, BS.skip, 'SKIP · TAKE TAG', {
            fill: 'transparent', bevel: null, outline: C.textMuted, textColor: C.text2, size: 13,
            hover: inRect(g.mx - col.x, g.my - col.y, BS.skip),
          });
        }
      } else if (done) {
        outlineText(ctx, 'CLEARED', col.w / 2, BS.select.y + 20, { size: 18, fill: C.good, lineWidth: 3 });
      }
      ctx.restore();
    }
  },

  shop(g, ctx) {
    const run = g.run;
    const shop = run.shop;
    if (!shop) return;

    outlineText(ctx, 'SHOP', L.shopHeader.x, L.shopHeader.y + 10, { size: 28, fill: C.text, align: 'left', lineWidth: 4 });
    outlineText(ctx, `Round ${run.round - 1} cleared`, L.shopHeader.x + 92, L.shopHeader.y + 14, {
      size: 13, family: 'ui', weight: 600, fill: C.textMuted, align: 'left', stroke: null,
    });
    outlineText(ctx, fmtMoney(Math.round(g.displayMoney)), L.shopHeader.x + L.shopHeader.w, L.shopHeader.y + 10, {
      size: 26, fill: C.money, align: 'right', lineWidth: 3,
    });

    drawButton(ctx, L.nextRoundBtn, 'NEXT ROUND', {
      fill: '#3E9E5A', bevel: '#2C7442', textColor: '#FFFFFF',
      hover: inRect(g.mx, g.my, L.nextRoundBtn),
    });
    const canReroll = run.canAfford(shop.rerollPrice);
    drawButton(ctx, L.rerollBtn, `REROLL $${shop.rerollPrice}`, {
      fill: '#E04A3C', bevel: '#A8302A', textColor: '#FFFFFF',
      disabled: !canReroll, hover: canReroll && inRect(g.mx, g.my, L.rerollBtn),
    });

    // card slots
    drawPanel(ctx, L.shopCards.x, L.shopCards.y, L.shopCards.w, L.shopCards.h, { r: 12 });
    outlineText(ctx, 'CARDS', L.shopCards.x + 12, L.shopCards.y - 10, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2 });
    shopSlots(g).forEach((slot, i) => {
      const item = shop.cards[i];
      if (!item || item.kind === 'empty') { drawEmptySlot(ctx, slot.x, slot.y, 100, 140); return; }
      const hover = inRect(g.mx, g.my, { x: slot.x, y: slot.y, w: 100, h: 140 });
      const opts = { t: g.t, price: item.price, hovered: hover, scale: hover ? 1.05 : 1 };
      if (item.kind === 'joker') {
        const fake = { def: item.def, edition: item.edition, disabled: false, counter: null };
        drawJokerCard(ctx, fake, slot.x, slot.y, { ...opts, description: item.def.description.replace(/\{(\w+)\}/g, (m, k) => tokenFromDef(item.def, k)) });
      } else {
        drawConsumableCard(ctx, { family: item.item.family, name: item.item.name, glyph: item.item.glyph, description: item.item.desc }, slot.x, slot.y, opts);
      }
    });

    // voucher
    drawPanel(ctx, L.voucherPanel.x, L.voucherPanel.y, L.voucherPanel.w, L.voucherPanel.h, { r: 12 });
    outlineText(ctx, 'VOUCHER', L.voucherPanel.x + 12, L.voucherPanel.y - 10, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2 });
    if (shop.voucher && !shop.voucherBought) {
      const v = VOUCHER_BY_ID[shop.voucher];
      const hover = inRect(g.mx, g.my, { x: L.voucherSlot.x, y: L.voucherSlot.y, w: 100, h: 140 });
      drawConsumableCard(ctx, { family: 'voucher', name: v.name, glyph: v.glyph, description: v.desc }, L.voucherSlot.x, L.voucherSlot.y, {
        t: g.t, price: run.price(v.price), hovered: hover, scale: hover ? 1.05 : 1, band: C.good,
      });
    } else {
      drawEmptySlot(ctx, L.voucherSlot.x, L.voucherSlot.y, 100, 140, shop.voucherBought ? 'BOUGHT' : 'NONE');
    }

    // packs
    drawPanel(ctx, L.packPanel.x, L.packPanel.y, L.packPanel.w, L.packPanel.h, { r: 12 });
    outlineText(ctx, 'BOOSTER PACKS', L.packPanel.x + 12, L.packPanel.y - 10, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2 });
    [L.pack1, L.pack2].forEach((slot, i) => {
      const pack = shop.packs[i];
      if (!pack || pack.bought) { drawEmptySlot(ctx, slot.x, slot.y, 120, 176, 'OPENED'); return; }
      const hover = inRect(g.mx, g.my, { x: slot.x, y: slot.y, w: 120, h: 176 });
      drawPack(ctx, pack, slot.x, slot.y, { t: g.t, hovered: hover, scale: hover ? 1.04 : 1, price: pack.price });
    });

    outlineText(ctx, TIPS_TITLE[g.tipIndex % TIPS_TITLE.length], L.shopHint.x, L.shopHint.y, {
      size: 12, family: 'ui', weight: 600, fill: C.textMuted, stroke: null,
    });
  },

  pack(g, ctx) {
    const run = g.run;
    const pack = run.pack;
    if (!pack) return;
    dim(ctx);
    const n = pack.items.length;
    const cw = pack.type === 'deck' ? 92 : 100;
    const spacing = Math.min(140, 900 / n);
    outlineText(ctx, pack.name.toUpperCase(), 640, 120, { size: 28, fill: C.text, lineWidth: 4, letterSpacing: 1 });
    outlineText(ctx, `Choose ${pack.picksLeft} more`, 640, 152, { size: 14, family: 'ui', weight: 700, fill: C.text2, stroke: null });

    pack.items.forEach((item, i) => {
      const x = 640 + (i - (n - 1) / 2) * spacing - cw / 2;
      const y = 200;
      if (pack.taken.has(i)) {
        ctx.save(); ctx.globalAlpha = 0.25;
        drawEmptySlot(ctx, x, y, cw, cw === 92 ? 128 : 140, 'TAKEN');
        ctx.restore();
        return;
      }
      const hover = inRect(g.mx, g.my, { x, y, w: cw, h: cw === 92 ? 128 : 140 });
      const opts = { t: g.t, hovered: hover, scale: hover ? 1.06 : 1 };
      if (item.kind === 'card') drawCard(ctx, item.card, x, y, opts);
      else if (item.kind === 'joker') {
        drawJokerCard(ctx, { def: item.def, edition: item.edition, counter: null }, x, y, {
          ...opts, description: item.def.description.replace(/\{(\w+)\}/g, (m, k) => tokenFromDef(item.def, k)),
        });
      } else {
        drawConsumableCard(ctx, { family: item.item.family, name: item.item.name, glyph: item.item.glyph, description: item.item.desc }, x, y, opts);
      }
    });

    // the hand is shown so targeted consumables can be used from the pack
    if (run.hand.length) {
      outlineText(ctx, 'YOUR HAND', 640, 396, { size: 11, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2 });
      const hs = Math.min(96, 800 / Math.max(1, run.hand.length - 1));
      run.hand.forEach((card, i) => {
        const x = 640 + (i - (run.hand.length - 1) / 2) * hs - 46;
        drawCard(ctx, card, x, 420, {
          t: g.t, scale: 0.85,
          highlight: g.selected.has(card) ? C.money : null,
        });
      });
    }

    drawButton(ctx, { x: 540, y: 620, w: 200, h: 48 }, pack.picksLeft > 0 ? 'SKIP' : 'DONE', {
      fill: C.panelBorder, bevel: '#2A2648', textColor: C.text,
      hover: inRect(g.mx, g.my, { x: 540, y: 620, w: 200, h: 48 }),
    });
  },

  cashOut(g, ctx) {
    dim(ctx);
    const r = L.cashOut;
    const rows = g.cashRows || [];
    const total = rows.reduce((a, x) => a + (x.amount || 0), 0);
    drawPanel(ctx, r.x, r.y, r.w, r.h, { r: 16 });
    outlineText(ctx, 'CASH OUT', r.x + r.w / 2, r.y + 40, { size: 30, fill: C.money, lineWidth: 4, letterSpacing: 1 });
    let y = r.y + 90;
    for (const row of rows) {
      if (row.note) continue;
      outlineText(ctx, row.label, r.x + 28, y, { size: 13, family: 'ui', weight: 700, fill: C.text2, align: 'left', stroke: null, maxWidth: 240 });
      outlineText(ctx, '+$' + row.amount, r.x + r.w - 28, y, { size: 16, fill: C.money, align: 'right', lineWidth: 3 });
      y += 30;
    }
    drawButton(ctx, { x: r.x + 32, y: r.y + r.h - 72, w: r.w - 64, h: 52 }, `CASH OUT $${total}`, {
      fill: C.money, bevel: C.moneyDark, textColor: C.moneyInk,
      hover: inRect(g.mx, g.my, { x: r.x + 32, y: r.y + r.h - 72, w: r.w - 64, h: 52 }),
    });
  },

  gameOver(g, ctx) { endPanel(g, ctx, false); },
  win(g, ctx) { endPanel(g, ctx, true); },

  pause(g, ctx) {
    dim(ctx);
    const r = L.pausePanel;
    drawPanel(ctx, r.x, r.y, r.w, r.h, { r: 16 });
    outlineText(ctx, 'PAUSED', r.x + r.w / 2, 160, { size: 32, fill: C.text, lineWidth: 4, letterSpacing: 1 });

    outlineText(ctx, 'VOLUME', 472, 204, { size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null, letterSpacing: 1.2 });
    const track = { x: 472, y: 216, w: 336, h: 24 };
    roundRect(ctx, track.x, track.y, track.w, track.h, 12);
    ctx.fillStyle = C.well; ctx.fill();
    const vol = S.getMasterVolume() / 100;
    roundRect(ctx, track.x, track.y, track.w * vol, track.h, 12);
    ctx.fillStyle = C.chips; ctx.fill();
    ctx.beginPath(); ctx.arc(track.x + track.w * vol, track.y + 12, 14, 0, Math.PI * 2);
    ctx.fillStyle = C.text; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();

    toggleRow(g, ctx, 'Mute', 262, S.isMuted());
    toggleRow(g, ctx, 'Reduced motion', 302, g.reduced);
    toggleRow(g, ctx, 'Screen shake', 342, g.shakeEnabled);

    drawButton(ctx, { x: 472, y: 470, w: 336, h: 48 }, 'RESUME', {
      fill: '#2F7BE0', bevel: '#1E5AB0', textColor: '#FFFFFF',
      hover: inRect(g.mx, g.my, { x: 472, y: 470, w: 336, h: 48 }),
    });
    drawButton(ctx, { x: 472, y: 530, w: 336, h: 40 }, 'ABANDON RUN', {
      fill: 'transparent', bevel: null, outline: C.bad, textColor: C.bad, size: 14,
      hover: inRect(g.mx, g.my, { x: 472, y: 530, w: 336, h: 40 }),
    });
  },

  deckPeek(g, ctx) {
    dim(ctx);
    const run = g.run;
    const cards = sortByRank(run.deck);
    outlineText(ctx, `YOUR DECK · ${run.deck.length} CARDS`, 640, 56, { size: 24, fill: C.text, lineWidth: 4, letterSpacing: 1 });
    const perRow = 13;
    const s = 0.62;
    const cw = 92 * s + 6, chh = 128 * s + 8;
    const rows = Math.ceil(cards.length / perRow);
    const startY = Math.max(90, 360 - (rows * chh) / 2);
    cards.forEach((card, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const x = 640 - (perRow * cw) / 2 + col * cw;
      const y = startY + row * chh;
      drawCard(ctx, card, x, y, { t: g.t, scale: s, shadow: false });
    });
    outlineText(ctx, 'Click anywhere to close', 640, H - 30, { size: 12, family: 'ui', weight: 600, fill: C.textMuted, stroke: null });
  },
};

/* ============================================================== helpers */

function endPanel(g, ctx, won) {
  dim(ctx);
  const r = L.overPanel;
  const run = g.run;
  drawPanel(ctx, r.x, r.y, r.w, r.h, { r: 16 });
  outlineText(ctx, won ? 'YOU BEAT ANTE 8' : 'RUN OVER', 640, 168, {
    size: won ? 40 : 48, fill: won ? C.money : C.bad, lineWidth: 5, maxWidth: 540,
  });
  const best = run.stats.bestHandType ? HAND_NAMES[run.stats.bestHandType] : '—';
  outlineText(ctx, won ? `Best hand ${best} · ${run.jokers.length} jokers` : `Ante ${run.ante} · Best hand ${best}`, 640, 208, {
    size: 14, family: 'ui', weight: 600, fill: C.text2, stroke: null,
  });

  const stats = [
    ['Rounds cleared', run.stats.roundsCleared],
    ['Hands played', run.stats.handsPlayed],
    ['Cards discarded', run.stats.discardsUsed],
    ['Best hand score', fmtScore(run.stats.bestHand)],
    ['Most played', mostPlayed(run)],
    ['Seed', run.seed],
  ];
  let y = 258;
  for (const [label, value] of stats) {
    outlineText(ctx, label, 380, y, { size: 13, family: 'ui', weight: 600, fill: C.text2, align: 'left', stroke: null });
    outlineText(ctx, String(value), 900, y, { size: 13, family: 'ui', weight: 800, fill: C.text, align: 'right', stroke: null });
    y += 34;
  }
  if (won) {
    outlineText(ctx, 'The deck is yours.', 640, y + 12, { size: 13, family: 'ui', weight: 600, fill: C.money, stroke: null });
  }

  const b1 = { x: 390, y: 528, w: 240, h: 56 };
  const b2 = { x: 650, y: 528, w: 240, h: 56 };
  drawButton(ctx, b1, won ? 'ENDLESS' : 'NEW RUN', {
    fill: '#2F7BE0', bevel: '#1E5AB0', textColor: '#FFFFFF', hover: inRect(g.mx, g.my, b1),
  });
  drawButton(ctx, b2, 'MAIN MENU', {
    fill: C.panelBorder, bevel: '#2A2648', textColor: C.text, hover: inRect(g.mx, g.my, b2),
  });
}

function mostPlayed(run) {
  let best = null, n = 0;
  for (const t of HAND_TYPES) if (run.handPlays[t] > n) { n = run.handPlays[t]; best = t; }
  return best ? `${HAND_NAMES[best]} (${n})` : '—';
}

function toggleRow(g, ctx, label, y, on) {
  outlineText(ctx, label, 472, y + 13, { size: 13, family: 'ui', weight: 700, fill: C.text, align: 'left', stroke: null });
  const px = 756;
  roundRect(ctx, px, y, 52, 26, 13);
  ctx.fillStyle = on ? C.good : C.well; ctx.fill();
  ctx.strokeStyle = C.panelBorder; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(px + (on ? 39 : 13), y + 13, 10, 0, Math.PI * 2);
  ctx.fillStyle = C.text; ctx.fill();
}

function dim(ctx) {
  ctx.fillStyle = C.dim;
  ctx.fillRect(0, 0, W, H);
}

function wrapInto(ctx, text, x, y, maxW, lineH, style) {
  ctx.font = font(style.size, style.family, style.weight);
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => outlineText(ctx, l, x, y + i * lineH, { ...style, align: 'left', stroke: null }));
  return lines.length;
}

function tokenFromDef(def, key) {
  for (const e of def.effects) {
    if (e.do && e.do[key] != null) return String(e.do[key]);
    if (e.scale && e.scale.stat === key) return String(e.scale.start ?? 0);
    if (e.passive && e.passive[key] != null) return String(e.passive[key]);
  }
  return key === 'counter' ? '0' : '?';
}

export function titleButtons(g) {
  return [
    { id: 'new', label: 'NEW RUN', rect: { x: 520, y: 340, w: 240, h: 52 }, primary: true },
    { id: 'continue', label: 'CONTINUE', rect: { x: 520, y: 406, w: 240, h: 52 }, disabled: !g.hasSave(), sub: g.hasSave() ? null : 'no saved run' },
    { id: 'howto', label: 'HOW TO PLAY', rect: { x: 520, y: 562, w: 240, h: 40 } },
  ];
}

export function shopSlots(g) {
  const n = g.run.shopCardSlots();
  const out = [];
  const cx = L.shopCards.x + L.shopCards.w / 2;
  const startX = cx - (n * 128 - 28) / 2;
  for (let i = 0; i < n; i++) out.push({ x: startX + i * 128, y: L.shopSlotA.y });
  return out;
}

export const TIPS_TITLE = [
  'Play fewer, bigger hands. Every unused hand pays $1.',
  'Mult multiplies Chips. ×Mult multiplies Mult. Order matters.',
  'Jokers trigger left to right. Drag to reorder them.',
  'Save a discard for the boss. You will want it.',
  'Star cards level a hand forever. Level the one you actually play.',
  'Interest pays $1 per $5 held, up to $5. Being rich is a strategy.',
];

export const HOWTO = [
  'Select up to 5 cards and PLAY HAND. Your hand\'s Chips × Mult is your score.',
  'Beat the blind\'s requirement before you run out of hands.',
  'Jokers change the math. They trigger left to right.',
  'Spend money in the shop between blinds. Interest rewards saving.',
];
