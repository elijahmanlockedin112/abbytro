// Seeded PRNG. Runs are fully reproducible from a seed string.
// xmur3 hashes the seed string to 32-bit state; sfc32 is the generator.

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = String(seed ?? Rng.randomSeed());
    const h = xmur3(this.seed);
    this._next = sfc32(h(), h(), h(), h());
    // sfc32 needs a few warm-up rounds to decorrelate from the seed.
    for (let i = 0; i < 12; i++) this._next();
  }

  static randomSeed() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  /** float in [0, 1) */
  next() { return this._next(); }

  /** integer in [0, n) */
  int(n) { return Math.floor(this._next() * n); }

  /** integer in [lo, hi] inclusive */
  range(lo, hi) { return lo + this.int(hi - lo + 1); }

  /** true with probability num/den */
  chance(num, den = 1) { return this._next() * den < num; }

  pick(arr) { return arr.length ? arr[this.int(arr.length)] : undefined; }

  /** weighted pick: items = [{ item, w }] */
  weighted(items) {
    let total = 0;
    for (const it of items) total += it.w;
    let r = this._next() * total;
    for (const it of items) {
      r -= it.w;
      if (r < 0) return it.item;
    }
    return items[items.length - 1]?.item;
  }

  /** in-place Fisher-Yates */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** derive an independent stream (e.g. for shop rerolls) */
  fork(label) { return new Rng(this.seed + ':' + label + ':' + this.int(1e9)); }
}
