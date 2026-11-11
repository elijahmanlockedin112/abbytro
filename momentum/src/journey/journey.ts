import type { ThemeId } from '../engine';

export type Phase = 'driving' | 'pulledOver' | 'restStop' | 'arrived' | 'ended';

export interface RestPolicy {
  enabled: boolean;
  /** Longest stretch of travel before a break, in minutes. */
  maxLegMin: number;
  lengthMin: number;
}

export interface Waypoint {
  name: string;
  /** 0..1 along the route. */
  at: number;
}

export interface JourneyPlan {
  routeId: string;
  from: string;
  to: string;
  theme: ThemeId;
  plannedMs: number;
  waypoints: Waypoint[];
  /** Travel-time marks (ms) where a rest stop begins. */
  rests: number[];
  restMs: number;
}

export interface Journey {
  id: string;
  plan: JourneyPlan;
  phase: Phase;
  startedAt: number;
  /** Travel time banked before the current driving stint. */
  travelledMs: number;
  stintStart: number | null;
  pullOvers: number;
  pulledOverMs: number;
  pulledSince: number | null;
  restsTaken: number;
  restStartedAt: number | null;
  restTotalMs: number;
  endedAt: number | null;
}

export type JourneyEvent = 'rest' | 'arrive' | null;

const MIN = 60_000;

/** Split a long trip into equal legs no longer than `maxLegMin`. */
export function planRests(plannedMs: number, policy: RestPolicy): number[] {
  if (!policy.enabled || policy.maxLegMin <= 0) return [];
  const legs = Math.ceil(plannedMs / (policy.maxLegMin * MIN) - 1e-9);
  const marks: number[] = [];
  for (let k = 1; k < legs; k++) marks.push(Math.round((plannedMs * k) / legs));
  return marks;
}

export function makePlan(
  route: { id: string; from: string; to: string; theme: ThemeId; via: string[] },
  minutes: number,
  policy: RestPolicy,
): JourneyPlan {
  const plannedMs = Math.max(1, Math.round(minutes * MIN));
  const n = route.via.length;
  return {
    routeId: route.id,
    from: route.from,
    to: route.to,
    theme: route.theme,
    plannedMs,
    waypoints: route.via.map((name, i) => ({ name, at: (i + 1) / (n + 1) })),
    rests: planRests(plannedMs, policy),
    restMs: Math.max(0, policy.lengthMin) * MIN,
  };
}

export function startJourney(plan: JourneyPlan, now: number): Journey {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    plan,
    phase: 'driving',
    startedAt: now,
    travelledMs: 0,
    stintStart: now,
    pullOvers: 0,
    pulledOverMs: 0,
    pulledSince: null,
    restsTaken: 0,
    restStartedAt: null,
    restTotalMs: 0,
    endedAt: null,
  };
}

export function travelled(j: Journey, now: number): number {
  const live = j.phase === 'driving' && j.stintStart !== null ? Math.max(0, now - j.stintStart) : 0;
  return Math.min(j.plan.plannedMs, j.travelledMs + live);
}

export function progress(j: Journey, now: number): number {
  return travelled(j, now) / j.plan.plannedMs;
}

export function remaining(j: Journey, now: number): number {
  return j.plan.plannedMs - travelled(j, now);
}

export function restRemaining(j: Journey, now: number): number {
  if (j.phase !== 'restStop' || j.restStartedAt === null) return 0;
  return Math.max(0, j.plan.restMs - (now - j.restStartedAt));
}

function bank(j: Journey, at: number): Journey {
  return { ...j, travelledMs: travelled(j, at), stintStart: null };
}

/** Stop the vehicle. `at` may be in the past (e.g. when focus was lost). */
export function pullOver(j: Journey, at: number): Journey {
  if (j.phase !== 'driving') return j;
  return { ...bank(j, at), phase: 'pulledOver', pulledSince: at, pullOvers: j.pullOvers + 1 };
}

export function resume(j: Journey, now: number): Journey {
  if (j.phase === 'pulledOver') {
    const stopped = j.pulledSince !== null ? Math.max(0, now - j.pulledSince) : 0;
    return { ...j, phase: 'driving', stintStart: now, pulledSince: null, pulledOverMs: j.pulledOverMs + stopped };
  }
  if (j.phase === 'restStop') {
    const rested = j.restStartedAt !== null ? Math.max(0, now - j.restStartedAt) : 0;
    return { ...j, phase: 'driving', stintStart: now, restStartedAt: null, restTotalMs: j.restTotalMs + rested };
  }
  return j;
}

/** Advance the clock. Returns the new state and any milestone reached. */
export function tick(j: Journey, now: number): { journey: Journey; event: JourneyEvent } {
  if (j.phase !== 'driving' || j.stintStart === null) return { journey: j, event: null };
  const t = j.travelledMs + (now - j.stintStart);
  const nextRest = j.plan.rests[j.restsTaken];
  if (nextRest !== undefined && nextRest < j.plan.plannedMs && t >= nextRest) {
    const at = j.stintStart + (nextRest - j.travelledMs);
    return {
      journey: { ...j, phase: 'restStop', travelledMs: nextRest, stintStart: null, restsTaken: j.restsTaken + 1, restStartedAt: at },
      event: 'rest',
    };
  }
  if (t >= j.plan.plannedMs) {
    const at = j.stintStart + (j.plan.plannedMs - j.travelledMs);
    return { journey: { ...j, phase: 'arrived', travelledMs: j.plan.plannedMs, stintStart: null, endedAt: at }, event: 'arrive' };
  }
  return { journey: j, event: null };
}

/** Abandon the trip early. */
export function endJourney(j: Journey, now: number): Journey {
  if (j.phase === 'arrived' || j.phase === 'ended') return j;
  let next = j.phase === 'driving' ? bank(j, now) : j;
  if (j.phase === 'pulledOver' && j.pulledSince !== null) {
    next = { ...next, pulledOverMs: j.pulledOverMs + Math.max(0, now - j.pulledSince), pulledSince: null };
  }
  if (j.phase === 'restStop' && j.restStartedAt !== null) {
    next = { ...next, restTotalMs: j.restTotalMs + Math.max(0, now - j.restStartedAt), restStartedAt: null };
  }
  return { ...next, phase: 'ended', endedAt: now };
}

/** Name of the last waypoint passed, or the origin. */
export function lastPassed(j: Journey, now: number): string {
  const p = progress(j, now);
  let name = j.plan.from;
  for (const w of j.plan.waypoints) if (p >= w.at) name = w.name;
  return name;
}

/** The next waypoint ahead, or the destination. */
export function nextStop(j: Journey, now: number): string {
  const p = progress(j, now);
  return j.plan.waypoints.find((w) => w.at > p)?.name ?? j.plan.to;
}
