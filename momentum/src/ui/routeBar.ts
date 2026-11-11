import type { JourneyPlan } from '../journey/journey';
import { h } from './dom';
import { ICON, VEHICLE } from './icons';

/** The progress bar drawn as a route: stops, rest areas and a vehicle marker. */
export class RouteBar {
  readonly el: HTMLElement;
  private readonly done: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly stops: { el: HTMLElement; at: number }[] = [];
  private last = -1;

  constructor(plan: JourneyPlan) {
    this.done = h('div', { class: 'route-done' });
    this.marker = h('div', { class: 'route-vehicle', html: VEHICLE[plan.theme] });
    const track = h('div', { class: 'route-track' }, this.done);
    const add = (cls: string, at: number, title: string, html = ''): void => {
      const el = h('div', { class: cls, style: `left:${at * 100}%`, title, html });
      track.append(el);
      this.stops.push({ el, at });
    };
    add('route-stop route-end', 0, plan.from);
    for (const w of plan.waypoints) add('route-stop', w.at, w.name);
    for (const r of plan.rests) add('route-rest', r / plan.plannedMs, 'Rest stop', ICON.rest);
    add('route-stop route-end', 1, plan.to);
    track.append(this.marker);
    this.el = h(
      'div',
      { class: 'route', role: 'progressbar', 'aria-label': `${plan.from} to ${plan.to}`, 'aria-valuemin': 0, 'aria-valuemax': 100 },
      track,
      h('div', { class: 'route-labels' }, h('span', {}, plan.from), h('span', {}, plan.to)),
    );
  }

  set(progress: number): void {
    const p = Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 10;
    if (p === this.last) return;
    this.last = p;
    this.done.style.width = `${p}%`;
    this.marker.style.left = `${p}%`;
    this.el.setAttribute('aria-valuenow', String(Math.floor(p)));
    for (const s of this.stops) s.el.classList.toggle('passed', s.at * 100 <= p);
  }
}
