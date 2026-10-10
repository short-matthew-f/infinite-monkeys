// The Infinity ceremony (DESIGN.md section 4, HANDOFF M4): plays once when the player declares.
//
//   1. the camera climbs an endless building (floors keep stacking above the Director's Office and fade upward)
//   2. the monkey counter spins and flips to aleph-null
//   3. job titles flip one by one, the roster keeping "formerly: Builder"
//   4. a closing card: "The first bus is on its way."
//
// Total about 16 seconds. Tap anywhere, press a key, or use Skip to leave early. One timeline, driven by one
// clock: nothing is stacked on setTimeout, and time spent in the background pauses it, so a player who switches
// away comes back to the beat they left. The overlay is built once; the building is one SVG moved by one
// transform (design/STYLE.md rules 1 and 2). Reduced motion keeps the same order of beats as crossfades.
import { N, busSpeed, type GameEvent, type GameState, type Tuning } from '../../core/index.js';
import { busSVG, marketLook, mmss } from './tower-art.js';
import './infinity.css';

export interface InfinityCeremonyOpts {
  /** Element the ceremony overlay mounts into (full screen, above the tower). */
  host: HTMLElement;
  state: () => GameState;
  t: Tuning;
  /** Called when the ceremony closes (the player is back on the tower). */
  onDone: () => void;
}

/** When each beat begins, in milliseconds on the ceremony clock. */
export const BEATS = {
  climb: 350,
  count: 1500,
  spin: 2000,
  flip: 4600,
  stamp: 5200,
  titles: 6300,
  firstRow: 6900,
  rowEvery: 1000,
  card: 11800,
  auto: 16200,
} as const;
/** Taps in the first moments are the Declare tap's echo, not a skip. */
const GRACE_MS = 700;

const ALEPH = 'ℵ₀';
const hs = (i: number): number => {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  return h >>> 0;
};
const esc = (v: string): string => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface Flip {
  from: string;
  to: string;
  note: string;
}
/** Roles core does not flip, shown for the joke and the roster's completeness. Not events: nothing here is a game fact. */
const FLAVOR: Flip[] = [
  { from: 'Elevator Operator', to: 'Retired', note: 'farewell party: ongoing, indefinitely' },
  { from: 'Editor', to: 'Editor', note: 'no change; still the bottleneck' },
];
const FLOOR_PLATES = ['PERSONNEL', 'TYPING POOL', 'DEPARTMENTS', 'RECORDS LIBRARY', "DIRECTOR'S OFFICE"];
const HIGHER = ['6', '7', '8', '9', '10', '12', '15', '20', '30', '50', '100', '365', '1,000', '10⁴', '10⁶', '10⁹', 'n', 'n+1', 'n+2', '…', '…', '∞', '∞', '∞', '∞'];

/** The endless building: five real floors, then floors with ever larger numbers that fade into the sky. Static markup, moved as one. */
function buildingSVG(): string {
  const W = 360;
  const H = 1700;
  const G = 1660;
  const FH = 56;
  const BX = 60;
  const BW = 240;
  const floors = 5 + HIGHER.length;
  let s = '';
  for (let i = 0; i < 46; i++) s += `<circle cx="${hs(i) % W}" cy="${hs(i + 99) % 900}" r="${0.7 + (hs(i + 7) % 10) / 9}" fill="var(--glow)" opacity="${(0.25 + (hs(i + 3) % 60) / 100).toFixed(2)}"/>`;
  s += `<rect y="${G}" width="${W}" height="${H - G}" class="inf-road"/><path d="M0 ${G + 20}H${W}" stroke="var(--mustard)" stroke-width="2" stroke-dasharray="14 10" opacity=".7"/>`;
  for (let k = 1; k <= floors; k++) {
    const y = G - k * FH;
    const op = k <= 5 ? 1 : Math.max(0.05, 1 - (k - 5) / 22) ** 1.15;
    let f = `<rect class="inf-wall" x="${BX}" y="${y}" width="${BW}" height="${FH}"/>`;
    for (let i = 0; i < 5; i++) {
      const lit = hs(k * 9 + i) % 4 !== 0;
      f += `<rect class="${lit ? 'inf-win lit' : 'inf-win'}" x="${BX + 14 + i * 44}" y="${y + 12}" width="24" height="24"/>`;
    }
    const label = k <= 5 ? FLOOR_PLATES[k - 1]! : HIGHER[k - 6]!;
    f += `<rect class="inf-plate-s" x="${BX + BW / 2 - 50}" y="${y + FH - 17}" width="100" height="14" rx="2"/><text class="inf-plate-t" x="${BX + BW / 2}" y="${y + FH - 6.4}">${esc(k <= 5 ? `${k} · ${label}` : label)}</text>`;
    if (k === 5) f += `<g class="inf-sign"><rect x="${BX + BW - 96}" y="${y - 15}" width="92" height="13" rx="2"/><text x="${BX + BW - 50}" y="${y - 5.4}">ROOF: REMOVED</text></g>`;
    s += `<g opacity="${op.toFixed(2)}">${f}</g>`;
  }
  s += `<path class="inf-door" d="M${BX + BW / 2 - 14} ${G}v-30h28v30z"/><rect x="${BX - 6}" y="${G}" width="${BW + 12}" height="6" class="inf-step"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${s}</svg>`;
}

