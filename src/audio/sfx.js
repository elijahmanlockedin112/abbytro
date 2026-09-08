// Abbytro sound engine — every sound is synthesised at runtime with WebAudio.
// No audio files, no dependencies. Implements design/FEEL.md §9 recipe for recipe.
//
//   Graph: voices → sfxGain → masterGain → DynamicsCompressor → destination
//
// Browsers refuse to start an AudioContext outside a user gesture, so the context
// is built lazily by initAudio(); call it from a click/pointerdown handler. Until
// then every sfx* function is a silent no-op, so callers never need to guard.
//
// Envelope notation follows the spec: A/D/S/R in **milliseconds**, S as a level
// 0–1. One extension: H = hold, how long the sustain level is held before the
// release, needed by recipes phrased as "held for 400ms then R 60".

/* ------------------------------------------------------------------ state -- */

let ctx = null;          // AudioContext, null until initAudio()
let sfxGain = null;      // sfx bus (leaves room for a future music bus)
let masterGain = null;   // volume slider + mute
let comp = null;         // DynamicsCompressor
let noiseBuf = null;     // the one shared 1s white-noise buffer

let volume = 70;         // slider position 0..100
let muted = false;

let chipStep = 0;        // §9 scoring pitch ladder (semitones, +2 per trigger, cap +24)
let coinStep = 0;        // §8 coin ping ladder (+1 semitone per coin, reset per burst)
let lastHoverAt = -1e9;  // hover tick rate-limit (1 per 40ms)

const MAX_VOICES = 24;   // §9 "Max 24 voices; steal oldest"
const live = [];         // { src, env, nodes, t }

// Small debug hook used by the audio smoke test; also handy in the console.
// __sfxDebug.voices counts every voice ever created, .live the current count.
const dbg = (typeof globalThis !== 'undefined')
  ? (globalThis.__sfxDebug = { voices: 0, live: 0, stolen: 0, lastEvent: null })
  : { voices: 0, live: 0, stolen: 0, lastEvent: null };

/* ----------------------------------------------------------------- utils -- */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rand = (a, b) => a + Math.random() * (b - a);
/** semitones → frequency ratio */
const semi = n => Math.pow(2, n / 12);
/** cents → frequency ratio */
const cents = c => Math.pow(2, c / 1200);
/** exponential ramps may never touch 0 */
const EPS = 1e-4;

/** true once the context exists and can accept voices */
function ready() { return !!ctx && ctx.state !== 'closed'; }

/** Absolute schedule origin. The 6ms cushion gives the ±5ms start humanisation
 *  room to move in both directions without clamping against currentTime. */
function now() { return ctx.currentTime + 0.006; }

function targetGain() { return muted ? 0 : Math.pow(clamp(volume, 0, 100) / 100, 2); }

/* ------------------------------------------------------------ lifecycle -- */

/**
 * Create (or resume) the AudioContext. Must be called from a user gesture.
 * Safe to call on every click — it resumes a suspended context each time.
 * @returns {boolean} true when audio is usable
 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state !== 'closed';
  }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = null; return false; }

  // §9 graph, exactly.
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;

  masterGain = ctx.createGain();
  masterGain.gain.value = targetGain();

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 1;

  sfxGain.connect(masterGain);
  masterGain.connect(comp);
  comp.connect(ctx.destination);

  // One shared 1s white-noise buffer, reused by every noise voice.
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  dbg.ctx = ctx;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

/** Master slider 0–100 → gain = (v/100)^2, ramped over 20ms. */
export function setMasterVolume(v) {
  volume = clamp(Number(v) || 0, 0, 100);
  if (masterGain) rampMaster();
  return volume;
}
export function getMasterVolume() { return volume; }

export function setMuted(on) {
  muted = !!on;
  if (masterGain) rampMaster();
  return muted;
}
export function isMuted() { return muted; }

function rampMaster() {
  const t = ctx.currentTime;
  const g = masterGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(targetGain(), t + 0.02);
}

/* ------------------------------------------------------ voice management -- */

