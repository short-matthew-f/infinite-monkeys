import { describe, expect, it } from 'vitest';
import { certifyTiers, createState, editingPool, N, nextFloat, suggestTierAllocation } from '../core/index.js';
import { T } from './helpers.js';

function allDiscovered(monkeys: number, editingLevel: number) {
  const s = createState(T, 7);
  for (const tier of T.tiers) s.tiers[tier.id] = { discoverable: true, discovered: true, acc: 1 };
  s.monkeys = N.of(monkeys);
  s.desks = N.of(monkeys);
  s.depts.editing = { level: editingLevel, stage: 1, rep: 1 };
  return s;
}

describe('production', () => {
  it('classifies each submission into at most one tier', () => {
    const total = T.tiers.reduce((a, x) => a + x.p, 0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it('pays each certified find once, at its own tier only', () => {
    const s = allDiscovered(10_000, 50);
    const c = certifyTiers(s, T, editingPool(s, T), { sentences: 1 });
    const sentences = N.toNumber(c.certified.sentences ?? N.zero);
    expect(sentences).toBeGreaterThan(0);
    expect(N.toNumber(c.certified.words ?? N.zero)).toBe(0);
    expect(N.toNumber(c.income)).toBeCloseTo(sentences * 8_000, 6);
  });

  it('never certifies more than was found or than capacity allows', () => {
    const s = allDiscovered(5_000, 20);
    const pool = editingPool(s, T);
    const rng = { s: 99 };
    for (let i = 0; i < 100; i++) {
      const alloc = Object.fromEntries(T.tiers.map((x) => [x.id, nextFloat(rng)]));
      const c = certifyTiers(s, T, pool, alloc);
      let used = 0;
      for (const tier of T.tiers) {
        const cert = N.toNumber(c.certified[tier.id] ?? N.zero);
        expect(cert).toBeLessThanOrEqual(N.toNumber(s.monkeys) * T.typingSpeed * tier.p + 1e-9);
        used += cert * tier.reviewCost;
      }
      expect(used).toBeLessThanOrEqual(N.toNumber(pool) + 1e-6);
    }
  });

  it('suggested split for Maximize bananas is never beaten by another split', () => {
    for (const [monkeys, level] of [[50, 2], [5_000, 20], [200_000, 400]] as const) {
      const s = allDiscovered(monkeys, level);
      const pool = editingPool(s, T);
      const best = N.toNumber(certifyTiers(s, T, pool, suggestTierAllocation(s, T)).income);
      const rng = { s: monkeys };
      for (let i = 0; i < 200; i++) {
        const alloc = Object.fromEntries(T.tiers.map((x) => [x.id, nextFloat(rng)]));
        expect(N.toNumber(certifyTiers(s, T, pool, alloc).income)).toBeLessThanOrEqual(best + 1e-6);
      }
    }
  });

  it('shows idle Editors when capacity is assigned to a tier with too few finds', () => {
    const s = allDiscovered(20, 10);
    const c = certifyTiers(s, T, editingPool(s, T), { sentences: 1 });
    expect(N.toNumber(c.idle)).toBeGreaterThan(0);
    expect(N.toNumber(c.discarded)).toBeGreaterThan(0);
  });

  it('suggested split shifts up the ladder as typing grows', () => {
    const small = allDiscovered(50, 5);
    const large = allDiscovered(500_000, 5);
    expect(suggestTierAllocation(large, T).sentences ?? 0).toBeGreaterThan(suggestTierAllocation(small, T).sentences ?? 0);
  });
});
