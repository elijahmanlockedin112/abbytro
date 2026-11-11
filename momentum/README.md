# Momentum

A focus app that recreates the "working in a car" effect: motion at the edges of your vision, a steady road or rail sound, a trip toward a destination, and a little friction against stopping halfway.

Phase 1 (MVP). Vite + TypeScript, no framework, no backend. Settings and history stay in `localStorage`.

## Run

```bash
cd momentum
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (journey clock, speed model, settings)
npm run build      # typecheck + production build into dist/
```

## What it does

- **Peripheral flow.** A full-screen canvas sits behind a static centre panel. Motion is drawn only in the outer band (18% per side by default, 10% on phones). It is hard-clipped out of the centre and faded with a CSS mask. Themes: night road, train window (parallax), starfield. Settings has sliders for speed, density, opacity and edge width.
- **Journey timer.** Pick a route preset (e.g. Kyoto → Osaka, 40 min) or a custom trip. Progress shows as a route with stops and a moving vehicle. Trips longer than 50 min are split into equal legs with 5-minute rest stops between them (both numbers can be changed). An arrival screen sums up the trip.
- **Ambient audio.** Procedural brown-noise road, rail rumble with joint clacks, or a deep-space drone, plus occasional passing whooshes. Pitch, filter and level follow the visual speed. Volume, mute (`M`), and a choice of sound or "match theme".
- **Pull over.** Leaving the tab (or the window, in strict mode) makes the vehicle coast down. If you're still away 2.5 s later, that's a pull-over: the trip clock stops and you get a gentle "Resume trip?" prompt when you return. Pull-overs are counted per trip. A reload or closed tab resumes in the pulled-over state.
- **Reduced motion.** With `prefers-reduced-motion`, trips are audio-only by default, with a one-click opt-in.
- **Low CPU.** DPR is capped at 1 and frames at 60 fps. The render loop sleeps when the vehicle is stopped or the tab is hidden. After 20 s stopped, audio fades out and the AudioContext is suspended.

## Layout

```
src/
  engine/          Standalone motion engine (no app imports, no storage)
    FlowEngine.ts  canvas loop, edge clip + mask, DPR/fps caps, sleep when idle
    speed.ts       clock-based SpeedModel (valid while not rendering)
    themes/        road.ts, train.ts, stars.ts (+ registry)
  audio/           AmbientAudio + voices; follows any SpeedSource (e.g. FlowEngine)
  journey/         routes.ts presets, journey.ts pure trip state machine
  storage/         settings, session history, active-trip snapshot
  ui/              app controller, views, route bar, focus watcher, sheets
test/              vitest unit tests
```

## Motion engine API

`src/engine` has no dependencies, so it can be lifted into a browser extension, a VS Code webview or another app.

```ts
import { FlowEngine } from './engine';

const flow = new FlowEngine(canvas, { theme: 'road', density: 0.6, opacity: 0.85, edge: 0.18 });
flow.start();
flow.setThrottle(1, 3);        // accelerate to cruise over 3 s
flow.setThrottle(0, 2.5);      // coast to a stop (rendering then sleeps)
flow.setOptions({ theme: 'stars', speed: 1.5 });
flow.onSpeedChange((ramp) => { /* drive audio, haptics… */ });
flow.velocity;                 // current normalised speed, even while hidden
flow.destroy();
```

Custom themes implement `Theme` (`resize`, `setDensity`, `update`, `draw`) and are passed as a factory: `{ theme: (density) => myTheme }`.

## Storage keys

`momentum.settings.v1`, `momentum.history.v1` (newest first, capped at 500), and `momentum.active.v1` (the trip in progress). History can be exported as JSON from the History sheet.
