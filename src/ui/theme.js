// Palette, typography and small canvas helpers.
// Source of truth: design/FEEL.md §1 (identity & palette) and §2 (typography).
// Pure constants + stateless helpers; nothing here knows about game state.

// ---------------------------------------------------------------------------
// §1 Palette
// ---------------------------------------------------------------------------

export const C = {
  // ground
  felt: '#241F3D',
  feltGrainMax: 0.03,               // ±3% luminance noise tile
  panel: '#2C2747',
  panelBorder: '#3A3560',
  panelHighlight: 'rgba(255,255,255,0.06)',   // 1px top edge on every panel
  well: '#171426',
  ink: '#171426',                   // text outlines, card shadows, badge borders

  // text
  text: '#F3EFE6',
  text2: '#B8B2CC',
  textMuted: '#7C7793',

  // card paper
  paper: '#F7F1E3',
  paperBorder: '#C9C0AC',
  paperTop: 'rgba(255,255,255,0.6)',
  plate: '#EFE8D6',                 // joker description plate
  plateInk: '#2B2740',

  // suits
  hearts: '#E3405F',
  diamonds: '#1FA8A0',              // teal — deliberately distinct from chips-blue
  clubs: '#3E9E5A',
  spades: '#26253B',

  // scoring
  chips: '#4FA3FF',
  chipsDark: '#2B6FC4',
  mult: '#FF5A3C',
  multDark: '#B8302A',
  xmultA: '#FF5A3C',                // xMult plate gradient
  xmultB: '#FF2E7A',
  money: '#F5C542',
  moneyDark: '#B98A1C',
  moneyInk: '#3B2A00',

  // rarity
  common: '#7F8FA6',
  uncommon: '#3FBF7F',
  rare: '#E04B6A',
  legendary: '#B36BFF',
  legendarySheen: '#F5C542',

  // feedback
  good: '#4CE07E',
  bad: '#FF3860',
  disabled: '#4A4860',
  disabledText: '#8B879F',
  dim: 'rgba(12,10,24,0.72)',       // full-screen overlay dim
  cardDim: 'rgba(12,10,24,0.45)',   // per-card "not available" dim
  cardShadow: 'rgba(23,20,38,0.45)',

  // consumable families (§4 joker recipe 9)
  arcana: '#B36BFF',
  star: '#4FA3FF',
  phantom: '#1FA8A0',

  // description-plate token colours (§4 joker recipe 4)
  tokMult: '#B8302A',
  tokChips: '#2B6FC4',
  tokMoney: '#9A6E00',
  tokHand: '#4A3F8F',

  // card back (§1 card back recipe)
  backFill: '#33306B',
  backStripe: '#3B3877',
  backGold: '#E9D8A6',

  // enhancement papers / accents (§4.7)
  enhBonus: '#E6EEF9',
  enhMult: '#FBE6E0',
  enhLucky: '#E9F7E6',
  enhGlassEdge: '#BFEFFF',
  steelA: '#D9DCE3',
  steelB: '#AEB3BF',
  steelEdge: '#7C8493',
  stoneFill: '#8C8A85',
  stoneBlob: '#6E6C68',
  stoneEdge: '#5A5955',
  goldA: '#F2D27A',
  goldB: '#D9A93F',
  goldEdge: '#B98A1C',
  goldIndex: '#7A5A10',

  // edition accents (§4.8)
  foilEdge: '#BFD7FF',
  negPaper: '#1B1830',
  negEdge: '#8F7CFF',

  // seals (§4.9)
  sealRed: '#FF4E42',
  sealGold: '#F5C542',
  sealBlue: '#4FA3FF',
  sealPurple: '#B36BFF',
};

export const SUIT_COLOR = {
  hearts: C.hearts,
  diamonds: C.diamonds,
  clubs: C.clubs,
  spades: C.spades,
};

export const RARITY_COLOR = {
  common: C.common,
  uncommon: C.uncommon,
  rare: C.rare,
  legendary: C.legendary,
};

/** Consumable family band colours (§4 joker recipe 9). */
export const FAMILY_COLOR = {
  arcana: C.arcana,
  star: C.star,
  phantom: C.phantom,
};

/** Seal disc fills, keyed by the internal seal ids in core/rules.js. */
export const SEAL_COLOR = {
  red: C.sealRed,
  gold: C.sealGold,
  blue: C.sealBlue,
  purple: C.sealPurple,
};

/** Blind disc / bar colours (§3 left sidebar). */
export const BLIND_COLOR = { small: C.chips, big: C.money, boss: C.legendary };