export class InfinityCeremony {
  private root: HTMLElement | null = null;
  private started = false;
  private done = false;
  private raf = 0;
  private t0 = 0;
  private last = 0;
  private beat = 0;
  private spinAt = 0;
  private calm = false;
  private prevFocus: Element | null = null;
  /** titleFlipped events, buffered from the moment they arrive: core emits them inside declareInfinity, before start(). */
  private flips: Flip[] = [];
  private rowsShown = 0;
  private titlesOn = false;
  private rowTimes: number[] = [];
  private count = '50,000';
  private beats: { at: number; run: () => void }[] = [];
  private els!: {
    num: HTMLElement;
    live: HTMLElement;
    cap: HTMLElement;
    rows: HTMLElement;
    sub: HTMLElement;
    busBox: HTMLElement;
  };

  constructor(private readonly opts: InfinityCeremonyOpts) {}

  /** Plays the ceremony. main.ts calls it on the `infinityDeclared` event. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.prevFocus = document.activeElement;
    this.count = group(String(Math.max(0, Math.floor(N.toNumber(this.opts.state().monkeys)))));
    this.build();
    this.plan();
    this.t0 = this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** True while the overlay is up (main.ts suppresses the cooler, Ernest and the away card meanwhile). */
  get isOpen(): boolean {
    return this.started && !this.done;
  }

  /** Feed core events while open (titleFlipped, busArrived...). main.ts forwards every event. */
  onEvent(e: GameEvent): void {
    if (e.type === 'infinityDeclared') this.flips = [];
    if (e.type !== 'titleFlipped') return;
    this.flips.push({ from: e.from, to: e.to, note: `formerly: ${e.from}` });
    if (this.titlesOn && !this.done) this.addRows([this.flips[this.flips.length - 1]!], this.elapsed());
  }

  // ---------- build ----------