/** §9 "Max 24 voices; steal oldest" */
function register(src, env, nodes, t) {
  while (live.length >= MAX_VOICES) stealOldest();
  const v = { src, env, nodes, t };
  live.push(v);
  dbg.voices++; dbg.live = live.length;
  src.onended = () => {
    const i = live.indexOf(v);
    if (i >= 0) live.splice(i, 1);
    dbg.live = live.length;
    for (const n of nodes) { try { n.disconnect(); } catch { /* already gone */ } }
  };
}

function stealOldest() {
  let oldest = 0;
  for (let i = 1; i < live.length; i++) if (live[i].t < live[oldest].t) oldest = i;
  const v = live.splice(oldest, 1)[0];
  dbg.stolen++; dbg.live = live.length;
  const t = ctx.currentTime;
  try {
    v.env.gain.cancelScheduledValues(t);
    v.env.gain.setValueAtTime(v.env.gain.value, t);
    v.env.gain.linearRampToValueAtTime(0, t + 0.005); // fade, never a click
    v.src.stop(t + 0.006);
  } catch { /* voice already finished */ }
}

/* ------------------------------------------------------- voice builders -- */

/**
 * ADSR (+hold) on a fresh GainNode. Always starts from 0 with a ≥1ms ramp so a
 * voice can never click in. Exponential decay (never to/from 0), linear release.
 * @returns {{env: GainNode, end: number}}
 */
function envelope(t0, o, peak) {
  const a = Math.max(o.A == null ? 2 : o.A, 1) / 1000;
  const d = Math.max(o.D == null ? 120 : o.D, 1) / 1000;
  const h = Math.max(o.H || 0, 0) / 1000;
  const r = Math.max(o.R == null ? 60 : o.R, 1) / 1000;
  const sus = Math.max(peak * (o.S || 0), peak * 1e-3, EPS);

  const env = ctx.createGain();
  const g = env.gain;
  g.setValueAtTime(0, t0);
  g.linearRampToValueAtTime(peak, t0 + a);
  g.exponentialRampToValueAtTime(sus, t0 + a + d);
  if (h > 0) g.setValueAtTime(sus, t0 + a + d + h);
  g.linearRampToValueAtTime(0, t0 + a + d + h + r);
  return { env, end: t0 + a + d + h + r + 0.01 };
}

/** BiquadFilter with an optional exponential sweep (`fEnd` over `sweep` ms). */
function biquad(t0, f) {
  const bq = ctx.createBiquadFilter();
  bq.type = f.type || 'lowpass';
  bq.Q.value = f.Q == null ? 0.7 : f.Q;
  bq.frequency.setValueAtTime(clamp(f.f || 1000, 20, 20000), t0);
  if (f.fEnd > 0 && f.sweep > 0) {
    bq.frequency.exponentialRampToValueAtTime(clamp(f.fEnd, 20, 20000), t0 + f.sweep / 1000);
  }
  return bq;
}

/** Humanised start time (±5ms), never before the context clock. */
function startAt(when) {
  return Math.max(ctx.currentTime, (when || now()) + rand(-0.005, 0.005));
}

/**
 * One oscillator voice.
 * @param {object} o
 * @param {string} [o.type]    oscillator waveform
 * @param {number} [o.f]       start frequency (Hz)
 * @param {number} [o.fEnd]    glide target (Hz)
 * @param {number} [o.glide]   glide duration (ms)
 * @param {number} [o.detune]  static detune (cents), e.g. the −8 cent game-over pair
 * @param {number} [o.A] [o.D] [o.S] [o.H] [o.R]  envelope, ms (S is a 0–1 level)
 * @param {number} [o.gain]    peak gain before humanisation
 * @param {object} [o.filter]  {type, f, Q, fEnd, sweep}
 * @param {number} [o.when]    absolute AudioContext time (seconds); defaults to now()
 * @param {number} [o.pan]     −1..1
 * @param {function} [o.fCurve] x∈[0,1] → Hz, sampled over o.fCurveMs (overrides glide)
 * @param {object} [o.vib]     {rate, cents} vibrato LFO on detune
 */
