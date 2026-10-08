// Form primitives for screens that live inside a paper sheet (see forms.css).
// Builders return elements plus small setters, so screens build once and update at 10 Hz.
//
// ---------------------------------------------------------------------------------------
// Sheet layout recipe (see docs/DISCOVERABILITY.md). Lead with the live decision, hide the rest.
// Build once in mount(); call the update methods every render(). All updates touch the DOM
// only when a value changed, so calling them at 10 Hz is cheap. Numbers come from core; the
// primitives only display what you pass. Copy-paste starting points:
//
//   // 1. nextCard: ONE primary action, why it matters, what it does.
//   const next = nextCard({ onAct: () => hire() });            // { hire: true } = curved tangerine
//   next.update({ label: 'Hire a monkey', cost: 120, enabled: canHire,
//     why: 'Monkeys type all day and earn you bananas.',
//     effect: { label: 'Monkeys', from: '3', to: '4' }, secondary: 'Hire faster unlocks at 5.' });
//   next.update({ label: null, hint: 'Check back when Words is filed.' });   // calm state
//
//   // 2. folder: collapsible, remembers open/closed, can stay hidden until relevant.
//   const dept = folder({ key: 'dept-editing', title: 'Editing', announce: true }, rows);
//   dept.setSummary('Level 3 · 0.9/s');  dept.show(unlocked);
//
//   // 3. buyRow: name + before → after + a price button that fills like a gauge.
//   const row = buyRow({ onBuy: () => buy(id) });
//   row.update({ label: 'Hire faster', effect: { from: '1.0/s', to: '1.2/s' },
//     price: 1000, have: 873, progress: 873 / 1000, enabled: false });
//   // non-money reasons: reason: 'Needs a free desk' (shown as a line under the row)
//
//   // 4. presetRow: 2-4 radio chips; sliders live behind "Adjust by hand".
//   const pre = presetRow({ label: 'Funding', options: [{ id: 'sug', label: 'Suggested' },
//     { id: 'grow', label: 'Favour growth' }], onPick: (id) => apply(id) }, sliders);
//   pre.select('sug');  // or pre.select(null) when the sliders no longer match a preset
//
//   // 5. tabs: panels are real elements; fill them once.
//   const t = tabs({ key: 'library', tabs: [{ id: 'now', label: 'Now' }, { id: 'done', label: 'Filed' }] });
//   t.panel('now').append(...);  t.badge('done', '2');  t.show('done', hasAny);
//
//   // 6. sealed: a future item, no price.     sealed('Opens when Words is filed').el
//   // 7. chip: a completed item.              chip('Words', 'Discovered').el
// ---------------------------------------------------------------------------------------
import { attr, h, show, storeGet, storeSet, text, uid } from './dom.js';
import { DEPTS, N, meters, metersFull, readinessScale, type DeptId, type GameState, type Tuning } from '../../core/index.js';
import { bananaText, costSpoken, count, meterPct, meterWord } from './format.js';
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

// =======================================================================================
// Discoverability primitives: nextCard, folder, buyRow, presetRow, tabs, sealed, chip.
// =======================================================================================

/** A before → after effect. A plain string is shown as given. `label` prefixes it ("Output"). */
export type Effect = string | { label?: string; from: string; to: string };

/** Fill `el` with an effect line: label, then mono from → to. Rebuilds only on change. */
function setEffect(el: HTMLElement, fx: Effect | null | undefined): void {
  const key = fx == null ? '' : typeof fx === 'string' ? fx : `${fx.label ?? ''}\u0001${fx.from}\u0001${fx.to}`;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  show(el, key !== '');
  if (fx == null) {
    el.replaceChildren();
  } else if (typeof fx === 'string') {
    el.replaceChildren(fx);
  } else {
    el.replaceChildren(
      ...(fx.label ? [h('span', { class: 'fx-lab' }, `${fx.label} `)] : []),
      h('span', { class: 'n' }, fx.from),
      h('span', { class: 'fx-arrow', 'aria-hidden': 'true' }, ' → '),
      h('span', { class: 'vh' }, ' becomes '),
      h('span', { class: 'n fx-to' }, fx.to),
    );
  }
}

// ---------- nextCard ----------

export interface NextOptions {
  /** Heading in typed Courier. Default "Next step". */
  heading?: string;
  /** Use the curved tangerine `.hire` button (Personnel's hire). */
  hire?: boolean;
  /** Called when the primary button is pressed. */
  onAct?: () => void;
}

