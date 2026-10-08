// Form primitives for screens that live inside a paper sheet (see forms.css).
// Builders return elements plus small setters, so screens build once and update at 10 Hz.
import { h, text } from './dom.js';
import { DEPTS, N, meters, metersFull, readinessScale, type DeptId, type GameState, type Tuning } from '../../core/index.js';
import { bananaText, count, meterPct, meterWord } from './format.js';
import './forms.css';

/** A drawn paper banana (no colour emoji). Decorative: the button carries the aria-label. */
export function banana(): HTMLElement {
  const el = h('span', { class: 'bn', 'aria-hidden': 'true' });
  el.innerHTML =
    '<svg viewBox="0 0 20 15"><path d="M2.4 2.6C2.6 9.6 8.6 13.6 17.6 10.4L18.4 7.6C12.2 9.4 7.4 7.4 5.6 1.8z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.4 2.6L1.4.8M5.6 1.8L4.4.6" stroke="var(--walnut)" stroke-width="1.8" stroke-linecap="round"/><path d="M17.6 10.4l.8-2.8" stroke="var(--screen)" stroke-width="2" stroke-linecap="round"/></svg>';
  return el;
}

/** Dotted-leader row: LABEL ........ value. */
export function field(label: string, value: HTMLElement): HTMLElement {
  return h('div', { class: 'field' }, h('span', { class: 'lab' }, label), h('span', { class: 'lead', 'aria-hidden': 'true' }), value);
}

/** Value element for a field: monospaced, with an optional small unit after it. */
export function figure(): HTMLElement {
  return h('span', { class: 'big' });
}

/** A boxed form section with a typed header such as "Ref. 3-H / Seated". */
export function formbox(heading: string, ...children: (Node | string)[]): HTMLElement {
  return h('section', { class: 'formbox' }, h('h3', { class: 'typed' }, heading), ...children);
}

/** A stack of formboxes: the contents of a sheet. */
export function stack(...children: (Node | string)[]): HTMLElement {
  return h('div', { class: 'form-stack' }, ...children);
}

/** Double-ruled rubber stamp. `tone` picks the ink: 'ok' (olive) or the default red. */
export function stamp(label: string, tone: 'ok' | 'warn' | 'plain' = 'plain'): HTMLElement {
  return h('span', { class: `stamp stamp-${tone}` }, label);
}

export interface Ledger {
  el: HTMLElement;
  /** frac: filled share 0..1. waste: hatched share after it (optional). valuetext is read by screen readers. */
  set(frac: number, valuetext: string, waste?: number): void;
}

