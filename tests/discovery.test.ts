import { describe, expect, it } from 'vitest';
import { createState, N, newRun, researchTier, run } from '../core/index.js';
import { collector, ofType, runUntil, secs, T } from './helpers.js';

function withBananas(seed = 3) {
  const s = createState(T, seed);
  s.bananas = N.of(10_000);
  s.monkeys = N.of(20);
  s.desks = N.of(20);
  return s;
}

describe('discovery', () => {
  it('progresses with no hired Editors, via the Editor-in-Chief, and fires exactly once', () => {
    const { events, sink } = collector();
    const s = withBananas();
    expect(s.depts.editing.level).toBe(0);
    expect(researchTier(s, T, sink, 'words')).toBe(true);
    const ticks = runUntil(s, sink, () => s.tiers.words?.discovered === true, secs(600));
    expect(ticks).not.toBeNull();
    run(s, T, sink, secs(30));
    expect(ofType(events, 'tierDiscovered').filter((e) => e.tier === 'words')).toHaveLength(1);
  });

  it('does not progress until research makes the tier discoverable', () => {
    const s = withBananas();
    run(s, T, collector().sink, secs(120));
    expect(s.tiers.words?.acc).toBe(0);
    expect(s.tiers.words?.discovered).toBe(false);
  });

  it('pays discovery rewards once per save, not once per run', () => {
    const { events, sink } = collector();
    const s1 = withBananas();
    researchTier(s1, T, sink, 'words');
    runUntil(s1, sink, () => s1.tiers.words?.discovered === true, secs(600));
    const goldenAfterFirst = s1.save.golden;
    expect(goldenAfterFirst).toBe(1);

    const s2 = newRun(T, 4, s1);
    s2.bananas = N.of(10_000);
    s2.monkeys = N.of(20);
    s2.desks = N.of(20);
    researchTier(s2, T, sink, 'words');
    runUntil(s2, sink, () => s2.tiers.words?.discovered === true, secs(600));
    const second = ofType(events, 'tierDiscovered').filter((e) => e.tier === 'words')[1];
    expect(second).toMatchObject({ bananas: 0, golden: 0 });
    expect(s2.save.golden).toBe(goldenAfterFirst);
  });

  it('cannot research the same tier twice', () => {
    const { sink } = collector();
    const s = withBananas();
    expect(researchTier(s, T, sink, 'words')).toBe(true);
    const bananas = s.bananas;
    expect(researchTier(s, T, sink, 'words')).toBe(false);
    expect(s.bananas).toBe(bananas);
  });
});
