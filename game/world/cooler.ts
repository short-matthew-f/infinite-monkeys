// The water-cooler card: after a stretch with no input, two monkeys and one
// exchange of office gossip appear at the top-right, just under the feed, for a
// few seconds. Some lines state a fact about the Bureau (core numbers only).
//
// Choosing a line: one nextFloat(state.rng.presentation) draw per card, the
// same convention as feed.ts (the presentation stream exists for UI flavour, so
// drawing from it never touches gameplay randomness). Same save + same ticks
// of play = same gossip. Recent lines are not repeated while others remain.
import { finiteBottleneck, nextFloat, quarterSecondsLeft, type GameState, type Tuning } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h } from '../ui/dom.js';
import { headSVG } from './floor-art.js';
import './cooler.css';

const IDLE_MS = 20_000;
const SHOW_MS = 8_000;
const RECENT_AVOID = 6;

type Line = readonly [string, string];
interface Entry {
  id: string;
  say: Line;
  /** Safe to say in the Hotel phase (does not mention the finite Bureau). */
  hotel?: boolean;
}

/** Always-available gossip. Gentle, sincere, bureaucratic. */
const GOSSIP: Entry[] = [
  { id: 'banana', say: ['Desk 7 typed BANANA twice.', 'The Editors were not impressed.'], hotel: true },
  { id: 'drawers', say: ['The Foreman says the new desks have drawers.', 'Drawers. Imagine.'] },
  { id: 'pencils', say: ['Who keeps taking the red pencils?', 'The Chief Editor counts them every morning.'] },
  { id: 'switch', say: ['Is it true the Director has a switch under a cover?', 'Nobody touches the switch.'], hotel: true },
  { id: 'bus', say: ['The applicant bus was early today.', 'Three more waiting with tickets.'] },
  { id: 'cake', say: ['Otis brought cake.', 'Does cake count toward the Permit?'], hotel: true },
  { id: 'eotm', say: ['Mabel got Employee of the Month.', 'Most pages, fewest complaints.'] },
  { id: 'crayon', say: ['Someone faxed a résumé in crayon.', 'Mostly the letter Q.'] },
  { id: 'cat', say: ['The Library found the word CAT.', 'They framed it and everything.'], hotel: true },
  { id: 'reading', say: ['Quiet in the Reading Room today.', "That's just how it sounds when they read."] },
  { id: 'stapler', say: ['Somebody moved the stapler again.', 'It was never where you left it.'], hotel: true },
  { id: 'lunch', say: ['Lunch is at 12:05 now.', 'Since when? Since a memo.'], hotel: true },
  { id: 'hardhat', say: ['The hard hat audit is ongoing.', 'It has been ongoing since spring.'] },
  { id: 'form', say: ['Form 7-R needs a form to request it.', 'That form is on the third floor.'], hotel: true },
  { id: 'copier', say: ['The copier made a noise like a sigh.', 'It does that on Mondays.'], hotel: true },
  { id: 'ficus', say: ['Has anyone watered the ficus?', 'It has been fine. Suspiciously fine.'], hotel: true },
  { id: 'umbrella', say: ['Somebody left an umbrella in the stand.', 'It has not rained in the building yet.'], hotel: true },
  { id: 'ink', say: ['The ribbon is nearly out of ink.', 'Type lighter. It all counts the same.'] },
  { id: 'overtime', say: ['I heard the Foreman say "overtime".', 'Nobody knows what it means for a monkey.'], hotel: true },
  { id: 'morale', say: ['Morale survey results came back.', 'They were filed with the other results.'], hotel: true },
  { id: 'cooler', say: ['The cooler gurgles when Editing is busy.', "It is gurgling now. That's all I know."] },
];

/** Lines that state a fact about the present moment. Only built from core numbers. */
function awareLines(s: GameState, t: Tuning): Entry[] {
  const out: Entry[] = [];
  if (s.phase === 'hotel') return out;
  const bottleneck = finiteBottleneck(s, t);
  if (bottleneck === 'editing') out.push({ id: 'in-tray', say: ["The in-tray's up to the ceiling.", 'Editing says it is working on it.'] });
  else out.push({ id: 'keeping-up', say: ['Editing is keeping up with the typists today.', 'Nobody has said so out loud, in case.'] });
  if (t.budget && s.budget) {
    const left = quarterSecondsLeft(s, t);
    if (left > 0 && left <= 40) out.push({ id: 'year-end', say: ['Fiscal year-end: spend it or lose it.', 'The Bursar has said so twice.'] });
    if (s.budget.requisition) out.push({ id: 'envelope', say: ["There's an inter-office envelope going round.", 'String and everything.'] });
    if (s.budget.reviewDue) out.push({ id: 'review', say: ['The quarterly review is waiting on a signature.', 'The pen is somewhere in Accounts.'] });
  }
  return out;
}

