import type { ThemeId } from '../engine';

export interface Route {
  id: string;
  from: string;
  to: string;
  minutes: number;
  theme: ThemeId;
  /** Intermediate stops, spread evenly along the route bar. */
  via: string[];
}

export const ROUTES: Route[] = [
  { id: 'corner-cafe', from: 'Home', to: 'The corner café', minutes: 25, theme: 'road', via: ['High Street'] },
  { id: 'pch', from: 'Santa Monica', to: 'Malibu', minutes: 30, theme: 'road', via: ['Pacific Palisades', 'Topanga'] },
  { id: 'kyoto-osaka', from: 'Kyoto', to: 'Osaka', minutes: 40, theme: 'train', via: ['Yamazaki', 'Takatsuki', 'Shin-Osaka'] },
  { id: 'edinburgh-glasgow', from: 'Edinburgh', to: 'Glasgow', minutes: 50, theme: 'train', via: ['Linlithgow', 'Falkirk High', 'Croy'] },
  { id: 'zurich-lucerne', from: 'Zürich', to: 'Lucerne', minutes: 60, theme: 'train', via: ['Thalwil', 'Zug'] },
  { id: 'moon', from: 'Earth orbit', to: 'The Moon', minutes: 75, theme: 'stars', via: ['Van Allen belts', 'Halfway', 'Lunar orbit'] },
  { id: 'tokyo-nagoya', from: 'Tokyo', to: 'Nagoya', minutes: 100, theme: 'train', via: ['Shin-Yokohama', 'Odawara', 'Shizuoka', 'Hamamatsu'] },
  { id: 'route-66', from: 'Barstow', to: 'Needles', minutes: 120, theme: 'road', via: ['Ludlow', 'Amboy', 'Essex'] },
];

export const CUSTOM_ROUTE_ID = 'custom';

export function findRoute(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}
