// The Bureau Tower: the whole Bureau as one building of floors that fits the
// screen. Each floor is one big button with a small live scene; tapping it opens
// that room full screen (room.ts). The Departments floor is three wings, one
// button each, so a wing opens its own department.
//
// The markup is built once. Each floor's art is replaced only when its picture
// changes; small live numbers are patched in place. Every number comes from
// core (floorProps) and is never computed here.
import { DEPTS, N, busSpeed, certifyTiers, editingPool, finiteBottleneck, hotelUpgradeCost, meters, onboardSpeed, type GameState, type HotelUpgrade, type Tuning } from '../../core/index.js';
import type { FloorProps } from './floor-art.js';
import { FLOOR_BOX, FLOOR_NAMES, KIND_NAMES, buildTower, busSVG, deptHint, floorHint, floorName, floorTag, marketLook, mmss, patchLive, roofSVG, skySVG, splitParts, towerKey, wingName, type FloorId } from './tower-art.js';
import type { Cue } from './advisor.js';
import './tower.css';

const NS = 'http://www.w3.org/2000/svg';
const WALK_SPEED = 80; // art units per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEPT_NAMES = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' } as const;
/** Top to bottom, as the building stands. */
const ORDER: FloorId[] = ['director', 'research', 'departments', 'pool', 'personnel'];
/** Floor numbers, from the street up. */
const DISC: Record<FloorId, number> = { personnel: 1, pool: 2, departments: 3, research: 4, director: 5 };

/** Art props from game state. Every value is read from state or core; nothing is computed here. */
export function floorProps(s: GameState, t: Tuning): FloorProps {
  const seated = Math.floor(N.toNumber(s.monkeys));
  const desks = Math.floor(N.toNumber(s.desks));
  const tiers = t.tiers.map((tier) => {
    const ts = s.tiers[tier.id];
    return { id: tier.id, state: ts?.discovered ? ('discovered' as const) : ts?.discoverable ? ('researching' as const) : ('locked' as const) };
  });
  const depts = Object.fromEntries(DEPTS.map((d) => [d, { level: s.depts[d].level, stage: s.depts[d].stage }])) as FloorProps['depts'];
  return {
    seated,
    desks,
    candidate: desks > seated,
    editors: s.depts.editing.level,
    tiers,
    depts,
    milestones: s.milestonesReached,
    permit: s.stability.permit,
    // Reel 1 lasts until the first hire (by hand or by a Recruiter).
    tutorial: seated <= 1,
    meters: meters(s, t),
    bottleneck: s.phase === 'finite' ? finiteBottleneck(s, t) : null,
    raw: {
      free: N.toNumber(N.sub(s.desks, s.monkeys)),
      pressure: s.phase === 'finite' ? pressure(s, t) : null,
    },
    office: s.office ? officeProps(s) : undefined,
    hotel: s.phase === 'hotel' && s.hotel ? hotelProps(s, t) : undefined,
  };
}

/** The wings after Infinity: which hotel upgrade line each one runs. */
const WING_LINE: Record<(typeof DEPTS)[number], HotelUpgrade> = { recruiting: 'busWranglers', construction: 'shiftCrews', editing: 'editors' };

/**
 * What the hotel building shows. Times are core's own speeds applied to the work left (the same arithmetic as
 * readySeconds); the pinned Commission's clock is its deadline tick less the current tick, in ticks of t.tickSeconds.
 */
function hotelProps(s: GameState, t: Tuning): NonNullable<FloorProps['hotel']> {
  const h = s.hotel!;
  const online = t.hotel.markets.filter((m) => h.markets[m.id]?.status === 'online');
  const total = online.reduce((a, m) => a + Math.max(0, h.allocation[m.id] ?? 0), 0);
  const markets = t.hotel.markets.map((def) => {
    const m = h.markets[def.id]!;
    const speed = m.status === 'inTransit' ? busSpeed(s, t) : m.status === 'onboarding' ? onboardSpeed(s, t) : 0;
    const secondsLeft = speed > 0 ? m.workLeft / speed : m.status === 'online' || m.status === 'locked' ? 0 : Infinity;
    const share = m.status === 'online' && total > 0 ? Math.max(0, h.allocation[def.id] ?? 0) / total : 0;
    return { id: def.id, status: m.status, secondsLeft, share };
  });
  const staff = {} as NonNullable<FloorProps['hotel']>['staff'];
  for (const d of DEPTS) {
    const line = WING_LINE[d];
    const cost = hotelUpgradeCost(s, t, line);
    staff[d] = { level: h.upgradeLevels[line], affordable: cost !== null && N.gte(s.bananas, cost) };
  }
  let pinned: NonNullable<FloorProps['hotel']>['pinned'] = null;
  const obj = s.objective;
  if (obj.kind === 'commission') {
    const c = h.commissions[obj.id];
    const def = t.hotel.commissions.find((d) => d.id === obj.id);
    if (c && def && c.status === 'active' && c.deadlineTick !== null) {
      let need = 0;
      let got = 0;
      for (const [m, req] of Object.entries(c.required)) {
        need += N.toNumber(req);
        got += Math.min(N.toNumber(req), N.toNumber(c.delivered[m] ?? N.zero));
      }
      pinned = { id: c.id, kind: c.kind, frac: need > 0 ? got / need : 0, secondsLeft: Math.max(0, (c.deadlineTick - s.tick) * t.tickSeconds), totalSeconds: def.deadlineSeconds };
    }
  }
  const offers = Object.values(h.commissions).filter((c) => c.status === 'offered').length;
  return { markets, staff, golden: s.save.golden, offers, reward: !!h.pendingReward, pinned };
}