function tone(o = {}) {
  if (!ready()) return null;
  const t0 = startAt(o.when);
  const peak = Math.max(EPS, (o.gain == null ? 0.2 : o.gain) * rand(0.92, 1.08)); // gain ±8%
  const base = Math.max(1, o.f || 440);
  const ratio = cents(rand(-3, 3));                                              // pitch ±3 cents
  const { env, end } = envelope(t0, o, peak);

  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  if (o.detune) osc.detune.setValueAtTime(o.detune, t0);

  if (o.fCurve) {
    const N = 64, c = new Float32Array(N);
    for (let i = 0; i < N; i++) c[i] = Math.max(1, o.fCurve(i / (N - 1)) * ratio);
    osc.frequency.setValueCurveAtTime(c, t0, Math.max(0.02, (o.fCurveMs || 400) / 1000));
  } else {
    osc.frequency.setValueAtTime(base * ratio, t0);
    if (o.fEnd > 0 && (o.glide || 0) > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.fEnd * ratio), t0 + o.glide / 1000);
    }
  }

  const nodes = [osc];
  let head = osc;
  if (o.filter) { const bq = biquad(t0, o.filter); head.connect(bq); head = bq; nodes.push(bq); }
  head.connect(env); nodes.push(env);
  head = env;
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(clamp(o.pan, -1, 1), t0);
    head.connect(p); head = p; nodes.push(p);
  }
  head.connect(sfxGain);

  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(o.vib.rate, t0);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(o.vib.cents, t0);
    lfo.connect(lg); lg.connect(osc.detune);
    lfo.start(t0); lfo.stop(end);
    register(lfo, lg, [lfo, lg], t0);
  }

  osc.start(t0); osc.stop(end);
  register(osc, env, nodes, t0);
  return { osc, env, t0, end };
}

/**
 * One noise voice: the shared white-noise buffer through a BiquadFilter.
 * Same envelope/humanisation contract as tone(). `sweep` may be given at the top
 * level as a shorthand for filter.sweep.
 * @param {object} o {filter:{type,f,Q,fEnd,sweep}, A, D, S, H, R, gain, when, sweep, pan}
 */
function noise(o = {}) {
  if (!ready()) return null;
  const t0 = startAt(o.when);
  const peak = Math.max(EPS, (o.gain == null ? 0.2 : o.gain) * rand(0.92, 1.08));
  const { env, end } = envelope(t0, o, peak);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.loopStart = 0; src.loopEnd = noiseBuf.duration;
  src.playbackRate.setValueAtTime(cents(rand(-3, 3)), t0);

  const nodes = [src];
  let head = src;
  const f = o.filter ? { ...o.filter } : null;
  if (f) {
    if (o.sweep && !f.sweep) f.sweep = o.sweep;
    const bq = biquad(t0, f); head.connect(bq); head = bq; nodes.push(bq);
  }
  head.connect(env); nodes.push(env);
  head = env;
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(clamp(o.pan, -1, 1), t0);
    head.connect(p); head = p; nodes.push(p);
  }
  head.connect(sfxGain);

  // Random read offset so repeated bursts never sound identical.
  src.start(t0, rand(0, noiseBuf.duration * 0.9));
  src.stop(end);
  register(src, env, nodes, t0);
  return { src, env, t0, end };
}

/* ---------------------------------------------------------- pitch ladder -- */

/** §9: chipStep resets to 0 on Play Hand and after the final multiply. */
export function resetChipStep() { chipStep = 0; }
/** §8: the coin ping ladder resets per burst. */
export function resetCoinStep() { coinStep = 0; }

/** §9 "chipStep += 2 per successive trigger (any type), cap +24" */
function advanceChip() { chipStep = Math.min(chipStep + 2, 24); }

/* --------------------------------------------------------------- events -- */

/** Card hover tick — square 1800→1400 over 20ms, lowpass 3k, A1 D25 S0 R10, gain .08,
 *  freq ±5%, rate-limited to 1 per 40ms. */
export function sfxHover() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (t - lastHoverAt < 0.04) return;
  lastHoverAt = t;
  dbg.lastEvent = 'hover';
  const k = rand(0.95, 1.05);
  tone({ type: 'square', f: 1800 * k, fEnd: 1400 * k, glide: 20,
    filter: { type: 'lowpass', f: 3000, Q: 0.7 }, A: 1, D: 25, S: 0, R: 10, gain: 0.08 });
}

