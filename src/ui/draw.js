// Procedural rendering of every card, token, panel and button.
// Implements FEEL.md section 4 (card recipes) and section 8 (button/panel motion).
// Pure drawing: no game state, no mutation. Every function takes a top-left
// (x, y) and leaves the context as it found it.

import {
  C, F, T, CARD, JOKER, PACK, SUIT_COLOR, RARITY_COLOR, FAMILY_COLOR, SEAL_COLOR,
  font, outlineText, roundRect, shadowRect, withAlpha, lighten, hslToHex, cachedGradient, clamp,
} from './theme.js';
import { isStone, isFace } from '../core/cards.js';

const TAU = Math.PI * 2;
const EMPTY = {};

/* ======================================================== suit glyphs (4.4) */

export function drawSuit(ctx, suit, cx, cy, s, color) {
  ctx.save();
  ctx.fillStyle = color || SUIT_COLOR[suit] || C.ink;
  ctx.beginPath();
  switch (suit) {
    case 'hearts':
      ctx.moveTo(cx, cy + 0.45 * s);
      ctx.bezierCurveTo(cx - 0.9 * s, cy - 0.2 * s, cx - 0.45 * s, cy - 0.65 * s, cx, cy - 0.25 * s);
      ctx.bezierCurveTo(cx + 0.45 * s, cy - 0.65 * s, cx + 0.9 * s, cy - 0.2 * s, cx, cy + 0.45 * s);
      ctx.fill();
      break;
    case 'diamonds':
      ctx.moveTo(cx, cy - 0.55 * s);
      ctx.lineTo(cx + 0.42 * s, cy);
      ctx.lineTo(cx, cy + 0.55 * s);
      ctx.lineTo(cx - 0.42 * s, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case 'clubs': {
      const r = 0.22 * s;
      ctx.arc(cx, cy - 0.22 * s, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 0.22 * s, cy + 0.06 * s, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 0.22 * s, cy + 0.06 * s, r, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 0.07 * s, cy + 0.05 * s);
      ctx.lineTo(cx + 0.07 * s, cy + 0.05 * s);
      ctx.lineTo(cx + 0.15 * s, cy + 0.5 * s);
      ctx.lineTo(cx - 0.15 * s, cy + 0.5 * s);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'spades': {
      // an inverted heart plus the club stem
      ctx.save();
      ctx.translate(cx, cy - 0.08 * s);
      ctx.scale(0.9, -0.9);
      ctx.beginPath();
      ctx.moveTo(0, 0.45 * s);
      ctx.bezierCurveTo(-0.9 * s, -0.2 * s, -0.45 * s, -0.65 * s, 0, -0.25 * s);
      ctx.bezierCurveTo(0.45 * s, -0.65 * s, 0.9 * s, -0.2 * s, 0, 0.45 * s);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx - 0.07 * s, cy + 0.08 * s);
      ctx.lineTo(cx + 0.07 * s, cy + 0.08 * s);
      ctx.lineTo(cx + 0.16 * s, cy + 0.5 * s);
      ctx.lineTo(cx - 0.16 * s, cy + 0.5 * s);
      ctx.closePath(); ctx.fill();
      break;
    }
    default:
      ctx.arc(cx, cy, s * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ====================================================== joker art shapes */

export function drawGlyphShape(ctx, shape, cx, cy, size, bg, fg) {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  switch (shape) {
    case 'diamond':
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case 'shield':
      ctx.moveTo(cx - r, cy - r * 0.9);
      ctx.lineTo(cx + r, cy - r * 0.9);
      ctx.lineTo(cx + r, cy + r * 0.2);
      ctx.quadraticCurveTo(cx + r, cy + r, cx, cy + r);
      ctx.quadraticCurveTo(cx - r, cy + r, cx - r, cy + r * 0.2);
      ctx.closePath();
      break;
    case 'burst': {
      const pts = 12;
      for (let i = 0; i < pts * 2; i++) {
        const rad = i % 2 ? r * 0.72 : r;
        const a = (i / (pts * 2)) * TAU - Math.PI / 2;
        const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'square':
      roundRect(ctx, cx - r, cy - r, size, size, 8);
      break;
    default:
      ctx.arc(cx, cy, r, 0, TAU);
  }
  ctx.fillStyle = bg || C.panelBorder;
  ctx.fill();
  if (fg) { ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

/* ========================================================== card backs (1) */

export function drawCardBack(ctx, x, y, opts = EMPTY) {
  const w = CARD.w, h = CARD.h, r = CARD.r;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
  ctx.translate(-w / 2, -h / 2);
  if (opts.shadow !== false) shadowRect(ctx, 0, 0, w, h, r, opts.shadowDy ?? 3);
  paintBack(ctx, w, h, r);
  ctx.restore();
}

function paintBack(ctx, w, h, r) {
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = C.backFill;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, 5, 5, w - 10, h - 10, 5);
  ctx.clip();
  ctx.fillStyle = C.backStripe;
  for (let i = -h; i < w + h; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 3, 0); ctx.lineTo(i + 3 + h, h); ctx.lineTo(i + h, h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = C.backGold;
  ctx.lineWidth = 2;
  roundRect(ctx, 5, 5, w - 10, h - 10, 5);
  ctx.stroke();

  // centre rhombus with the game's initial
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24); ctx.lineTo(cx + 17, cy); ctx.lineTo(cx, cy + 24); ctx.lineTo(cx - 17, cy);
  ctx.closePath();
  ctx.fillStyle = C.backGold; ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
  outlineText(ctx, 'A', cx, cy + 1, { size: 26, fill: C.backFill, stroke: null });

  ctx.fillStyle = C.backGold;
  for (const [dx, dy] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) {
    ctx.beginPath(); ctx.arc(dx, dy, 2, 0, TAU); ctx.fill();
  }
}

/* ======================================================= playing card (4) */

// Pip grid from FEEL.md 4.5: columns L/C/R, row sets A and B.
const PIP_L = 28, PIP_C = 46, PIP_R = 64;
const A1 = 28, A2 = 46, A3 = 64, A4 = 82, A5 = 100;
const B1 = 28, B2 = 52, B3 = 76, B4 = 100;
const PIPS = {
  '2': [[PIP_C, A1], [PIP_C, A5]],
  '3': [[PIP_C, A1], [PIP_C, A3], [PIP_C, A5]],
  '4': [[PIP_L, A1], [PIP_R, A1], [PIP_L, A5], [PIP_R, A5]],
  '5': [[PIP_L, A1], [PIP_R, A1], [PIP_C, A3], [PIP_L, A5], [PIP_R, A5]],
  '6': [[PIP_L, A1], [PIP_R, A1], [PIP_L, A3], [PIP_R, A3], [PIP_L, A5], [PIP_R, A5]],
  '7': [[PIP_L, A1], [PIP_R, A1], [PIP_C, 37], [PIP_L, A3], [PIP_R, A3], [PIP_L, A5], [PIP_R, A5]],
  '8': [[PIP_L, A1], [PIP_R, A1], [PIP_C, 37], [PIP_L, A3], [PIP_R, A3], [PIP_C, 91], [PIP_L, A5], [PIP_R, A5]],
  '9': [[PIP_L, B1], [PIP_R, B1], [PIP_L, B2], [PIP_R, B2], [PIP_C, 64], [PIP_L, B3], [PIP_R, B3], [PIP_L, B4], [PIP_R, B4]],
  '10': [[PIP_L, B1], [PIP_R, B1], [PIP_C, 40], [PIP_L, B2], [PIP_R, B2], [PIP_L, B3], [PIP_R, B3], [PIP_C, 88], [PIP_L, B4], [PIP_R, B4]],
};

/**
 * @param card {rank, suit, enhancement, edition, seal, bonusChips, debuffed, faceDown}
 * @param opts {t, scale, rot, alpha, shadow, shadowDy, highlight, selected, dim, flip}
 */
export function drawCard(ctx, card, x, y, opts = EMPTY) {
  const w = CARD.w, h = CARD.h, r = CARD.r;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.rot) ctx.rotate(opts.rot);
  let sx = opts.scale ?? 1;
  // mid-flight flip: squash horizontally through the halfway point
  if (opts.flip != null && opts.flip < 1) sx *= Math.abs(Math.cos(Math.PI * opts.flip));
  if (sx !== 1 || (opts.scale ?? 1) !== 1) ctx.scale(sx, opts.scale ?? 1);
  ctx.translate(-w / 2, -h / 2);

  if (opts.highlight) {
    ctx.save();
    ctx.shadowColor = opts.highlight;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = 3;
    roundRect(ctx, -1.5, -1.5, w + 3, h + 3, r + 1.5);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.shadow !== false) shadowRect(ctx, 0, 0, w, h, r, opts.shadowDy ?? 3);

  const faceDown = card.faceDown || (opts.flip != null && opts.flip < 0.5);
  if (faceDown) { paintBack(ctx, w, h, r); ctx.restore(); return; }

  const enh = card.enhancement;
  const suitColor = SUIT_COLOR[card.suit] || C.ink;
  const stone = isStone(card);

  // 2. paper (tinted by enhancement)
  roundRect(ctx, 0, 0, w, h, r);
  paintCardGround(ctx, card, enh, w, h);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();

  if (!stone) {
    // 3. corner indices
    paintIndex(ctx, card, suitColor, false);
    ctx.save();
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    paintIndex(ctx, card, suitColor, true);
    ctx.restore();

    // 5-6. centre
    if (card.rank === 'A') {
      ctx.save();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = suitColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(46, 64, 30, 0, TAU); ctx.stroke();
      ctx.restore();
      drawSuit(ctx, card.suit, 46, 64, 40, suitColor);
    } else if (isFace(card)) {
      paintFace(ctx, card, suitColor);
    } else {
      const pips = PIPS[card.rank];
      if (pips) {
        for (let i = 0; i < pips.length; i++) {
          const px = pips[i][0], py = pips[i][1];
          if (py > 64) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Math.PI);
            drawSuit(ctx, card.suit, 0, 0, 14, suitColor);
            ctx.restore();
          } else {
            drawSuit(ctx, card.suit, px, py, 14, suitColor);
          }
        }
      }
    }
  } else {
    paintStone(ctx, card, w, h);
  }

  paintEnhancementOverlay(ctx, enh, w, h);
  paintEdition(ctx, card.edition, w, h, r, opts.t || 0);
  ctx.restore();

  // border
  ctx.strokeStyle = enh === 'stone' ? C.stoneEdge : (card.edition === 'negative' ? C.negEdge : C.paperBorder);
  ctx.lineWidth = enh === 'stone' ? 2 : 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();

  // 9. seal
  if (card.seal) {
    const col = SEAL_COLOR[card.seal] || C.money;
    ctx.beginPath(); ctx.arc(78, 14, 8, 0, TAU);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(78, 14, 5, Math.PI, Math.PI * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // enhancement badge
  paintBadge(ctx, enh);

  // 10. debuffed
  if (card.debuffed) {
    roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = 'rgba(74,72,88,0.55)';
    ctx.fill();
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.strokeStyle = C.bad;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 16); ctx.lineTo(76, 112);
    ctx.moveTo(76, 16); ctx.lineTo(16, 112);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.dim) {
    roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = C.cardDim;
    ctx.fill();
  }
  ctx.restore();
}

function paintCardGround(ctx, card, enh, w, h) {
  if (card.edition === 'negative') { ctx.fillStyle = C.negPaper; return; }
  switch (enh) {
    case 'bonus': ctx.fillStyle = C.enhBonus; return;
    case 'mult': ctx.fillStyle = C.enhMult; return;
    case 'lucky': ctx.fillStyle = C.enhLucky; return;
    case 'stone': ctx.fillStyle = C.stoneFill; return;
    case 'steel': {
      const g = cachedGradient(ctx, 'steel' + h, () => {
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, C.steelA); gr.addColorStop(0.5, C.steelB); gr.addColorStop(1, C.steelA);
        return gr;
      });
      ctx.fillStyle = g; return;
    }
    case 'gold': {
      const g = cachedGradient(ctx, 'gold' + h, () => {
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, C.goldA); gr.addColorStop(1, C.goldB);
        return gr;
      });
      ctx.fillStyle = g; return;
    }
    case 'glass':
      ctx.fillStyle = withAlpha(C.paper, 0.55); return;
    default:
      ctx.fillStyle = C.paper;
  }
}

function paintIndex(ctx, card, color, flipped) {
  const neg = card.edition === 'negative';
  const col = neg ? (card.suit === 'spades' ? C.text : lighten(color, 25))
    : (card.enhancement === 'gold' ? C.goldIndex : color);
  outlineText(ctx, card.rank, 8, 16, { size: 20, fill: col, align: 'left', stroke: null });
  drawSuit(ctx, card.suit, 13, 34, 12, col);
}

function paintFace(ctx, card, color) {
  ctx.save();
  roundRect(ctx, 20, 30, 52, 68, 6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = withAlpha(color, 0.08);
  for (let i = -70; i < 100; i += 5) {
    ctx.beginPath();
    ctx.moveTo(20 + i, 30); ctx.lineTo(22.5 + i, 30); ctx.lineTo(22.5 + i + 68, 98); ctx.lineTo(20 + i + 68, 98);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = withAlpha(color, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();

  // crest above the letter
  ctx.fillStyle = color;
  if (card.rank === 'J') {
    drawSuit(ctx, card.suit, 46, 42, 12, color);
  } else if (card.rank === 'Q') {
    for (const cx of [38, 46, 54]) {
      ctx.beginPath();
      ctx.moveTo(cx - 4, 46); ctx.lineTo(cx, 38); ctx.lineTo(cx + 4, 46);
      ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.fillRect(34, 42, 24, 6);
    for (const cx of [38, 46, 54]) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, 42); ctx.lineTo(cx, 33); ctx.lineTo(cx + 5, 42);
      ctx.closePath(); ctx.fill();
    }
  }
  outlineText(ctx, card.rank, 46, 70, { size: 44, fill: color, stroke: C.paper, lineWidth: 3 });
  ctx.restore();
}

function paintStone(ctx, card, w, h) {
  // speckled grain so stone reads as a different material
  ctx.save();
  ctx.globalAlpha *= 0.16;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 46; i++) {
    const gx = (i * 37.7) % (w - 12) + 6;
    const gy = (i * 61.3) % (h - 12) + 6;
    ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, 22, 17, 0, 0, TAU);
  ctx.fillStyle = C.stoneBlob;
  ctx.fill();
  outlineText(ctx, '50', w / 2, h / 2 + 1, { size: 18, fill: C.text, stroke: null });
}

function paintEnhancementOverlay(ctx, enh, w, h) {
  switch (enh) {
    case 'bonus': case 'mult': case 'lucky': {
      const col = enh === 'bonus' ? C.chips : enh === 'mult' ? C.mult : C.clubs;
      ctx.save();
      ctx.globalAlpha *= 0.6;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      roundRect(ctx, 3, 3, w - 6, h - 6, 6);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'wild': {
      // a four-colour ribbon across the face
      ctx.save();
      ctx.globalAlpha *= 0.35;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = SUIT_COLOR[suits[i]];
        ctx.fillRect(-90, -8 + i * 4, 180, 4);
      }
      ctx.restore();
      break;
    }
    case 'glass': {
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.translate(0, 0);
      ctx.rotate(0);
      for (const [sx, sw] of [[20, 6], [34, 3]]) {
        ctx.beginPath();
        ctx.moveTo(sx, 0); ctx.lineTo(sx + sw, 0);
        ctx.lineTo(sx + sw + 60, h); ctx.lineTo(sx + 60, h);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = C.enhGlassEdge;
      ctx.lineWidth = 1.5;
      roundRect(ctx, 2, 2, w - 4, h - 4, 6);
      ctx.stroke();
      break;
    }
    case 'steel': {
      ctx.fillStyle = C.steelEdge;
      for (const [dx, dy] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) {
        ctx.beginPath(); ctx.arc(dx, dy, 2, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = C.steelEdge;
      ctx.lineWidth = 2;
      roundRect(ctx, 2, 2, w - 4, h - 4, 6);
      ctx.stroke();
      break;
    }
    case 'gold': {
      ctx.strokeStyle = C.goldEdge;
      ctx.lineWidth = 2;
      roundRect(ctx, 2, 2, w - 4, h - 4, 6);
      ctx.stroke();
      break;
    }
    default: break;
  }
}

const BADGE = {
  bonus: { color: C.chips, text: '+' },
  mult: { color: C.mult, text: 'M' },
  wild: { color: C.legendary, text: 'W' },
  gold: { color: C.money, text: '$' },
  glass: { color: C.enhGlassEdge, text: '◆' },
  steel: { color: C.steelEdge, text: '⬛' },
  lucky: { color: C.clubs, text: '♣' },
};

function paintBadge(ctx, enh) {
  const b = BADGE[enh];
  if (!b) return;
  ctx.beginPath(); ctx.arc(17, 111, 9, 0, TAU);
  ctx.fillStyle = b.color; ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
  outlineText(ctx, b.text, 17, 112, { size: 11, fill: '#FFFFFF', stroke: null });
}

/* --------------------------------------------------------- editions (4.8) */

function paintEdition(ctx, edition, w, h, r, t) {
  if (!edition) return;
  switch (edition) {
    case 'foil': {
      // a sheen band sweeping across, then a pause, on a 3s loop
      const period = 3000;
      const p = (t % period) / 2200;
      if (p <= 1) {
        const bx = -40 + p * 172;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(bx, 0, bx + 40, h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      ctx.strokeStyle = C.foilEdge;
      ctx.lineWidth = 2;
      roundRect(ctx, 1, 1, w - 2, h - 2, r);
      ctx.stroke();
      break;
    }
    case 'holo': {
      const hue = (t / 20) % 360;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, hslToHex(hue, 90, 65));
      g.addColorStop(0.5, hslToHex((hue + 120) % 360, 90, 65));
      g.addColorStop(1, hslToHex((hue + 240) % 360, 90, 65));
      ctx.save();
      ctx.globalAlpha *= 0.12;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      roundRect(ctx, 1.5, 1.5, w - 3, h - 3, r);
      ctx.stroke();
      break;
    }
    case 'poly': {
      const off = (t / 3000) % 1;
      const g = ctx.createLinearGradient(-w + off * w * 2, 0, w + off * w * 2, h);
      const stops = ['#FF5A3C', '#F5C542', '#3E9E5A', '#4FA3FF', '#B36BFF'];
      stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
      ctx.save();
      ctx.globalAlpha *= 0.3;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }
    case 'negative': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.25;
      const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w);
      g.addColorStop(0, C.negEdge);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }
    default: break;
  }
}

/* ================================================== joker / consumable card */

const HAND_WORDS = [
  'Straight Flush', 'Flush House', 'Flush Five', 'Five of a Kind', 'Four of a Kind',
  'Three of a Kind', 'Full House', 'Two Pair', 'High Card', 'Straight', 'Flush', 'Pair',
];
const NUM = '(?:\\d+(?:\\.\\d+)?|\\{\\w+\\})';
const TOKEN_RE = new RegExp(
  '(\\$' + NUM + ')' +
  '|([+\\-\\u00d7x]\\s?' + NUM + '\\s*(?:Mult|mult))' +
  '|([+\\-]\\s?' + NUM + '\\s*(?:Chips|chips))' +
  '|\\b(' + HAND_WORDS.join('|') + ')\\b',
  'g');

const layoutCache = new Map();

/** Word-wrap into colour-tagged runs. Cached, so per-frame calls are free. */
function layoutRuns(ctx, str, maxWidth, fontStr) {
  const key = fontStr + '|' + maxWidth + '|' + str;
  const hit = layoutCache.get(key);
  if (hit) return hit;

  ctx.font = fontStr;
  const segs = [];
  let last = 0, m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(str)) !== null) {
    if (m.index > last) segs.push({ s: str.slice(last, m.index), c: null, atom: false });
    const col = m[1] ? C.tokMoney : m[2] ? C.tokMult : m[3] ? C.tokChips : C.tokHand;
    segs.push({ s: m[0], c: col, atom: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) segs.push({ s: str.slice(last), c: null, atom: false });

  const words = [];
  for (const seg of segs) {
    if (seg.atom) {
      const s = seg.s.replace(/[{}]/g, '').trim();
      if (s) words.push({ s, c: seg.c });
    } else {
      for (const wd of seg.s.replace(/[{}]/g, '').split(/\s+/)) if (wd) words.push({ s: wd, c: null });
    }
  }

  const lines = [];
  let line = null, lineW = 0;
  const spaceW = ctx.measureText(' ').width;
  for (const wd of words) {
    const ww = ctx.measureText(wd.s).width;
    if (line && lineW + spaceW + ww > maxWidth) { lines.push(line); line = null; }
    if (!line) { line = []; lineW = 0; } else lineW += spaceW;
    line.push({ s: wd.s, c: wd.c, w: ww });
    lineW += ww;
    line.width = lineW;
  }
  if (line) lines.push(line);

  if (layoutCache.size > 600) layoutCache.clear();
  layoutCache.set(key, lines);
  return lines;
}

/**
 * Rules text runs to ~110 characters, far more than fits on the plate at a
 * fixed size, so the type shrinks rather than the text being cut off.
 */
const SIZE_STEPS = [11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7];
function fitRuns(ctx, str, maxWidth, maxHeight, weight = 600) {
  let best = null;
  for (const size of SIZE_STEPS) {
    const fontStr = font(size, 'ui', weight);
    const lineH = Math.round(size * 1.27 * 10) / 10;
    const maxLines = Math.max(1, Math.floor(maxHeight / lineH));
    const lines = layoutRuns(ctx, str, maxWidth, fontStr);
    best = { lines, fontStr, lineH, size };
    if (lines.length <= maxLines) return best;
  }
  const maxLines = Math.max(1, Math.floor(maxHeight / best.lineH));
  best.lines = best.lines.slice(0, maxLines);
  return best;
}

function drawRuns(ctx, line, cx, y, fontStr, defColor) {
  ctx.font = fontStr;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const spaceW = ctx.measureText(' ').width;
  let px = cx - line.width / 2;
  for (const run of line) {
    ctx.fillStyle = run.c || defColor;
    ctx.fillText(run.s, px, y);
    px += run.w + spaceW;
  }
}

/** Shared body of joker / consumable / voucher cards. */
function paintTokenCard(ctx, cfg, opts, w, h, r) {
  // paper + rarity border
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = C.paper;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();

  // name band
  roundRect(ctx, 0, 0, w, 26, [r, r, 0, 0]);
  ctx.fillStyle = cfg.band;
  ctx.fill();
  outlineText(ctx, cfg.name, w / 2, 13, {
    size: 13, family: 'ui', weight: 800, fill: '#FFFFFF', stroke: C.ink, lineWidth: 2, maxWidth: w - 8, letterSpacing: 0.3,
  });

  // glyph zone
  const gcx = w / 2, gcy = 58;
  const art = cfg.art;
  if (art && art.shape) {
    drawGlyphShape(ctx, art.shape, gcx, gcy, 52, art.bg || C.panelBorder, art.fg || null);
  } else {
    ctx.beginPath();
    ctx.arc(gcx, gcy, 26, 0, TAU);
    ctx.fillStyle = 'rgba(23,20,38,0.06)';
    ctx.fill();
  }
  if (cfg.glyph) {
    ctx.save();
    ctx.font = '40px ' + F.emoji;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(cfg.glyph, gcx, gcy + 2);
    ctx.restore();
  }

  // description plate: FEEL.md puts it at (6,92,88,42); 50px tall here so real
  // rules text fits once fitRuns has shrunk it.
  const PY = 84, PH = 50;
  roundRect(ctx, 6, PY, w - 12, PH, 5);
  ctx.fillStyle = C.plate;
  ctx.fill();
  if (cfg.desc) {
    const fit = fitRuns(ctx, cfg.desc, w - 18, PH - 6);
    const n = fit.lines.length;
    const y0 = PY + PH / 2 - ((n - 1) * fit.lineH) / 2;
    ctx.save();
    roundRect(ctx, 6, PY, w - 12, PH, 5);
    ctx.clip();
    for (let i = 0; i < n; i++) drawRuns(ctx, fit.lines[i], w / 2, y0 + i * fit.lineH, fit.fontStr, C.plateInk);
    ctx.restore();
  }

  if (cfg.legendary) {
    // gold sheen sweep on a 3s loop
    const p = ((opts.t || 0) % 3000) / 3000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.5;
    const bx = -30 + p * (w + 60);
    const g = ctx.createLinearGradient(bx, 0, bx + 24, h);
    g.addColorStop(0, 'rgba(245,197,66,0)');
    g.addColorStop(0.5, C.legendarySheen);
    g.addColorStop(1, 'rgba(245,197,66,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  paintEdition(ctx, cfg.edition, w, h, r, opts.t || 0);
  ctx.restore();

  ctx.strokeStyle = cfg.border;
  ctx.lineWidth = cfg.borderW;
  roundRect(ctx, cfg.borderW / 2, cfg.borderW / 2, w - cfg.borderW, h - cfg.borderW, r);
  ctx.stroke();

  if (cfg.disabled) {
    roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = 'rgba(40,38,60,0.62)';
    ctx.fill();
    outlineText(ctx, 'DISABLED', w / 2, h / 2, { size: 12, family: 'ui', weight: 800, fill: C.bad, stroke: C.ink, lineWidth: 2 });
  }
  if (cfg.counter != null) {
    roundRect(ctx, w - 36, 68, 30, 18, 9);
    ctx.fillStyle = C.well; ctx.fill();
    ctx.strokeStyle = C.money; ctx.lineWidth = 1; ctx.stroke();
    outlineText(ctx, String(cfg.counter), w - 21, 77, { size: 11, family: 'ui', weight: 800, fill: C.money, stroke: null });
  }
}

function paintTags(ctx, opts, w, h) {
  if (opts.price != null) {
    roundRect(ctx, w / 2 - 22, -14, 44, 22, 6);
    ctx.fillStyle = C.money; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    outlineText(ctx, opts.price === 0 ? 'FREE' : '$' + opts.price, w / 2, -3, {
      size: opts.price === 0 ? 12 : 15, fill: C.moneyInk, stroke: null,
    });
  }
  if (opts.sellValue != null) {
    roundRect(ctx, -50, 12, 46, 24, 6);
    ctx.fillStyle = C.panel; ctx.fill();
    ctx.strokeStyle = C.money; ctx.lineWidth = 1; ctx.stroke();
    outlineText(ctx, 'SELL $' + opts.sellValue, -27, 24, { size: 9, family: 'ui', weight: 800, fill: C.money, stroke: null });
  }
  if (opts.slotIndex != null) {
    outlineText(ctx, '#' + opts.slotIndex, 4, h - 8, {
      size: 10, family: 'ui', weight: 800, fill: C.textMuted, align: 'left', stroke: null,
    });
  }
}

/**
 * @param joker {def:{name, rarity, description, flavor, art}, edition, disabled, counter, faceDown}
 */
export function drawJokerCard(ctx, joker, x, y, opts = EMPTY) {
  const w = JOKER.w, h = JOKER.h, r = JOKER.r;
  const def = joker.def || joker;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
  ctx.translate(-w / 2, -h / 2);

  if (opts.highlight) {
    ctx.save();
    ctx.shadowColor = opts.highlight; ctx.shadowBlur = 14;
    ctx.strokeStyle = opts.highlight; ctx.lineWidth = 3;
    roundRect(ctx, -1.5, -1.5, w + 3, h + 3, r + 1.5);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.shadow !== false) shadowRect(ctx, 0, 0, w, h, r, opts.shadowDy ?? 3);

  if (opts.faceDown || joker.faceDown) {
    paintBack(ctx, w, h, r);
    ctx.restore();
    return;
  }

  JOKER_CFG.band = RARITY_COLOR[def.rarity] || C.common;
  JOKER_CFG.border = RARITY_COLOR[def.rarity] || C.common;
  JOKER_CFG.borderW = 3;
  JOKER_CFG.name = def.name || '';
  JOKER_CFG.glyph = (def.art && def.art.glyph) || '';
  JOKER_CFG.art = def.art || null;
  JOKER_CFG.desc = opts.description ?? def.description ?? '';
  JOKER_CFG.legendary = def.rarity === 'legendary';
  JOKER_CFG.edition = joker.edition || null;
  JOKER_CFG.disabled = !!joker.disabled;
  JOKER_CFG.counter = opts.showCounter === false ? null : (joker.counter || null);
  paintTokenCard(ctx, JOKER_CFG, opts, w, h, r);
  paintTags(ctx, opts, w, h);

  if (opts.dim) {
    roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = C.cardDim;
    ctx.fill();
  }
  ctx.restore();
}
const JOKER_CFG = {
  band: '', border: '', borderW: 3, name: '', glyph: '', art: null,
  desc: '', legendary: false, edition: null, disabled: false, counter: null,
};

/**
 * @param item {family:'arcana'|'star'|'phantom'|'voucher', name, glyph, description}
 */
export function drawConsumableCard(ctx, item, x, y, opts = EMPTY) {
  const w = JOKER.w, h = JOKER.h, r = JOKER.r;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
  ctx.translate(-w / 2, -h / 2);

  if (opts.highlight) {
    ctx.save();
    ctx.shadowColor = opts.highlight; ctx.shadowBlur = 14;
    ctx.strokeStyle = opts.highlight; ctx.lineWidth = 3;
    roundRect(ctx, -1.5, -1.5, w + 3, h + 3, r + 1.5);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.shadow !== false) shadowRect(ctx, 0, 0, w, h, r, opts.shadowDy ?? 3);

  CONS_CFG.band = opts.band || FAMILY_COLOR[item.family] || C.arcana;
  CONS_CFG.border = C.panelBorder;
  CONS_CFG.borderW = 2;
  CONS_CFG.name = item.name || '';
  CONS_CFG.glyph = item.glyph || '';
  CONS_CFG.art = null;
  CONS_CFG.desc = opts.description ?? item.description ?? '';
  CONS_CFG.legendary = false;
  CONS_CFG.edition = null;
  CONS_CFG.disabled = false;
  CONS_CFG.counter = null;
  paintTokenCard(ctx, CONS_CFG, opts, w, h, r);
  paintTags(ctx, opts, w, h);
  ctx.restore();
}
const CONS_CFG = {
  band: '', border: '', borderW: 2, name: '', glyph: '', art: null,
  desc: '', legendary: false, edition: null, disabled: false, counter: null,
};

/* ================================================= panels, buttons, bars (8) */

export function drawPanel(ctx, x, y, w, h, opts = EMPTY) {
  const r = opts.r ?? 12;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = opts.fill || (opts.well ? C.well : C.panel);
  ctx.fill();
  if (opts.border !== null) {
    ctx.strokeStyle = opts.border || C.panelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // 1px highlight along the top edge
  ctx.strokeStyle = C.panelHighlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 0.5);
  ctx.lineTo(x + w - r, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawButton(ctx, rect, label, opts = EMPTY) {
  const { x, y, w, h } = rect;
  const disabled = !!opts.disabled;
  const press = disabled ? 0 : clamp(opts.press || 0, 0, 1);
  const transparent = opts.fill === 'transparent';
  const bevelH = disabled || transparent || opts.bevel === null ? 0 : 4 - 3 * press;
  const dy = press * 3;
  const r = 10;

  ctx.save();
  ctx.globalAlpha *= disabled ? 0.7 : 1;

  if (bevelH > 0) {
    roundRect(ctx, x, y + dy, w, h + bevelH, r);
    ctx.fillStyle = opts.bevel || '#1E5AB0';
    ctx.fill();
  }

  roundRect(ctx, x, y + dy, w, h, r);
  if (transparent && !disabled) {
    ctx.strokeStyle = opts.outline || C.textMuted;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = disabled ? C.disabled : (opts.fill || '#2F7BE0');
    ctx.fill();
    if (opts.hover) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); }
  }
  if (transparent && opts.hover) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
  }

  if (label) {
    outlineText(ctx, label, x + w / 2, y + dy + h / 2, {
      size: opts.size ?? 16,
      family: opts.font || 'display',
      fill: disabled ? C.disabledText : (opts.textColor || C.text),
      stroke: disabled ? null : C.ink,
      lineWidth: 2,
      letterSpacing: 0.5,
      maxWidth: w - 16,
    });
  }
  ctx.restore();
}

export function drawProgressBar(ctx, x, y, w, h, frac, color) {
  const r = h / 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = C.well;
  ctx.fill();
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 1) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    roundRect(ctx, x, y, Math.max(fw, h), h, r);
    ctx.fillStyle = color || C.chips;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + fw - 2, y, 2, h);
    ctx.restore();
  }
}

export function drawCoin(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = C.money; ctx.fill();
  ctx.strokeStyle = C.moneyDark; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r - 3, Math.PI * 0.9, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

const DASH = [6, 5];
const NODASH = [];

export function drawEmptySlot(ctx, x, y, w = JOKER.w, h = JOKER.h, label = null) {
  const r = w >= PACK.w ? PACK.r : JOKER.r;
  ctx.save();
  ctx.strokeStyle = C.panelBorder;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(DASH);
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.stroke();
  ctx.setLineDash(NODASH);
  if (label) {
    outlineText(ctx, label, x + w / 2, y + h / 2, {
      size: 10, family: 'ui', weight: 800, fill: C.textMuted, stroke: null, letterSpacing: 1.2,
    });
  }
  ctx.restore();
}

const PACK_STYLE = {
  arcana: { color: '#B36BFF', glyph: '🔮' },
  star: { color: '#4FA3FF', glyph: '🌟' },
  deck: { color: '#3E9E5A', glyph: '🂠' },
  joker: { color: '#E04B6A', glyph: '🎭' },
  phantom: { color: '#1FA8A0', glyph: '👻' },
  grab: { color: '#F5C542', glyph: '🎁' },
};

/** @param pack {type, size, name, price, show, pick} */
export function drawPack(ctx, pack, x, y, opts = EMPTY) {
  const w = PACK.w, h = PACK.h, r = PACK.r;
  const style = PACK_STYLE[pack && pack.type] || PACK_STYLE.arcana;
  const color = style.color;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
  ctx.translate(-w / 2, -h / 2);
  if (opts.shadow !== false) shadowRect(ctx, 0, 0, w, h, r);

  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = C.panel;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  roundRect(ctx, 0, 0, w, 34, [r, r, 0, 0]);
  ctx.fillStyle = color;
  ctx.fill();
  outlineText(ctx, (pack && pack.name) || 'PACK', w / 2, 17, {
    size: 12, family: 'ui', weight: 800, fill: '#FFFFFF', stroke: C.ink, lineWidth: 2, maxWidth: w - 10,
  });
  ctx.save();
  ctx.font = '52px ' + F.emoji;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.glyph, w / 2, 92);
  ctx.restore();
  if (pack) {
    outlineText(ctx, `Reveal ${pack.show} · Choose ${pack.pick}`, w / 2, 146, {
      size: 10, family: 'ui', weight: 700, fill: C.text2, stroke: null, maxWidth: w - 12,
    });
  }
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, r - 1);
  ctx.stroke();

  paintTags(ctx, opts, w, h);
  ctx.restore();
}