/** Review demand over the review pool, the two numbers core's finiteBottleneck compares. Drawing bands only. */
function pressure(s: GameState, t: Tuning): number {
  const pool = editingPool(s, t);
  const demand = certifyTiers(s, t, pool, s.tierAllocation).demand;
  return N.lte(pool, N.zero) ? (N.gt(demand, N.zero) ? 1e9 : 0) : N.ratio(demand, pool);
}

/** The amenities the Foreman has built, drawn on the Personnel and Typing Pool floors. Morale is no longer on the building. */
function officeProps(s: GameState): NonNullable<FloorProps['office']> {
  const o = s.office!;
  return {
    on: true,
    built: { bathrooms: (o.owned.bathrooms ?? 0) > 0, breakRoom: (o.owned.breakRoom ?? 0) > 0, snackMachine: (o.owned.snackMachine ?? 0) > 0 },
  };
}

/** What the building shows of the quarterly budget (all values from core; ratios only for drawing). */
export interface BudgetView {
  quarter: number;
  /** Seconds left in the quarter, from core's quarterSecondsLeft. */
  secondsLeft: number;
  /** Share of the quarter still to run, 0..1. */
  frac: number;
  reviewDue: boolean;
  /** Each department's account against its next level price. */
  accounts: Record<(typeof DEPTS)[number], { frac: number; balance: string; price: string }>;
}

