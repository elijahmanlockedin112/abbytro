import { THEME_LIST } from '../engine';
import type { Settings } from '../storage/store';
import { segmented, sheet, slider, toggle, numberField } from './controls';
import { h } from './dom';
import { ICON } from './icons';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function openSettings(s: Settings, reducedMotion: boolean, update: (patch: Partial<Settings>) => void): void {
  const body = h(
    'div',
    { class: 'sheet-body' },
    h('h3', {}, 'Motion'),
    segmented(
      'Peripheral motion',
      [
        { value: 'system', label: 'System' },
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ],
      s.motion,
      (motion) => update({ motion }),
    ),
    h('p', { class: 'hint' }, `System follows your reduced-motion preference (${reducedMotion ? 'reduced, so motion is off' : 'not reduced'}).`),
    segmented('Theme', THEME_LIST.map((t) => ({ value: t.id, label: t.name })), s.theme, (theme) => update({ theme })),
    slider('Speed', { min: 0.25, max: 2.5, step: 0.05, value: s.speed, format: (v) => `${v.toFixed(2)}×` }, (speed) => update({ speed })),
    slider('Density', { min: 0, max: 1, step: 0.05, value: s.density, format: pct }, (density) => update({ density })),
    slider('Opacity', { min: 0.1, max: 1, step: 0.05, value: s.opacity, format: pct }, (opacity) => update({ opacity })),
    slider('Edge width', { min: 0.08, max: 0.3, step: 0.01, value: s.edge, format: pct }, (edge) => update({ edge })),

    h('h3', {}, 'Sound'),
    segmented(
      'Ambience',
      [
        { value: 'auto', label: 'Match theme' },
        { value: 'road', label: 'Road' },
        { value: 'rail', label: 'Rail' },
        { value: 'space', label: 'Space' },
      ],
      s.sound,
      (sound) => update({ sound }),
    ),
    slider('Volume', { min: 0, max: 1, step: 0.05, value: s.volume, format: pct }, (volume) => update({ volume })),
    toggle('Mute (M)', s.muted, (muted) => update({ muted })),

    h('h3', {}, 'Trip'),
    segmented(
      'Pull over when',
      [
        { value: 'strict', label: 'Tab or window loses focus' },
        { value: 'lenient', label: 'Tab is hidden' },
      ],
      s.pullOver,
      (pullOver) => update({ pullOver }),
    ),
    h('p', { class: 'hint' }, 'Use “Tab is hidden” if you work in another window beside Momentum.'),
    toggle('Rest stops on long trips', s.rests.enabled, (enabled) => update({ rests: { ...s.rests, enabled } })),
    numberField('Longest stretch', { min: 15, max: 180, value: s.rests.maxLegMin, suffix: 'min' }, (maxLegMin) => update({ rests: { ...s.rests, maxLegMin } })),
    numberField('Break length', { min: 1, max: 30, value: s.rests.lengthMin, suffix: 'min' }, (lengthMin) => update({ rests: { ...s.rests, lengthMin } })),
    h('p', { class: 'hint' }, 'Rest stop changes apply from the next trip.'),
  );
  const d = sheet('Settings', body, ICON.close);
  document.body.append(d);
  d.showModal();
}
