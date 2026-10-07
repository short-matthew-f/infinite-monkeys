import { describe, expect, it } from 'vitest';
import {
  applySuggestedAllocation,
  buyDesk,
  catchUp,
  createState,
  nextFloat,
  researchTier,
  run,
  step,
  tapHire,
  type GameState,
} from '../core/index.js';
import { collector, secs, T } from './helpers.js';

/** A fixed opening script, roughly the first few minutes of play. */
function playScript(s: GameState, sink: ReturnType<typeof collector>['sink'], onTick?: () => void) {
  for (let i = 0; i < secs(240); i++) {
    tapHire(s, T, sink);
    buyDesk(s, T, sink);
    researchTier(s, T, sink, 'words');
    if (i % 50 === 0) applySuggestedAllocation(s, T, sink);
    onTick?.();
    step(s, T, sink);
  }
}

function economy(s: GameState) {
  const { rng, ...rest } = s;
  return JSON.stringify({ ...rest, gameplay: rng.gameplay });
}

describe('determinism', () => {
  it('the same seed and actions produce the same run', () => {
    const a = collector(), b = collector();
    const s1 = createState(T, 42), s2 = createState(T, 42);
    playScript(s1, a.sink);
    playScript(s2, b.sink);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
    expect(a.events).toEqual(b.events);
  });

  it('drawing from the presentation stream never changes the economy', () => {
    const s1 = createState(T, 42), s2 = createState(T, 42);
    playScript(s1, collector().sink);
    playScript(s2, collector().sink, () => {
      nextFloat(s2.rng.presentation); // e.g. picking a feed line
    });
    expect(economy(s1)).toBe(economy(s2));
  });

  it('offline catch-up matches continuous play over the same elapsed time', () => {
    const s1 = createState(T, 9), s2 = createState(T, 9);
    playScript(s1, collector().sink);
    playScript(s2, collector().sink);
    run(s1, T, collector().sink, secs(600));
    catchUp(s2, T, collector().sink, 600);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('offline catch-up is capped by the offline allowance', () => {
    const s = createState(T, 9);
    const ticks = catchUp(s, T, collector().sink, T.offlineCapSeconds * 3);
    expect(ticks).toBe(secs(T.offlineCapSeconds));
  });
});
