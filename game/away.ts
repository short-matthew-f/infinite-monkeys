// "While you were away": a dismissable paper card shown after a long catch-up (MOBILE-UX rule 18).
// It only reads state: the caller snapshots before catchUp and hands the snapshot back after.
// The card queues behind the quarterly-review ceremony and appears when that closes.
import { DEPTS, N, type DeptId, type GameState, type Tuning } from '../core/index.js';
import { h } from './ui/dom.js';
import * as f from './ui/format.js';
import { DEPT_LABEL } from './world/projects.js';
import './away.css';

/** Catch-ups shorter than this (seconds simulated) are not worth a card. */
export const AWAY_MIN_SECONDS = 60;

export interface AwaySnap {
  bananas: number;
  pot: number;
  monkeys: number;
  desks: number;
  levels: Record<DeptId, number>;
}

/** What changed while away, accumulated if catch-ups stack up behind another card. */
interface Summary {
  /** Seconds the Bureau actually ran (after the cap). */
  ran: number;
  /** Seconds the player was gone. */
  gone: number;
  capped: boolean;
  bananas: number;
  pot: number;
  monkeys: number;
  desks: number;
  levels: Record<DeptId, number>;
}

export function awaySnap(s: GameState): AwaySnap {
  const levels = {} as Record<DeptId, number>;
  for (const d of DEPTS) levels[d] = s.depts[d].level;
  return { bananas: N.toNumber(s.bananas), pot: s.budget ? N.toNumber(s.budget.pot) : 0, monkeys: N.toNumber(s.monkeys), desks: N.toNumber(s.desks), levels };
}

export interface AwayHooks {
  /** True while something else owns the screen (the ceremony). */
  busy(): boolean;
  /** Opens the waiting quarterly review. */
  openReview(): void;
}

const ROW_ID = (k: string) => `away-${k}`;

export class AwayCard {
  private pending: Summary | null = null;
  private hooks: AwayHooks = { busy: () => false, openReview: () => {} };
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly primary: HTMLButtonElement;
  private readonly later: HTMLButtonElement;
  private opener: HTMLElement | null = null;
  private open = false;
  /** Called after the card closes, so the caller can repaint. */
  onClose: () => void = () => {};

