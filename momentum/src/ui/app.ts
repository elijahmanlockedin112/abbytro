import { AmbientAudio, type SoundProfile } from '../audio/AmbientAudio';
import { FlowEngine, THEME_LIST, prefersReducedMotion, type FlowOptions, type ThemeId } from '../engine';
import * as J from '../journey/journey';
import { CUSTOM_ROUTE_ID, ROUTES, findRoute } from '../journey/routes';
import * as store from '../storage/store';
import type { Settings } from '../storage/store';
import { fmtClock, fmtMinutes, fmtTime, h } from './dom';
import { FocusWatch } from './focusWatch';
import { openHistory } from './historyPanel';
import { ICON } from './icons';
import { RouteBar } from './routeBar';
import { openSettings } from './settingsPanel';

const GRACE_MS = 2500;
const PREVIEW = 0.35;
const RAMP = { start: 4, resume: 3.5, leave: 2.5, rest: 4, arrive: 5, quickReturn: 2 };
const SOUND_FOR: Record<ThemeId, SoundProfile> = { road: 'road', train: 'rail', stars: 'space' };
const themeName = (id: ThemeId): string => THEME_LIST.find((t) => t.id === id)?.name ?? id;

export class App {
  private settings: Settings = store.loadSettings();
  private journey: J.Journey | null = null;
  /** The trip just finished, shown on the arrival screen. */
  private finished: J.Journey | null = null;
  private confirmingEnd = false;
  private reduced = prefersReducedMotion();
  private readonly engine: FlowEngine;
  private readonly audio = new AmbientAudio();
  private readonly panel: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly watch: FocusWatch;
  private bar: RouteBar | null = null;
  private refs: Record<string, HTMLElement> = {};
  private readyChimed = false;
  private lastSave = 0;

