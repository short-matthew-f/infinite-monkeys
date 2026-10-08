// Dev-only harness for the requisition memo and the water-cooler card.
// Not referenced by game/index.html. Open /infinite-monkeys/dev/cards.html in `npm run dev`.
import { N, buyDeptLevel, createState, nullSink, run, signBudget, type GameState } from '../../core/index.js';
import { prototypeBudgetTuning as t } from '../../content/prototype.js';
import { createCtx } from '../ctx.js';
import { Cooler } from '../world/cooler.js';
import { MemoView } from '../world/memo.js';

const stage = document.getElementById('stage')!;
const hdr = document.getElementById('hdr')!;
document.documentElement.style.setProperty('--hdr', `${hdr.offsetHeight + 40}px`);

let state: GameState = createState(t, 7);
const events: ((e: never) => void)[] = [];
const sink = (e: never) => events.forEach((fn) => fn(e));
const ctx = createCtx(() => state, t, sink as never, (fn) => {
  events.push(fn as never);
  return () => {};
}, () => {});
const memo = new MemoView(stage, ctx);
const cooler = new Cooler(stage, ctx);
document.addEventListener('pointerdown', () => cooler.poke());

function frame() {
  memo.render();
  cooler.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const api = {
  /** A real run: a department level, a signed budget, time until a requisition opens. */
  setup(wallet = 5000) {
    state = createState(t, 7);
    state.bananas = N.of(1_000);
    state.monkeys = N.of(50);
    state.desks = N.of(60);
    buyDeptLevel(state, t, sink as never, 'recruiting');
    run(state, t, sink as never, 1);
    signBudget(state, t, sink as never, { recruiting: 0.2, construction: 0.2, editing: 0.3, discretionary: 0.3 });
    state.depts.editing.level = Math.max(1, state.depts.editing.level);
    run(state, t, nullSink, Math.round(t.budget!.requisitions!.cooldownSeconds / t.tickSeconds) + 1);
    state.bananas = N.of(wallet);
    return !!state.budget?.requisition;
  },
  wallet(n: number) { state.bananas = N.of(n); run(state, t, sink as never, 1); },
  /** Advances game time (seconds) with events flowing to the UI. */
  advance(sec: number) { run(state, t, sink as never, Math.round(sec / t.tickSeconds)); },
  info() {
    const r = state.budget?.requisition;
    return { requisition: r ?? null, bananas: N.toNumber(state.bananas), tick: state.tick };
  },
  suppress(v: boolean) { cooler.suppressed = v; },
  /** Pretend the player has been idle that long. */
  idle() { (cooler as unknown as { lastInput: number }).lastInput = performance.now() - 21_000; },
};
(window as unknown as { cards: typeof api }).cards = api;
