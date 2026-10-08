import { classicTuning, prototypeTuning } from '../content/prototype.js';
import {
  createState,
  declareInfinity,
  N,
  run,
  type GameEvent,
  type GameState,
  type Tuning,
} from '../core/index.js';

export const T = prototypeTuning;
/** The economy without the quarterly budget, for the free funding shares it still supports. */
export const TC = classicTuning;

export function collector() {
  const events: GameEvent[] = [];
  return { events, sink: (e: GameEvent) => events.push(e) };
}

export const secs = (n: number) => Math.round(n / T.tickSeconds);

export function ofType<K extends GameEvent['type']>(events: GameEvent[], type: K) {
  return events.filter((e): e is Extract<GameEvent, { type: K }> => e.type === type);
}

/** A late-Phase-1 operation with balanced departments at stage 4 and enough scale. */
export function lateFiniteState(seed = 1, t: Tuning = T): GameState {
  const s = createState(t, seed);
  s.monkeys = N.of(100_000);
  s.desks = N.of(100_000);
  s.depts.recruiting = { level: 100, stage: 4, rep: 1 };
  s.depts.construction = { level: 100, stage: 4, rep: 1 };
  s.depts.editing = { level: 800, stage: 4, rep: 1 };
  return s;
}

/** Declared infinity, first bus arrived, three Commissions offered. */
export function hotelState(seed = 1, sink = collector().sink): GameState {
  const s = lateFiniteState(seed);
  run(s, T, sink, secs(T.readiness.stabilitySeconds) + 1);
  if (!s.stability.permit) throw new Error('fixture: permit not stamped');
  if (!declareInfinity(s, T, sink)) throw new Error('fixture: declare failed');
  let guard = 0;
  while (!s.hotel?.offersMade) {
    run(s, T, sink, 1);
    if (++guard > secs(120)) throw new Error('fixture: first bus never arrived');
  }
  return s;
}

/** Runs until predicate holds or the tick budget runs out. Returns ticks used, or null. */
export function runUntil(s: GameState, sink: (e: GameEvent) => void, pred: () => boolean, maxTicks: number): number | null {
  for (let i = 0; i < maxTicks; i++) {
    if (pred()) return i;
    run(s, T, sink, 1);
  }
  return pred() ? maxTicks : null;
}