/** Hatched ledger bar. Always role=progressbar with valuenow and valuetext. */
export function ledger(label: string, kind: 'ok' | 'gold' = 'ok'): Ledger {
  const fillEl = h('i');
  const wasteEl = h('b');
  const el = h('div', { class: `ledger ledger-${kind}`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, fillEl, wasteEl);
  const put = (node: HTMLElement, frac: number) => {
    const v = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    if (node.style.getPropertyValue('--fill') !== v) node.style.setProperty('--fill', v);
  };
  return {
    el,
    set(frac, valuetext, waste = 0) {
      put(fillEl, frac);
      put(wasteEl, waste);
      const now = String(Math.max(0, Math.min(100, Math.floor(frac * 100))));
      if (el.getAttribute('aria-valuenow') !== now) el.setAttribute('aria-valuenow', now);
      if (el.getAttribute('aria-valuetext') !== valuetext) el.setAttribute('aria-valuetext', valuetext);
    },
  };
}

export interface Dial {
  el: HTMLElement;
  set(frac: number, word: string, valuetext: string): void;
}

const CX = 60;
const CY = 62;
const pt = (r: number, deg: number): string => `${(CX + r * Math.cos((deg * Math.PI) / 180)).toFixed(1)} ${(CY + r * Math.sin((deg * Math.PI) / 180)).toFixed(1)}`;
const arc = (r: number, a: number, b: number, col: string): string => `<path d="M${pt(r, 180 + 180 * a)}A${r} ${r} 0 0 1 ${pt(r, 180 + 180 * b)}" fill="none" stroke="${col}" stroke-width="5"/>`;

/** Brass-bezel half dial. The three arc bands match the meter vocabulary (Low / Partial / Nearly+Full). */
export function dial(label: string): Dial {
  const ticks = Array.from({ length: 11 }, (_, k) => {
    const major = k % 5 === 0;
    return `<path d="M${pt(major ? 33 : 36, 180 + 18 * k)}L${pt(40, 180 + 18 * k)}" stroke="var(--ink)" stroke-width="${major ? 1.8 : 1}"/>`;
  }).join('');
  const svg =
    '<svg viewBox="0 0 120 80" aria-hidden="true"><path d="M4 66A56 56 0 0 1 116 66V72Q116 76 112 76H8Q4 76 4 72Z" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M9 66A51 51 0 0 1 111 66Z" fill="var(--edge)" stroke="var(--screen)" stroke-width="1.2"/>' +
    arc(44, 0, 0.4, 'var(--alert)') + arc(44, 0.4, 0.75, 'var(--mustard)') + arc(44, 0.75, 1, 'var(--olive)') + ticks +
    '<g class="needle"><path d="M58 62L60 22L62 62Z" fill="var(--screen)"/><rect x="57.4" y="62" width="5.2" height="8" rx="2" fill="var(--screen)"/></g>' +
    '<circle cx="60" cy="62" r="5.4" fill="var(--mustard)" stroke="var(--screen)" stroke-width="1.2"/>' +
    '<rect x="34" y="68" width="52" height="7" rx="1.5" fill="var(--paper-shade)" stroke="var(--screen)" stroke-width=".8"/></svg>';
  const face = h('span', { class: 'gauge-face' });
  face.innerHTML = svg;
  const needle = face.querySelector('.needle') as SVGGElement;
  const word = h('p', { class: 'gv' });
  const el = h('div', { class: 'gauge', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, face, h('p', { class: 'lab' }, label), word);
  return {
    el,
    set(frac, w, valuetext) {
      const clamped = Math.max(0, Math.min(1, frac));
      const tf = `rotate(${(-90 + 180 * clamped).toFixed(1)} ${CX} ${CY})`;
      if (needle.getAttribute('transform') !== tf) needle.setAttribute('transform', tf);
      text(word, w);
      const now = String(Math.floor(clamped * 100));
      if (el.getAttribute('aria-valuenow') !== now) el.setAttribute('aria-valuenow', now);
      if (el.getAttribute('aria-valuetext') !== valuetext) el.setAttribute('aria-valuetext', valuetext);
    },
  };
}

/** A hidden-until-needed reason line that sits under a control and says why it is off. */
export function why(): HTMLElement {
  return h('p', { class: 'why', hidden: true });
}

/** Show a reason (or hide the line when null). Sets only on change. */
export function setWhy(el: HTMLElement, reason: string | null): void {
  const hide = reason === null;
  if (el.hidden !== hide) el.hidden = hide;
  if (!hide) text(el, reason);
}

/** Cost line on a button: drawn banana plus the amount, with a spoken label on the button. Rebuilds only on change. */
export function setCost(btn: HTMLElement, costEl: HTMLElement, label: string, amount: number): void {
  const key = count(amount);
  if (costEl.dataset.v !== key) {
    costEl.dataset.v = key;
    costEl.replaceChildren(banana(), key);
  }
  const spoken = `${label}: ${bananaText(amount)}`;
  if (btn.getAttribute('aria-label') !== spoken) btn.setAttribute('aria-label', spoken);
}

const DEPT_NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };

/**
 * Names what holds readiness back, from core values only: the lowest of the three meters,
 * plus the scale cap. Same sentence on Departments and Readiness.
 */
export function readinessBottleneck(s: GameState, t: Tuning): string {
  const m = meters(s, t);
  if (metersFull(m)) return 'Bottleneck: none. All three meters are Full.';
  const lo = DEPTS.reduce((a, d) => (m[d] < m[a] - 1e-9 ? d : a), DEPTS[0] as DeptId);
  const spread = Math.max(...DEPTS.map((d) => m[d])) - m[lo];
  const scale = readinessScale(s, t);
  const cap = scale < 1 - 1e-9 ? ` Scale caps every meter at ${meterPct(scale)} (${count(s.monkeys)} of ${count(t.readiness.minMonkeys)} monkeys).` : '';
  if (spread < 1e-9) return `Bottleneck: all three meters are level at ${meterPct(m[lo])} (${meterWord(m[lo])}).${cap}`;
  return `Bottleneck: ${DEPT_NAMES[lo]} at ${meterPct(m[lo])} (${meterWord(m[lo])}).${cap}`;
}

/** For previews: lets the clone afford a purchase, so the before → after shows even while the real balance is short. */
export function afford(c: GameState, cost: number): void {
  if (N.toNumber(c.bananas) < cost) c.bananas = N.of(cost);
}
