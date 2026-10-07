import { describe, expect, it } from 'vitest';
import {
  buyDesk,
  capability,
  createState,
  declareInfinity,
  deptOutput,
  hireCooldownSeconds,
  meters,
  metersFull,
  N,
  run,
  setShares,
  tapHire,
} from '../core/index.js';
import { collector, lateFiniteState, ofType, secs, T } from './helpers.js';

describe('the finite climb', () => {
  it('desk costs grow ×1.15 per purchase', () => {
    const { events, sink } = collector();
    const s = createState(T, 1);
    s.bananas = N.of(1_000);
    buyDesk(s, T, sink);
    buyDesk(s, T, sink);
    const [a, b] = ofType(events, 'purchase');
    expect(b!.cost / a!.cost).toBeCloseTo(1.15, 10);
  });

  it("Zeno's cooldown halves per level and never reaches zero", () => {
    expect(hireCooldownSeconds(T, 1)).toBeCloseTo(hireCooldownSeconds(T, 0) / 2, 10);
    expect(hireCooldownSeconds(T, 60)).toBeGreaterThan(0);
  });

  it('blocks manual hiring during the cooldown and without a free desk', () => {
    const { sink } = collector();
    const s = createState(T, 1);
    expect(tapHire(s, T, sink)).toBe(false); // one monkey, one desk
    s.desks = N.of(5);
    expect(tapHire(s, T, sink)).toBe(true);
    expect(tapHire(s, T, sink)).toBe(false); // cooling down
    run(s, T, sink, secs(hireCooldownSeconds(T, 0)));
    expect(tapHire(s, T, sink)).toBe(true);
  });

  it('equal funding shares give each department its capability', () => {
    const s = lateFiniteState();
    for (const d of ['recruiting', 'construction', 'editing'] as const) {
      expect(N.toNumber(deptOutput(s, T, d))).toBeCloseTo(N.toNumber(capability(s, T, d)), 6);
    }
  });

  it('funding reallocation is free, validated, and recorded', () => {
    const { events, sink } = collector();
    const s = lateFiniteState();
    const bananas = s.bananas;
    expect(setShares(s, T, sink, { recruiting: 0.5, construction: 0.5, editing: 0.5 })).toBe(false);
    expect(setShares(s, T, sink, { recruiting: 0.5, construction: 0.3, editing: 0.2 })).toBe(true);
    expect(s.bananas).toBe(bananas);
    expect(ofType(events, 'fundingChanged')).toHaveLength(1);
  });

  it('overshoot is waste: recruiting never seats more monkeys than desks', () => {
    const s = createState(T, 1);
    s.depts.recruiting = { level: 500, stage: 1, rep: 1 };
    s.desks = N.of(10);
    run(s, T, collector().sink, secs(5));
    expect(N.toNumber(s.monkeys)).toBeLessThanOrEqual(N.toNumber(s.desks) + 1e-9);
  });

  it('stamps the Infinity Permit only after all meters hold full for the Stability Window', () => {
    const { events, sink } = collector();
    const s = lateFiniteState();
    expect(metersFull(meters(s, T))).toBe(true);
    run(s, T, sink, secs(T.readiness.stabilitySeconds) - 5);
    expect(s.stability.permit).toBe(false);
    run(s, T, sink, 10);
    expect(s.stability.permit).toBe(true);
    expect(ofType(events, 'permitStamped')).toHaveLength(1);
  });

  it('breaking balance resets the Stability Window', () => {
    const { sink } = collector();
    const s = lateFiniteState();
    run(s, T, sink, secs(30));
    setShares(s, T, sink, { recruiting: 0.6, construction: 0.2, editing: 0.2 });
    run(s, T, sink, 1);
    expect(s.stability.heldTicks).toBe(0);
    setShares(s, T, sink, { recruiting: 1 / 3, construction: 1 / 3, editing: 1 / 3 });
    run(s, T, sink, secs(45));
    expect(s.stability.permit).toBe(false);
  });

  it('cannot declare infinity without the permit', () => {
    const s = lateFiniteState();
    expect(declareInfinity(s, T, collector().sink)).toBe(false);
    expect(s.phase).toBe('finite');
  });

  it('purchase events record the binding bottleneck before and after', () => {
    const { events, sink } = collector();
    const s = createState(T, 1);
    s.bananas = N.of(100);
    buyDesk(s, T, sink);
    const p = ofType(events, 'purchase')[0]!;
    expect(['typing', 'editing']).toContain(p.bottleneckBefore);
    expect(['typing', 'editing']).toContain(p.bottleneckAfter);
  });
});
