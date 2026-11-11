/** A continuous sound bed whose character follows speed. */
export interface Voice {
  /** Fade node; connect to the bus. */
  readonly output: GainNode;
  apply(speed: number, now: number, seconds: number): void;
  stop(at: number): void;
}

export type SoundProfile = 'road' | 'rail' | 'space';

/** Glide an AudioParam toward `value`; reaches ~95% after `seconds`. Click-free and interruptible. */
export function glide(param: AudioParam, value: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, Math.max(0.015, seconds / 3));
}

function loop(ctx: AudioContext, buf: AudioBuffer, offset = 0): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(0, offset % buf.duration);
  return s;
}

function filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

function gain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

const level = (v: number, idle: number): number => idle + (1 - idle) * Math.min(1.15, Math.pow(Math.max(0, v), 0.8));

/** Tyre roar on asphalt: brown-noise body, a band of tyre hiss, a low electric hum. */
function road(ctx: AudioContext, brown: AudioBuffer): Voice {
  const output = gain(ctx, 0);
  const bed = gain(ctx, 0);
  bed.connect(output);
  const body = loop(ctx, brown);
  const lp = filter(ctx, 'lowpass', 200, 0.4);
  body.connect(lp).connect(gain(ctx, 0.9)).connect(bed);
  const tyre = loop(ctx, brown, 3.1);
  const bp = filter(ctx, 'bandpass', 650, 0.7);
  const tyreGain = gain(ctx, 0);
  tyre.connect(bp).connect(tyreGain).connect(bed);
  const hum = ctx.createOscillator();
  hum.type = 'triangle';
  hum.frequency.value = 32;
  hum.connect(filter(ctx, 'lowpass', 140, 0.5)).connect(gain(ctx, 0.05)).connect(bed);
  hum.start();
  return {
    output,
    apply(v, now, sec) {
      const s = Math.min(v, 2.5);
      glide(body.playbackRate, 0.6 + 0.4 * Math.min(s, 2), now, sec);
      glide(lp.frequency, 150 * Math.pow(2, s * 1.25), now, sec);
      glide(tyre.playbackRate, 0.7 + 0.3 * Math.min(s, 2), now, sec);
      glide(tyreGain.gain, 0.16 * Math.min(1.6, s * s), now, sec);
      glide(hum.frequency, 32 + 16 * s, now, sec);
      glide(bed.gain, level(s, 0.18), now, sec);
    },
    stop(at) {
      body.stop(at);
      tyre.stop(at);
      hum.stop(at);
    },
  };
}

/** Train carriage rumble: warm low-mid body and a sub layer. Clacks are scheduled separately. */
function rail(ctx: AudioContext, brown: AudioBuffer): Voice {
  const output = gain(ctx, 0);
  const bed = gain(ctx, 0);
  bed.connect(output);
  const body = loop(ctx, brown);
  const lp = filter(ctx, 'lowpass', 220, 0.5);
  body.connect(lp).connect(filter(ctx, 'peaking', 95, 1, 5)).connect(gain(ctx, 0.85)).connect(bed);
  const sub = loop(ctx, brown, 4.4);
  sub.connect(filter(ctx, 'lowpass', 65, 0.6)).connect(gain(ctx, 0.9)).connect(bed);
  return {
    output,
    apply(v, now, sec) {
      const s = Math.min(v, 2.5);
      glide(body.playbackRate, 0.65 + 0.35 * Math.min(s, 2), now, sec);
      glide(lp.frequency, 190 * Math.pow(2, s * 1.1), now, sec);
      glide(bed.gain, level(s, 0.08), now, sec);
    },
    stop(at) {
      body.stop(at);
      sub.stop(at);
    },
  };
}

/** Deep-space cabin: very dark noise plus a slow beating drone. */
function space(ctx: AudioContext, brown: AudioBuffer): Voice {
  const output = gain(ctx, 0);
  const bed = gain(ctx, 0);
  bed.connect(output);
  const body = loop(ctx, brown);
  const lp = filter(ctx, 'lowpass', 140, 0.4);
  body.connect(lp).connect(gain(ctx, 0.8)).connect(bed);
  const droneOut = filter(ctx, 'lowpass', 320, 0.5);
  droneOut.connect(gain(ctx, 0.035)).connect(bed);
  const oscs = [55, 55.35, 82.4].map((hz) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    o.connect(droneOut);
    o.start();
    return { o, hz };
  });
  return {
    output,
    apply(v, now, sec) {
      const s = Math.min(v, 2.5);
      glide(lp.frequency, 110 * Math.pow(2, s), now, sec);
      for (const { o, hz } of oscs) glide(o.frequency, hz + s * 2.5, now, sec);
      glide(bed.gain, level(s, 0.3), now, sec);
    },
    stop(at) {
      body.stop(at);
      for (const { o } of oscs) o.stop(at);
    },
  };
}

export const VOICES: Record<SoundProfile, (ctx: AudioContext, brown: AudioBuffer) => Voice> = { road, rail, space };