export interface NextUpdate {
  /** Button text. null or omitted shows the calm state instead. */
  label?: string | null;
  /** Calm state only: what to look for later. Shown after "Nothing needs you here right now." */
  hint?: string;
  /** Banana price shown under the label (drawn banana + amount). Omit for free actions. */
  cost?: number;
  /** Default true. */
  enabled?: boolean;
  /** One plain sentence, 14+ px, saying why this is the thing to do. */
  why?: string;
  /** Before → after line. */
  effect?: Effect | null;
  /** Optional quieter extra line. */
  secondary?: string | null;
  /** Why the button is off (non-money reasons), shown in bold under the effect. */
  reason?: string | null;
  /** Hire style only: 0..1 cooldown sweep across the button. */
  cooldown?: number;
  /** Replace the click handler. */
  onAct?: () => void;
}

export interface NextCard {
  el: HTMLElement;
  /** The primary button, for tests and focus management. */
  button: HTMLButtonElement;
  update(u: NextUpdate): void;
}

/** The "Next" card at the top of a form: one action, one reason, one effect. */
export function nextCard(opts: NextOptions = {}): NextCard {
  let onAct = opts.onAct;
  const labelEl = h('span', { class: 'next-label' });
  const costEl = h('span', { class: 'cost', hidden: true });
  const cdEl = h('i', { class: 'hire-cooldown', 'aria-hidden': 'true', hidden: !opts.hire });
  const button = h('button', { type: 'button', class: opts.hire ? 'hire next-act' : 'strong next-act wide', onclick: () => onAct?.() }, cdEl, labelEl, costEl);
  const whyEl = h('p', { class: 'next-why' });
  const fxEl = h('p', { class: 'next-fx', hidden: true });
  const reasonEl = h('p', { class: 'next-reason', hidden: true });
  const secEl = h('p', { class: 'next-sec', hidden: true });
  const calmEl = h('p', { class: 'next-calm', hidden: true });
  const act = h('div', { class: 'next-actwrap' }, button);
  const el = h('section', { class: `next${opts.hire ? ' next-hire' : ''}`, 'aria-label': opts.heading ?? 'Next step' }, h('h3', { class: 'typed' }, opts.heading ?? 'Next step'), act, whyEl, fxEl, reasonEl, secEl, calmEl);
  return {
    el,
    button,
    update(u) {
      if (u.onAct) onAct = u.onAct;
      const label = u.label ?? null;
      const calm = label === null;
      show(act, !calm);
      show(whyEl, !calm);
      show(calmEl, calm);
      el.classList.toggle('calm', calm);
      if (label === null) {
        text(calmEl, `Nothing needs you here right now.${u.hint ? ` ${u.hint}` : ''}`);
        setEffect(fxEl, null);
        show(reasonEl, false);
        show(secEl, u.secondary != null);
        if (u.secondary != null) text(secEl, u.secondary);
        return;
      }
      text(labelEl, label);
      const enabled = u.enabled ?? true;
      if (button.disabled === enabled) button.disabled = !enabled;
      if (u.cost !== undefined) {
        setCost(button, costEl, label, u.cost);
        show(costEl, true);
      } else {
        show(costEl, false);
        if (button.hasAttribute('aria-label')) button.removeAttribute('aria-label');
      }
      if (opts.hire) {
        const v = `${Math.max(0, Math.min(1, u.cooldown ?? 0)) * 100}%`;
        if (cdEl.style.getPropertyValue('--fill') !== v) cdEl.style.setProperty('--fill', v);
      }
      text(whyEl, u.why ?? '');
      setEffect(fxEl, u.effect);
      const r = u.reason ?? null;
      show(reasonEl, r !== null && !enabled);
      if (r !== null) text(reasonEl, r);
      show(secEl, u.secondary != null);
      if (u.secondary != null) text(secEl, u.secondary);
    },
  };
}

// ---------- folder ----------

export interface FolderOptions {
  /** Unique key; open/closed is remembered under it in localStorage. */
  key: string;
  title: string;
  /** Shown beside the title while collapsed, e.g. "Level 3 · 0.9/s". */
  summary?: string;
  /** Open on first visit. Default false. */
  defaultOpen?: boolean;
  /** Show a "New" stamp from when it first appears until the player first toggles it. */
  announce?: boolean;
  /** Start hidden (call show(true) when it becomes relevant). */
  hidden?: boolean;
}

export interface Folder {
  el: HTMLElement;
  /** Put content here (or pass children to folder()). */
  body: HTMLElement;
  setSummary(s: string): void;
  setTitle(s: string): void;
  setOpen(on: boolean): void;
  isOpen(): boolean;
  /** Hide the whole folder until relevant. */
  show(on: boolean): void;
}

