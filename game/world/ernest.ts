// Ernest, Orientation Officer: nine Orientation Reels, each teaching one rule
// the first time it matters. He leans in from the corner with a short card,
// docks to a strip while his own room's sheet is open, and steps back otherwise.
//
// Rules of the system:
//  - A reel fires on a false-to-true transition seen during this session. Triggers
//    already true on the first update after load are marked seen silently, so an
//    existing save never gets a flood of cards. Reel 1 is the exception: it fires
//    on load while the Bureau has one monkey or none.
//  - One card at a time. Simultaneous triggers queue (at most 2; older non-essential
//    ones drop), and the next card waits a short pause after the last is dismissed.
//  - Reels teach rules and locations, never which option is best.
// Which reels have been seen is presentation state (progress.ts), never GameState.
import { N, certifyTiers, deskCost, discoveredTiers, editingPool, findRates, buyDeptStage, researchTier, DEPTS, type GameState, type Tuning } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import * as f from '../ui/format.js';
import { progress } from './progress.js';

interface Reel {
  id: string;
  n: number;
  title: string;
  /** The room its button leads to. */
  room: string;
  /** Card text; may read tuning. */
  say: (t: Tuning) => string;
  /** Held back unless nothing essential is queued behind it. */
  essential?: boolean;
  /** Has the moment passed, so the card would be stale? */
  stale?: (s: GameState) => boolean;
}

const seatedOf = (s: GameState) => Math.floor(N.toNumber(s.monkeys));

const REELS: Reel[] = [
  { id: 'first-hire', n: 1, title: 'Your First Hire', room: 'personnel', essential: true,
    say: () => 'Monkeys earn bananas, and more monkeys earn more. Each needs a desk; pull up the Personnel form to seat the first.',
    stale: (s) => seatedOf(s) > 1 },
  { id: 'records', n: 2, title: 'The Records', room: 'research',
    say: () => 'Monkeys type, and the Library keeps what they find. Research a kind of find, and every find of it pays.',
    stale: () => progress.hasOpened('research') },
  { id: 'who-does-what', n: 3, title: 'Who Does What', room: 'departments',
    say: () => 'Recruiters hire, Builders build desks, and Editors review finds into bananas.' },
  { id: 'finds-need-editors', n: 4, title: 'Finds Need Editors', room: 'departments',
    say: () => 'Finds that are not reviewed are thrown away. Editors review them into bananas.' },
  { id: 'levels-and-stages', n: 5, title: 'Levels Nudge, Stages Leap', room: 'departments',
    say: () => 'A level adds a little. A stage multiplies a department.' },
  { id: 'who-reviews-what', n: 6, title: 'Who Reviews What', room: 'pool',
    say: () => 'Editors can favour common, cheap finds or rare, valuable ones. Suggested aims for the most bananas.' },
  { id: 'the-permit', n: 7, title: 'The Permit', room: 'director', essential: true,
    say: (t) => `Form 9-R is the finish line: ${t.readiness.minMonkeys.toLocaleString()} monkeys and all three meters full, held for ${t.readiness.stabilitySeconds} seconds.`,
    stale: (s) => s.stability.permit },
  { id: 'hold-steady', n: 8, title: 'Hold Steady', room: 'director',
    say: () => 'Keep all three meters full. If one slips, the count starts over.',
    stale: (s) => s.stability.permit },
  { id: 'permit-issued', n: 9, title: 'Permit Issued', room: 'director', essential: true,
    say: () => 'The Director holds the switch. Lift the cover to see what changes.' },
];
const BY_ID = new Map(REELS.map((r) => [r.id, r]));

const MAX_QUEUE = 2;
const PAUSE_SECONDS = 1.5;

export class Ernest {
  /** Set by main: open a room. */
  onOpenRoom: (room: string) => void = () => {};

  private say: HTMLElement;
  private reelLine: HTMLElement;
  private title: HTMLElement;
  private card: HTMLElement;
  private go: HTMLButtonElement;
  private ok: HTMLButtonElement;
  private fig: Element | null;

  private first = true;
  private calls = 0;
  private quietUntil = 0;
  private prev = new Map<string, boolean>();
  private queue: Reel[] = [];
  private current: Reel | null = null;
  private shown = false;
  private lastSay = '';
  private lastOpen: string | null = null;

  constructor(private wrap: HTMLElement, private ctx: Ctx, private t: Tuning) {
    const q = <E extends HTMLElement>(sel: string) => wrap.querySelector(sel) as E;
    this.card = q('.ernest');
    this.reelLine = q('.reel');
    this.title = q('h2');
    this.say = q('.say');
    this.go = q('.go');
    this.ok = q('.ok');
    this.fig = wrap.querySelector('.efig');
    this.ok.addEventListener('click', () => this.finish(false));
    this.go.addEventListener('click', () => this.finish(true));
  }

