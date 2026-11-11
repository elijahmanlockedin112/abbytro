import { describe, expect, it } from 'vitest';
import { SpeedModel } from '../src/engine/speed';

describe('SpeedModel', () => {
  it('eases between targets on its own clock', () => {
    let t = 0;
    const m = new SpeedModel(0, () => t);
    const seen: number[] = [];
    m.subscribe((r) => seen.push(r.to));
    m.setTarget(1, 2);
    expect(m.valueAt(0)).toBe(0);
    expect(m.valueAt(1000)).toBeCloseTo(0.5);
    expect(m.valueAt(2000)).toBe(1);
    t = 1000;
    m.setTarget(0, 1);
    expect(m.valueAt(1000)).toBeCloseTo(0.5);
    expect(m.valueAt(2000)).toBe(0);
    expect(seen).toEqual([1, 0]);
  });
});
