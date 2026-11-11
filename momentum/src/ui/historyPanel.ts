import { clearHistory, loadHistory, type SessionRecord } from '../storage/store';
import { sheet } from './controls';
import { fmtMinutes, h } from './dom';
import { ICON } from './icons';

function row(r: SessionRecord): HTMLElement {
  const date = new Date(r.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = new Date(r.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const po = `${r.pullOvers} pull-over${r.pullOvers === 1 ? '' : 's'}`;
  return h(
    'li',
    { class: 'hist-row' },
    h('div', { class: 'hist-main' }, h('strong', {}, `${r.from} → ${r.to}`), h('span', { class: r.completed ? 'tag ok' : 'tag' }, r.completed ? 'Arrived' : 'Ended early')),
    h('div', { class: 'hist-meta' }, `${date}, ${time} · ${fmtMinutes(r.travelledMs)} of ${fmtMinutes(r.plannedMs)} · ${po}${r.motion ? '' : ' · no motion'}`),
  );
}

export function openHistory(): void {
  const records = loadHistory();
  const list = h('ul', { class: 'hist' });
  const body = h('div', { class: 'sheet-body' });
  const done = records.filter((r) => r.completed).length;
  const minutes = records.reduce((s, r) => s + r.travelledMs, 0);
  if (records.length) {
    body.append(h('p', { class: 'hint' }, `${records.length} trips · ${done} arrived · ${fmtMinutes(minutes)} travelled`));
    list.append(...records.map(row));
    body.append(list);
    const exportBtn = h('button', {
      type: 'button',
      class: 'btn ghost',
      onclick: () => {
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: 'momentum-history.json' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    }, 'Export JSON');
    const clearBtn = h('button', {
      type: 'button',
      class: 'btn ghost danger',
      onclick: (e: Event) => {
        const b = e.currentTarget as HTMLButtonElement;
        if (b.dataset.armed) {
          clearHistory();
          list.replaceChildren();
          body.replaceChildren(h('p', { class: 'hint' }, 'History cleared.'));
        } else {
          b.dataset.armed = '1';
          b.textContent = 'Tap again to clear';
        }
      },
    }, 'Clear history');
    body.append(h('div', { class: 'row-btns' }, exportBtn, clearBtn));
  } else {
    body.append(h('p', { class: 'hint' }, 'No trips yet. Finished and abandoned trips show up here.'));
  }
  const d = sheet('History', body, ICON.close);
  document.body.append(d);
  d.showModal();
}
