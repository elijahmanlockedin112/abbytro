import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/storage/store';

describe('sanitizeSettings', () => {
  it('fills defaults and clamps bad values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ theme: 'nope', speed: 99, volume: -1, rests: { maxLegMin: 'x' } });
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.speed).toBe(2.5);
    expect(s.volume).toBe(0);
    expect(s.rests.maxLegMin).toBe(50);
  });
});
