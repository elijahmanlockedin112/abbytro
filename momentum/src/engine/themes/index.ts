import type { ThemeFactory } from '../types';
import { createRoadTheme } from './road';
import { createStarsTheme } from './stars';
import { createTrainTheme } from './train';

export const THEMES = {
  road: createRoadTheme,
  train: createTrainTheme,
  stars: createStarsTheme,
} satisfies Record<string, ThemeFactory>;

export type ThemeId = keyof typeof THEMES;

export const THEME_LIST: { id: ThemeId; name: string; blurb: string }[] = [
  { id: 'road', name: 'Night road', blurb: 'Lane lines and passing lamps' },
  { id: 'train', name: 'Train window', blurb: 'Parallax hills at dusk' },
  { id: 'stars', name: 'Starfield', blurb: 'Drifting through deep space' },
];