/** Card select — triangle 520→780 glide 40, A2 D70 S0 R40, gain .25;
 *  + noise click highpass 4k, 15ms, gain .10. */
export function sfxSelect() {
  if (!ready()) return;
  dbg.lastEvent = 'select';
  const t = now();
  tone({ type: 'triangle', f: 520, fEnd: 780, glide: 40, A: 2, D: 70, S: 0, R: 40, gain: 0.25, when: t });
  noise({ filter: { type: 'highpass', f: 4000, Q: 0.7 }, A: 1, D: 9, S: 0, R: 5, gain: 0.10, when: t });
}

/** Card deselect — triangle 640→420 glide 50, A2 D60 S0 R40, gain .20. */
export function sfxDeselect() {
  if (!ready()) return;
  dbg.lastEvent = 'deselect';
  tone({ type: 'triangle', f: 640, fEnd: 420, glide: 50, A: 2, D: 60, S: 0, R: 40, gain: 0.20 });
}

/** Deal card i — noise bandpass 2500 Q1.2, A1 D45 S0 R30, gain .18;
 *  + sine 300 + 30*i Hz, A1 D60, gain .12. Panned slightly by slot. */
export function sfxDeal(index = 0) {
  if (!ready()) return;
  dbg.lastEvent = 'deal';
  const t = now();
  const pan = clamp((index - 3.5) * 0.08, -0.5, 0.5);
  noise({ filter: { type: 'bandpass', f: 2500, Q: 1.2 }, A: 1, D: 45, S: 0, R: 30, gain: 0.18, when: t, pan });
  tone({ type: 'sine', f: 300 + 30 * index, A: 1, D: 60, S: 0, R: 30, gain: 0.12, when: t, pan });
}

/** Play hand whoosh — noise bandpass 400→2400 over 220ms (Q .8), A20 D180 S0 R100,
 *  gain .30; + sawtooth 90→60, lowpass 200, 180ms, gain .20. Resets the ladder. */
export function sfxPlayHand() {
  if (!ready()) return;
  dbg.lastEvent = 'playHand';
  resetChipStep();
  const t = now();
  noise({ filter: { type: 'bandpass', f: 400, Q: 0.8, fEnd: 2400, sweep: 220 },
    A: 20, D: 180, S: 0, R: 100, gain: 0.30, when: t });
  tone({ type: 'sawtooth', f: 90, fEnd: 60, glide: 180, filter: { type: 'lowpass', f: 200, Q: 0.7 },
    A: 5, D: 120, S: 0, R: 55, gain: 0.20, when: t });
}

/** Discard — the play whoosh, shorter, drier and pitched down (§6 discard fly-off). */
export function sfxDiscard() {
  if (!ready()) return;
  dbg.lastEvent = 'discard';
  const t = now();
  noise({ filter: { type: 'bandpass', f: 300, Q: 0.8, fEnd: 1200, sweep: 120 },
    A: 10, D: 90, S: 0, R: 45, gain: 0.22, when: t });
  tone({ type: 'sawtooth', f: 70, fEnd: 45, glide: 120, filter: { type: 'lowpass', f: 160, Q: 0.7 },
    A: 4, D: 80, S: 0, R: 40, gain: 0.16, when: t });
}

/** Chip gain — square at f = 660 * 2^(chipStep/12), chirp f*1.06 → f over 30ms,
 *  lowpass 4k Q2, A1 D90 S0 R40, gain .22. Then advances the ladder. */
export function sfxChip() {
  if (!ready()) return;
  dbg.lastEvent = 'chip';
  const f = 660 * semi(chipStep);
  tone({ type: 'square', f: f * 1.06, fEnd: f, glide: 30,
    filter: { type: 'lowpass', f: 4000, Q: 2 }, A: 1, D: 90, S: 0, R: 40, gain: 0.22 });
  advanceChip();
}

/** Mult gain — triangle at f = 220 * 2^(chipStep/12) + sine one octave below, rising
 *  into pitch from f*0.94 over 60ms, lowpass 1800, A2 D140 S0 R80, gain .28. */