/** A collapsible paper folder with a 44 px tab row. */
export function folder(opts: FolderOptions, ...children: (Node | string)[]): Folder {
  const openKey = `im:folder:${opts.key}`;
  const seenKey = `im:folder-seen:${opts.key}`;
  const saved = storeGet(openKey);
  let open = saved === null ? !!opts.defaultOpen : saved === '1';
  const bodyId = uid('folder-body');
  const btnId = uid('folder-tab');
  const titleEl = h('span', { class: 'ft-title' }, opts.title);
  const newEl = h('span', { class: 'ft-new', hidden: true }, 'New');
  const sumEl = h('span', { class: 'ft-sum' }, opts.summary ?? '');
  const chev = h('span', { class: 'ft-chev', 'aria-hidden': 'true' });
  const btn = h('button', { type: 'button', class: 'ft-btn', id: btnId, 'aria-expanded': String(open), 'aria-controls': bodyId }, titleEl, newEl, sumEl, chev);
  const body = h('div', { class: 'folder-body', id: bodyId, role: 'region', 'aria-labelledby': btnId, hidden: !open }, ...children);
  const el = h('section', { class: 'folder', hidden: !!opts.hidden }, h('h3', { class: 'folder-h' }, btn), body);
  const sync = () => {
    attr(btn, 'aria-expanded', String(open));
    show(body, open);
    el.classList.toggle('is-open', open);
    show(sumEl, !open && sumEl.textContent !== '');
  };
  const markSeen = () => {
    if (!opts.announce || storeGet(seenKey)) return;
    storeSet(seenKey, '1');
    show(newEl, false);
  };
  btn.addEventListener('click', () => {
    open = !open;
    storeSet(openKey, open ? '1' : '0');
    markSeen();
    sync();
  });
  sync();
  return {
    el,
    body,
    setSummary(s) {
      text(sumEl, s);
      sync();
    },
    setTitle: (s) => text(titleEl, s),
    setOpen(on) {
      if (on === open) return;
      open = on;
      storeSet(openKey, on ? '1' : '0');
      sync();
    },
    isOpen: () => open,
    show(on) {
      show(el, on);
      if (on && opts.announce && !storeGet(seenKey)) show(newEl, true);
    },
  };
}

// ---------- buyRow ----------

export interface BuyOptions {
  /** Pressed when the price button is enabled and tapped. */
  onBuy?: () => void;
  /** Spoken verb in the button's name. Default "Buy". */
  verb?: string;
}

export interface BuyUpdate {
  label: string;
  effect?: Effect | null;
  /** Banana price. */
  price: number;
  /** Balance, for the spoken "Costs X, you have Y". Optional but recommended. */
  have?: number;
  /** 0..1 gauge fill while unaffordable (balance / price). */
  progress: number;
  enabled: boolean;
  /** Non-money reason (needs a free desk, locked by stage...). Shown as a line under the row. */
  reason?: string | null;
  onBuy?: () => void;
}

export interface BuyRow {
  el: HTMLElement;
  button: HTMLButtonElement;
  update(u: BuyUpdate): void;
}

/** Compact purchase row. The price is always printed; the fill behind it is a gauge, never the only signal. */
export function buyRow(opts: BuyOptions = {}): BuyRow {
  let onBuy = opts.onBuy;
  const nameEl = h('p', { class: 'buy-name' });
  const fxEl = h('p', { class: 'buy-fx', hidden: true });
  const fillEl = h('i', { class: 'buy-fill', 'aria-hidden': 'true' });
  const priceEl = h('span', { class: 'cost', 'aria-hidden': 'true' });
  const spokenEl = h('span', { class: 'vh' });
  const button = h('button', { type: 'button', class: 'buy-btn', onclick: () => onBuy?.() }, fillEl, priceEl, spokenEl);
  const reasonEl = h('p', { class: 'why buy-why', hidden: true });
  const el = h('div', { class: 'buy' }, h('div', { class: 'buy-info' }, nameEl, fxEl), button, reasonEl);
  return {
    el,
    button,
    update(u) {
      if (u.onBuy) onBuy = u.onBuy;
      text(nameEl, u.label);
      setEffect(fxEl, u.effect);
      const key = count(u.price);
      if (priceEl.dataset.v !== key) {
        priceEl.dataset.v = key;
        priceEl.replaceChildren(banana(), key);
      }
      if (button.disabled === u.enabled) button.disabled = !u.enabled;
      el.classList.toggle('ready', u.enabled);
      const frac = u.enabled ? 1 : Math.max(0, Math.min(1, u.progress));
      const v = `${Math.round(frac * 100)}%`;
      if (fillEl.style.getPropertyValue('--fill') !== v) fillEl.style.setProperty('--fill', v);
      const verb = opts.verb ?? 'Buy';
      const cost = u.have === undefined ? `Costs ${bananaText(u.price)}` : costSpoken(u.price, u.have);
      const r = u.reason ?? null;
      text(spokenEl, `${verb} ${u.label}. ${u.enabled ? `Costs ${bananaText(u.price)}.` : `${cost}.`}${r && !u.enabled ? ` ${r}.` : ''}`);
      show(reasonEl, r !== null && !u.enabled);
      if (r !== null) text(reasonEl, r);
    },
  };
}

