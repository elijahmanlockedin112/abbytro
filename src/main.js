// Bootstrap: size the canvas, load data and fonts, run the frame loop.

import { Game } from './ui/game.js';
import { attachInput } from './ui/interact.js';
import { loadJokerDefs } from './data/loadJokers.js';
import * as S from './audio/sfx.js';
import { jokerSellValue } from './core/jokers.js';

const canvas = document.getElementById('game');
const boot = document.getElementById('boot');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

// The renderer reaches for this to show sell values without a circular import.
globalThis.__abbytroJokerMod = { jokerSellValue };

async function start() {
  const defs = await loadJokerDefs('./');
  try {
    await Promise.all([
      document.fonts.load('400 40px "Lilita One"'),
      document.fonts.load('800 13px Nunito'),
      document.fonts.load('600 11px Nunito'),
    ]);
  } catch { /* fall back to system fonts */ }

  const game = new Game(canvas, defs);
  attachInput(game, canvas);
  globalThis.game = game;              // handy in the console

  try {
    const vol = localStorage.getItem('abbytro.volume');
    if (vol != null) S.setMasterVolume(Number(vol));
    game.shakeEnabled = localStorage.getItem('abbytro.shake') !== '0';
    if (localStorage.getItem('abbytro.reduced') === '1') game.reduced = true;
  } catch { /* ignore */ }

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 400);

  // The loop runs on requestAnimationFrame, with a timer fallback: some embedded
  // and background contexts throttle or stop rAF entirely, and a card game that
  // freezes mid-deal there is worse than one that runs a little less smoothly.
  let last = performance.now();
  let lastTick = last;
  let rafId = 0;

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastTick = now;
    game.update(dt);
    game.render();
  }

  function frame(now) {
    step(now);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  // If rAF is healthy it will have ticked within the last frame or two and this
  // does nothing. If it has stalled, this keeps the game running at ~30fps.
  setInterval(() => {
    const now = performance.now();
    if (now - lastTick < 32) return;
    step(now);
  }, 16);

  window.addEventListener('beforeunload', () => {
    try {
      localStorage.setItem('abbytro.volume', String(S.getMasterVolume()));
      localStorage.setItem('abbytro.shake', game.shakeEnabled ? '1' : '0');
      localStorage.setItem('abbytro.reduced', game.reduced ? '1' : '0');
    } catch { /* ignore */ }
  });
}

start().catch(err => {
  console.error(err);
  boot.textContent = 'Failed to start: ' + err.message;
});
