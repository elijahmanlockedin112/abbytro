import type { ThemeId } from '../engine';

const svg = (vb: string, body: string): string =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const VEHICLE: Record<ThemeId, string> = {
  road: svg('0 0 32 16', '<path d="M3 11.5V9.2c0-.9.6-1.6 1.4-1.8l4-1 3.2-3.1c.5-.5 1.1-.8 1.8-.8h6.4c.7 0 1.3.3 1.8.7l3.6 3.4 3.2.7c.9.2 1.6 1 1.6 1.9v2.3c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1z" fill="currentColor"/><circle cx="9" cy="12.6" r="2.3" fill="#0b0d10" stroke="currentColor" stroke-width="1.4"/><circle cx="23" cy="12.6" r="2.3" fill="#0b0d10" stroke="currentColor" stroke-width="1.4"/>'),
  train: svg('0 0 36 16', '<path d="M2 4.5C2 3.1 3.1 2 4.5 2H25c4.6 0 8.6 3.3 9.4 7.8l.3 1.7c.2 1-.6 2-1.6 2H4.5C3.1 13.5 2 12.4 2 11z" fill="currentColor"/><path d="M5 5h4v3H5zM11 5h4v3h-4zM17 5h4v3h-4zM24 5h3.5l2 3H24z" fill="#0b0d10"/>'),
  stars: svg('0 0 32 16', '<path d="M6 8c3-4 9-6 16-5.5 3 .3 6 2.4 8 5.5-2 3.1-5 5.2-8 5.5C15 14 9 12 6 8z" fill="currentColor"/><circle cx="21" cy="8" r="2" fill="#0b0d10"/><path d="M8 4.5 3 2l1.5 4M8 11.5 3 14l1.5-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
};

export const ICON = {
  gear: svg('0 0 24 24', '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
  history: svg('0 0 24 24', '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 3.5V8h4.5M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  sound: svg('0 0 24 24', '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  muted: svg('0 0 24 24', '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  close: svg('0 0 24 24', '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  rest: svg('0 0 12 12', '<path d="M6 1v2.2M3.4 3.6h5.2L7.8 9H4.2zM3 10.8h6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'),
};
