// The world camera: two zoom levels (roomy play view, whole-floor plan view),
// drag-pan with momentum, pinch between levels, and fly-to.
//
// Performance rules (design/STYLE.md), measured on the mockup at 4× CPU throttle:
// - The camera is ONE plain transform on one element. Nothing in the world
//   reads camera values, so moving never restyles the floor.
// - Flights use a CSS transform transition (compositor thread). The layer is
//   promoted only while moving, then dropped so the floor re-rasters crisp.
// - `body.moving` pauses ambient animation while the camera moves; areas out
//   of view are culled (`.offscreen`) at rest.
// - Screen-sized labels live outside the world and are placed when the camera settles.

export type Mode = 'play' | 'plan';
export type Pose = readonly [x: number, y: number, s: number];
export type Box = readonly [x: number, y: number, w: number, h: number];

export interface CameraOptions {
  stage: HTMLElement;
  world: HTMLElement;
  size: readonly [w: number, h: number];
  /** Zoom for the play view. */
  playScale: number;
  /** Screen pixels covered at the top (header, feed) and bottom (bars). */
  insets: () => { top: number; bottom: number };
  /** Called after every settled move with the current pose and mode. */
  onSettle?: (pose: Pose, mode: Mode) => void;
  /** Called when the mode changes. */
  onMode?: (mode: Mode) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const FLIGHT_MS = 860;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class Camera {
  mode: Mode = 'play';
  x = 0;
  y = 0;
  s: number;
  /** True while a flight, drag, coast, or pinch is in progress. */
  busy = false;
  /** Set briefly after a drag so the tap that ended it doesn't open a room. */
  dragged = false;

  private o: CameraOptions;
  private areas: { el: Element; box: Box; off: boolean }[] = [];
  private flightTimer = 0;
  private lastPlay: Pose | null = null;

  constructor(o: CameraOptions) {
    this.o = o;
    this.s = o.playScale;
    o.world.style.transformOrigin = '0 0';
    this.bindPointer();
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('hidden-page', document.hidden));
  }

  // ---------- geometry ----------

  get vw() { return this.o.stage.clientWidth; }
  get vh() { return this.o.stage.clientHeight; }

  planScale(): number {
    const [w, h] = this.o.size;
    const { top, bottom } = this.o.insets();
    return Math.min(this.vw / w, (this.vh - top - bottom - 16) / h);
  }

  planPose(): Pose {
    const s = this.planScale();
    const { top } = this.o.insets();
    return [(this.vw - this.o.size[0] * s) / 2, top + 8, s];
  }

  /** Keeps a sliver of table visible at each edge. */
  clampPose(x: number, y: number, s = this.s): [number, number] {
    const [w, h] = this.o.size;
    const { top, bottom } = this.o.insets();
    const minX = this.vw - w * s - 18, maxX = 18;
    const minY = this.vh - bottom - h * s - 14, maxY = top + 6;
    return [minX > maxX ? (minX + maxX) / 2 : clamp(x, minX, maxX), minY > maxY ? (minY + maxY) / 2 : clamp(y, minY, maxY)];
  }

