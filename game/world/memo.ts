// The requisition memo: a department head's mid-quarter request, docked at the
// bottom-left as a paper tab that opens into a small card. Every number comes
// from core (requisitionPrice, levelsListPrice, quarterSecondsLeft); the memo
// states the need and the price and never advises.
import {
  declineRequisition,
  finiteBottleneck,
  grantRequisition,
  levelsListPrice,
  requisitionPrice,
  type DeptId,
  type GameEvent,
} from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { enable, h, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './memo.css';

const DEPT_NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
const STAMP_HOLD_MS = 1500;
const FILE_MS = 360;

/** Everything the card shows, frozen when the memo closes so the stamp moment keeps its words. */
interface View {
  key: string;
  dept: DeptId;
  asking: string;
  fact: string;
  levels: number;
  list: string;
  price: string;
}

const ENVELOPE = `<svg viewBox="0 0 32 22" aria-hidden="true"><rect x="1.5" y="2.5" width="29" height="17" rx="1.5" fill="var(--edge)" stroke="var(--screen)" stroke-width="1.4"/><path d="M2 3.5l14 9.5 14-9.5" fill="none" stroke="var(--screen)" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 19l9-8M30 19l-9-8" stroke="var(--concrete)" stroke-width="1.1"/><circle cx="24.5" cy="14.5" r="2" fill="var(--alert)" stroke="var(--screen)" stroke-width=".8"/></svg>`;

let uid = 0;

export class MemoView {
  private readonly dock: HTMLElement;
  private readonly tab: HTMLButtonElement;
  private readonly tabLabel: HTMLElement;
  private readonly card: HTMLElement;
  private readonly from: HTMLElement;
  private readonly ask: HTMLElement;
  private readonly fact: HTMLElement;
  private readonly priceEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly walletEl: HTMLElement;
  private readonly why: HTMLElement;
  private readonly grant: HTMLButtonElement;
  private readonly decline: HTMLButtonElement;
  private readonly stamp: HTMLElement;
  private readonly live: HTMLElement;

  private shownKey: string | null = null;
  private expanded = false;
  /** 'stamping' while APPROVED is shown, 'filing' while the card slides away. */
  private phase: 'open' | 'stamping' | 'filing' | 'none' = 'none';
  private frozen: View | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly reduced: MediaQueryList | null;

  constructor(parent: HTMLElement, private readonly ctx: Ctx) {
    const id = `memo${uid++}`;
    this.reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

    this.tabLabel = h('span', { class: 'memo-tl' }, 'MEMO · Editing');
    this.tab = h('button', { class: 'memo-tab', type: 'button', 'aria-expanded': 'false', 'aria-controls': `${id}-card`, onclick: () => this.toggle() });
    this.tab.innerHTML = ENVELOPE;
    this.tab.append(this.tabLabel);

    this.from = h('p', { class: 'memo-typed' });
    this.ask = h('p', { class: 'memo-ask' });
    this.fact = h('p', { class: 'memo-fact' });
    this.priceEl = h('b', { class: 'memo-v' });
    this.listEl = h('span', { class: 'memo-list' });
    this.timeEl = h('b', { class: 'memo-v' });
    this.walletEl = h('b', { class: 'memo-v' });
    this.bar = h('i');
    const barWrap = h('div', { class: 'memo-bar', role: 'progressbar', 'aria-label': 'Time left on this memo', 'aria-valuemin': '0', 'aria-valuemax': '100' }, this.bar);
    this.why = h('p', { class: 'memo-why', id: `${id}-why` });
    this.grant = h('button', { class: 'memo-btn strong', type: 'button', 'aria-describedby': `${id}-why`, onclick: () => this.onGrant() }, 'Grant');
    this.decline = h('button', { class: 'memo-btn', type: 'button', onclick: () => this.onDecline() }, 'Decline');
    this.stamp = h('div', { class: 'memo-stamp', 'aria-hidden': 'true' }, 'Approved');
    this.stamp.hidden = true;
    this.barWrap = barWrap;

    this.card = h(
      'section',
      { class: 'memo-card', id: `${id}-card`, 'aria-label': 'Requisition memo', hidden: true },
      this.from,
      this.ask,
      this.fact,
      h('dl', { class: 'memo-rows' },
        h('dt', {}, 'Asking'), h('dd', {}, this.priceEl, this.listEl),
        h('dt', {}, 'Time left'), h('dd', {}, this.timeEl),
        h('dt', {}, 'In the wallet'), h('dd', {}, this.walletEl),
      ),
      barWrap,
      this.why,
      h('div', { class: 'memo-acts' }, this.grant, this.decline),
      this.stamp,
    );
    this.live = h('div', { class: 'memo-sr', 'aria-live': 'polite', role: 'status' });
    this.dock = h('div', { class: 'memo-dock', hidden: true }, this.card, this.tab);
    parent.append(this.dock, this.live);

    ctx.onEvent((e: GameEvent) => {
      if (e.type !== 'requisitionClosed') return;
      if (e.outcome === 'granted') this.startStamp();
      else this.startFiling(e.outcome === 'declined' ? 'Memo declined and filed.' : 'The memo expired and was filed.');
    });
  }

  private readonly barWrap: HTMLElement;

  private motion(): boolean {
    return !this.reduced?.matches;
  }

  private toggle(): void {
    if (this.phase !== 'open') return;
    this.expanded = !this.expanded;
    this.syncExpanded();
  }

  private syncExpanded(): void {
    const open = this.expanded || this.phase === 'stamping';
    this.tab.setAttribute('aria-expanded', String(open));
    if (this.card.hidden === open) this.card.hidden = !open;
    this.dock.classList.toggle('open', open);
  }

  private onGrant(): void {
    // The Grant event (requisitionClosed granted) starts the stamp.
    if (!this.ctx.can('grantRequisition', grantRequisition)) return;
    this.ctx.act(grantRequisition);
  }

  private onDecline(): void {
    this.ctx.act(declineRequisition);
  }

  private startStamp(): void {
    if (this.phase === 'none' || this.phase === 'filing') return;
    this.phase = 'stamping';
    this.frozen = this.frozen ?? this.build();
    this.stamp.hidden = false;
    this.stamp.classList.remove('hit');
    void this.stamp.offsetWidth;
    this.stamp.classList.add('hit');
    this.card.classList.add('done');
    this.syncExpanded();
    this.announce('Requisition granted. Approved.');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.startFiling(null), STAMP_HOLD_MS);
  }

  private startFiling(message: string | null): void {
    if (this.phase === 'none' || this.phase === 'filing') return;
    this.phase = 'filing';
    this.frozen = this.frozen ?? this.build();
    if (message) this.announce(message);
    this.dock.classList.add('filing');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finish(), this.motion() ? FILE_MS : 120);
  }

  private finish(): void {
    this.phase = 'none';
    this.frozen = null;
    this.shownKey = null;
    this.expanded = false;
    this.dock.hidden = true;
    this.dock.classList.remove('filing', 'open', 'arrive');
    this.card.hidden = true;
    this.card.classList.remove('done');
    this.stamp.hidden = true;
    this.tab.setAttribute('aria-expanded', 'false');
  }

  private announce(msg: string): void {
    this.live.textContent = '';
    // A second tick lets repeated identical messages be read again.
    setTimeout(() => (this.live.textContent = msg), 30);
  }

  /** The numbers on the card, straight from core. Null when there is no open requisition. */
  private build(): View | null {
    const { ctx } = this;
    const s = ctx.state();
    const t = ctx.t;
    const r = s.budget?.requisition;
    const cfg = t.budget?.requisitions;
    const price = requisitionPrice(s, t);
    if (!r || !cfg || !price) return null;
    const name = DEPT_NAMES[r.dept];
    const fact =
      r.dept === 'editing' && finiteBottleneck(s, t) === 'editing'
        ? 'Editing is behind review demand.'
        : r.dept === 'editing'
          ? 'Editing is the shortest department.'
          : `${name} is the shorter of Recruiting and Construction.`;
    return {
      key: `${r.dept}:${r.openedTick}`,
      dept: r.dept,
      asking: `Requesting ${cfg.levels} more ${cfg.levels === 1 ? 'level' : 'levels'} of ${name}.`,
      fact,
      levels: cfg.levels,
      list: f.bananas(levelsListPrice(s, t, r.dept, cfg.levels)),
      price: f.bananas(price),
    };
  }

  /** Called once per frame-tick by main; cheap when nothing changed. */
  render(): void {
    const { ctx } = this;
    const s = ctx.state();
    const t = ctx.t;
    if (!t.budget || !s.budget) {
      if (this.phase !== 'none') this.finish();
      return;
    }
    const r = s.budget.requisition;

    // Closing animations own the card; leave it alone until they finish.
    if (this.phase === 'stamping' || this.phase === 'filing') return;

    if (!r) {
      if (this.phase === 'open') this.startFiling('The memo expired and was filed.'); // closed without an event we saw
      return;
    }

    const v = this.build();
    if (!v) return;
    if (this.shownKey !== v.key) {
      this.shownKey = v.key;
      this.phase = 'open';
      this.expanded = false;
      this.frozen = null;
      this.dock.hidden = false;
      this.dock.classList.remove('filing');
      this.dock.classList.remove('arrive');
      void this.dock.offsetWidth;
      if (this.motion()) this.dock.classList.add('arrive');
      this.card.classList.remove('done');
      this.stamp.hidden = true;
      text(this.tabLabel, `MEMO · ${DEPT_NAMES[v.dept]}`);
      text(this.from, `Inter-office · Head of ${DEPT_NAMES[v.dept]}`);
      text(this.ask, v.asking);
      text(this.fact, v.fact);
      this.syncExpanded();
      this.announce(`New memo from the Head of ${DEPT_NAMES[v.dept]}. ${v.asking} Asking ${v.price}.`);
    }
    text(this.fact, v.fact);
    this.refresh(v);
    this.freezeSnapshot(v);
  }

  private freezeSnapshot(v: View): void {
    this.frozen = v;
  }

  private refresh(v: View): void {
    const { ctx } = this;
    const s = ctx.state();
    const t = ctx.t;
    const r = s.budget!.requisition!;
    const priceN = requisitionPrice(s, t)!;
    const secLeft = Math.max(0, (r.expiresTick - s.tick) * t.tickSeconds);
    const total = Math.max(1, (r.expiresTick - r.openedTick) * t.tickSeconds);
    text(this.priceEl, v.price);
    text(this.listEl, `list ${v.list}`);
    text(this.timeEl, f.duration(Math.ceil(secLeft)));
    text(this.walletEl, f.bananas(s.bananas));
    const frac = Math.min(1, secLeft / total);
    const pct = String(Math.round(frac * 100));
    this.bar.style.width = `${frac * 100}%`;
    if (this.barWrap.getAttribute('aria-valuenow') !== pct) {
      this.barWrap.setAttribute('aria-valuenow', pct);
      this.barWrap.setAttribute('aria-valuetext', `${f.duration(Math.ceil(secLeft))} left`);
    }
    const can = ctx.can('grantRequisition', grantRequisition);
    enable(this.grant, can);
    const short = f.shortBy(priceN, s.bananas);
    text(this.why, can ? '' : (short ?? ''));
    this.why.hidden = can;
    text(this.grant, can ? `Grant · ${v.price}` : `Grant`);
  }
}
