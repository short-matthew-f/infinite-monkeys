// "While you were away": a dismissable paper card shown after a long catch-up (MOBILE-UX rule 18).
// It only reads state: the caller snapshots before catchUp and hands the snapshot back after.
// The card queues behind the quarterly-review ceremony and appears when that closes.
import { DEPTS, N, type CommissionStatus, type DeptId, type GameState, type MarketStatus, type Num, type Tuning } from '../core/index.js';
import { h } from './ui/dom.js';
import * as f from './ui/format.js';
import { DEPT_LABEL } from './world/projects.js';
import { commissionTitle, marketName } from './screens/hotel/names.js';
import './away.css';

/** Catch-ups shorter than this (seconds simulated) are not worth a card. */
export const AWAY_MIN_SECONDS = 60;

export interface AwaySnap {
  bananas: number;
  pot: number;
  monkeys: number;
  desks: number;
  levels: Record<DeptId, number>;
  /** After Infinity: the hotel's markets and Commissions, copied so the card can compare before and after. */
  hotel?: HotelSnap;
}

interface HotelSnap {
  golden: number;
  markets: Record<string, MarketStatus>;
  /** The pinned Commission, with what it had delivered per market. */
  pinned: { id: string; delivered: Record<string, Num>; required: Record<string, Num> } | null;
  commissions: Record<string, CommissionStatus>;
}

/** What the hotel did while away: state read after the catch-up against the snapshot taken before it. */
interface HotelAway {
  golden: number;
  pinned: { id: string; before: Record<string, Num>; after: Record<string, Num>; required: Record<string, Num>; status: CommissionStatus } | null;
  completed: string[];
  failed: string[];
  buses: string[];
  online: string[];
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
  hotel?: HotelAway;
}

export function awaySnap(s: GameState): AwaySnap {
  const levels = {} as Record<DeptId, number>;
  for (const d of DEPTS) levels[d] = s.depts[d].level;
  const out: AwaySnap = { bananas: N.toNumber(s.bananas), pot: s.budget ? N.toNumber(s.budget.pot) : 0, monkeys: N.toNumber(s.monkeys), desks: N.toNumber(s.desks), levels };
  const hot = s.hotel;
  if (s.phase === 'hotel' && hot) {
    const pc = s.objective.kind === 'commission' ? hot.commissions[s.objective.id] : undefined;
    out.hotel = {
      golden: s.save.golden,
      markets: Object.fromEntries(Object.entries(hot.markets).map(([id, m]) => [id, m.status])),
      pinned: pc && pc.status === 'active' ? { id: pc.id, delivered: { ...pc.delivered }, required: { ...pc.required } } : null,
      commissions: Object.fromEntries(Object.entries(hot.commissions).map(([id, c]) => [id, c.status])),
    };
  }
  return out;
}