// ---------- presetRow ----------

export interface Preset {
  id: string;
  label: string;
}

export interface PresetOptions {
  /** Accessible name of the group, e.g. "Funding". */
  label: string;
  /** 2-4 choices. */
  options: Preset[];
  /** Initially selected id, or null for none (custom). */
  selected?: string | null;
  /** Called when the player picks a chip (by tap or arrow keys). */
  onPick: (id: string) => void;
  /** Text of the disclosure. Default "Adjust by hand". */
  adjustLabel?: string;
  /** Remember the disclosure's open state under this key. */
  key?: string;
}

export interface PresetRow {
  el: HTMLElement;
  /** The hidden-until-asked container for the screen's sliders. */
  adjust: HTMLElement;
  /** Show which preset is current, without firing onPick. null = none match (custom). */
  select(id: string | null): void;
  setAdjustOpen(on: boolean): void;
}

/** Preset chips (radio group) plus an "Adjust by hand" disclosure for the arbitrary controls. */
export function presetRow(opts: PresetOptions, ...adjustChildren: (Node | string)[]): PresetRow {
  let current: string | null = opts.selected ?? null;
  const chips = opts.options.map((o) => h('button', { type: 'button', class: 'chip-btn', role: 'radio', 'data-id': o.id }, o.label));
  const group = h('div', { class: 'presets', role: 'radiogroup', 'aria-label': opts.label }, ...chips);
  const sync = () => {
    const found = opts.options.findIndex((o) => o.id === current);
    chips.forEach((c, i) => {
      attr(c, 'aria-checked', String(i === found));
      attr(c, 'tabindex', i === Math.max(0, found) ? '0' : '-1');
    });
  };
  const pick = (i: number, focus: boolean) => {
    const o = opts.options[i]!;
    current = o.id;
    sync();
    if (focus) chips[i]!.focus();
    opts.onPick(o.id);
  };
  chips.forEach((c, i) => c.addEventListener('click', () => pick(i, false)));
  group.addEventListener('keydown', (e) => {
    const n = chips.length;
    const at = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to, true);
  });
  const bodyId = uid('adjust');
  const storeKey = opts.key ? `im:adjust:${opts.key}` : null;
  let open = storeKey ? storeGet(storeKey) === '1' : false;
  const adjust = h('div', { class: 'adjust-body', id: bodyId, hidden: !open }, ...adjustChildren);
  const toggle = h('button', { type: 'button', class: 'adjust-btn quiet', 'aria-expanded': String(open), 'aria-controls': bodyId }, h('span', { class: 'ft-chev', 'aria-hidden': 'true' }), opts.adjustLabel ?? 'Adjust by hand');
  const setOpen = (on: boolean) => {
    open = on;
    attr(toggle, 'aria-expanded', String(on));
    show(adjust, on);
    if (storeKey) storeSet(storeKey, on ? '1' : '0');
  };
  toggle.addEventListener('click', () => setOpen(!open));
  const el = h('div', { class: 'presetrow' }, group, toggle, adjust);
  sync();
  return {
    el,
    adjust,
    select(id) {
      if (id === current) return;
      current = id;
      sync();
    },
    setAdjustOpen: setOpen,
  };
}

// ---------- tabs ----------

export interface TabSpec {
  id: string;
  label: string;
}

export interface TabsOptions {
  /** Unique key; the selected tab is remembered under it. */
  key: string;
  tabs: TabSpec[];
  /** Used when nothing is remembered. Default: the first tab. */
  initial?: string;
  /** Called after the selection changes (tap, keys, or select()). */
  onSelect?: (id: string) => void;
}

export interface Tabs {
  el: HTMLElement;
  panel(id: string): HTMLElement;
  select(id: string): void;
  selected(): string;
  /** Small mono count/mark on a tab (e.g. "2"), or null to clear. Spoken as part of the tab name. */
  badge(id: string, value: string | null): void;
  /** Hide a tab (and its panel) until relevant. */
  show(id: string, on: boolean): void;
}