  /** Called at most once per tick. `open` is the open sheet's room id or null; `plan` is true in plan view. */
  update(open: string | null, plan: boolean): void {
    this.calls++;
    const s = this.ctx.state();
    this.detect(s, open);
    if (open) progress.markOpened(open);
    this.lastOpen = open;
    this.first = false;

    if (this.current?.id === 'first-hire' && seatedOf(s) > 1) this.retire();

    if (!this.current && this.calls >= this.quietUntil) {
      while (this.queue.length) {
        const next = this.queue.shift()!;
        if (next.stale?.(s)) {
          progress.markReel(next.id);
          continue;
        }
        this.current = next;
        break;
      }
    }
    this.trim();
    if (!this.current) return;
    void plan; // Plan view is hidden by CSS (body.plan); the card keeps its place.

    const r = this.current;
    if (open && open !== r.room) {
      this.hide();
      return;
    }
    this.present(r, open === r.room, s);
  }

  // ---------- triggers ----------

  private detect(s: GameState, open: string | null): void {
    const t = this.t;
    const now = (id: string, v: () => boolean): void => {
      if (progress.seenReel(id)) return;
      const was = this.prev.get(id) ?? false;
      const is = v();
      this.prev.set(id, is);
      if (!is || was) return;
      if (this.first && id !== 'first-hire') {
        progress.markReel(id);
        return;
      }
      this.enqueue(BY_ID.get(id)!);
    };

    now('first-hire', () => seatedOf(s) <= 1);
    now('records', () => !progress.hasOpened('research') && this.ctx.can('ernest:words', (c, tu, sk) => researchTier(c, tu, sk, 'words')));
    now('who-does-what', () => open === 'departments' && this.lastOpen !== 'departments' && !progress.hasOpened('departments'));
    now('finds-need-editors', () => {
      const cert = certifyTiers(s, t, editingPool(s, t), s.tierAllocation);
      const rates = findRates(s, t);
      const finds = discoveredTiers(s, t).reduce((sum, x) => sum + N.toNumber(rates[x.id] ?? N.zero), 0);
      return finds > 0 && N.toNumber(cert.discarded) / finds > 0.1;
    });
    now('levels-and-stages', () => DEPTS.some((d) => this.ctx.can(`ernest:stage:${d}`, (c, tu, sk) => buyDeptStage(c, tu, sk, d))));
    now('who-reviews-what', () => discoveredTiers(s, t).length >= 2);
    now('the-permit', () => s.milestonesReached.includes('tall'));
    now('hold-steady', () => s.stability.heldTicks > 0);
    now('permit-issued', () => s.stability.permit);
  }

  private enqueue(r: Reel): void {
    if (this.current === r || this.queue.includes(r)) return;
    this.queue.push(r);
  }

  /** Keep at most two waiting: drop the oldest non-essential one first. */
  private trim(): void {
    while (this.queue.length > MAX_QUEUE) {
      const i = this.queue.findIndex((q) => !q.essential);
      this.queue.splice(i >= 0 ? i : 0, 1);
    }
  }

  // ---------- the card ----------

  private present(r: Reel, docked: boolean, s: GameState): void {
    let text = r.say(this.t);
    if (docked && r.id === 'first-hire') {
      const desks = Math.floor(N.toNumber(s.desks));
      text = desks > seatedOf(s) ? 'A desk is free. Press Hire to seat a monkey.' : `Buy a desk first (${f.bananaText(deskCost(s, this.t))}). Then hire.`;
    }
    if (text !== this.lastSay || this.title.textContent !== r.title) {
      this.say.textContent = text;
      this.title.textContent = r.title;
      this.reelLine.textContent = `Orientation Reel ${r.n}`;
      this.card.setAttribute('aria-label', `Orientation Reel ${r.n}: ${r.title}`);
      this.lastSay = text;
    }
    this.wrap.classList.toggle('docked', docked);
    this.go.hidden = docked;
    this.fig?.setAttribute('viewBox', docked ? '50 8 86 76' : '0 0 138 128');
    if (!this.shown) {
      this.shown = true;
      // Reel 1 is replayed on every load until acted on; the rest are one-shot.
      if (r.id !== 'first-hire') progress.markReel(r.id);
      this.wrap.classList.add('in');
    }
  }

  private finish(goThere: boolean): void {
    const r = this.current;
    if (!r) return;
    progress.markReel(r.id);
    if (goThere && r.id === 'first-hire') {
      // Reel 1 stays on as the docked hire guide until the first hire or "Understood".
      this.onOpenRoom(r.room);
      return;
    }
    this.retire();
    if (goThere) this.onOpenRoom(r.room);
  }

  private retire(): void {
    if (this.current) progress.markReel(this.current.id);
    this.current = null;
    this.quietUntil = this.calls + Math.ceil(PAUSE_SECONDS / this.t.tickSeconds);
    this.hide();
  }

  private hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.wrap.classList.remove('in', 'docked');
  }
}