/** The hotel's change between a snapshot and the state now. Only reads. */
function hotelAway(before: HotelSnap, s: GameState): HotelAway {
  const hot = s.hotel;
  const out: HotelAway = { golden: s.save.golden - before.golden, pinned: null, completed: [], failed: [], buses: [], online: [] };
  if (!hot) return out;
  for (const [id, m] of Object.entries(hot.markets)) {
    const was = before.markets[id];
    if ((was === 'locked' || was === 'inTransit') && (m.status === 'onboarding' || m.status === 'online')) out.buses.push(id);
    if (was !== undefined && was !== 'online' && m.status === 'online') out.online.push(id);
  }
  for (const [id, c] of Object.entries(hot.commissions)) {
    const was = before.commissions[id];
    if (was === undefined || was === c.status) continue;
    if (c.status === 'completed') out.completed.push(id);
    else if (c.status === 'failed') out.failed.push(id);
  }
  if (before.pinned) {
    const c = hot.commissions[before.pinned.id];
    if (c) out.pinned = { id: c.id, before: before.pinned.delivered, after: { ...c.delivered }, required: before.pinned.required, status: c.status };
  }
  return out;
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
    if (before.hotel) next.hotel = hotelAway(before.hotel, this.state());
    const p = this.pending;
    if (p) {
      if (p.hotel && next.hotel) {
        const a = p.hotel, b = next.hotel;
        // Stacked catch-ups read as one: the pinned Commission starts where the first began (when it is still the same one).
        const same = a.pinned && b.pinned && a.pinned.id === b.pinned.id;
        next.hotel = {
          golden: a.golden + b.golden,
          pinned: same ? { ...b.pinned!, before: a.pinned!.before } : b.pinned ?? a.pinned,
          completed: [...a.completed, ...b.completed], failed: [...a.failed, ...b.failed],
          buses: [...a.buses, ...b.buses], online: [...a.online, ...b.online],
        };
      }
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
    const hotel = sum.hotel;
    if (hotel) {
      // After Infinity there are no departments or desks: the card reports bananas, the pinned Commission, and the route.
      rows.push(row('bananas', 'Bananas banked', sum.bananas > 0 ? `${sign(sum.bananas)} bananas` : 'no change'));
      if (hotel.golden > 0) rows.push(row('golden', 'Golden Bananas', `${sign(hotel.golden)}`));
      const pin = hotel.pinned;
      if (pin) {
        const parts = Object.keys(pin.required).map((m) => {
          const was = pin.before[m] ?? N.zero, now = pin.after[m] ?? N.zero;
          return `${marketName(m)}: ${f.count(was)} to ${f.count(now)} of ${f.count(pin.required[m]!)}`;
        });
        rows.push(row('pinned', 'Pinned', `${commissionTitle(pin.id)}. ${parts.join('; ')}.`));
      } else rows.push(row('pinned', 'Pinned', 'No Commission pinned'));
      const finished = [...hotel.completed.map((id) => `${commissionTitle(id)} completed`), ...hotel.failed.map((id) => `${commissionTitle(id)} lapsed`)];
      rows.push(row('commissions', 'Commissions', finished.length ? finished.join(', ') : 'none finished'));
      rows.push(row('buses', 'Buses arrived', hotel.buses.length ? hotel.buses.map(marketName).join(', ') : 'none'));
      rows.push(row('online', 'Markets online', hotel.online.length ? hotel.online.map(marketName).join(', ') : 'none new'));
    } else {
      rows.push(row('bananas', 'Wallet', sum.bananas > 0 ? `${sign(sum.bananas)} bananas` : 'no change'));
      if (this.state().budget && sum.pot > 0.5) rows.push(row('pot', 'Pot', `${sign(sum.pot)} bananas, waiting for the next review`));
      const bought = DEPTS.filter((d) => sum.levels[d] > 0);
      const total = bought.reduce((a, d) => a + sum.levels[d], 0);
      rows.push(row('levels', 'Department levels', total > 0 ? bought.map((d) => `${DEPT_LABEL[d]} ${sign(sum.levels[d])}`).join(', ') : 'none bought'));
      rows.push(row('desks', 'Desks built', sum.desks > 0.5 ? sign(sum.desks) : 'none'));
      rows.push(row('monkeys', 'Monkeys seated', sum.monkeys > 0.5 ? sign(sum.monkeys) : 'none'));
    }
    const time = h('p', { class: 'away-time' }, `You were gone ${f.duration(sum.gone)}.`);
    const nodes: (Node | string)[] = [time];
    if (sum.capped) nodes.push(h('p', { class: 'away-cap' }, `The Bureau works unattended for at most ${f.duration(sum.ran)}, so the rest of the time away did not count.`));
    else nodes.push(h('p', { class: 'away-cap' }, `The Bureau kept working the whole time.`));
    nodes.push(h('dl', { class: 'away-rows' }, ...rows));
    const due = !!this.state().budget?.reviewDue;
    if (!hotel) nodes.push(h('p', { class: 'away-review', id: 'away-review' }, due ? 'A quarterly review is waiting for your signature. The Bureau keeps running on the current lines until you sign.' : 'No quarterly review is waiting.'));
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