/** Paper folder tabs with tablist/tab/tabpanel semantics and arrow-key navigation. */
export function tabs(opts: TabsOptions): Tabs {
  const storeKey = `im:tab:${opts.key}`;
  const ids = opts.tabs.map((t) => t.id);
  const hiddenIds = new Set<string>();
  const saved = storeGet(storeKey);
  let current = saved && ids.includes(saved) ? saved : opts.initial && ids.includes(opts.initial) ? opts.initial : ids[0]!;
  const base = uid('tabs');
  const btns = new Map<string, HTMLButtonElement>();
  const badges = new Map<string, HTMLElement>();
  const panels = new Map<string, HTMLElement>();
  for (const t of opts.tabs) {
    const badgeEl = h('span', { class: 'tab-badge', hidden: true });
    badges.set(t.id, badgeEl);
    btns.set(t.id, h('button', { type: 'button', class: 'tab', role: 'tab', id: `${base}-t-${t.id}`, 'aria-controls': `${base}-p-${t.id}` }, h('span', { class: 'tab-label' }, t.label), badgeEl));
    panels.set(t.id, h('div', { class: 'tabpanel', role: 'tabpanel', id: `${base}-p-${t.id}`, 'aria-labelledby': `${base}-t-${t.id}`, tabindex: '0' }));
  }
  const list = h('div', { class: 'tablist', role: 'tablist' }, ...btns.values());
  const el = h('div', { class: 'tabs' }, list, ...panels.values());
  const visible = () => ids.filter((i) => !hiddenIds.has(i));
  const sync = () => {
    if (hiddenIds.has(current)) current = visible()[0] ?? current;
    for (const id of ids) {
      const on = id === current;
      const b = btns.get(id)!;
      attr(b, 'aria-selected', String(on));
      attr(b, 'tabindex', on ? '0' : '-1');
      show(b, !hiddenIds.has(id));
      show(panels.get(id)!, on);
    }
  };
  const select = (id: string, focus = false) => {
    if (!ids.includes(id) || hiddenIds.has(id)) return;
    const changed = id !== current;
    current = id;
    storeSet(storeKey, id);
    sync();
    if (focus) btns.get(id)!.focus();
    if (changed) opts.onSelect?.(id);
  };
  for (const [id, b] of btns) b.addEventListener('click', () => select(id));
  list.addEventListener('keydown', (e) => {
    const vis = visible();
    const at = vis.indexOf(current);
    const to = e.key === 'ArrowRight' ? (at + 1) % vis.length : e.key === 'ArrowLeft' ? (at + vis.length - 1) % vis.length : e.key === 'Home' ? 0 : e.key === 'End' ? vis.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    select(vis[to]!, true);
  });
  sync();
  return {
    el,
    panel: (id) => panels.get(id)!,
    select: (id) => select(id),
    selected: () => current,
    badge(id, value) {
      const b = badges.get(id);
      if (!b) return;
      show(b, value !== null);
      if (value !== null) text(b, value);
    },
    show(id, on) {
      if (on) hiddenIds.delete(id);
      else hiddenIds.add(id);
      sync();
    },
  };
}

// ---------- sealed ----------

export interface Sealed {
  el: HTMLElement;
  set(textLine: string): void;
}

/** A sealed envelope: a future item with no price. "Opens when Words is filed". */
export function sealed(line: string): Sealed {
  const lineEl = h('p', { class: 'sealed-text' }, line);
  const icon = h('span', { class: 'sealed-icon', 'aria-hidden': 'true' });
  icon.innerHTML = '<svg viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1.5 2L14 11.5L26.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="14" cy="11.5" r="2.6" fill="currentColor"/></svg>';
  return { el: h('div', { class: 'sealed', role: 'group' }, icon, lineEl), set: (t) => text(lineEl, t) };
}

// ---------- chip ----------

export interface Chip {
  el: HTMLElement;
  set(name: string, status?: string): void;
}

/** A collapsed "done" chip: a stamped "WORDS · DISCOVERED". Not interactive. */
export function chip(name: string, status = 'Discovered'): Chip {
  const label = h('span', { class: 'done-text' });
  const el = h('div', { class: 'done-chip' }, h('span', { class: 'done-tick', 'aria-hidden': 'true' }, '✓'), label);
  const set = (n: string, s = 'Discovered') => {
    text(label, `${n} · ${s}`);
  };
  set(name, status);
  return { el, set };
}