export function sfxMult() {
  if (!ready()) return;
  dbg.lastEvent = 'mult';
  const f = 220 * semi(chipStep);
  const t = now();
  const lp = { type: 'lowpass', f: 1800, Q: 0.7 };
  tone({ type: 'triangle', f: f * 0.94, fEnd: f, glide: 60, filter: lp,
    A: 2, D: 140, S: 0, R: 80, gain: 0.28, when: t });
  tone({ type: 'sine', f: f * 0.47, fEnd: f * 0.5, glide: 60, filter: { ...lp },
    A: 2, D: 140, S: 0, R: 80, gain: 0.28, when: t });
  advanceChip();
}

/** xMult — three sawtooths at f, f×1.25, f×1.5 with f = 110 * 2^(min(chipStep,12)/12),
 *  lowpass 900→3000 over 120ms Q3, A5 D260 S.2 R220, gain .18 each; + sub sine 70→40
 *  over 120ms, A1 D200, gain .5; + noise slap highpass 2k, 30ms, gain .15. */
export function sfxXMult() {
  if (!ready()) return;
  dbg.lastEvent = 'xmult';
  const f = 110 * semi(Math.min(chipStep, 12));
  const t = now();
  for (const m of [1, 1.25, 1.5]) {
    tone({ type: 'sawtooth', f: f * m,
      filter: { type: 'lowpass', f: 900, Q: 3, fEnd: 3000, sweep: 120 },
      A: 5, D: 260, S: 0.2, R: 220, gain: 0.18, when: t });
  }
  tone({ type: 'sine', f: 70, fEnd: 40, glide: 120, A: 1, D: 200, S: 0, R: 80, gain: 0.5, when: t });
  noise({ filter: { type: 'highpass', f: 2000, Q: 0.7 }, A: 1, D: 20, S: 0, R: 9, gain: 0.15, when: t });
  advanceChip();
}

/** Score count-up — sine + triangle unison, freq 300 + 600*outQuart(t/400), vibrato
 *  6 Hz ±8 cents, gain .18 held for the duration then R 60. */
export function sfxScoreCountUp(durationMs = 400) {
  if (!ready()) return;
  dbg.lastEvent = 'countUp';
  const ms = clamp(durationMs || 400, 80, 4000);
  const curve = x => 300 + 600 * (1 - Math.pow(1 - x, 4)); // outQuart
  const t = now();
  for (const type of ['sine', 'triangle']) {
    tone({ type, f: 300, fCurve: curve, fCurveMs: ms, vib: { rate: 6, cents: 8 },
      A: 10, D: 10, S: 1, H: ms, R: 60, gain: 0.18, when: t });
  }
}

/** Slam into bar — square 180 Hz 40ms lowpass 600 + noise thud lowpass 300 Hz 80ms,
 *  gain .40. Ends the scoring sequence, so the pitch ladder resets here. */
export function sfxScoreSlam() {
  if (!ready()) return;
  dbg.lastEvent = 'slam';
  const t = now();
  tone({ type: 'square', f: 180, filter: { type: 'lowpass', f: 600, Q: 0.7 },
    A: 1, D: 25, S: 0, R: 14, gain: 0.40, when: t });
  noise({ filter: { type: 'lowpass', f: 300, Q: 0.7 }, A: 2, D: 50, S: 0, R: 28, gain: 0.40, when: t });
  resetChipStep();
}

/** Blind cleared — triangle arpeggio C5 E5 G5 C6 at 90ms, each A3 D260 S0 R200, gain .25;
 *  + sine pad C4 261 A40 D600, gain .15; + sparkle noise highpass 6k 300ms, gain .08. */
export function sfxBlindCleared() {
  if (!ready()) return;
  dbg.lastEvent = 'blindCleared';
  const t = now();
  [523, 659, 784, 1047].forEach((f, i) => {
    tone({ type: 'triangle', f, A: 3, D: 260, S: 0, R: 200, gain: 0.25, when: t + i * 0.09 });
  });
  tone({ type: 'sine', f: 261, A: 40, D: 600, S: 0, R: 200, gain: 0.15, when: t });
  noise({ filter: { type: 'highpass', f: 6000, Q: 0.7 }, A: 20, D: 200, S: 0, R: 80, gain: 0.08, when: t });
}

