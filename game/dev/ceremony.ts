// Dev-only harness for the quarter-end ceremony (not linked from game/index.html).
// Open /infinite-monkeys/dev/ceremony.html?scenario=q2|first|mid[&live=1]. window.__h exposes the pieces
// for Playwright (scripts in the session scratchpad drive it).
import { DEPTS, N, buyDeptLevel, buyDesk, createState, nullSink, run, signBudget, suggestBudget, tapHire, type EventSink, type GameEvent, type GameState } from '../../core/index.js';
import { prototypeTuning as t } from '../../content/prototype.js';
import { createCtx } from '../ctx.js';
import { Ceremony } from '../world/ceremony.js';

const params = new URLSearchParams(location.search);
const QTICKS = Math.round(t.budget!.quarterSeconds / t.tickSeconds);

/** A small real game: a few desks and hires, one level in each department. */
function early(): GameState {
  const s = createState(t, 7);
  s.bananas = N.of(5000);
  for (let i = 0; i < 6; i++) { buyDesk(s, t, nullSink); tapHire(s, t, nullSink); }
  for (const d of DEPTS) buyDeptLevel(s, t, nullSink, d);
  return s;
}
/** Runs quarters, signing the suggestion each time and spending the wallet on department levels by hand. */
function midGame(quarters: number): GameState {
  const s = early();
  run(s, t, nullSink, 5);
  for (let q = 0; q < quarters; q++) {
    if (s.budget?.reviewDue) signBudget(s, t, nullSink, suggestBudget(s, t));
    for (let i = 0; i < 4; i++) {
      run(s, t, nullSink, QTICKS / 4);
      for (const d of DEPTS) for (let k = 0; k < 20 && buyDeptLevel(s, t, nullSink, d); k++);
      for (let k = 0; k < 40 && buyDesk(s, t, nullSink); k++);
      for (let k = 0; k < 40 && tapHire(s, t, nullSink); k++);
    }
    run(s, t, nullSink, QTICKS - 4 * (QTICKS / 4) + 1);
  }
  return s;
}
function scenario(name: string): GameState {
  if (name === 'first') {
    const s = early();
    run(s, t, nullSink, 5); // the budget opens; no quarter has ended yet
    return s;
  }
  if (name === 'mid') return midGame(Number(params.get('q') ?? 4));
  const s = early();
  run(s, t, nullSink, 5);
  run(s, t, nullSink, QTICKS); // Q1 ends: lastReport is set
  return s;
}

let state = scenario(params.get('scenario') ?? 'q2');
const listeners = new Set<EventSink>();
const events: GameEvent[] = [];
const sink: EventSink = (e) => { events.push(e); listeners.forEach((f) => f(e)); };
const ctx = createCtx(() => state, t, sink, (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => {});
const ceremony = new Ceremony(document.getElementById('stage')!, ctx);
const out = document.getElementById('out')!;
const opener = document.getElementById('opener')!;
opener.addEventListener('click', () => ceremony.open());
ceremony.onClose = () => { out.textContent = `closed; reviewDue=${state.budget?.reviewDue}; quarter=${state.budget?.quarter}`; };

const frame = () => { ceremony.render(); requestAnimationFrame(frame); };
requestAnimationFrame(frame);
if (params.get('live')) setInterval(() => run(state, t, sink, 1), t.tickSeconds * 1000);

(window as unknown as Record<string, unknown>).__h = {
  ceremony, ctx, t, events,
  get state() { return state; },
  set state(s: GameState) { state = s; },
  scenario: (n: string) => { state = scenario(n); },
  run: (n: number) => run(state, t, sink, n),
  QTICKS,
  open: (o?: { skipPresentations?: boolean }) => ceremony.open(o),
};
if (params.get('open')) ceremony.open({ skipPresentations: params.get('open') === 'skip' });