  constructor(root: HTMLElement, canvas: HTMLCanvasElement) {
    this.engine = new FlowEngine(canvas, this.flowOptions());
    this.audio.attach(this.engine);
    this.audio.setVolume(this.settings.volume);
    this.audio.setMuted(this.settings.muted);
    this.audio.setProfile(this.soundProfile());

    this.muteBtn = h('button', { type: 'button', class: 'icon-btn', onclick: () => this.update({ muted: !this.settings.muted }) });
    const corner = h(
      'nav',
      { class: 'corner', 'aria-label': 'App' },
      this.muteBtn,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'History', title: 'History', html: ICON.history, onclick: () => openHistory() }),
      h('button', {
        type: 'button',
        class: 'icon-btn',
        'aria-label': 'Settings',
        title: 'Settings',
        html: ICON.gear,
        onclick: () => openSettings(this.settings, this.reduced, (p) => this.update(p)),
      }),
    );
    this.panel = h('main', { class: 'panel' });
    root.append(corner, h('div', { class: 'stage' }, this.panel));
    this.syncMute();

    this.watch = new FocusWatch({
      mode: () => this.settings.pullOver,
      graceMs: GRACE_MS,
      onLeave: () => {
        if (!this.journey) this.engine.setThrottle(0, RAMP.leave);
        else if (this.journey.phase === 'driving') this.engine.setThrottle(0, RAMP.leave);
      },
      onPullOver: (at) => {
        if (this.journey?.phase !== 'driving') return;
        this.journey = J.pullOver(this.journey, at);
        this.persist();
        this.render();
      },
      onQuickReturn: () => {
        if (this.journey?.phase === 'driving') this.engine.setThrottle(1, RAMP.quickReturn);
        else if (!this.journey && !this.finished) this.engine.setThrottle(PREVIEW, RAMP.quickReturn);
      },
      onReturn: () => {
        if (!this.journey && !this.finished) this.engine.setThrottle(PREVIEW, RAMP.quickReturn);
        this.panel.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      },
    });

    this.restore();
    this.setBands();
    this.engine.start();
    if (!this.journey) this.engine.setThrottle(PREVIEW, 2);
    this.render();

    window.setInterval(() => this.tick(), 1000);
    window.addEventListener('resize', () => this.setBands());
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('pagehide', () => this.persist());
    window.addEventListener('beforeunload', (e) => {
      if (this.journey?.phase === 'driving' || this.journey?.phase === 'restStop') {
        this.persist();
        e.preventDefault();
        e.returnValue = '';
      }
    });
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reduced = e.matches;
      this.engine.setOptions({ visible: this.motionOn() });
      if (!this.journey && !this.finished) this.render();
    });
  }

  // ---- settings ---------------------------------------------------------

  private motionOn(): boolean {
    const m = this.settings.motion;
    return m === 'on' || (m === 'system' && !this.reduced);
  }

  private edge(): number {
    return innerWidth < 640 ? Math.min(this.settings.edge, 0.1) : this.settings.edge;
  }

  private soundProfile(): SoundProfile {
    return this.settings.sound === 'auto' ? SOUND_FOR[this.settings.theme] : this.settings.sound;
  }

  private flowOptions(): Partial<FlowOptions> {
    const s = this.settings;
    return { theme: s.theme, speed: s.speed, density: s.density, opacity: s.opacity, edge: this.edge(), visible: this.motionOn() };
  }

  private update(patch: Partial<Settings>, rerender = false): void {
    this.settings = { ...this.settings, ...patch };
    store.saveSettings(this.settings);
    this.engine.setOptions(this.flowOptions());
    this.audio.setVolume(this.settings.volume);
    this.audio.setMuted(this.settings.muted);
    this.audio.setProfile(this.soundProfile());
    if (patch.pullOver) this.watch.check();
    if (patch.edge !== undefined) this.setBands();
    this.syncMute();
    const setupVisible = !this.journey && !this.finished;
    if (rerender || (setupVisible && (patch.theme || patch.motion))) this.render();
  }

  private syncMute(): void {
    const m = this.settings.muted;
    this.muteBtn.innerHTML = m ? ICON.muted : ICON.sound;
    this.muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    this.muteBtn.title = m ? 'Unmute (M)' : 'Mute (M)';
    this.muteBtn.setAttribute('aria-pressed', String(m));
  }

  private setBands(): void {
    const e = this.edge();
    if (e !== this.engine.options.edge) this.engine.setOptions({ edge: e });
    const root = document.documentElement.style;
    root.setProperty('--band-x', `${Math.round(innerWidth * e)}px`);
    root.setProperty('--band-y', `${Math.round(innerHeight * e)}px`);
  }

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') this.update({ muted: !this.settings.muted });
  }

  // ---- trip lifecycle ---------------------------------------------------

  private restore(): void {
    const snap = store.loadActive();
    if (!snap) return;
    let j = snap.journey;
    // Closing the tab mid-drive counts as pulling over at the moment it was last saved.
    if (j.phase === 'driving') j = J.pullOver(j, snap.savedAt);
    if (j.phase === 'arrived' || j.phase === 'ended') {
      store.saveActive(null);
      return;
    }
    this.journey = j;
  }

  private persist(): void {
    this.lastSave = Date.now();
    store.saveActive(this.journey);
  }

  private startTrip(): void {
    const s = this.settings;
    const route = findRoute(s.routeId);
    const base = route ?? { id: CUSTOM_ROUTE_ID, from: s.customFrom, to: s.customTo, theme: s.theme, via: [] };
    const plan = J.makePlan({ ...base, theme: s.theme }, route ? route.minutes : s.customMinutes, s.rests);
    this.journey = J.startJourney(plan, Date.now());
    this.finished = null;
    this.confirmingEnd = false;
    void this.audio.start();
    this.engine.setThrottle(1, RAMP.start);
    this.persist();
    this.render();
  }

  private resumeTrip(): void {
    if (!this.journey) return;
    this.journey = J.resume(this.journey, Date.now());
    void this.audio.start();
    this.engine.setThrottle(1, RAMP.resume);
    this.persist();
    this.render();
  }

  private pullOverNow(): void {
    if (this.journey?.phase !== 'driving') return;
    this.engine.setThrottle(0, RAMP.leave);
    this.journey = J.pullOver(this.journey, Date.now());
    this.persist();
    this.render();
  }

  private endTrip(): void {
    if (!this.journey) return;
    this.engine.setThrottle(0, RAMP.leave);
    this.finish(J.endJourney(this.journey, Date.now()));
  }

  private finish(j: J.Journey): void {
    if (j.phase === 'arrived') {
      this.engine.setThrottle(0, RAMP.arrive);
      this.audio.chime('arrive');
    }
    store.addRecord(store.toRecord(j, this.motionOn()));
    this.journey = null;
    this.finished = j;
    this.confirmingEnd = false;
    store.saveActive(null);
    this.render();
  }

  private newTrip(): void {
    this.finished = null;
    this.engine.setThrottle(PREVIEW, 3);
    this.render();
  }

  private tick(): void {
    const j = this.journey;
    if (!j) return;
    const now = Date.now();
    const { journey, event } = J.tick(j, now);
    this.journey = journey;
    if (event === 'rest') {
      this.engine.setThrottle(0, RAMP.rest);
      this.readyChimed = false;
      this.confirmingEnd = false;
      this.persist();
      this.render();
    } else if (event === 'arrive') {
      this.finish(journey);
    } else {
      if (now - this.lastSave > 15_000) this.persist();
      this.refresh(now);
    }
  }

  // ---- views ------------------------------------------------------------

  private render(): void {
    this.refs = {};
    this.bar = null;
    const j = this.journey;
    let view: HTMLElement;
    if (j) view = j.phase === 'restStop' ? this.restView(j) : this.tripView(j);
    else if (this.finished) view = this.summaryView(this.finished);
    else view = this.setupView();
    this.panel.replaceChildren(view);
    this.panel.dataset.view = j ? j.phase : this.finished ? 'summary' : 'setup';
    this.refresh(Date.now());
    this.panel.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }

  /** Cheap per-second update of the live numbers. */
  private refresh(now: number): void {
    const j = this.journey;
    if (!j) {
      document.title = 'Momentum';
      return;
    }
    const left = J.remaining(j, now);
    this.bar?.set(J.progress(j, now));
    const r = this.refs;
    if (r.remaining) r.remaining.textContent = fmtMinutes(left);
    if (r.eta) {
      const restsLeft = j.plan.rests.length - j.restsTaken;
      r.eta.textContent = `to ${j.plan.to} · arrive ${fmtTime(now + left + restsLeft * j.plan.restMs)}`;
    }
    if (r.next) r.next.textContent = `Next: ${J.nextStop(j, now)}`;
    if (r.pullovers) r.pullovers.textContent = `${j.pullOvers} pull-over${j.pullOvers === 1 ? '' : 's'}`;
    if (j.phase === 'restStop') {
      const rest = J.restRemaining(j, now);
      if (r.restClock) r.restClock.textContent = fmtClock(rest);
      if (rest <= 0 && !this.readyChimed) {
        this.readyChimed = true;
        this.audio.chime('ready');
        if (r.restNote) r.restNote.textContent = 'Break’s over. Back on the road when you’re ready.';
        r.restBtn?.classList.add('pulse');
      }
      document.title = `Rest stop · Momentum`;
    } else if (j.phase === 'pulledOver') {
      document.title = `Pulled over · Momentum`;
    } else {
      document.title = `${fmtMinutes(left)} to ${j.plan.to} · Momentum`;
    }
  }

  private setupView(): HTMLElement {
    const s = this.settings;
    const selected = findRoute(s.routeId) ? s.routeId : CUSTOM_ROUTE_ID;
    const card = (id: string, title: string, meta: string): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: 'route-card',
          role: 'radio',
          'aria-checked': String(id === selected),
          onclick: () => this.update({ routeId: id, theme: findRoute(id)?.theme ?? s.theme }, true),
        },
        h('span', { class: 'route-card-title' }, title),
        h('span', { class: 'route-card-meta' }, meta),
      );
    const routes = h('div', { class: 'routes', role: 'radiogroup', 'aria-label': 'Route' });
    for (const r of ROUTES) routes.append(card(r.id, `${r.from} → ${r.to}`, `${fmtMinutes(r.minutes * 60_000)} · ${themeName(r.theme)}`));
    routes.append(card(CUSTOM_ROUTE_ID, 'Custom trip', 'Your own places and time'));

    const minutes = selected === CUSTOM_ROUTE_ID ? s.customMinutes : findRoute(selected)!.minutes;
    const info = h('p', { class: 'hint center' });
    const setInfo = (min: number): void => {
      const rests = J.planRests(min * 60_000, s.rests).length;
      info.textContent = rests ? `${rests} rest stop${rests > 1 ? 's' : ''} of ${s.rests.lengthMin} min on the way` : 'Straight through, no rest stops';
    };
    setInfo(minutes);

    const custom =
      selected === CUSTOM_ROUTE_ID
        ? h(
            'div',
            { class: 'custom' },
            h('label', {}, 'From', h('input', { type: 'text', value: s.customFrom, maxlength: 40, oninput: (e: Event) => this.update({ customFrom: (e.target as HTMLInputElement).value || 'Here' }) })),
            h('label', {}, 'To', h('input', { type: 'text', value: s.customTo, maxlength: 40, oninput: (e: Event) => this.update({ customTo: (e.target as HTMLInputElement).value || 'Done' }) })),
            h(
              'label',
              {},
              'Minutes',
              h('input', {
                type: 'number',
                inputmode: 'numeric',
                min: 1,
                max: 600,
                value: s.customMinutes,
                oninput: (e: Event) => {
                  const v = Math.min(600, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
                  if (v) {
                    this.update({ customMinutes: v });
                    setInfo(v);
                  }
                },
              }),
            ),
          )
        : null;

    const themes = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Theme' });
    for (const t of THEME_LIST) {
      themes.append(
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(t.id === s.theme), title: t.blurb, onclick: () => this.update({ theme: t.id }, true) }, t.name),
      );
    }

    const motionNote = this.motionOn()
      ? null
      : h(
          'p',
          { class: 'note' },
          s.motion === 'off' ? 'Motion is off. ' : 'Your system asks for reduced motion, so this trip is audio-only. ',
          h('button', { type: 'button', class: 'link', onclick: () => this.update({ motion: 'on' }, true) }, 'Turn motion on'),
        );

    return h(
      'section',
      { class: 'view setup' },
      h('div', { class: 'brand' }, 'Momentum'),
      h('h1', {}, 'Where are you headed?'),
      routes,
      custom,
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'View from the window'), themes),
      motionNote,
      h(
        'div',
        { class: 'start-bar' },
        h('button', { type: 'button', class: 'btn primary wide', 'data-autofocus': true, onclick: () => this.startTrip() }, 'Start journey'),
        info,
      ),
    );
  }

  private tripView(j: J.Journey): HTMLElement {
    this.bar = new RouteBar(j.plan);
    const r = this.refs;
    r.remaining = h('div', { class: 'big' });
    r.eta = h('div', { class: 'sub' });
    r.next = h('span', {});
    r.pullovers = h('span', {});
    const head = h(
      'div',
      { class: 'trip-head' },
      h('div', { class: 'trip-title' }, `${j.plan.from} → ${j.plan.to}`),
      r.remaining,
      r.eta,
    );
    const status = h('div', { class: 'trip-status' }, r.next, r.pullovers);

    let actions: HTMLElement;
    if (this.confirmingEnd) {
      actions = h(
        'div',
        { class: 'card' },
        h('h2', {}, 'End the trip here?'),
        h('p', {}, `You’re ${fmtMinutes(J.remaining(j, Date.now()))} from ${j.plan.to}. The trip is saved as unfinished.`),
        h(
          'div',
          { class: 'row-btns' },
          h('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, onclick: () => ((this.confirmingEnd = false), this.render()) }, 'Keep going'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => this.endTrip() }, 'End trip'),
        ),
      );
    } else if (j.phase === 'pulledOver') {
      actions = h(
        'div',
        { class: 'card pulled' },
        h('h2', {}, 'Resume trip?'),
        h('p', {}, `You pulled over near ${J.lastPassed(j, Date.now())}. ${fmtMinutes(J.remaining(j, Date.now()))} left to ${j.plan.to}.`),
        h(
          'div',
          { class: 'row-btns' },
          h('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, onclick: () => this.resumeTrip() }, 'Resume trip'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => ((this.confirmingEnd = true), this.render()) }, 'End trip here'),
        ),
      );
    } else {
      actions = h(
        'div',
        { class: 'row-btns' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => this.pullOverNow() }, 'Pull over'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => ((this.confirmingEnd = true), this.render()) }, 'End trip'),
      );
    }
    return h('section', { class: 'view trip' }, head, this.bar.el, status, actions);
  }

  private restView(j: J.Journey): HTMLElement {
    const r = this.refs;
    r.restClock = h('div', { class: 'big' });
    r.restNote = h('p', {}, 'Stretch, drink some water, rest your eyes on something far away.');
    r.restBtn = h('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, onclick: () => this.resumeTrip() }, 'Continue journey');
    this.bar = new RouteBar(j.plan);
    return h(
      'section',
      { class: 'view rest' },
      h('div', { class: 'trip-title' }, `Rest stop · ${J.lastPassed(j, Date.now())}`),
      r.restClock,
      r.restNote,
      this.bar.el,
      h('div', { class: 'row-btns' }, r.restBtn, h('button', { type: 'button', class: 'btn ghost', onclick: () => this.endTrip() }, 'End trip here')),
    );
  }

  private summaryView(j: J.Journey): HTMLElement {
    const arrived = j.phase === 'arrived';
    const end = j.endedAt ?? Date.now();
    const stat = (label: string, value: string): HTMLElement => h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label));
    const at = j.travelledMs / j.plan.plannedMs;
    let near = j.plan.from;
    for (const w of j.plan.waypoints) if (at >= w.at) near = w.name;
    return h(
      'section',
      { class: 'view summary' },
      h('div', { class: 'brand' }, arrived ? 'Arrived' : 'Trip ended'),
      h('h1', {}, arrived ? j.plan.to : `Stopped near ${near}`),
      h('p', { class: 'sub' }, arrived ? `${j.plan.from} → ${j.plan.to}` : `${fmtMinutes(j.plan.plannedMs - j.travelledMs)} short of ${j.plan.to}`),
      h(
        'div',
        { class: 'stats' },
        stat('Travelled', fmtMinutes(j.travelledMs)),
        stat('Elapsed', fmtMinutes(end - j.startedAt)),
        stat('Pull-overs', String(j.pullOvers)),
        stat('Rest stops', String(j.restsTaken)),
      ),
      h('button', { type: 'button', class: 'btn primary wide', 'data-autofocus': true, onclick: () => this.newTrip() }, 'Plan another trip'),
    );
  }
}