/** Boss cleared — sawtooth (lowpass 2.5k) arpeggio C4 E4 G4 C5 E5 G5 C6 at 70ms, gain .22;
 *  + sub sine 55→30 over 400ms, gain .6; + shatter: 4 noise bursts bandpass 3k Q.5,
 *  60ms each at 0/40/90/150ms, gain .35. */
export function sfxBossCleared() {
  if (!ready()) return;
  dbg.lastEvent = 'bossCleared';
  const t = now();
  [261.63, 329.63, 392, 523.25, 659.25, 784, 1046.5].forEach((f, i) => {
    tone({ type: 'sawtooth', f, filter: { type: 'lowpass', f: 2500, Q: 0.7 },
      A: 3, D: 200, S: 0, R: 160, gain: 0.22, when: t + i * 0.07 });
  });
  tone({ type: 'sine', f: 55, fEnd: 30, glide: 400, A: 5, D: 250, S: 0.3, H: 100, R: 150, gain: 0.6, when: t });
  [0, 0.04, 0.09, 0.15].forEach(off => {
    noise({ filter: { type: 'bandpass', f: 3000, Q: 0.5 }, A: 1, D: 40, S: 0, R: 19, gain: 0.35, when: t + off });
  });
}

/** Coin — sines 2093 + 2793 (inharmonic 1.334) + triangle 1046, highpass 800,
 *  A1 D180 S0 R120, gain .20, ±4% pitch. Successive coins in a burst rise +1 semitone. */
export function sfxCoin() {
  if (!ready()) return;
  dbg.lastEvent = 'coin';
  coinVoice(coinStep, now());
  coinStep = Math.min(coinStep + 1, 12);
}

/** Shared coin body so Buy/Sell/Level up can borrow it at any transposition. */
function coinVoice(semitones, t, gainScale = 1) {
  const k = semi(semitones) * rand(0.96, 1.04); // ±4% pitch on top of the ladder
  const hp = { type: 'highpass', f: 800, Q: 0.7 };
  const env = { A: 1, D: 180, S: 0, R: 120 };
  tone({ type: 'sine', f: 2093 * k, ...env, filter: { ...hp }, gain: 0.20 * gainScale, when: t });
  tone({ type: 'sine', f: 2793 * k, ...env, filter: { ...hp }, gain: 0.20 * gainScale, when: t });
  tone({ type: 'triangle', f: 1046 * k, ...env, filter: { ...hp }, gain: 0.20 * gainScale, when: t });
}

/** Buy — coin + triangle 440→660 slide 80, A2 D160, gain .25; + sine 120 Hz 60ms thunk, gain .30. */
export function sfxBuy() {
  if (!ready()) return;
  dbg.lastEvent = 'buy';
  const t = now();
  coinVoice(0, t);
  tone({ type: 'triangle', f: 440, fEnd: 660, glide: 80, A: 2, D: 160, S: 0, R: 80, gain: 0.25, when: t });
  tone({ type: 'sine', f: 120, A: 2, D: 38, S: 0, R: 20, gain: 0.30, when: t });
}

/** Sell — triangle 660→440 slide 100, A2 D160, gain .22; + coin pitched −3 semitones. */
export function sfxSell() {
  if (!ready()) return;
  dbg.lastEvent = 'sell';
  const t = now();
  tone({ type: 'triangle', f: 660, fEnd: 440, glide: 100, A: 2, D: 160, S: 0, R: 80, gain: 0.22, when: t });
  coinVoice(-3, t);
}

/** Reroll — noise bandpass 1200 Q.6, three 40ms bursts at 0/50/100ms, gain .20;
 *  + square 300→500 100ms lowpass 1500, gain .12. */
export function sfxReroll() {
  if (!ready()) return;
  dbg.lastEvent = 'reroll';
  const t = now();
  [0, 0.05, 0.10].forEach(off => {
    noise({ filter: { type: 'bandpass', f: 1200, Q: 0.6 }, A: 1, D: 26, S: 0, R: 13, gain: 0.20, when: t + off });
  });
  tone({ type: 'square', f: 300, fEnd: 500, glide: 100, filter: { type: 'lowpass', f: 1500, Q: 0.7 },
    A: 2, D: 60, S: 0, R: 38, gain: 0.12, when: t });
}

