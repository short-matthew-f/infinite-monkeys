// The floor controller: turns GameState into floor props, rebuilds the world
// SVG only when the picture can change, owns the room hot areas and plan tags,
// and plays the hire walk when a `hire` event arrives.
import { DEPTS, N, type GameState, type Tuning } from '../../core/index.js';
import { CAP, PERS_DY, buildFloor, deskSpot, installRouteCSS, normalize, updateHeadcount, type FloorProps, type FloorZone } from './floor-art.js';

const NS = 'http://www.w3.org/2000/svg';
const WALK_SPEED = 250; // world px per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Art props from game state. Every value is read from state; nothing is computed here. */
export function floorProps(s: GameState, t: Tuning): FloorProps {
  const seated = Math.floor(N.toNumber(s.monkeys));
  const desks = Math.floor(N.toNumber(s.desks));
  const tiers = t.tiers.map((tier) => {
    const ts = s.tiers[tier.id];
    return { id: tier.id, state: ts?.discovered ? 'discovered' as const : ts?.discoverable ? 'researching' as const : 'locked' as const };
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
  };
}

export interface ZoneView extends FloorZone {
  name: string;
  disc: number;
  chipText: string;
}

export class FloorView {
  zones: FloorZone[] = [];
  private key = '';
  private walking = 0;
  private deferred: FloorProps | null = null;
  private chipEls: { el: HTMLElement; wx: number; wy: number }[] = [];
  /** Called when a room's hot area or plan tag is activated. */
  onZone: (id: string, from: HTMLElement) => void = () => {};
  /** Called while a hire walk wants the camera to show its path ([x, y, w, h] in world coords), and again with null when done. */
  onWalk: (box: [number, number, number, number] | null) => void = () => {};

  constructor(
    private world: SVGGElement,
    private fx: SVGGElement,
    private cam: HTMLElement,
    private chips: HTMLElement,
    private names: Record<string, { name: string; disc: number; chip: string }>,
  ) {
    installRouteCSS();
  }

  /** Rebuilds only when the picture changes; the headcount placard is patched in place. Returns true if rebuilt. */
  apply(p: FloorProps, opts: { sit?: number | null; arrive?: boolean } = {}): boolean {
    if (this.walking) {
      this.deferred = p;
      return false;
    }
    // The key is cheap (a small normalized object); the markup is ~100 KB, so build it only when the key moves.
    const key = JSON.stringify(normalize(p));
    if (key === this.key) {
      updateHeadcount(this.world, p.seated);
      return false;
    }
    const f = buildFloor(p);
    this.key = key;
    this.world.innerHTML = f.svg;
    if (!this.zones.length) this.mountZones(f.zones);
    this.zones = f.zones;
    document.body.classList.toggle('hired', !p.tutorial);
    const cand = this.world.querySelector<SVGGElement>('#cand');
    if (cand && opts.arrive && !reduceMotion.matches) cand.classList.add('arrive');
    if (opts.sit != null) {
      const seat = this.world.querySelector(`.seat[data-i="${opts.sit}"]`);
      if (seat) {
        seat.classList.add('sit', 'hl');
        window.setTimeout(() => seat.classList.remove('sit'), 400);
        window.setTimeout(() => seat.classList.remove('hl'), 1700);
      }
    }
    return true;
  }

  zone(id: string): FloorZone | undefined {
    return this.zones.find((z) => z.id === id);
  }

  /** Hot areas (inside the world) and plan tags (screen-space overlay) come from the zones buildFloor returns. */
  private mountZones(zones: FloorZone[]): void {
    for (const z of zones) {
      const meta = this.names[z.id];
      const b = document.createElement('button');
      b.className = 'hot';
      b.dataset.zone = z.id;
      Object.assign(b.style, { left: `${z.box[0]}px`, top: `${z.box[1]}px`, width: `${z.box[2]}px`, height: `${z.box[3]}px` });
      b.setAttribute('aria-label', z.label);
      this.cam.append(b);
      for (const e of z.extra ?? []) {
        const d = document.createElement('div');
        d.className = 'hot';
        d.dataset.zone = z.id;
        d.setAttribute('aria-hidden', 'true');
        Object.assign(d.style, { left: `${e[0]}px`, top: `${e[1]}px`, width: `${e[2]}px`, height: `${e[3]}px` });
        this.cam.append(d);
      }
      const c = document.createElement('div');
      c.className = 'chip';
      c.dataset.chip = z.id;
      c.dataset.a = z.chip.a;
      c.setAttribute('aria-hidden', 'true');
      c.innerHTML = `<span class="disc sm">${meta?.disc ?? ''}</span><span>${meta?.chip ?? ''}</span>${z.id === 'personnel' ? '<span class="start">Start here</span>' : ''}`;
      this.chips.append(c);
      this.chipEls.push({ el: c, wx: z.chip.x, wy: z.chip.y });
    }
    const activate = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-zone], [data-chip]');
      if (!el) return;
      const id = el.dataset.zone ?? el.dataset.chip;
      if (id) this.onZone(id, el);
    };
    this.cam.addEventListener('click', activate);
    this.chips.addEventListener('click', activate);
  }

  /** Places plan tags in screen space for the current camera pose. */
  placeChips(x: number, y: number, s: number, plan: boolean): void {
    const o = plan ? Math.max(0, Math.min(1, (0.76 - s) * 8)) : 0;
    for (const c of this.chipEls) {
      c.el.style.left = `${c.wx * s + x}px`;
      c.el.style.top = `${c.wy * s + y}px`;
      c.el.style.opacity = String(o);
    }
  }

  /**
   * A hire happened (the game already updated its state). The waiting candidate
   * walks from the entrance to desk `idx`, then the floor shows the new props.
   */
  hire(idx: number, next: FloorProps): void {
    const cand = this.world.querySelector<SVGGElement>('#cand');
    const done = () => {
      this.walking = Math.max(0, this.walking - 1);
      if (this.walking) return;
      const p = this.deferred ?? next;
      this.deferred = null;
      this.key = ''; // force: the walk ended over the old picture
      this.apply(p, { sit: idx < CAP ? idx : null, arrive: true });
      this.onWalk(null);
    };
    this.walking++;
    if (!cand || reduceMotion.matches) {
      done();
      return;
    }
    const wk = document.createElementNS(NS, 'g');
    wk.setAttribute('class', 'walker');
    wk.innerHTML = `<g class="wf"><g class="wb">${cand.innerHTML}</g></g>`;
    cand.style.visibility = 'hidden';
    this.fx.append(wk);
    const [tx, ty] = idx < CAP ? deskSpot(idx) : [390, 1290];
    const y0 = 1470 + PERS_DY;
    const pts: [number, number][] = [[362, y0], [130, y0], [130, ty], [tx, ty]];
    // Show where the new monkey sits down; the whole path is too tall to fit above a sheet.
    this.onWalk([90, ty - 90, 470, 320]);
    const d = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
    const total = d.reduce((a, b) => a + b, 0);
    let acc = 0;
    const offs = [0, ...d.map((v) => (acc += v) / total)];
    const kf = pts.map((p, i) => ({ offset: offs[i], transform: `translate(${p[0]}px, ${p[1]}px)` }));
    wk.style.transform = kf[0]!.transform;
    const dur = (total / WALK_SPEED) * 1000;
    window.setTimeout(() => {
      const a = wk.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' });
      const turn = offs[2] ?? 0.5;
      wk.querySelector('.wf')?.animate(
        [{ transform: 'scaleX(1)', offset: 0 }, { transform: 'scaleX(1)', offset: turn }, { transform: 'scaleX(-1)', offset: turn }, { transform: 'scaleX(-1)', offset: 1 }],
        { duration: dur, easing: 'linear', fill: 'forwards' },
      );
      a.onfinish = () => {
        wk.remove();
        done();
      };
    }, 520); // let the camera pull back first
  }
}
