/**
 * Momentum motion engine: standalone, no app imports, no storage.
 * Usage:
 *   const flow = new FlowEngine(canvas, { theme: 'road' });
 *   flow.start();
 *   flow.setThrottle(1, 3);   // accelerate to cruise over 3 s
 *   flow.setThrottle(0, 2.5); // coast to a stop
 */
export { FlowEngine, DEFAULT_FLOW_OPTIONS, prefersReducedMotion, type FlowOptions } from './FlowEngine';
export { SpeedModel, type SpeedRamp, type SpeedListener } from './speed';
export { THEMES, THEME_LIST, type ThemeId } from './themes';
export type { Theme, ThemeFactory, View, Rect } from './types';