/** Error — sawtooth 110 + square 113 (beating), lowpass 500, A5 D40 S.6 R120,
 *  200ms total, gain .20; second hit at 110ms. */
export function sfxError() {
  if (!ready()) return;
  dbg.lastEvent = 'error';
  const t = now();
  for (const off of [0, 0.11]) {
    const env = { A: 5, D: 40, S: 0.6, H: 35, R: 120, gain: 0.20 }; // 5+40+35+120 = 200ms
    tone({ type: 'sawtooth', f: 110, filter: { type: 'lowpass', f: 500, Q: 0.7 }, ...env, when: t + off });
    tone({ type: 'square', f: 113, filter: { type: 'lowpass', f: 500, Q: 0.7 }, ...env, when: t + off });
  }
}

/** Game over — G4 392, Eb4 311, C4 262, G3 196 at 260ms, triangle + sawtooth detuned
 *  −8 cents, lowpass 1200→400 across the phrase, each 320ms, last R 900, gain .25;
 *  + sub sine 55 Hz 1200ms, gain .30. */
export function sfxGameOver() {
  if (!ready()) return;
  dbg.lastEvent = 'gameOver';
  const t = now();
  const notes = [392, 311, 262, 196];
  notes.forEach((f, i) => {
    const last = i === notes.length - 1;
    const lp = 1200 * Math.pow(400 / 1200, i / (notes.length - 1));       // 1200 → 400 across the phrase
    const lpNext = 1200 * Math.pow(400 / 1200, (i + 1) / notes.length);
    const env = { A: 5, D: 200, S: 0, R: last ? 900 : 115, gain: 0.25 };
    const when = t + i * 0.26;
    tone({ type: 'triangle', f, ...env, when,
      filter: { type: 'lowpass', f: lp, Q: 0.7, fEnd: lpNext, sweep: 260 } });
    tone({ type: 'sawtooth', f, detune: -8, ...env, when,
      filter: { type: 'lowpass', f: lp, Q: 0.7, fEnd: lpNext, sweep: 260 } });
  });
  tone({ type: 'sine', f: 55, A: 30, D: 300, S: 0.5, H: 500, R: 370, gain: 0.30, when: t });
}

/** Win fanfare — square (lowpass 3k) + triangle: C5 C5 C5 E5 G5 C6 at 0/120/240/360/540/720ms,
 *  gain .22, last note A5 D900; + pad C4 E4 G4 sawtooths lowpass 800 A100 D1500 gain .10 each;
 *  + sparkle noise. */
export function sfxWin() {
  if (!ready()) return;
  dbg.lastEvent = 'win';
  const t = now();
  const notes = [[523.25, 0], [523.25, 0.12], [523.25, 0.24], [659.25, 0.36], [784, 0.54], [1046.5, 0.72]];
  notes.forEach(([f, off], i) => {
    const last = i === notes.length - 1;
    const env = last ? { A: 5, D: 900, S: 0, R: 300 } : { A: 3, D: 200, S: 0, R: 120 };
    tone({ type: 'square', f, ...env, gain: 0.22, when: t + off,
      filter: { type: 'lowpass', f: 3000, Q: 0.7 } });
    tone({ type: 'triangle', f, ...env, gain: 0.22, when: t + off });
  });
  for (const f of [261.63, 329.63, 392]) {
    tone({ type: 'sawtooth', f, filter: { type: 'lowpass', f: 800, Q: 0.7 },
      A: 100, D: 1500, S: 0, R: 300, gain: 0.10, when: t });
  }
  noise({ filter: { type: 'highpass', f: 6000, Q: 0.7 }, A: 60, D: 600, S: 0, R: 240, gain: 0.08, when: t });
}

/** Button click — square 900→600 25ms lowpass 2.5k, A1 D40, gain .15;
 *  + noise click highpass 3k 12ms, gain .08. */
export function sfxClick() {
  if (!ready()) return;
  dbg.lastEvent = 'click';
  const t = now();
  tone({ type: 'square', f: 900, fEnd: 600, glide: 25, filter: { type: 'lowpass', f: 2500, Q: 0.7 },
    A: 1, D: 40, S: 0, R: 20, gain: 0.15, when: t });
  noise({ filter: { type: 'highpass', f: 3000, Q: 0.7 }, A: 1, D: 7, S: 0, R: 4, gain: 0.08, when: t });
}