const FACES = [
  { fur: 4, ears: 'big', mouth: 'o', eyes: 'wide', view: 'pr', gaze: [1, 0], head: 'none' },
  { fur: 2, ears: 'tuft', mouth: 'smirk', eyes: 'heavy', view: 'pl', gaze: [-1, 0], head: 'none' },
];
const faceSVG = (s: Record<string, unknown>) =>
  `<svg viewBox="-16 -16 32 32" aria-hidden="true"><g class="f${s.fur} sk-paper">${headSVG(s, 0, 0, 11)}</g></svg>`;

export class Cooler {
  /** Main sets this true while a room or the ceremony is open (no card then). */
  suppressed = false;

  private readonly card: HTMLElement;
  private readonly lineA: HTMLElement;
  private readonly lineB: HTMLElement;
  private readonly recent: string[] = [];
  private lastInput: number;
  private shownAt = 0;
  /** True once a card has appeared in this idle stretch; poke() rearms it. */
  private spent = false;
  private visible = false;

  constructor(parent: HTMLElement, private readonly ctx: Ctx) {
    this.lastInput = performance.now();
    this.lineA = h('p', { class: 'cl a' });
    this.lineB = h('p', { class: 'cl' });
    const faces = h('div', { class: 'faces' });
    faces.innerHTML = faceSVG(FACES[0]!) + faceSVG(FACES[1]!);
    const x = h('button', { class: 'x', type: 'button', 'aria-label': 'Dismiss', onclick: () => this.hide() }, '✕');
    this.card = h('aside', { class: 'cooler', role: 'status', 'aria-label': 'Water cooler', hidden: true, onclick: () => this.hide() }, faces, h('div', { class: 'lines' }, this.lineA, this.lineB), x);
    parent.append(this.card);
  }

  /** Main calls this on any player input to reset the idle timer and dismiss the card. */
  poke(): void {
    this.lastInput = performance.now();
    this.spent = false;
    // The player's own tap on the card is handled by its button; any other input dismisses it.
    if (this.visible) this.hide();
  }

  /** Called once per frame-tick by main. */
  render(): void {
    const now = performance.now();
    if (this.visible) {
      if (this.suppressed || now - this.shownAt >= SHOW_MS) this.hide();
      return;
    }
    if (this.suppressed) {
      // Time spent inside a room is not idle time: restart the count when it closes.
      this.lastInput = now;
      return;
    }
    if (this.spent || now - this.lastInput < IDLE_MS) return;
    this.show(now);
  }

  private show(now: number): void {
    const [a, b] = this.pick().say;
    this.lineA.textContent = `“${a}”`;
    this.lineB.textContent = `“${b}”`;
    this.card.hidden = false;
    this.card.classList.remove('pop');
    void this.card.offsetWidth;
    this.card.classList.add('pop');
    this.visible = true;
    this.spent = true;
    this.shownAt = now;
  }

  private hide(): void {
    this.visible = false;
    this.card.hidden = true;
  }

  private pick(): Entry {
    const s = this.ctx.state();
    const aware = awareLines(s, this.ctx.t);
    const urgent = aware.some((e) => e.id === 'year-end');
    const pool = (s.phase === 'hotel' ? GOSSIP.filter((e) => e.hotel) : GOSSIP).filter((e) => !this.recent.includes(e.id));
    const fresh = pool.length ? pool : GOSSIP;
    const r = nextFloat(s.rng.presentation);
    // About half the cards state a fact (seven in ten when the quarter is ending).
    const pFact = urgent ? 0.7 : 0.45;
    const useAware = aware.length > 0 && r < pFact;
    const list = useAware ? aware.filter((e) => !this.recent.includes(e.id)) : fresh;
    const from = list.length ? list : aware.length ? aware : fresh;
    const span = useAware ? pFact : 1 - pFact;
    const u = useAware ? r / span : (r - pFact) / span; // renormalised 0..1
    const e = from[Math.min(from.length - 1, Math.floor(u * from.length))]!;
    this.recent.push(e.id);
    if (this.recent.length > RECENT_AVOID) this.recent.shift();
    return e;
  }
}
