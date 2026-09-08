// Particle emitter configs (FEEL.md section 7). Each returns a config object
// for Particles.emit(); the catalogue lives here so the numbers stay in one place.

export const fx = {
  chipSparkle: (x, y) => ({
    n: 6, x, y, spread: 10, angle: -Math.PI / 2, arc: (140 * Math.PI) / 180,
    speed: [60, 140], gravity: 200, life: [320, 480], size: [4, 7],
    colors: ['#9FD0FF', '#FFFFFF'], shape: 'spark', blend: 'lighter', spin: [-6, 6],
  }),

  multEmber: (x, y) => ({
    n: 5, x, y, spread: 20, angle: -Math.PI / 2, arc: (70 * Math.PI) / 180,
    speed: [80, 160], gravity: -120, life: [500, 700], size: [4, 8],
    colors: ['#FF5A3C', '#FF8A3C', '#FFB03A'], shape: 'circle', blend: 'lighter', drag: 0.99,
  }),

  shockwave: (x, y) => ({
    n: 1, x, y, speed: [0, 0], gravity: 0, life: [380, 380], size: [26, 26],
    colors: ['#FFFFFF'], shape: 'ring', blend: 'lighter', shrink: false, spin: [0, 0],
  }),

  shockSparks: (x, y) => ({
    n: 12, x, y, spread: 4, arc: Math.PI * 2, speed: [180, 320], gravity: 0,
    life: [280, 320], size: [3, 6], colors: ['#FFD08A', '#FF5A3C'], shape: 'circle', blend: 'lighter',
  }),

  coins: (x, y, n) => ({
    n: Math.min(12, 4 + n), x, y, spread: 6, angle: -Math.PI / 2, arc: (100 * Math.PI) / 180,
    speed: [120, 260], gravity: 900, life: [700, 700], size: [10, 10],
    colors: ['#F5C542'], shape: 'coin', shrink: false, spin: [-3, 3],
  }),

  shatter: (x, y) => ({
    n: 20, x, y, spread: 30, arc: Math.PI * 2, speed: [150, 350], gravity: 1100,
    life: [500, 800], size: [4, 9], colors: ['#BFEFFF', '#FFFFFF', '#8FD8F0'],
    shape: 'spark', blend: 'lighter', spin: [-9, 9],
  }),

  burn: (x, y) => ({
    n: 22, x, y, spread: 26, angle: -Math.PI / 2, arc: (120 * Math.PI) / 180,
    speed: [40, 120], gravity: -80, life: [400, 700], size: [3, 7],
    colors: ['#FFB03A', '#FF5A3C', '#553322'], shape: 'circle', blend: 'lighter',
  }),

  ash: (x, y) => ({
    n: 10, x, y, spread: 26, angle: Math.PI / 2, arc: Math.PI / 2,
    speed: [20, 40], gravity: 60, life: [700, 900], size: [2, 3],
    colors: ['#4A4858'], shape: 'square', spin: [-4, 4],
  }),

  confetti: (x, y, n = 120) => ({
    n, x, y, spread: 30, angle: -Math.PI / 2, arc: (120 * Math.PI) / 180,
    speed: [200, 520], gravity: 700, life: [1400, 2000], size: [8, 12],
    colors: ['#FF5A3C', '#4FA3FF', '#F5C542', '#3E9E5A', '#B36BFF', '#F7F1E3'],
    shape: 'confetti', spin: [-12, 12], drag: 0.995,
  }),

  bossSparks: (x, y) => ({
    n: 30, x, y, spread: 40, arc: Math.PI * 2, speed: [250, 450], gravity: 300,
    life: [400, 600], size: [4, 8], colors: ['#B36BFF', '#FF2E7A', '#FFFFFF'],
    shape: 'spark', blend: 'lighter', spin: [-10, 10],
  }),

  levelStars: (x, y, n = 16) => ({
    n, x, y, spread: 8, arc: Math.PI * 2, speed: [200, 380], gravity: 300,
    life: [600, 900], size: [6, 11], colors: ['#F5C542', '#FFFFFF'],
    shape: 'star', blend: 'lighter', spin: [-8, 8],
  }),

  purchase: (x, y, color) => ({
    n: 10, x, y, spread: 24, angle: -Math.PI / 2, arc: Math.PI / 2,
    speed: [60, 120], gravity: -60, life: [500, 700], size: [3, 6],
    colors: [color, '#FFFFFF'], shape: 'circle', blend: 'lighter',
  }),

  wisp: (x, y) => ({
    n: 1, x, y, spread: 2, arc: Math.PI * 2, speed: [10, 25], gravity: -10,
    life: [900, 900], size: [12, 18], colors: ['#8F7CFF'], shape: 'circle',
    blend: 'lighter', shrink: false,
  }),
};
