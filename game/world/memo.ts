// The requisition memo: a department head's mid-quarter request, docked on the
// bottom edge as a paper strip that opens upward into a small card. Every number comes
// from core (requisitionPrice, levelsListPrice, quarterSecondsLeft); the memo
// states the need and the price and never advises.
import {
  N,
  declineRequisition,
  finiteBottleneck,
  grantRequisition,
  levelsListPrice,
  moraleMult,
  nullSink,
  projectDef,
  requisitionPrice,
  type GameEvent,
  type HeadId,
} from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { enable, h, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford } from '../ui/forms.js';
import { DEPT_LABEL, HEAD_NAMES, OFFICE_SHORT, fadeMultOf, projectFact, projectTitle } from './projects.js';
import { reserveDock } from './dock.js';
import './memo.css';

/** The word on the tab: a department, or a support office. */
const TAB_NAMES: Record<HeadId, string> = { ...DEPT_LABEL, ...OFFICE_SHORT, facilities: 'Facilities', accounting: 'Accounting', training: 'Training' };
const STAMP_HOLD_MS = 1500;
const FILE_MS = 360;

/** Everything the card shows, frozen when the memo closes so the stamp moment keeps its words. */
interface View {
  key: string;
  from: HeadId;
  /** 'levels' for a department's level block, else a project id. */
  kind: string;
  /** Who's asking, as the typed header line. */
  who: string;
  /** What it is. */
  asking: string;
  /** What it does, as a fact. */
  fact: string;
  /** List price, for level blocks only. */
  list: string | null;
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
  private readonly shareEl: HTMLElement;
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
    this.shareEl = h('span', { class: 'memo-share' });
    this.listEl = h('span', { class: 'memo-list' });
    this.timeEl = h('b', { class: 'memo-v' });
    this.walletEl = h('b', { class: 'memo-v' });
    this.bar = h('i');
    const barWrap = h('div', { class: 'memo-bar', role: 'progressbar', 'aria-label': 'Time left on this memo', 'aria-valuemin': '0', 'aria-valuemax': '100' }, this.bar);
    this.why = h('p', { class: 'memo-why', id: `${id}-why` });
    this.grant = h('button', { class: 'memo-btn strong', type: 'button', 'aria-describedby': `${id}-why`, onclick: () => this.onGrant() }, 'Accept');
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
        h('dt', {}, 'Share of wallet'), h('dd', {}, this.shareEl),
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
    this.announce('Request accepted. Approved.');
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
    this.syncDock();
    this.dock.classList.remove('filing', 'open', 'arrive');
    this.card.hidden = true;
    this.card.classList.remove('done');
    this.stamp.hidden = true;
    this.tab.setAttribute('aria-expanded', 'false');
  }

  /** The strip sits on the bottom edge: Ernest's card stacks above it and the building ends above both. */
  private syncDock(): void {
    const root = document.documentElement;
    if (this.dock.hidden) root.style.removeProperty('--memo-h');
    else root.style.setProperty('--memo-h', `${this.tab.offsetHeight + 8}px`);
    reserveDock();
  }

  private announce(msg: string): void {
    this.live.textContent = '';
    // A second tick lets repeated identical messages be read again.
    setTimeout(() => (this.live.textContent = msg), 30);
  }

  /** Cached effect text: morale's depends on how much headroom is left, which changes as it fades. */
  private factKey = '';
  private factText = '';

  /** The numbers on the card, straight from core. Null when there is no open requisition. */
  private build(): View | null {
    const { ctx } = this;
    const s = ctx.state();
    const t = ctx.t;
    const r = s.budget?.requisition;
    const cfg = t.budget?.requisitions;
    const price = requisitionPrice(s, t);
    if (!r || !cfg || !price) return null;
    const key = `${r.kind}:${r.openedTick}`;
    if (r.kind === 'levels' && r.dept) {
      const name = DEPT_LABEL[r.dept];
      const fact =
        r.dept === 'editing' && finiteBottleneck(s, t) === 'editing'
          ? 'Editing is behind review demand.'
          : r.dept === 'editing'
            ? 'Editing is the shortest department.'
            : `${name} is the shorter of Recruiting and Construction.`;
      return {
        key, from: r.from, kind: r.kind,
        who: `Inter-office · Head of ${name}`,
        asking: `Requesting ${cfg.levels} more ${cfg.levels === 1 ? 'level' : 'levels'} of ${name}.`,
        fact,
        list: f.bananas(levelsListPrice(s, t, r.dept, cfg.levels)),
        price: f.bananas(price),
      };
    }
    const p = projectDef(t, r.kind);
    return {
      key, from: r.from, kind: r.kind,
      who: `Inter-office · from the ${HEAD_NAMES[r.from]}`,
      asking: projectTitle(r.kind),
      fact: p ? this.effectText(key, r.kind) : '',
      list: null,
      price: f.bananas(price),
    };
  }

  /** The effect as a fact. Morale's is a core preview (it caps at the ceiling), refreshed as morale fades. */
  private effectText(key: string, kind: string): string {
    const { ctx } = this;
    const s = ctx.state();
    const t = ctx.t;
    const p = projectDef(t, kind)!;
    const owned = s.office?.owned[kind] ?? 0;
    if (p.effect.type !== 'morale') {
      const k = `${key}:${owned}`;
      if (k !== this.factKey) {
        this.factKey = k;
        this.factText = projectFact(t, p, { n: owned + 1 });
      }
      return this.factText;
    }
    const k = `${key}:${Math.round(moraleMult(s) * 100)}`;
    if (k !== this.factKey) {
      this.factKey = k;
      const after = ctx.preview((c) => {
        afford(c, N.toNumber(requisitionPrice(s, t) ?? N.zero));
        grantRequisition(c, t, nullSink);
      });
      this.factText = projectFact(t, p, { moraleGain: moraleMult(after) - moraleMult(s), fadeMult: fadeMultOf(s, t) });
    }
    return this.factText;
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
      this.syncDock();
      this.dock.classList.remove('filing');
      this.dock.classList.remove('arrive');
      void this.dock.offsetWidth;
      if (this.motion()) this.dock.classList.add('arrive');
      this.card.classList.remove('done');
      this.stamp.hidden = true;
      text(this.tabLabel, `MEMO · ${TAB_NAMES[v.from]}`);
      text(this.from, v.who);
      text(this.ask, v.asking);
      this.syncExpanded();
      this.announce(`New memo from the ${v.kind === 'levels' ? `Head of ${TAB_NAMES[v.from]}` : HEAD_NAMES[v.from]}. ${v.asking}. ${v.fact} Asking ${v.price}.`);
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
    text(this.listEl, v.list ? `list ${v.list}` : '');
    const wallet = N.toNumber(s.bananas);
    const share = wallet > 0 ? N.toNumber(priceN) / wallet : Infinity;
    text(this.shareEl, !Number.isFinite(share) ? 'wallet is empty' : share > 10 ? 'over 1,000%' : f.pct(share));
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
    const gap = Math.ceil(N.toNumber(priceN) - N.toNumber(s.bananas));
    text(this.why, can ? '' : gap > 0 ? `Short by ${f.bananaText(gap)}.` : '');
    this.why.hidden = can;
    text(this.grant, can ? `Accept · ${v.price}` : `Accept`);
  }
}