/** Level up — triangle arpeggio C5 E5 G5 at 60ms + coin, gain .22. */
export function sfxLevelUp() {
  if (!ready()) return;
  dbg.lastEvent = 'levelUp';
  const t = now();
  [523.25, 659.25, 784].forEach((f, i) => {
    tone({ type: 'triangle', f, A: 3, D: 200, S: 0, R: 140, gain: 0.22, when: t + i * 0.06 });
  });
  coinVoice(0, t + 0.12);
}

/** Card shatter (§7 "glass sound") — 5 bright noise bursts bandpass 3–6k Q.5 at
 *  0/35/80/140/210ms, gain .30, plus two thin glass tinkles. */
export function sfxShatter() {
  if (!ready()) return;
  dbg.lastEvent = 'shatter';
  const t = now();
  [0, 0.035, 0.08, 0.14, 0.21].forEach((off, i) => {
    noise({ filter: { type: 'bandpass', f: 3000 + i * 750, Q: 0.5 },
      A: 1, D: 34, S: 0, R: 18, gain: 0.30 * (1 - i * 0.12), when: t + off });
  });
  [3136, 4186].forEach((f, i) => {
    tone({ type: 'triangle', f: f * rand(0.98, 1.02), filter: { type: 'highpass', f: 2000, Q: 0.7 },
      A: 1, D: 160, S: 0, R: 120, gain: 0.10, when: t + 0.02 + i * 0.06 });
  });
}

/** Card burn (§7 destroy) — filtered noise crackle: bandpass 1400→600 over the 500ms
 *  burn line, plus short high crackles scattered through it. */
export function sfxBurn() {
  if (!ready()) return;
  dbg.lastEvent = 'burn';
  const t = now();
  noise({ filter: { type: 'bandpass', f: 1400, Q: 2, fEnd: 600, sweep: 500 },
    A: 30, D: 200, S: 0.35, H: 150, R: 250, gain: 0.16, when: t });
  for (let i = 0; i < 6; i++) {
    noise({ filter: { type: 'highpass', f: rand(2500, 5000), Q: 0.7 },
      A: 1, D: 14, S: 0, R: 8, gain: rand(0.05, 0.11), when: t + rand(0.02, 0.46) });
  }
  tone({ type: 'sine', f: 90, fEnd: 55, glide: 400, A: 20, D: 260, S: 0, R: 180, gain: 0.14, when: t });
}

/** Skip tag received — short bright two-note rise (A5 → E6) with a sparkle. */
export function sfxTagged() {
  if (!ready()) return;
  dbg.lastEvent = 'tagged';
  const t = now();
  [880, 1318.5].forEach((f, i) => {
    tone({ type: 'triangle', f, filter: { type: 'lowpass', f: 5000, Q: 0.7 },
      A: 2, D: 140, S: 0, R: 80, gain: 0.20, when: t + i * 0.07 });
  });
  noise({ filter: { type: 'highpass', f: 5000, Q: 0.7 }, A: 5, D: 90, S: 0, R: 60, gain: 0.07, when: t + 0.07 });
}

/** Booster pack opened — paper tear (noise bandpass 1500→4000 over 260ms) + rising tone. */
export function sfxPackOpen() {
  if (!ready()) return;
  dbg.lastEvent = 'packOpen';
  const t = now();
  noise({ filter: { type: 'bandpass', f: 1500, Q: 0.7, fEnd: 4000, sweep: 260 },
    A: 15, D: 180, S: 0.25, H: 60, R: 120, gain: 0.26, when: t });
  tone({ type: 'triangle', f: 300, fEnd: 900, glide: 300, filter: { type: 'lowpass', f: 2500, Q: 0.7 },
    A: 20, D: 260, S: 0, R: 120, gain: 0.18, when: t });
  noise({ filter: { type: 'highpass', f: 6000, Q: 0.7 }, A: 20, D: 200, S: 0, R: 120, gain: 0.07, when: t + 0.18 });
}
