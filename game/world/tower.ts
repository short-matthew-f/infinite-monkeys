// The Bureau Tower: the whole Bureau as one building of floors that fits the
// screen. Each floor is one big button with a small live scene; tapping it opens
// that room full screen (room.ts). The Departments floor is three wings, one
// button each, so a wing opens its own department.
//
// The markup is built once. Each floor's art is replaced only when its picture
// changes; small live numbers are patched in place. Every number comes from
// core (floorProps) and is never computed here.
import { DEPTS, N, finiteBottleneck, meters, moraleMult, type GameState, type Tuning } from '../../core/index.js';
import type { FloorProps } from './floor-art.js';
import { FLOOR_BOX, FLOOR_NAMES, buildTower, deptHint, floorHint, officeHint, patchLive, roofSVG, towerKey, type FloorId } from './tower-art.js';
import { OFFICE_IDS, OFFICE_SHORT } from './projects.js';
import type { Cue } from './advisor.js';
import './tower.css';

const NS = 'http://www.w3.org/2000/svg';
const WALK_SPEED = 80; // art units per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEPT_NAMES = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' } as const;
/** Top to bottom, as the building stands. */
const ORDER: FloorId[] = ['director', 'admin', 'research', 'departments', 'pool', 'personnel'];
/** Floor numbers. The Administration floor sits at 5 once it exists, which moves the Director's Office to 6. */
const DISC: Record<FloorId, number> = { personnel: 1, pool: 2, departments: 3, research: 4, admin: 5, director: 5 };
/** The Director's floor number, with or without the Administration floor under it. */
export const directorFloor = (admin: boolean): number => (admin ? 6 : 5);

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
    office: s.office ? officeProps(s, t) : undefined,
  };
}