const CLOCK_R = 15;
const CLOCK_C = 2 * Math.PI * CLOCK_R;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Tower {
  private arts = new Map<FloorId, SVGSVGElement>();
  private floors = new Map<FloorId, HTMLElement>();
  private cache = new Map<FloorId, string>();
  /** The roof band: the quarter clock and the water-cooler card live here. */
  readonly roof: HTMLElement;
  private hits = new Map<string, HTMLButtonElement>();
  private cells = new Map<string, HTMLElement>();
  private key = '';
  private walking = 0;
  private deferred: FloorProps | null = null;
  private props: FloorProps | null = null;
  private cueEl = new Map<FloorId, HTMLElement>();
  private limitTag: HTMLElement;
  private pile = false;
  private cued: Cue | null = null;
  private clock: HTMLButtonElement;
  private clockArc: SVGCircleElement;
  private clockQ: SVGTextElement;
  private clockTag: HTMLElement;
  private clockKey = '';
  // after Infinity: the Commission deadline clock on the roof, the market share bar, and the street's buses
  private dclock: HTMLButtonElement;
  private dArc: SVGCircleElement;
  private dNum: SVGTextElement;
  private dPin: SVGGElement;
  private dTag: HTMLElement;
  private dKey = '';
  private sbar: HTMLElement;
  private sbarKey = '';
  private hotelOn = false;
  private noteText = new Map<string, string>();
  private marketSeen = new Map<string, string>();
  private shuffleEl: HTMLElement | null = null;
  private shuffleTimers: number[] = [];
  private pendingShuffle: string | null = null;
  /** The scrolling building (short screens). The roof sits above it and never scrolls. */
  private bldg!: HTMLElement;
  private born = performance.now();
  private touched = false;
  private lastCueRoom = '';
  private acctNote: Partial<Record<(typeof DEPTS)[number], string>> = {};
  private flashes = new Map<string, { n: number; timer: number }>();
  /** Called when the roof clock is tapped (budget trial). */
  onReview: () => void = () => {};
  /** Called when a floor (or a Departments wing) is activated. */
  onOpen: (id: FloorId, from: HTMLElement, dept?: string) => void = () => {};

  constructor(private host: HTMLElement) {
    const roof = (this.roof = el('div', 'roof'));
    roof.innerHTML = `<svg class="roof-art" viewBox="0 -8 400 34" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${roofSVG()}</svg><svg class="sky-art" viewBox="0 -72 400 98" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${skySVG()}</svg>`;
    this.clock = el('button', 'qclock',
      `<span class="qtag" hidden></span><svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle class="qface" cx="20" cy="20" r="19"/><circle class="qtrack" cx="20" cy="20" r="${CLOCK_R}"/><circle class="qarc" cx="20" cy="20" r="${CLOCK_R}" transform="rotate(-90 20 20)" stroke-dasharray="${CLOCK_C.toFixed(2)}"/><circle class="qring" cx="20" cy="20" r="19"/><text class="qnum" x="20" y="24.5" text-anchor="middle">Q1</text></svg>`);
    this.clock.type = 'button';
    this.clock.hidden = true;
    this.clock.addEventListener('click', () => this.onReview());
    this.clockArc = this.clock.querySelector('.qarc') as unknown as SVGCircleElement;
    this.clockQ = this.clock.querySelector('.qnum') as unknown as SVGTextElement;
    this.clockTag = this.clock.querySelector('.qtag') as HTMLElement;
    roof.append(this.clock);
    // After Infinity the roof clock is the pinned Commission's deadline. It opens the Director's Office like the floor does.
    this.dclock = el('button', 'qclock dclock',
      `<span class="qtag" hidden></span><svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle class="qface" cx="20" cy="20" r="19"/><circle class="qtrack" cx="20" cy="20" r="${CLOCK_R}"/><circle class="qarc" cx="20" cy="20" r="${CLOCK_R}" transform="rotate(-90 20 20)" stroke-dasharray="${CLOCK_C.toFixed(2)}"/><text class="qnum" x="20" y="24.5" text-anchor="middle"></text><g class="dpin"><path d="M20 27V14" stroke="var(--screen-ink)" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="13" r="5" fill="var(--tangerine)" stroke="var(--screen-ink)" stroke-width="1.6"/></g></svg>`);
    this.dclock.type = 'button';
    this.dclock.hidden = true;
    this.dclock.dataset.room = 'director';
    this.dArc = this.dclock.querySelector('.qarc') as unknown as SVGCircleElement;
    this.dNum = this.dclock.querySelector('.qnum') as unknown as SVGTextElement;
    this.dPin = this.dclock.querySelector('.dpin') as unknown as SVGGElement;
    this.dTag = this.dclock.querySelector('.qtag') as HTMLElement;
    roof.append(this.dclock);
    this.sbar = el('span', 'sbar');
    this.sbar.hidden = true;
    this.sbar.setAttribute('role', 'img');
    const bldg = (this.bldg = el('div', 'bldg'));
    // Once the player scrolls the building themselves, it is theirs: nothing here moves it again on its own.
    for (const ev of ['pointerdown', 'wheel', 'keydown'] as const) bldg.addEventListener(ev, () => (this.touched = true), { passive: true });
    this.limitTag = el('span', 'limit-tag', '<span aria-hidden="true">◆</span> Typing is the limit');
    for (const id of ORDER) bldg.append(this.floor(id));
    host.append(roof, bldg);
    // The window changes height when a dock opens or the phone turns: until the player scrolls it themselves, keep the floor that matters in view.
    new ResizeObserver(() => {
      if (!this.touched) this.reveal(this.relevant());
    }).observe(bldg);
    host.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-room]');
      if (b) this.onOpen(b.dataset.room as FloorId, b, b.dataset.dept);
    });
  }

  private floor(id: FloorId): HTMLElement {
    const f = el('div', `flr flr-${id}`);
    f.dataset.floor = id;
    // Every floor is a label rail across its top and, below it, the scene. Text lives in the rail and the
    // art never sits under it, so a label can never cover a figure. The whole floor is one big button.
    const rail = el('div', id === 'departments' ? 'rail rail-wings' : 'rail');
    const view = el('div', 'flr-view');
    const art = document.createElementNS(NS, 'svg') as SVGSVGElement;
    art.setAttribute('class', 'flr-art');
    art.setAttribute('viewBox', `0 0 ${FLOOR_BOX[id][0]} ${FLOOR_BOX[id][1]}`);
    art.setAttribute('preserveAspectRatio', id === 'personnel' ? 'xMaxYMax meet' : 'xMidYMax meet');
    art.setAttribute('aria-hidden', 'true');
    view.append(art);
    f.append(rail, view);
    this.arts.set(id, art);
    this.floors.set(id, f);
    rail.append(el('span', 'fplate', `<span class="disc sm" aria-hidden="true">${DISC[id]}</span><span class="pn" data-live="name:${id}">${FLOOR_NAMES[id]}</span>`));
    const cue = el('span', 'cue-tag');
    cue.hidden = true;
    cue.setAttribute('aria-hidden', 'true');
    this.cueEl.set(id, cue);
    if (id === 'departments') {
      // Each wing's label is a cell in the rail: its name and level, or (in the same place) the pile warning, the cue or a flash.
      for (const d of DEPTS) {
        const c = el('span', `wcell wcell-${d}`, `<span class="wv wv-name"><span data-live="wname:${d}">${DEPT_NAMES[d]}</span> <span class="lvw">Lv </span><span data-live="lv:${d}"></span></span><span class="wv wv-note" aria-hidden="true"><span class="wg" aria-hidden="true">▲</span> <span class="wn-t">${d === 'editing' ? 'Pages piling up' : 'Upgrade'}</span></span><span class="wv wv-cue" aria-hidden="true"></span><span class="wv wv-flash" aria-hidden="true"></span><i class="acct-bar" aria-hidden="true" hidden></i>`);
        this.cells.set(`departments:${d}`, c);
        rail.append(c);
        const w = el('button', `wing wing-${d}`);
        w.type = 'button';
        w.dataset.room = 'departments';
        w.dataset.dept = d;
        w.setAttribute('aria-label', `${DEPT_NAMES[d]}: hire and level up`);
        this.hits.set(`departments:${d}`, w);
        f.append(w);
      }
    } else {
      const b = el('button', 'hit');
      b.type = 'button';
      b.dataset.room = id;
      b.setAttribute('aria-label', FLOOR_NAMES[id]);
      this.hits.set(id, b);
      rail.append(el('span', 'ftag', `<span data-live="${id}"></span>`));
      if (id === 'pool') rail.append(this.sbar);
      const flag = el('span', 'flag');
      flag.append(cue);
      if (id === 'pool') flag.append(this.limitTag);
      rail.append(flag);
      f.append(b);
    }
    return f;
  }

  /** Rebuilds only the floors whose picture changed; patches the live numbers. Returns true if any floor was redrawn. */
  apply(p: FloorProps, opts: { sit?: number | null; arrive?: boolean } = {}): boolean {
    if (this.walking) {
      this.deferred = p;
      return false;
    }
    this.props = p;
    let rebuilt = false;
    this.setHotel(!!p.hotel);
    const buses = p.hotel ? this.busChanges(p) : null;
    const key = towerKey(p);
    if (key !== this.key) {
      this.key = key;
      const t = buildTower(p);
      for (const fl of t.floors) {
        if (this.cache.get(fl.id) === fl.svg) continue;
        this.cache.set(fl.id, fl.svg);
        this.arts.get(fl.id)!.innerHTML = fl.svg;
        rebuilt = true;
      }
      document.body.classList.toggle('hired', !p.tutorial);
      const cand = this.arts.get('personnel')!.querySelector<SVGGElement>('#t-cand');
      if (cand && opts.arrive && !reduceMotion.matches) cand.classList.add('arrive');
      if (opts.sit != null) {
        const seat = this.arts.get('pool')!.querySelector(`.seat[data-i="${opts.sit}"]`);
        if (seat) {
          seat.classList.add('sit', 'hl');
          window.setTimeout(() => seat.classList.remove('sit'), 400);
          window.setTimeout(() => seat.classList.remove('hl'), 1700);
        }
      }
    }
    patchLive(this.host, p);
    this.labels(p);
    this.setBottleneck(p.bottleneck);
    if (p.hotel) this.hotelRoof(p, buses);
    // First seconds only: bring the floor that matters (the cued one, else the limit, else the lobby) into view.
    if (!this.touched && performance.now() - this.born < 2500 && !this.settling) {
      this.settling = true;
      requestAnimationFrame(() => {
        this.settling = false;
        if (!this.touched) this.reveal(this.relevant());
      });
    }
    return rebuilt;
  }

  private settling = false;

  /** The floor most worth seeing on a short screen: the cue's, else the one that limits income, else the lobby. */
  private relevant(): FloorId {
    if (this.cued && this.floors.has(this.cued.room as FloorId)) return this.cued.room as FloorId;
    if (this.props?.tutorial) return 'personnel';
    if (this.props?.bottleneck === 'editing') return 'departments';
    if (this.props?.bottleneck === 'typing') return 'pool';
    return 'personnel';
  }

  /** Scrolls the building so a floor sits in the middle of the window (no-op when everything fits). */
  private reveal(id: FloorId, onlyIfHidden = false): void {
    const f = this.floors.get(id);
    const b = this.bldg;
    if (!f || f.hidden || b.scrollHeight <= b.clientHeight + 1) return;
    const fr = f.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    if (onlyIfHidden && fr.top >= br.top && fr.bottom <= br.bottom) return;
    const mid = fr.top - br.top + b.scrollTop + fr.height / 2;
    b.scrollTop = Math.max(0, Math.min(b.scrollHeight - b.clientHeight, mid - b.clientHeight / 2));
  }

  /** The quarterly budget on the building. Null (classic, or before the budget opens) shows nothing new. */
  setBudget(b: BudgetView | null): void {
    const on = !!b;
    this.host.classList.toggle('budget', on);
    this.clock.hidden = !on;
    for (const d of DEPTS) {
      const acct = this.cells.get(`departments:${d}`)?.querySelector<HTMLElement>('.acct-bar');
      if (!acct) continue;
      acct.hidden = !on;
      if (!b) continue;
      const a = b.accounts[d];
      acct.style.setProperty('--fill', `${Math.min(100, a.frac * 100).toFixed(1)}%`);
      this.acctNote[d] = `. Account ${a.balance} of ${a.price} for the next level`;
    }
    if (!on) this.acctNote = {};
    if (this.props) this.labels(this.props);
    if (!b) return;
    this.clock.classList.toggle('due', b.reviewDue);
    this.clockTag.hidden = !b.reviewDue;
    if (b.reviewDue && !this.clockTag.textContent) this.clockTag.textContent = 'Review ready';
    // Redraw the arc and label only when they would change.
    const key = `${b.quarter}|${b.reviewDue}|${Math.round(b.frac * 200)}|${Math.ceil(b.secondsLeft / 5)}`;
    if (key === this.clockKey) return;
    this.clockKey = key;
    this.clockArc.setAttribute('stroke-dashoffset', (CLOCK_C * (1 - (b.reviewDue ? 1 : b.frac))).toFixed(2));
    this.clockQ.textContent = `Q${b.quarter}`;
    const left = `${Math.max(0, Math.ceil(b.secondsLeft / 5) * 5)} seconds left`;
    this.clock.setAttribute('aria-label', b.reviewDue ? `Quarterly review ready, Q${b.quarter}` : `Quarterly review, Q${b.quarter}, ${left}`);
  }

  /** A department bought a level from its own account. Flashes on its wing; bursts add up. */
  flashAuto(d: (typeof DEPTS)[number]): void {
    const fl = this.cells.get(`departments:${d}`)?.querySelector<HTMLElement>('.wv-flash');
    if (!fl) return;
    const prev = this.flashes.get(d);
    if (prev) window.clearTimeout(prev.timer);
    const n = (prev?.n ?? 0) + 1;
    fl.textContent = n === 1 ? '+1 level · auto' : `+${n} levels · auto`;
    fl.classList.remove('go');
    void fl.offsetWidth; // restart the animation
    fl.classList.add('go');
    this.flashes.set(d, { n, timer: window.setTimeout(() => { this.flashes.delete(d); this.paintCell(d); }, 1900) });
    this.paintCell(d);
  }

  /**
   * One wing's rail cell shows one thing at a time, all stacked in the same place so the rail never
   * shifts: a flash of auto-bought levels, then the cue, then the pile warning, then its name and level.
   */
  private paintCell(d: (typeof DEPTS)[number]): void {
    const c = this.cells.get(`departments:${d}`);
    if (!c) return;
    const cueOn = !!this.cued && this.cued.room === 'departments' && (this.cued.view && (DEPTS as readonly string[]).includes(this.cued.view) ? this.cued.view : 'recruiting') === d;
    const up = this.hotelOn && !!this.props?.hotel?.staff[d].affordable;
    const st = this.flashes.has(d) ? 'flash' : cueOn ? 'cue' : up || (this.pile && d === 'editing') ? 'note' : 'name';
    c.classList.toggle('up', up);
    if (c.dataset.state !== st) c.dataset.state = st;
    const cueEl = c.querySelector<HTMLElement>('.wv-cue');
    const want = cueOn ? `● ${this.cued!.tag}` : '';
    if (cueEl && cueEl.textContent !== want) cueEl.textContent = want;
  }

  /** Button labels carry the same status words as the plates. */
  private labels(p: FloorProps): void {
    const set = (b: HTMLElement | undefined, v: string) => {
      if (b && b.getAttribute('aria-label') !== v) b.setAttribute('aria-label', v);
    };
    for (const id of ['personnel', 'pool', 'research', 'director'] as const) set(this.hits.get(id), `${floorName(id, p)}: ${floorHint(id, p)}`);
    for (const d of DEPTS) {
      const pile = p.bottleneck === 'editing' && d === 'editing' ? '. Pages are piling up' : '';
      set(this.hits.get(`departments:${d}`), `${wingName(d, p)}: ${deptHint(d, p)}${pile}${this.acctNote[d] ?? ''}`);
    }
  }

  /** core's finiteBottleneck, made readable without colour: a drawn pile and words on the wing, or a note on the pool. */
  setBottleneck(b: 'typing' | 'editing' | null): void {
    this.host.dataset.bottleneck = b ?? '';
    this.pile = b === 'editing';
    this.paintCell('editing');
    this.limitTag.hidden = b !== 'typing';
    this.floors.get('pool')?.classList.toggle('flagged', b === 'typing');
    // the pile and its warning are always drawn; this class shows them (a flip never redraws the floor)
    this.floors.get('departments')?.classList.toggle('piled', b === 'editing');
    this.hits.get('departments:editing')?.classList.toggle('limit', b === 'editing');
    this.floors.get('pool')?.classList.toggle('limit', b === 'typing');
  }

  /** The next-thing cue: a lit tag and lamp on the cued floor (and wing). */
  setCue(cue: Cue | null): void {
    this.cued = cue;
    // A new cue on a floor that is scrolled out of view brings it back (not while the player is scrolling).
    if (cue && cue.room !== this.lastCueRoom && !document.body.classList.contains('room-open')) {
      const id = cue.room as FloorId;
      requestAnimationFrame(() => this.reveal(id, this.touched));
    }
    this.lastCueRoom = cue?.room ?? '';
    for (const [id, tag] of this.cueEl) {
      const on = !!cue && cue.room === id;
      tag.hidden = !on;
      if (on) tag.textContent = cue.tag;
      this.floors.get(id)?.classList.toggle('cued', on);
      // A floor with a flag shows it in place of the status (when the rail is narrow); see tower.css
      this.floors.get(id)?.classList.toggle('flagged', on || (id === 'pool' && !this.limitTag.hidden));
    }
    for (const d of DEPTS) this.paintCell(d);
    for (const b of this.hits.values()) b.removeAttribute('aria-description');
    for (const d of DEPTS) this.hits.get(`departments:${d}`)?.classList.remove('cued');
    const wing = cue && cue.room === 'departments' && cue.view && (DEPTS as readonly string[]).includes(cue.view) ? this.hits.get(`departments:${cue.view}`) : undefined;
    // A cued wing carries the ring; the floor's own ring is for floors without wings or a plain Departments cue.
    this.floors.get('departments')?.classList.toggle('wing-cued', !!wing);
    if (!cue) return;
    wing?.classList.add('cued');
    const target = wing ?? this.hits.get(cue.room) ?? this.hits.get('departments:recruiting');
    target?.setAttribute('aria-description', cue.tag);
  }

  // ---------- after Infinity ----------

  /** The hotel look is a class on the tower: names flip by data-live, the roof becomes the sky, the pool carries a share bar. */
  private setHotel(on: boolean): void {
    if (on === this.hotelOn) return;
    this.hotelOn = on;
    this.host.classList.toggle('hotel', on);
    this.dclock.hidden = !on;
    this.sbar.hidden = !on;
    this.dKey = '';
    this.sbarKey = '';
    const note = this.cells.get('departments:editing')?.querySelector('.wn-t');
    if (note) note.textContent = on ? 'Upgrade' : 'Pages piling up';
    for (const d of DEPTS) this.paintCell(d);
  }

  /** Which buses came or went since the last frame, read from market status (state, not events, so it also holds after a reload or catch-up). */
  private busChanges(p: FloorProps): { arrived: string[]; left: { id: string; node: Node | null }[] } {
    const out: { arrived: string[]; left: { id: string; node: Node | null }[] } = { arrived: [], left: [] };
    const first = this.marketSeen.size === 0;
    for (const m of p.hotel!.markets) {
      const was = this.marketSeen.get(m.id);
      this.marketSeen.set(m.id, m.status);
      if (first || !was || was === m.status) continue;
      if (was === 'inTransit' && m.status === 'onboarding') out.arrived.push(m.id);
      if (was === 'onboarding' && m.status === 'online') out.left.push({ id: m.id, node: this.arts.get('personnel')!.querySelector(`.bus-${m.id}`)?.cloneNode(true) ?? null });
    }
    return out;
  }

  /** Everything the hotel adds to the building each frame: street effects, the share bar, the deadline clock, the upgrade notes. */
  private hotelRoof(p: FloorProps, buses: { arrived: string[]; left: { id: string; node: Node | null }[] } | null): void {
    const h = p.hotel!;
    const fx = this.arts.get('personnel')!.querySelector('.tw-fx');
    for (const id of buses?.arrived ?? []) {
      this.pendingShuffle = id;
      const bus = this.arts.get('personnel')!.querySelector(`.bus-${id}`);
      if (bus && !reduceMotion.matches) bus.classList.add('arrive');
    }
    for (const b of buses?.left ?? []) {
      if (!fx || !b.node || reduceMotion.matches) continue;
      const g = b.node as SVGGElement;
      g.classList.remove('arrive');
      g.classList.add('depart');
      g.addEventListener('animationend', () => g.remove(), { once: true });
      fx.append(g);
    }
    if (this.pendingShuffle) {
      const m = h.markets.find((x) => x.id === this.pendingShuffle);
      if (!m || m.status !== 'onboarding') this.pendingShuffle = null;
      else if (!document.body.classList.contains('room-open')) {
        const id = this.pendingShuffle;
        this.pendingShuffle = null;
        // Bring the Front Desk into view after the cue's own scroll (same frame) has run, then return to the floor that matters.
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!this.touched) this.reveal('personnel'); }));
        this.playShuffle(id);
      }
    }
    // the share bar on the Typing Pool rail
    const parts = splitParts(h);
    const sk = parts.map((x) => `${x.id}:${x.pct}`).join('|');
    if (sk !== this.sbarKey) {
      this.sbarKey = sk;
      this.sbar.innerHTML = parts.map((x) => `<i class="seg m-${x.id}" style="flex-grow:${x.share.toFixed(3)}"><b>${x.glyph} ${x.pct}</b></i>`).join('');
      this.sbar.setAttribute('aria-label', floorHint('pool', p));
    }
    // upgrades you can afford light their wing cell
    const uk = DEPTS.map((d) => (h.staff[d].affordable ? 1 : 0)).join('');
    if (uk !== this.upKey) {
      this.upKey = uk;
      for (const d of DEPTS) this.paintCell(d);
    }
    this.deadlineClock(p);
  }

  private upKey = '';

  /** The roof clock after Infinity: the pinned Commission's time left, or a prompt to pin one. Same 44 px target as the quarter clock. */
  private deadlineClock(p: FloorProps): void {
    const h = p.hotel!;
    const pin = h.pinned;
    const key = pin ? `${pin.id}|${Math.ceil(pin.secondsLeft)}|${Math.round(pin.frac * 100)}` : `none|${h.offers}|${h.reward}`;
    if (key === this.dKey) return;
    this.dKey = key;
    const frac = pin ? Math.min(1, pin.secondsLeft / Math.max(1, pin.totalSeconds)) : 0;
    this.dArc.setAttribute('stroke-dashoffset', (CLOCK_C * (1 - frac)).toFixed(2));
    this.dNum.textContent = pin ? `${Math.max(1, Math.ceil(pin.secondsLeft / 60))}m` : '';
    this.dPin.style.display = pin ? 'none' : '';
    const prompt = !pin && (h.offers > 0 || h.reward);
    const text = pin ? `${mmss(pin.secondsLeft)} left` : h.reward ? 'Reward to use' : h.offers > 0 ? 'Pin a Commission' : 'No offers yet';
    this.dTag.textContent = text;
    this.dTag.classList.toggle('calm', !prompt);
    this.dclock.setAttribute('aria-label', pin
      ? `${KIND_NAMES[pin.kind] ?? 'Commission'} Commission, ${Math.round(pin.frac * 100)} percent delivered, ${Math.max(0, Math.ceil(pin.secondsLeft / 5) * 5)} seconds left. Open the Director's Office`
      : `${text}. Open the Director's Office`);
    this.dTag.hidden = false;
  }

  /** The Hilbert shuffle on the Front Desk: "everyone, please move to twice your room number", and the new guests take the odd rooms. About 3 seconds. */
  private playShuffle(market: string): void {
    const view = this.floors.get('personnel')?.querySelector<HTMLElement>('.flr-view');
    if (!view) return;
    this.endShuffle();
    const look = marketLook(market);
    const glyphs = Array.from(look.glyphs);
    const calm = reduceMotion.matches;
    const wrap = el('div', 'shuffle');
    wrap.setAttribute('aria-hidden', 'true');
    let html = `<p class="sh-cap">${calm ? `Everyone, please move to twice your room number. The ${look.name} guests take the odd rooms.` : 'Everyone, please move to twice your room number!'}</p>`;
    if (!calm) {
      html += '<div class="sh-row">';
      for (let n = 1; n <= 4; n++) html += `<div class="door res" style="--s:${n - 1};--mv:${n}"><b data-n="${n}">${n}</b></div>`;
      for (let k = 0; k < 4; k++) html += `<div class="door arr" style="--s:${2 * k};--k:${k}"><i>${glyphs[k % glyphs.length]}</i><b>${2 * k + 1}</b></div>`;
      html += '</div>';
    }
    wrap.innerHTML = html;
    view.append(wrap);
    this.shuffleEl = wrap;
    const at = (ms: number, fn: () => void) => this.shuffleTimers.push(window.setTimeout(fn, ms));
    requestAnimationFrame(() => wrap.classList.add('on'));
    if (calm) {
      at(3600, () => this.endShuffle());
      return;
    }
    at(120, () => wrap.classList.add('go'));
    // the numbers tick from n to 2n while the doors slide
    for (let step = 1; step <= 5; step++) {
      at(350 + step * 190, () => {
        wrap.querySelectorAll<HTMLElement>('b[data-n]').forEach((b) => {
          const n = Number(b.dataset.n);
          b.textContent = String(Math.round(n + (n * step) / 5));
        });
      });
    }
    at(1650, () => wrap.classList.add('arrive'));
    at(2700, () => wrap.classList.remove('on'));
    at(3000, () => this.endShuffle());
  }

  private endShuffle(): void {
    for (const id of this.shuffleTimers) window.clearTimeout(id);
    this.shuffleTimers = [];
    this.shuffleEl?.remove();
    this.shuffleEl = null;
    if (!this.touched && this.hotelOn && !document.body.classList.contains('room-open')) this.reveal(this.relevant());
  }

  /** The button to give focus back to when a room closes. */
  focusFloor(id: string, dept?: string): void {
    const b = (id === 'departments' ? this.hits.get(`departments:${dept ?? 'recruiting'}`) ?? this.hits.get('departments:recruiting') : this.hits.get(id)) as HTMLElement | undefined;
    b?.focus({ preventScroll: true });
  }

  /**
   * A manual hire happened (the game already updated its state). The waiting
   * candidate walks from the street into the lobby, then the floors show the new props.
   */
  hire(idx: number, next: FloorProps, quick: boolean): void {
    const art = this.arts.get('personnel')!;
    const cand = art.querySelector<SVGGElement>('#t-cand');
    const fx = art.querySelector<SVGGElement>('.tw-fx');
    const done = () => {
      this.walking = Math.max(0, this.walking - 1);
      if (this.walking) return;
      const p = this.deferred ?? next;
      this.deferred = null;
      this.key = ''; // force: the walk ended over the old picture
      this.cache.delete('personnel');
      this.apply(p, { sit: idx, arrive: true });
    };
    this.walking++;
    if (!cand || !fx || quick || reduceMotion.matches) {
      done();
      return;
    }
    const wk = document.createElementNS(NS, 'g');
    wk.setAttribute('class', 'walker');
    wk.innerHTML = `<g class="wf"><g class="wb">${cand.innerHTML}</g></g>`;
    cand.style.visibility = 'hidden';
    fx.append(wk);
    const y0 = 110;
    const pts: [number, number][] = [[238, y0], [143, y0], [143, 92]];
    const d = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
    const total = d.reduce((a, b) => a + b, 0);
    let acc = 0;
    const offs = [0, ...d.map((v) => (acc += v) / total)];
    const kf = pts.map((p, i) => ({ offset: offs[i], transform: `translate(${p[0]}px, ${p[1]}px) scale(${i === 2 ? 0.5 : 0.6})`, opacity: i === 2 ? 0 : 1 }));
    wk.setAttribute('style', `transform:${kf[0]!.transform}`);
    const a = wk.animate(kf, { duration: (total / WALK_SPEED) * 1000, easing: 'linear', fill: 'forwards' });
    a.onfinish = () => {
      wk.remove();
      done();
    };
  }
}