  private build(): void {
    const root = document.createElement('div');
    root.className = `inf${this.calm ? ' calm' : ''}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Infinity declared');
    root.tabIndex = -1;
    root.innerHTML = `
      <div class="inf-sky" aria-hidden="true"></div>
      <div class="inf-bldg" aria-hidden="true">${buildingSVG()}</div>
      <div class="inf-ui">
        <div class="inf-plaque" aria-hidden="true">
          <div class="inf-plate"><span class="inf-lab">Monkeys on staff</span><div class="inf-face"><span class="inf-num">${this.count}</span></div></div>
          <div class="inf-stamp">Granted &middot; Form &infin;-1</div>
        </div>
        <div class="inf-memo" aria-hidden="true">
          <p class="inf-memo-h">Staff notice <span>effective immediately</span></p>
          <ul class="inf-rows"></ul>
        </div>
        <div class="inf-card" hidden>
          <div class="inf-busbox" aria-hidden="true"></div>
          <h2 class="inf-h">The first bus is on its way.</h2>
          <p class="inf-sub"></p>
          <button type="button" class="inf-go">To the tower</button>
        </div>
      </div>
      <p class="inf-cap" aria-hidden="true"></p>
      <button type="button" class="inf-skip">Skip</button>
      <p class="inf-sr" role="status" aria-live="polite"></p>`;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    this.els = { num: q('.inf-num'), live: q('.inf-sr'), cap: q('.inf-cap'), rows: q('.inf-rows'), sub: q('.inf-sub'), busBox: q('.inf-busbox') };
    root.addEventListener('click', () => {
      if (this.elapsed() >= GRACE_MS) this.finish();
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.elapsed() >= GRACE_MS) this.finish();
      }
    });
    this.opts.host.append(root);
    this.root = root;
    root.focus({ preventScroll: true });
    requestAnimationFrame(() => root.classList.add('on'));
  }

  // ---------- timeline ----------

  private plan(): void {
    const B = BEATS;
    const say = (cap: string, live?: string) => () => {
      this.els.cap.textContent = cap;
      if (live) this.els.live.textContent = live;
    };
    const cls = (c: string) => () => this.root!.classList.add(c);
    this.beats = [
      { at: 0, run: say('Form 3-H received. Extending the building upward.', 'Infinity declared. The building is being extended upward.') },
      { at: B.climb, run: cls('climbing') },
      { at: B.count, run: () => { this.root!.classList.add('counting'); this.els.cap.textContent = 'Recounting the monkeys. Please hold.'; } },
      { at: B.spin, run: () => (this.spinAt = this.elapsed()) },
      { at: B.flip, run: () => this.flipCounter() },
      { at: B.stamp, run: () => { this.root!.classList.add('stamped'); this.els.cap.textContent = 'Headcount: aleph-null. Stationery has been notified.'; this.els.live.textContent = 'The monkey count is now aleph-null.'; } },
      { at: B.titles, run: () => { this.root!.classList.add('titles'); this.titlesOn = true; this.els.cap.textContent = 'New titles, effective immediately.'; } },
      { at: B.firstRow, run: () => this.addRows([...this.flips, ...FLAVOR], this.elapsed()) },
      { at: B.card, run: () => this.showCard() },
      { at: B.auto, run: () => this.finish() },
    ];
  }

  private elapsed(): number {
    return performance.now() - this.t0;
  }

  private frame = (now: number): void => {
    if (!this.root || this.done) return;
    // Time in the background pauses the ceremony: the player returns to the beat they left, not to the end.
    if (now - this.last > 1000) this.t0 += now - this.last - 16;
    this.last = now;
    const el = now - this.t0;
    // A beat that is far behind (a long frame, a throttled tab) jumps rather than animates.
    while (this.beat < this.beats.length && this.beats[this.beat]!.at <= el) {
      const b = this.beats[this.beat++]!;
      const behind = el - b.at > 500;
      this.root.classList.toggle('jump', behind);
      b.run();
      if (this.done) return;
    }
    this.root.classList.remove('jump');
    this.rowsTick(el);
    this.spin(el);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** The counter: the true headcount first, then more and more digits, faster and faster, until it cannot keep up. */
  private lastSpin = -1;
  private spin(el: number): void {
    if (this.calm || !this.spinAt || el >= BEATS.flip) return;
    const frame = Math.floor(el / 60);
    if (frame === this.lastSpin) return;
    this.lastSpin = frame;
    const p = Math.min(1, (el - this.spinAt) / (BEATS.flip - this.spinAt));
    const base = this.count.replace(/,/g, '');
    const extra = Math.min(12 - Math.min(12, base.length), Math.floor(p * p * 9));
    if (p < 0.12 || extra <= 0 && p < 0.3) {
      this.els.num.textContent = this.count;
      return;
    }
    const n = Math.min(12, base.length + Math.max(extra, Math.floor(p * 5)));
    let d = '';
    for (let j = 0; j < n; j++) d += j === 0 ? String(1 + (hs(frame * 7 + j) % 9)) : String(hs(frame * 13 + j * 5) % 10);
    this.els.num.textContent = group(d);
  }

  private flipCounter(): void {
    const num = this.els.num;
    const set = () => {
      num.textContent = ALEPH;
      num.classList.add('alef');
    };
    this.els.cap.textContent = 'Count complete.';
    if (this.calm || this.root!.classList.contains('jump') || !num.animate) {
      set();
      return;
    }
    const face = num.parentElement!;
    const out = face.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    out.onfinish = () => {
      set();
      const back = face.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      back.onfinish = () => out.cancel();
    };
  }

  private addRows(list: Flip[], at: number): void {
    for (const f of list) {
      const li = document.createElement('li');
      li.className = 'inf-row';
      li.innerHTML = `<span class="flap"><span class="was">${esc(f.from)}</span><span class="now">${esc(f.to)}</span></span><small>${esc(f.note)}</small>`;
      this.els.rows.append(li);
      // Each row flips a beat after the last (rows that arrive late still wait their turn).
      this.rowTimes.push(Math.max(at, (this.rowTimes[this.rowTimes.length - 1] ?? at - BEATS.rowEvery) + BEATS.rowEvery));
    }
  }

  private rowsTick(el: number): void {
    const items = this.els.rows.children;
    while (this.rowsShown < items.length && this.rowTimes[this.rowsShown]! <= el) {
      const li = items[this.rowsShown] as HTMLElement;
      li.classList.add('go');
      const to = li.querySelector('.now')?.textContent ?? '';
      const from = li.querySelector('.was')?.textContent ?? '';
      if (from !== to && !FLAVOR.some((f) => f.from === from)) this.els.live.textContent = `${from} is now ${to}. Formerly ${from}.`;
      this.rowsShown++;
    }
  }

  private showCard(): void {
    const root = this.root!;
    const s = this.opts.state();
    const id = this.opts.t.hotel.ceremonyMarket;
    const m = s.hotel?.markets[id];
    const look = marketLook(id);
    const secs = m && m.status === 'inTransit' ? m.workLeft / busSpeed(s, this.opts.t) : null;
    this.els.sub.textContent = `Home market: online.${secs !== null && Number.isFinite(secs) ? ` ${look.name} bus: about ${mmss(secs)} away.` : ''} Commissions are being drawn up.`;
    this.els.busBox.innerHTML = `<svg viewBox="0 0 140 56" aria-hidden="true" focusable="false"><rect x="0" y="46" width="140" height="10" class="inf-road"/>${busSVG(id, 14, 8)}</svg>`;
    root.querySelector<HTMLElement>('.inf-card')!.hidden = false;
    // one frame later so the card's entrance animates
    requestAnimationFrame(() => root.classList.add('card'));
    this.els.cap.textContent = '';
    this.els.live.textContent = 'The first bus is on its way.';
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    const root = this.root;
    root?.classList.remove('on');
    window.setTimeout(() => root?.remove(), 320);
    if (this.prevFocus instanceof HTMLElement && this.prevFocus.isConnected) this.prevFocus.focus({ preventScroll: true });
    this.opts.onDone();
  }
}
