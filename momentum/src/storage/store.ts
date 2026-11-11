import type { SoundProfile } from '../audio/AmbientAudio';
import { THEMES, type ThemeId } from '../engine';
import type { Journey, RestPolicy } from '../journey/journey';

export interface Settings {
  theme: ThemeId;
  /** Speed multiplier, 0.25..2.5 */
  speed: number;
  density: number;
  opacity: number;
  /** Motion band per side, fraction of the screen. */
  edge: number;
  /** 'system' follows prefers-reduced-motion (motion off when reduced). */
  motion: 'system' | 'on' | 'off';
  sound: 'auto' | SoundProfile;
  volume: number;
  muted: boolean;
  /** strict: pull over on window blur or tab switch. lenient: tab switch only. */
  pullOver: 'strict' | 'lenient';
  rests: RestPolicy;
  routeId: string;
  customMinutes: number;
  customFrom: string;
  customTo: string;
}

export interface SessionRecord {
  id: string;
  routeId: string;
  from: string;
  to: string;
  theme: ThemeId;
  motion: boolean;
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  travelledMs: number;
  pullOvers: number;
  pulledOverMs: number;
  restStops: number;
  completed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'train',
  speed: 1,
  density: 0.6,
  opacity: 0.85,
  edge: 0.18,
  motion: 'system',
  sound: 'auto',
  volume: 0.6,
  muted: false,
  pullOver: 'strict',
  rests: { enabled: true, maxLegMin: 50, lengthMin: 5 },
  routeId: 'kyoto-osaka',
  customMinutes: 45,
  customFrom: 'Here',
  customTo: 'Done',
};

const KEYS = {
  settings: 'momentum.settings.v1',
  history: 'momentum.history.v1',
  active: 'momentum.active.v1',
} as const;

const HISTORY_CAP = 500;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): the app still works for this visit.
  }
}

const num = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

/** Merge stored settings over defaults, dropping anything malformed. */
export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  const r = (s.rests && typeof s.rests === 'object' ? s.rests : {}) as Partial<Record<keyof RestPolicy, unknown>>;
  const str = (v: unknown, dv: string): string => (typeof v === 'string' && v.trim() ? v.slice(0, 60) : dv);
  return {
    theme: oneOf(s.theme, Object.keys(THEMES) as ThemeId[], d.theme),
    speed: num(s.speed, 0.25, 2.5, d.speed),
    density: num(s.density, 0, 1, d.density),
    opacity: num(s.opacity, 0, 1, d.opacity),
    edge: num(s.edge, 0.08, 0.3, d.edge),
    motion: oneOf(s.motion, ['system', 'on', 'off'] as const, d.motion),
    sound: oneOf(s.sound, ['auto', 'road', 'rail', 'space'] as const, d.sound),
    volume: num(s.volume, 0, 1, d.volume),
    muted: typeof s.muted === 'boolean' ? s.muted : d.muted,
    pullOver: oneOf(s.pullOver, ['strict', 'lenient'] as const, d.pullOver),
    rests: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : d.rests.enabled,
      maxLegMin: num(r.maxLegMin, 15, 180, d.rests.maxLegMin),
      lengthMin: num(r.lengthMin, 1, 30, d.rests.lengthMin),
    },
    routeId: str(s.routeId, d.routeId),
    customMinutes: num(s.customMinutes, 1, 600, d.customMinutes),
    customFrom: str(s.customFrom, d.customFrom),
    customTo: str(s.customTo, d.customTo),
  };
}

export const loadSettings = (): Settings => sanitizeSettings(read(KEYS.settings));
export const saveSettings = (s: Settings): void => write(KEYS.settings, s);

export const loadHistory = (): SessionRecord[] => {
  const h = read<SessionRecord[]>(KEYS.history);
  return Array.isArray(h) ? h : [];
};
export function addRecord(r: SessionRecord): void {
  const h = loadHistory().filter((x) => x.id !== r.id);
  h.unshift(r);
  write(KEYS.history, h.slice(0, HISTORY_CAP));
}
export const clearHistory = (): void => write(KEYS.history, null);

/** The trip in progress, so a reload or crash does not lose it. */
export interface ActiveSnapshot {
  journey: Journey;
  savedAt: number;
}
export const loadActive = (): ActiveSnapshot | null => {
  const s = read<ActiveSnapshot>(KEYS.active);
  const j = s?.journey;
  return j && typeof j === 'object' && j.plan && typeof j.plan.plannedMs === 'number' && typeof s.savedAt === 'number' ? s : null;
};
export const saveActive = (j: Journey | null): void => write(KEYS.active, j ? { journey: j, savedAt: Date.now() } : null);

export function toRecord(j: Journey, motion: boolean): SessionRecord {
  return {
    id: j.id,
    routeId: j.plan.routeId,
    from: j.plan.from,
    to: j.plan.to,
    theme: j.plan.theme,
    motion,
    startedAt: j.startedAt,
    endedAt: j.endedAt ?? Date.now(),
    plannedMs: j.plan.plannedMs,
    travelledMs: j.travelledMs,
    pullOvers: j.pullOvers,
    pulledOverMs: j.pulledOverMs,
    restStops: j.restsTaken,
    completed: j.phase === 'arrived',
  };
}
