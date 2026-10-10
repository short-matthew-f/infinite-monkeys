// Dev-only harness for the Infinity ceremony (not linked from game/index.html).
// Open /infinite-monkeys/dev/infinity.html[?auto=1]. It declares Infinity on a seeded state and wires the ceremony the
// way main.ts does: start() on infinityDeclared, then every event (the titleFlipped pair follows) through onEvent().
// window.__h exposes the pieces for Playwright.
import { N, createState, declareInfinity, type EventSink, type GameEvent } from '../../core/index.js';
import { prototypeTuning as t } from '../../content/prototype.js';
import { InfinityCeremony } from '../world/infinity.js';

const params = new URLSearchParams(location.search);
const out = document.getElementById('out')!;
const events: GameEvent[] = [];
let state = createState(t, 7);
state.monkeys = N.of(Number(params.get('monkeys') ?? 52_000));
state.stability.permit = true;

const cer = new InfinityCeremony({
  host: document.getElementById('stage')!,
  state: () => state,
  t,
  onDone: () => {
    out.textContent = `done at ${Math.round(performance.now() - declaredAt)} ms`;
  },
});
let declaredAt = 0;
const sink: EventSink = (e) => {
  events.push(e);
  if (e.type === 'infinityDeclared') cer.start();
  cer.onEvent(e);
};
function declare(): void {
  state = createState(t, 7);
  state.monkeys = N.of(Number(params.get('monkeys') ?? 52_000));
  state.stability.permit = true;
  declaredAt = performance.now();
  out.textContent = 'playing';
  declareInfinity(state, t, sink);
}
document.getElementById('declare')!.addEventListener('click', declare);
(window as unknown as Record<string, unknown>).__h = { cer, events, declare, get state() { return state; } };
if (params.get('auto')) declare();
