// The Bureau Tower: the whole Bureau as one building of floors that fits the
// screen. Each floor is one big button with a small live scene; tapping it opens
// that room full screen (room.ts). The Departments floor is three wings, one
// button each, so a wing opens its own department.
//
// The markup is built once. Each floor's art is replaced only when its picture
// changes; small live numbers are patched in place. Every number comes from
// core (floorProps) and is never computed here.
import { DEPTS, N, finiteBottleneck, meters, type GameState, type Tuning } from '../../core/index.js';
import type { FloorProps } from './floor-art.js';
import { FLOOR_BOX, FLOOR_NAMES, buildTower, deptHint, floorHint, patchLive, roofSVG, towerKey, type FloorId } from './tower-art.js';
import type { Cue } from './advisor.js';
import './tower.css';

const NS = 'http://www.w3.org/2000/svg';
const WALK_SPEED = 80; // art units per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEPT_NAMES = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' } as const;
/** Top to bottom, as the building stands. */
const ORDER: FloorId[] = ['director', 'research', 'departments', 'pool', 'personnel'];
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
  };
}

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
  private hits = new Map<string, HTMLButtonElement>();
  private key = '';
  private walking = 0;
  private deferred: FloorProps | null = null;
  private props: FloorProps | null = null;
  private cueEl = new Map<FloorId, HTMLElement>();
  private limitTag: HTMLElement;
  private pileNote!: HTMLElement;
  private cued: Cue | null = null;
  /** Called when a floor (or a Departments wing) is activated. */
  onOpen: (id: FloorId, from: HTMLElement, dept?: string) => void = () => {};

  constructor(private host: HTMLElement) {
    const roof = el('div', 'roof');
    roof.innerHTML = `<svg viewBox="0 -8 400 34" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${roofSVG()}</svg>`;
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
    const art = document.createElementNS(NS, 'svg') as SVGSVGElement;
    art.setAttribute('class', 'flr-art');
    art.setAttribute('viewBox', `0 0 ${FLOOR_BOX[id][0]} ${FLOOR_BOX[id][1]}`);
    art.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    art.setAttribute('aria-hidden', 'true');
    f.append(art);
    this.arts.set(id, art);
    this.floors.set(id, f);
    f.append(el('span', 'fplate', `<span class="disc sm" aria-hidden="true">${DISC[id]}</span><span>${FLOOR_NAMES[id]}</span>`));
    const cue = el('span', 'cue-tag');
    cue.hidden = true;
    cue.setAttribute('aria-hidden', 'true');
    this.cueEl.set(id, cue);
    if (id === 'departments') {
      for (const d of DEPTS) {
        const w = el('button', `wing wing-${d}`, `<span class="wlab"><span data-live="${d}"></span>${d === 'editing' ? '<span class="wnote" hidden><span aria-hidden="true">▲</span> Pages piling up</span>' : ''}</span>`);
        w.type = 'button';
        w.dataset.room = 'departments';
        w.dataset.dept = d;
        w.setAttribute('aria-label', `${DEPT_NAMES[d]}: hire and level up`);
        this.hits.set(`departments:${d}`, w);
        f.append(w);
      }
      this.pileNote = f.querySelector('.wnote') as HTMLElement;
    } else {
      const b = el('button', 'hit');
      b.type = 'button';
      b.dataset.room = id;
      b.setAttribute('aria-label', FLOOR_NAMES[id]);
      this.hits.set(id, b);
      f.append(el('span', 'ftag', `<span data-live="${id}"></span>`), b);
      if (id === 'pool') f.append(this.limitTag);
    }
    f.append(cue);
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
    this.labels(p);
    this.setBottleneck(p.bottleneck);
    return rebuilt;
  }

  /** Button labels carry the same status words as the plates. */
  private labels(p: FloorProps): void {
    const set = (b: HTMLElement | undefined, v: string) => {
      if (b && b.getAttribute('aria-label') !== v) b.setAttribute('aria-label', v);
    };
    for (const id of ['personnel', 'pool', 'research', 'director'] as const) set(this.hits.get(id), `${FLOOR_NAMES[id]}: ${floorHint(id, p)}`);
    for (const d of DEPTS) {
      const pile = p.bottleneck === 'editing' && d === 'editing' ? '. Pages are piling up' : '';
      set(this.hits.get(`departments:${d}`), `${DEPT_NAMES[d]}: ${deptHint(d, p)}${pile}`);
    }
  }

  /** core's finiteBottleneck, made readable without colour: a drawn pile and words on the wing, or a note on the pool. */
  setBottleneck(b: 'typing' | 'editing' | null): void {
    this.host.dataset.bottleneck = b ?? '';
    this.pileNote.hidden = b !== 'editing';
    this.limitTag.hidden = b !== 'typing';
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
    }
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
