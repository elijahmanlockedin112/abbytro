/** Stereo brown noise, detrended so the loop point does not click. */
export function brownNoise(ctx: BaseAudioContext, seconds = 8): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last;
    }
    // Remove the end-to-start step and any DC, then normalise.
    const step = d[n - 1] - d[0];
    let mean = 0;
    for (let i = 0; i < n; i++) {
      d[i] -= (step * i) / (n - 1);
      mean += d[i];
    }
    mean /= n;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      d[i] -= mean;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    const k = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return buf;
}

export function whiteNoise(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