/** The support offices on the building: morale from core's moraleMult, amenities from the owned counts. */
function officeProps(s: GameState, t: Tuning): NonNullable<FloorProps['office']> {
  const o = s.office!;
  const morale = moraleMult(s);
  const max = t.budget?.morale.max ?? 1;
  return {
    on: true,
    morale,
    // The needle's place on the dial: a ratio for drawing only.
    moraleFrac: max > 1 ? Math.max(0, Math.min(1, (morale - 1) / (max - 1))) : 0,
    built: { bathrooms: (o.owned.bathrooms ?? 0) > 0, breakRoom: (o.owned.breakRoom ?? 0) > 0, snackMachine: (o.owned.snackMachine ?? 0) > 0 },
    audit: o.audits.length > 0,
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
  private acctNote: Partial<Record<(typeof DEPTS)[number], string>> = {};
  private flashes = new Map<string, { n: number; timer: number }>();
  /** Called when the roof clock is tapped (budget trial). */
  onReview: () => void = () => {};
  /** Called when a floor (or a Departments wing) is activated. */
  onOpen: (id: FloorId, from: HTMLElement, dept?: string) => void = () => {};

  constructor(private host: HTMLElement) {
    const roof = (this.roof = el('div', 'roof'));
    roof.innerHTML = `<svg viewBox="0 -8 400 34" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${roofSVG()}</svg>`;
    this.clock = el('button', 'qclock',
      `<span class="qtag" hidden></span><svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle class="qface" cx="20" cy="20" r="19"/><circle class="qtrack" cx="20" cy="20" r="${CLOCK_R}"/><circle class="qarc" cx="20" cy="20" r="${CLOCK_R}" transform="rotate(-90 20 20)" stroke-dasharray="${CLOCK_C.toFixed(2)}"/><circle class="qring" cx="20" cy="20" r="19"/><text class="qnum" x="20" y="24.5" text-anchor="middle">Q1</text></svg>`);
    this.clock.type = 'button';
    this.clock.hidden = true;
    this.clock.addEventListener('click', () => this.onReview());
    this.clockArc = this.clock.querySelector('.qarc') as unknown as SVGCircleElement;
    this.clockQ = this.clock.querySelector('.qnum') as unknown as SVGTextElement;
    this.clockTag = this.clock.querySelector('.qtag') as HTMLElement;
    roof.append(this.clock);
    const bldg = el('div', 'bldg');
    this.limitTag = el('span', 'limit-tag', '<span aria-hidden="true">◆</span> Typing is the limit');
    for (const id of ORDER) bldg.append(this.floor(id));
    host.append(roof, bldg);
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
    const wings = id === 'departments' || id === 'admin';
    const rail = el('div', wings ? 'rail rail-wings' : 'rail');
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
    rail.append(el('span', 'fplate', `<span class="disc sm" aria-hidden="true">${DISC[id]}</span><span class="pn">${FLOOR_NAMES[id]}</span>`));
    const cue = el('span', 'cue-tag');
    cue.hidden = true;
    cue.setAttribute('aria-hidden', 'true');
    this.cueEl.set(id, cue);
    if (id === 'departments') {
      // Each wing's label is a cell in the rail: its name and level, or (in the same place) the pile warning, the cue or a flash.
      for (const d of DEPTS) {
        const c = el('span', `wcell wcell-${d}`, `<span class="wv wv-name">${DEPT_NAMES[d]} <span class="lvw">Lv </span><span data-live="lv:${d}"></span></span>${d === 'editing' ? '<span class="wv wv-note" aria-hidden="true"><span class="wg" aria-hidden="true">▲</span> Pages piling up</span>' : ''}<span class="wv wv-cue" aria-hidden="true"></span><span class="wv wv-flash" aria-hidden="true"></span><i class="acct-bar" aria-hidden="true" hidden></i>`);
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
    } else if (id === 'admin') {
      // Administration: three wings, each with its head. A wing opens that office's room.
      f.hidden = true;
      for (const o of OFFICE_IDS) {
        const c = el('span', `wcell wcell-${o}`, `<span class="wv wv-name"><span data-live="adm-${o}">${OFFICE_SHORT[o]}</span></span>`);
        rail.append(c);
        const w = el('button', `wing wing-${o}`);
        w.type = 'button';
        w.dataset.room = 'admin';
        w.dataset.dept = o;
        w.setAttribute('aria-label', `${OFFICE_SHORT[o]} office`);
        this.hits.set(`admin:${o}`, w);
        f.append(w);
      }
    } else {
      const b = el('button', 'hit');
      b.type = 'button';
      b.dataset.room = id;
      b.setAttribute('aria-label', FLOOR_NAMES[id]);
      this.hits.set(id, b);
      rail.append(el('span', 'ftag', `<span data-live="${id}"></span>`));
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
    this.setAdmin(!!p.office?.on);
    this.labels(p);
    this.setBottleneck(p.bottleneck);
    return rebuilt;
  }

  /** The Administration floor shows once the budget has opened; the Director's Office moves up a floor. */
  private setAdmin(on: boolean): void {
    const f = this.floors.get('admin');
    if (!f || f.hidden === !on) return;
    f.hidden = !on;
    const disc = this.floors.get('director')?.querySelector('.disc');
    if (disc) disc.textContent = String(directorFloor(on));
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
    const st = this.flashes.has(d) ? 'flash' : cueOn ? 'cue' : this.pile && d === 'editing' ? 'note' : 'name';
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
    for (const id of ['personnel', 'pool', 'research', 'director'] as const) set(this.hits.get(id), `${FLOOR_NAMES[id]}: ${floorHint(id, p)}`);
    for (const o of OFFICE_IDS) set(this.hits.get(`admin:${o}`), `${OFFICE_SHORT[o]} office: ${officeHint(o, p)}`);
    for (const d of DEPTS) {
      const pile = p.bottleneck === 'editing' && d === 'editing' ? '. Pages are piling up' : '';
      set(this.hits.get(`departments:${d}`), `${DEPT_NAMES[d]}: ${deptHint(d, p)}${pile}${this.acctNote[d] ?? ''}`);
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

  /** The button to give focus back to when a room closes. */
  focusFloor(id: string, dept?: string): void {
    const office = (OFFICE_IDS as readonly string[]).includes(id) ? this.hits.get(`admin:${id}`) : undefined;
    const b = (office ?? (id === 'departments' ? this.hits.get(`departments:${dept ?? 'recruiting'}`) ?? this.hits.get('departments:recruiting') : this.hits.get(id))) as HTMLElement | undefined;
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
