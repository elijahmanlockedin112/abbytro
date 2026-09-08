// Every rectangle in the game, at the logical 1280x720 resolution (FEEL.md section 3).
// Layout is data so hit-testing and drawing always agree.

export const W = 1280;
export const H = 720;

export const L = {
  // --- left sidebar ---
  sidebar:    { x: 16, y: 16, w: 232, h: 688 },
  blindPanel: { x: 24, y: 24, w: 216, h: 120 },
  blindDisc:  { cx: 56, cy: 86, r: 22 },
  blindBar:   { x: 32, y: 124, w: 200, h: 10 },
  scorePanel: { x: 24, y: 152, w: 216, h: 64 },
  chipsMult:  { x: 24, y: 224, w: 216, h: 72 },
  chipsBox:   { x: 32, y: 236, w: 90, h: 48 },
  multBox:    { x: 134, y: 236, w: 90, h: 48 },
  timesSign:  { x: 128, y: 260 },
  handType:   { x: 24, y: 304, w: 216, h: 36 },
  handsBox:   { x: 24, y: 348, w: 104, h: 60 },
  discardsBox:{ x: 136, y: 348, w: 104, h: 60 },
  moneyBox:   { x: 24, y: 416, w: 216, h: 52 },
  anteBox:    { x: 24, y: 476, w: 104, h: 52 },
  roundBox:   { x: 136, y: 476, w: 104, h: 52 },
  runInfoBtn: { x: 24, y: 536, w: 216, h: 40 },
  optionsBtn: { x: 24, y: 584, w: 216, h: 40 },

  // --- table ---
  jokerPanel:    { x: 264, y: 18, w: 560, h: 152 },
  jokerSlot0:    { x: 270, y: 24 },
  jokerSlotStep: 112,
  jokerLabel:    { x: 270, y: 178 },
  consumPanel:   { x: 860, y: 18, w: 224, h: 152 },
  consumSlot0:   { x: 866, y: 24 },
  consumSlotStep: 112,
  consumLabel:   { x: 866, y: 178 },

  banner:   { x: 720, y: 216 },
  staging:  { x: 404, y: 248, w: 632, h: 144, cy: 320, spacing: 104, scoringY: 308 },
  handArea: { x: 300, y: 440, w: 840, h: 128, cy: 504, maxSpacing: 100, span: 668 },

  playBtn:    { x: 452, y: 586, w: 200, h: 52 },
  sortPanel:  { x: 668, y: 586, w: 104, h: 52 },
  sortRank:   { x: 672, y: 590, w: 96, h: 22 },
  sortSuit:   { x: 672, y: 616, w: 96, h: 22 },
  discardBtn: { x: 788, y: 586, w: 200, h: 52 },

  deckPile:  { x: 1156, y: 552, w: 92, h: 128 },
  deckCount: { x: 1202, y: 700 },

  // --- shop --- (below the joker row, which stays visible while you buy)
  shopHeader:  { x: 288, y: 196, w: 964, h: 44 },
  nextRoundBtn:{ x: 296, y: 258, w: 180, h: 62 },
  rerollBtn:   { x: 296, y: 334, w: 180, h: 62 },
  shopCards:   { x: 500, y: 254, w: 340, h: 176 },
  shopSlotA:   { x: 556, y: 272 },
  shopSlotB:   { x: 684, y: 272 },
  voucherPanel:{ x: 872, y: 254, w: 360, h: 176 },
  voucherSlot: { x: 1002, y: 272 },
  packPanel:   { x: 500, y: 452, w: 732, h: 216 },
  pack1:       { x: 726, y: 474 },
  pack2:       { x: 886, y: 474 },
  shopHint:    { x: 866, y: 692 },

  // --- blind select ---
  // sits below the joker row, which stays visible while you choose
  bsHeader: { x: 764, y: 200 },
  bsCol:    [{ x: 294, y: 240 }, { x: 614, y: 240 }, { x: 934, y: 240 }],
  bsColSize:{ w: 300, h: 452 },

  // --- overlays ---
  overPanel:  { x: 340, y: 110, w: 600, h: 500 },
  pausePanel: { x: 440, y: 120, w: 400, h: 480 },
  cashOut:    { x: 440, y: 180, w: 400, h: 320 },
};

/** Joker slot i top-left. */
export function jokerSlot(i) {
  return { x: L.jokerSlot0.x + i * L.jokerSlotStep, y: L.jokerSlot0.y };
}
export function consumSlot(i) {
  return { x: L.consumSlot0.x + i * L.consumSlotStep, y: L.consumSlot0.y };
}

/**
 * Fan layout for n cards in the hand (FEEL.md section 3): centres, a gentle
 * rotation, and a slight arc so the row reads as a held hand rather than a grid.
 */
export function handLayout(n, i) {
  const spacing = Math.min(L.handArea.maxSpacing, L.handArea.span / Math.max(n - 1, 1));
  const off = i - (n - 1) / 2;
  return {
    x: 720 + off * spacing,
    y: L.handArea.cy + 6 * Math.pow(off / 3.5, 2),
    rot: off * 1.2 * Math.PI / 180,
  };
}

/** Staging slot for the k-th played card of m. */
export function stagingLayout(m, k, scoring) {
  const off = k - (m - 1) / 2;
  return {
    x: 720 + off * L.staging.spacing,
    y: scoring ? L.staging.scoringY : L.staging.cy,
    rot: 0,
  };
}

/** Blind-select column rect for index i, with the selected one lifted. */
export function bsColumn(i, current) {
  const base = L.bsCol[i];
  const sel = i === current;
  return {
    x: base.x, y: sel ? base.y - 12 : base.y,
    w: L.bsColSize.w, h: L.bsColSize.h,
    scale: sel ? 1 : 0.96, alpha: sel ? 1 : 0.85,
  };
}

/** Rects inside a blind-select column, in column-local coordinates. */
export const BS = {
  band:    { x: 0, y: 0, w: 300, h: 38 },
  disc:    { cx: 150, cy: 84, r: 30 },
  name:    { y: 132 },
  req:     { y: 160 },
  reward:  { y: 186 },
  desc:    { x: 22, y: 202, w: 256, h: 72 },
  tag:     { x: 22, y: 284, w: 256, h: 66 },
  select:  { x: 28, y: 362, w: 244, h: 46 },
  skip:    { x: 28, y: 412, w: 244, h: 32 },
  reroll:  { x: 28, y: 300, w: 244, h: 30 },
};

export function inRect(x, y, r) {
  return !!r && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

/** Hit test a card drawn at top-left (x,y) with size (w,h), allowing a scale. */
export function inCard(px, py, x, y, w, h) {
  return px >= x && py >= y && px <= x + w && py <= y + h;
}