  /** Pose that centres a world box in the visible area, at play zoom, optionally above a sheet of `cover` px. */
  frame(box: Box, cover = 0, s = this.o.playScale, minScale = 0): Pose {
    const { top } = this.o.insets();
    const bottom = Math.max(this.o.insets().bottom, cover);
    const fit = Math.max(minScale, Math.min(s, (this.vw - 24) / box[2], (this.vh - top - bottom - 24) / box[3]));
    const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
    const sy = (top + this.vh - bottom) / 2;
    const [x, y] = cover ? [this.vw / 2 - cx * fit, sy - cy * fit] : this.clampPose(this.vw / 2 - cx * fit, sy - cy * fit, fit);
    return [x, y, fit];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.x) / this.s, (sy - this.y) / this.s];
  }

  // ---------- culling ----------

  /** Registers elements whose ambient animation pauses when out of view. Call after the world is (re)built. */
  measure(selector: string): void {
    const rect = this.o.world.getBoundingClientRect();
    const k = rect.width / this.o.size[0] || 1;
    this.areas = [...this.o.world.querySelectorAll(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      return { el, box: [(r.left - rect.left) / k, (r.top - rect.top) / k, r.width / k, r.height / k] as Box, off: false };
    });
    this.cull();
  }

  private cull(): void {
    const m = 8 / this.s;
    const x0 = -this.x / this.s - m, x1 = (this.vw - this.x) / this.s + m;
    const y0 = -this.y / this.s - m, y1 = (this.vh - this.y) / this.s + m;
    for (const a of this.areas) {
      const [bx, by, bw, bh] = a.box;
      const off = bx + bw < x0 || bx > x1 || by + bh < y0 || by > y1;
      if (off !== a.off) {
        a.off = off;
        a.el.classList.toggle('offscreen', off);
      }
    }
  }

  // ---------- moving ----------

  private apply(x: number, y: number, s: number): void {
    this.x = x;
    this.y = y;
    this.s = s;
    this.o.world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  }

  private startMove(): void {
    this.o.world.classList.remove('flying');
    this.o.world.classList.add('moving');
    document.body.classList.add('moving');
    this.busy = true;
  }

  private endMove(): void {
    this.o.world.classList.remove('moving', 'flying');
    document.body.classList.remove('moving');
    this.busy = false;
    this.cull();
    this.o.onSettle?.([this.x, this.y, this.s], this.mode);
  }

  /** Instant move (no animation). */
  jump([x, y, s]: Pose): void {
    this.apply(x, y, s);
    this.cull();
    this.o.onSettle?.([x, y, s], this.mode);
  }

  /** Animated move; with reduced motion, a snap behind a brief fade. */
  fly([x, y, s]: Pose): Promise<void> {
    clearTimeout(this.flightTimer);
    return new Promise((done) => {
      if (reduceMotion.matches) {
        this.o.world.classList.add('fade');
        this.flightTimer = window.setTimeout(() => {
          this.jump([x, y, s]);
          requestAnimationFrame(() => this.o.world.classList.remove('fade'));
          done();
        }, 150);
        return;
      }
      this.startMove();
      this.o.world.classList.add('flying');
      this.apply(x, y, s);
      this.flightTimer = window.setTimeout(() => {
        this.endMove();
        done();
      }, FLIGHT_MS + 20);
    });
  }

  setMode(m: Mode): void {
    if (m === this.mode) return;
    this.mode = m;
    document.body.classList.toggle('plan', m === 'plan');
    this.o.onMode?.(m);
  }

  toPlan(): Promise<void> {
    if (this.mode === 'plan') return Promise.resolve();
    if (!this.busy) this.lastPlay = [this.x, this.y, this.s];
    this.setMode('plan');
    return this.fly(this.planPose());
  }

  /** Back to play view: to `pose` if given, else where the player was. */
  toPlay(pose?: Pose): Promise<void> {
    this.setMode('play');
    const target = pose ?? this.lastPlay ?? this.frame([0, 0, this.o.size[0], this.o.size[1]]);
    this.lastPlay = target;
    return this.fly(target);
  }

  /** Current transform as rendered (mid-flight included). */
  private live(): Pose {
    const m = new DOMMatrix(getComputedStyle(this.o.world).transform);
    return [m.m41, m.m42, m.a];
  }

  // ---------- pointer: drag, coast, pinch ----------

  /** Hook for the game to pick a play pose after a pinch-in at world point (wx, wy). */
  pinchIn: (wx: number, wy: number) => Pose = (wx, wy) => {
    const s = this.o.playScale;
    return [...this.clampPose(this.vw / 2 - wx * s, this.vh / 2 - wy * s, s), s];
  };

  private bindPointer(): void {
    const ptrs = new Map<number, [number, number]>();
    let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, raf = 0, coasting = false;
    let hist: [number, number, number][] = [];
    let pinch: { d0: number; s0: number; wx: number; wy: number; from: Mode } | null = null;
    const world = this.o.world;
    const pair = () => {
      const [a, b] = [...ptrs.values()] as [[number, number], [number, number]];
      return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
    };
    const markDragged = (ms: number) => {
      this.dragged = true;
      window.setTimeout(() => (this.dragged = false), ms);
    };
    // Pointer moves are coalesced to one transform write per frame.
    let pending: Pose | null = null;
    const schedule = (p: Pose) => {
      if (!pending) requestAnimationFrame(() => { if (pending) { this.apply(...pending); pending = null; } });
      pending = p;
    };

    world.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('sheet-open')) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) {
        cancelAnimationFrame(raf);
        coasting = false;
        down = false;
        const [lx, ly, ls] = this.live();
        this.startMove();
        this.apply(lx, ly, ls);
        const p = pair();
        pinch = { d0: p.d, s0: ls, wx: (p.mx - lx) / ls, wy: (p.my - ly) / ls, from: this.mode };
        this.dragged = true;
        return;
      }
      if (ptrs.size > 2 || this.mode === 'plan' || world.classList.contains('flying')) return;
      cancelAnimationFrame(raf);
      if (coasting) markDragged(120);
      coasting = false;
      const [lx, ly] = this.live();
      this.startMove();
      this.apply(lx, ly, this.o.playScale);
      down = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      ox = lx;
      oy = ly;
      hist = [[performance.now(), lx, ly]];
    });

    window.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch) {
        if (ptrs.size < 2) return;
        const p = pair();
        const s = clamp((pinch.s0 * p.d) / pinch.d0, this.planScale() * 0.84, this.o.playScale * 1.16);
        schedule([p.mx - pinch.wx * s, p.my - pinch.wy * s, s]);
        return;
      }
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      const [x, y] = this.clampPose(ox + dx, oy + dy, this.o.playScale);
      schedule([x, y, this.o.playScale]);
      hist.push([performance.now(), x, y]);
      if (hist.length > 6) hist.shift();
    });

    const release = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (pinch) {
        if (ptrs.size >= 2) return;
        const p = pinch;
        pinch = null;
        markDragged(260);
        if (pending) { this.apply(...pending); pending = null; }
        this.endMove();
        if (this.s < Math.sqrt(this.planScale() * this.o.playScale)) void this.toPlan();
        else void this.toPlay(this.pinchIn(p.wx, p.wy));
        return;
      }
      if (!down) return;
      down = false;
      if (pending) { this.apply(...pending); pending = null; }
      if (!moved) { this.endMove(); return; }
      markDragged(120);
      const a = hist[0]!, b = hist[hist.length - 1]!;
      const dt = Math.max(1, b[0] - a[0]);
      let vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
      if (performance.now() - b[0] > 90 || reduceMotion.matches) {
        this.lastPlay = [this.x, this.y, this.s];
        this.endMove();
        return;
      }
      coasting = true;
      let last = performance.now();
      const step = (t: number) => {
        const d = Math.min(32, t - last);
        last = t;
        const k = Math.pow(0.93, d / 16);
        vx *= k;
        vy *= k;
        const nx = this.x + vx * d, ny = this.y + vy * d;
        const [qx, qy] = this.clampPose(nx, ny, this.o.playScale);
        if (qx !== nx) vx = 0;
        if (qy !== ny) vy = 0;
        this.apply(qx, qy, this.o.playScale);
        if (coasting && Math.hypot(vx, vy) > 0.03) raf = requestAnimationFrame(step);
        else {
          coasting = false;
          this.lastPlay = [this.x, this.y, this.s];
          this.endMove();
        }
      };
      raf = requestAnimationFrame(step);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // Trackpad pinch and ctrl + wheel switch levels.
    this.o.stage.addEventListener('wheel', (e) => {
      if (!e.ctrlKey || document.body.classList.contains('sheet-open')) return;
      e.preventDefault();
      if (this.busy) return;
      if (e.deltaY > 0 && this.mode === 'play') void this.toPlan();
      else if (e.deltaY < 0 && this.mode === 'plan') {
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        void this.toPlay(this.pinchIn(wx, wy));
      }
    }, { passive: false });
  }
}
