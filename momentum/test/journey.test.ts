import { describe, expect, it } from 'vitest';
import { endJourney, makePlan, planRests, progress, pullOver, restRemaining, resume, startJourney, tick, travelled } from '../src/journey/journey';

const MIN = 60_000;
const policy = { enabled: true, maxLegMin: 50, lengthMin: 5 };
const route = { id: 'r', from: 'A', to: 'B', theme: 'road' as const, via: ['X', 'Y'] };

describe('planRests', () => {
  it('adds no breaks to short trips', () => {
    expect(planRests(40 * MIN, policy)).toEqual([]);
    expect(planRests(50 * MIN, policy)).toEqual([]);
  });
  it('splits long trips into equal legs', () => {
    expect(planRests(60 * MIN, policy)).toEqual([30 * MIN]);
    expect(planRests(120 * MIN, policy)).toEqual([40 * MIN, 80 * MIN]);
  });
  it('respects the toggle', () => {
    expect(planRests(120 * MIN, { ...policy, enabled: false })).toEqual([]);
  });
});

describe('journey clock', () => {
  it('spreads waypoints evenly', () => {
    expect(makePlan(route, 30, policy).waypoints.map((w) => w.at)).toEqual([1 / 3, 2 / 3]);
  });

  it('stops counting while pulled over', () => {
    let j = startJourney(makePlan(route, 40, policy), 0);
    j = pullOver(j, 10 * MIN);
    expect(j.pullOvers).toBe(1);
    expect(travelled(j, 15 * MIN)).toBe(10 * MIN);
    j = resume(j, 15 * MIN);
    expect(j.pulledOverMs).toBe(5 * MIN);
    expect(travelled(j, 20 * MIN)).toBe(15 * MIN);
    expect(progress(j, 20 * MIN)).toBeCloseTo(15 / 40);
  });

  it('arrives exactly at the planned time', () => {
    let j = startJourney(makePlan(route, 40, policy), 0);
    expect(tick(j, 39 * MIN).event).toBeNull();
    const r = tick(j, 41 * MIN);
    expect(r.event).toBe('arrive');
    j = r.journey;
    expect(j.phase).toBe('arrived');
    expect(j.endedAt).toBe(40 * MIN);
    expect(j.travelledMs).toBe(40 * MIN);
  });

  it('takes rest stops on long trips without counting them as travel', () => {
    let j = startJourney(makePlan(route, 60, policy), 0);
    const r = tick(j, 31 * MIN);
    expect(r.event).toBe('rest');
    j = r.journey;
    expect(j.travelledMs).toBe(30 * MIN);
    expect(j.restStartedAt).toBe(30 * MIN);
    expect(restRemaining(j, 32 * MIN)).toBe(3 * MIN);
    j = resume(j, 36 * MIN);
    expect(j.restTotalMs).toBe(6 * MIN);
    expect(tick(j, 50 * MIN).event).toBeNull();
    expect(tick(j, 66 * MIN).event).toBe('arrive');
  });

  it('records an early finish as incomplete', () => {
    let j = startJourney(makePlan(route, 40, policy), 0);
    j = endJourney(j, 12 * MIN);
    expect(j.phase).toBe('ended');
    expect(j.travelledMs).toBe(12 * MIN);
  });
});