/** Button palettes (§8). */
export const BTN = {
  play:      { fill: '#2F7BE0', bevel: '#1E5AB0', text: C.text },
  discard:   { fill: '#E04A3C', bevel: '#A8302A', text: C.text },
  nextRound: { fill: '#3E9E5A', bevel: '#2C7442', text: C.text },
  reroll:    { fill: '#E04A3C', bevel: '#A8302A', text: C.text },
  select:    { fill: '#F5C542', bevel: '#B98A1C', text: C.moneyInk },
  neutral:   { fill: '#3A3560', bevel: '#282546', text: C.text },
};

// ---------------------------------------------------------------------------
// §2 Typography
// ---------------------------------------------------------------------------

export const F = {
  display: '"Lilita One", "Arial Black", Impact, sans-serif',
  ui: 'Nunito, system-ui, "Segoe UI", sans-serif',
  emoji: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
};

/** Named text styles straight out of the §2 table: [size, family, weight, outline]. */
export const T = {
  score:      { size: 52, family: 'display', weight: 400, lineWidth: 5, maxWidth: 208 },
  counter:    { size: 34, family: 'display', weight: 400, lineWidth: 4, maxWidth: 82 },
  blindReq:   { size: 26, family: 'display', weight: 400, lineWidth: 3 },
  banner:     { size: 28, family: 'display', weight: 400, lineWidth: 4, letterSpacing: 1 },
  levelTag:   { size: 13, family: 'ui', weight: 800, letterSpacing: 0.5 },
  cardRank:   { size: 20, family: 'display', weight: 400, lineWidth: 0 },
  faceLetter: { size: 44, family: 'display', weight: 400, lineWidth: 3 },
  jokerName:  { size: 13, family: 'ui', weight: 800, letterSpacing: 0.3, lineWidth: 2 },
  jokerDesc:  { size: 11, family: 'ui', weight: 600, lineHeight: 14 },
  button:     { size: 16, family: 'display', weight: 400, letterSpacing: 0.5, lineWidth: 2 },
  tooltip:    { size: 12, family: 'ui', weight: 600, lineHeight: 16 },
  money:      { size: 26, family: 'display', weight: 400, lineWidth: 3 },
  popup:      { size: 22, family: 'display', weight: 400, lineWidth: 4 },
  popupX:     { size: 26, family: 'display', weight: 400, lineWidth: 4, letterSpacing: 0.5 },
  handsNum:   { size: 24, family: 'display', weight: 400, lineWidth: 3 },
  smallLabel: { size: 10, family: 'ui', weight: 800, letterSpacing: 1.2 },
};

// ---------------------------------------------------------------------------
// §3 Card metrics
// ---------------------------------------------------------------------------

export const CARD = { w: 92, h: 128, r: 8 };    // playing card
export const JOKER = { w: 100, h: 140, r: 10 }; // joker / consumable card
export const PACK = { w: 120, h: 176, r: 12 };  // booster pack

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const HAS_LETTER_SPACING =
  typeof CanvasRenderingContext2D !== 'undefined' &&
  'letterSpacing' in CanvasRenderingContext2D.prototype;

/** Canvas font string. `family` is 'display' | 'ui' | 'emoji' | a raw font stack. */
export function font(size, family = 'display', weight = 400) {
  const stack = F[family] || family;
  return weight + ' ' + size + 'px ' + stack;
}

/**
 * Outlined text (§2: strokeText with round joins, then fillText).
 * Mutates ctx font/align/baseline/stroke/fill — wrap in save()/restore() when that matters.
 * If `maxWidth` is set and the text overflows, the font auto-shrinks until it fits.
 * @returns {number} measured width of the drawn text.
 */
export function outlineText(ctx, text, x, y, o) {
  const str = text == null ? '' : String(text);
  const size = o.size ?? 16;
  const family = o.family ?? 'display';
  const weight = o.weight ?? 400;
  const ls = o.letterSpacing || 0;

  if (HAS_LETTER_SPACING) ctx.letterSpacing = ls ? ls + 'px' : '0px';

  let s = size;
  ctx.font = font(s, family, weight);
  let w = ctx.measureText(str).width;
  if (o.maxWidth && w > o.maxWidth && w > 0) {
    // proportional first guess, then walk down a px at a time (measure is non-linear
    // once hinting kicks in, so the guess alone can still overflow by a hair).
    s = Math.max(5, Math.floor(s * (o.maxWidth / w)));
    ctx.font = font(s, family, weight);
    w = ctx.measureText(str).width;
    while (w > o.maxWidth && s > 5) {
      s -= 1;
      ctx.font = font(s, family, weight);
      w = ctx.measureText(str).width;
    }
  }

  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';

  const lw = o.lineWidth ?? 0;
  if (lw > 0 && o.stroke !== null) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = o.stroke || C.ink;
    ctx.lineWidth = lw;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.fill || C.text;
  ctx.fillText(str, x, y);

  if (HAS_LETTER_SPACING && ls) ctx.letterSpacing = '0px';
  return w;
}

