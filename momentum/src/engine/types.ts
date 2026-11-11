export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry handed to themes. All values are CSS pixels. */
export interface View {
  width: number;
  height: number;
  cx: number;
  cy: number;
  /** Width of the left/right motion bands. */
  bandX: number;
  /** Height of the top/bottom motion bands. */
  bandY: number;
  /** The protected centre. The engine clips it out, so nothing is ever drawn there. */
  inner: Rect;
}

export interface Theme {
  readonly id: string;
  /** Called once after creation and again on every resize. */
  resize(view: View): void;
  /** 0..1 */
  setDensity(density: number): void;
  /** `speed` is the normalised velocity: 0 = stopped, 1 = cruising, ~2.5 = fast. */
  update(dt: number, speed: number, view: View): void;
  draw(ctx: CanvasRenderingContext2D, view: View): void;
}

export type ThemeFactory = (density: number) => Theme;

/** True when a point sits inside the protected centre (with optional padding). */
export function inInner(view: View, x: number, y: number, pad = 0): boolean {
  const r = view.inner;
  return x > r.x + pad && x < r.x + r.w - pad && y > r.y + pad && y < r.y + r.h - pad;
}