  constructor(parent: HTMLElement, private t: Tuning, private state: () => GameState) {
    this.body = h('div', { class: 'away-body' });
    this.primary = h('button', { class: 'away-btn strong', type: 'button' }) as HTMLButtonElement;
    this.later = h('button', { class: 'away-btn', type: 'button' }) as HTMLButtonElement;
    const card = h('div', { class: 'away-card' },
      h('p', { class: 'away-typed' }, 'Night shift log'),
      h('h2', { class: 'away-h', id: 'away-title', tabindex: '-1' }, 'While you were away'),
      this.body,
      h('div', { class: 'away-acts' }, this.primary, this.later),
    );
    this.root = h('div', { class: 'away-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'away-title', hidden: true }, card);
    parent.append(this.root);
    this.primary.addEventListener('click', () => this.finish(this.primary.dataset.act === 'review'));
    this.later.addEventListener('click', () => this.finish(false));
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.finish(false);
      } else if (e.key === 'Tab') {
        const f = [this.primary, this.later].filter((b) => !b.hidden);
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  bind(hooks: AwayHooks): void {
    this.hooks = hooks;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Call right after a catch-up: `gone` is the real time away, `ticks` what core simulated. */
  record(before: AwaySnap, gone: number, ticks: number): void {
    const ran = ticks * this.t.tickSeconds;
    if (ran < AWAY_MIN_SECONDS) return;
    const after = awaySnap(this.state());
    const levels = {} as Record<DeptId, number>;
    for (const d of DEPTS) levels[d] = after.levels[d] - before.levels[d];
    const next: Summary = { ran, gone, capped: gone > ran + this.t.tickSeconds * 2, bananas: after.bananas - before.bananas, pot: after.pot - before.pot, monkeys: after.monkeys - before.monkeys, desks: after.desks - before.desks, levels };
    const p = this.pending;
    if (p) {
      for (const d of DEPTS) next.levels[d] += p.levels[d];
      next.ran += p.ran; next.gone += p.gone; next.capped = next.capped || p.capped;
      next.bananas += p.bananas; next.pot += p.pot; next.monkeys += p.monkeys; next.desks += p.desks;
    }
    this.pending = next;
    if (this.open) this.paint(next);
  }

  /** Once per frame: shows a queued card when nothing else is in the way. */
  render(): void {
    if (this.open) {
      this.sync();
      return;
    }
    if (!this.pending || this.hooks.busy()) return;
    this.show(this.pending);
  }

  private show(sum: Summary): void {
    this.open = true;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.paint(sum);
    this.root.hidden = false;
    void this.root.offsetWidth;
    this.root.classList.add('on');
    this.sync();
    (this.primary.hidden ? this.later : this.primary).focus({ preventScroll: true });
  }

  /** The review button follows the live state: the review may be signed elsewhere while the card is up. */
  private sync(): void {
    const due = !!this.state().budget?.reviewDue;
    const want = due ? 'review' : 'back';
    if (this.primary.dataset.act !== want) this.paintButtons(due);
  }

  private paintButtons(due: boolean): void {
    this.primary.dataset.act = due ? 'review' : 'back';
    this.primary.textContent = due ? 'Open the review' : 'Back to the Bureau';
    this.later.hidden = !due;
    this.later.textContent = 'Not now';
  }

  private paint(sum: Summary): void {
    const row = (k: string, label: string, value: string) => h('div', { class: 'away-row', id: ROW_ID(k) }, h('dt', {}, label), h('dd', {}, value));
    const rows: HTMLElement[] = [];
    const sign = (n: number) => `+${f.count(n)}`;
    rows.push(row('bananas', 'Wallet', sum.bananas > 0 ? `${sign(sum.bananas)} bananas` : 'no change'));
    if (this.state().budget && sum.pot > 0.5) rows.push(row('pot', 'Pot', `${sign(sum.pot)} bananas, waiting for the next review`));
    const bought = DEPTS.filter((d) => sum.levels[d] > 0);
    const total = bought.reduce((a, d) => a + sum.levels[d], 0);
    rows.push(row('levels', 'Department levels', total > 0 ? bought.map((d) => `${DEPT_LABEL[d]} ${sign(sum.levels[d])}`).join(', ') : 'none bought'));
    rows.push(row('desks', 'Desks built', sum.desks > 0.5 ? sign(sum.desks) : 'none'));
    rows.push(row('monkeys', 'Monkeys seated', sum.monkeys > 0.5 ? sign(sum.monkeys) : 'none'));
    const time = h('p', { class: 'away-time' }, `You were gone ${f.duration(sum.gone)}.`);
    const nodes: (Node | string)[] = [time];
    if (sum.capped) nodes.push(h('p', { class: 'away-cap' }, `The Bureau works unattended for at most ${f.duration(sum.ran)}, so the rest of the time away did not count.`));
    else nodes.push(h('p', { class: 'away-cap' }, `The Bureau kept working the whole time.`));
    nodes.push(h('dl', { class: 'away-rows' }, ...rows));
    const due = !!this.state().budget?.reviewDue;
    nodes.push(h('p', { class: 'away-review', id: 'away-review' }, due ? 'A quarterly review is waiting for your signature. The Bureau keeps running on the current lines until you sign.' : 'No quarterly review is waiting.'));
    this.body.replaceChildren(...nodes);
    this.paintButtons(due);
  }

  private finish(openReview: boolean): void {
    if (!this.open) return;
    this.open = false;
    this.pending = null;
    this.root.classList.remove('on');
    this.root.hidden = true;
    const back = this.opener;
    this.opener = null;
    if (openReview) this.hooks.openReview();
    else if (back && back.isConnected) back.focus({ preventScroll: true });
    this.onClose();
  }
}