/** Plain (non-outlined) text convenience — same options, lineWidth defaults to 0. */
export function text(ctx, str, x, y, o) {
  return outlineText(ctx, str, x, y, o);
}

/**
 * Rounded-rect path only (no fill/stroke). `r` is a number or [tl, tr, br, bl].
 * Allocation-free: no arrays or objects are created per call.
 */
export function roundRect(ctx, x, y, w, h, r) {
  let tl, tr, br, bl;
  if (typeof r === 'number') { tl = tr = br = bl = r; }
  else { tl = r[0]; tr = r[1]; br = r[2]; bl = r[3]; }
  const m = Math.min(Math.abs(w), Math.abs(h)) / 2;
  if (tl > m) tl = m; if (tr > m) tr = m; if (br > m) br = m; if (bl > m) bl = m;
  if (tl < 0) tl = 0; if (tr < 0) tr = 0; if (br < 0) br = 0; if (bl < 0) bl = 0;
  const HP = Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arc(x + w - tr, y + tr, tr, -HP, 0);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arc(x + w - br, y + h - br, br, 0, HP);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arc(x + bl, y + h - bl, bl, HP, Math.PI);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arc(x + tl, y + tl, tl, Math.PI, Math.PI + HP);
  ctx.closePath();
}

const wrapCache = new Map();
const WRAP_CACHE_MAX = 600;

/**
 * Greedy word-wrap. `fontStr` is a full canvas font string (also applied to ctx).
 * Results are cached by font+width+text, so this is safe to call every frame.
 * @returns {string[]} lines
 */
export function wrapText(ctx, str, maxWidth, fontStr) {
  const s = str == null ? '' : String(str);
  const key = fontStr + '|' + maxWidth + '|' + s;
  const hit = wrapCache.get(key);
  ctx.font = fontStr;
  if (hit) return hit;

  const words = s.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const probe = line ? line + ' ' + words[i] : words[i];
    if (line && ctx.measureText(probe).width > maxWidth) {
      lines.push(line);
      line = words[i];
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  if (!lines.length) lines.push('');

  if (wrapCache.size > WRAP_CACHE_MAX) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}

/** Hard offset card shadow (§3: same rounded rect, offset (0,3), rgba(23,20,38,.45)). */
export function shadowRect(ctx, x, y, w, h, r, dy = 3, color = C.cardShadow) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y + dy, w, h, r);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Colour utilities (cached — these are called from per-frame draw code)
// ---------------------------------------------------------------------------

const rgbaCache = new Map();

/** '#RRGGBB' + alpha → 'rgba(r,g,b,a)'. Cached. */
export function withAlpha(hex, a) {
  const key = hex + '|' + a;
  let out = rgbaCache.get(key);
  if (out) return out;
  const n = parseInt(hex.slice(1), 16);
  out = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  if (rgbaCache.size > 512) rgbaCache.clear();
  rgbaCache.set(key, out);
  return out;
}

const lightenCache = new Map();

/** Raise a hex colour's HSL lightness by `pct` points (0..100). Cached. */
export function lighten(hex, pct) {
  const key = hex + '|' + pct;
  let out = lightenCache.get(key);
  if (out) return out;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const l2 = Math.min(1, l + pct / 100);
  out = hslToHex(h * 360, s * 100, l2 * 100);
  if (lightenCache.size > 512) lightenCache.clear();
  lightenCache.set(key, out);
  return out;
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const hx = (v) => {
    const t = Math.round((v + m) * 255).toString(16);
    return t.length < 2 ? '0' + t : t;
  };
  return '#' + hx(r) + hx(g) + hx(b);
}

// ---------------------------------------------------------------------------
// Gradient cache — gradients are built in *local* card space (after translate),
// so one cached object is reusable by every card at any screen position.
// ---------------------------------------------------------------------------

const gradPerCtx = new WeakMap();

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key   cache key; must encode every parameter `make` depends on
 * @param {(ctx:CanvasRenderingContext2D)=>CanvasGradient} make  module-level fn (no closures!)
 */
export function cachedGradient(ctx, key, make) {
  let m = gradPerCtx.get(ctx);
  if (!m) { m = new Map(); gradPerCtx.set(ctx, m); }
  let g = m.get(key);
  if (g === undefined) {
    g = make(ctx);
    if (m.size > 800) m.clear();
    m.set(key, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Easing (§ preamble) — handy for callers, free of state.
// ---------------------------------------------------------------------------

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
