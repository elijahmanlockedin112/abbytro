import { h } from './dom';

let uid = 0;
const nextId = (p: string): string => `${p}-${++uid}`;

export function segmented<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map((o) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === value), onclick: () => select(o.value) }, o.label),
  );
  function select(v: T): void {
    buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i].value === v)));
    onChange(v);
  }
  group.append(...buttons);
  return h('div', { class: 'field' }, h('div', { class: 'field-label' }, label), group);
}

export function slider(
  label: string,
  o: { min: number; max: number; step: number; value: number; format: (v: number) => string },
  onInput: (v: number) => void,
): HTMLElement {
  const id = nextId('rng');
  const out = h('output', { for: id }, o.format(o.value));
  const input = h('input', {
    id,
    type: 'range',
    min: o.min,
    max: o.max,
    step: o.step,
    value: o.value,
    oninput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      out.textContent = o.format(v);
      onInput(v);
    },
  });
  return h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, label, out), input);
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', checked, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) });
  return h('label', { class: 'toggle' }, input, h('span', {}, label));
}

export function numberField(label: string, o: { min: number; max: number; value: number; suffix?: string }, onChange: (v: number) => void): HTMLElement {
  const id = nextId('num');
  const input = h('input', {
    id,
    type: 'number',
    inputmode: 'numeric',
    min: o.min,
    max: o.max,
    value: o.value,
    onchange: (e: Event) => {
      const el = e.target as HTMLInputElement;
      const v = Math.min(o.max, Math.max(o.min, Math.round(Number(el.value) || o.value)));
      el.value = String(v);
      onChange(v);
    },
  });
  return h('div', { class: 'field field-inline' }, h('label', { for: id }, label), h('span', { class: 'num' }, input, o.suffix ? h('span', {}, o.suffix) : null));
}

/** A right-hand sheet built on <dialog>: Esc and backdrop clicks close it. */
export function sheet(title: string, body: HTMLElement, closeIcon: string): HTMLDialogElement {
  const d = h('dialog', { class: 'sheet', 'aria-label': title });
  const close = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', html: closeIcon, onclick: () => d.close() });
  d.append(h('header', { class: 'sheet-head' }, h('h2', {}, title), close), body);
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.addEventListener('close', () => d.remove());
  return d;
}
