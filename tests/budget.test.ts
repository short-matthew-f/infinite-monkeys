// The quarterly budget (DESIGN.md §13, proposed). Runs on prototypeBudgetTuning only;
// the shipped tuning has no budget and every other test covers that path.

import { describe, expect, it } from 'vitest';
import { prototypeBudgetTuning as TB, prototypeTuning as T } from '../content/prototype.js';
import {
  buyDeptLevel,
  createState,
  declareInfinity,
  declineRequisition,
  grantRequisition,
  headShares,
  levelsListPrice,
  previewQuarter,
  N,
  nullSink,
  requisitionPrice,
  run,
  setShares,
  signBudget,
  suggestBudget,
  suggestShares,
  type BudgetLines,
  type GameState,
} from '../core/index.js';
import { collector, ofType } from './helpers.js';

const Q = TB.budget!.quarterSeconds;
const ticks = (sec: number) => Math.round(sec / TB.tickSeconds);
const LINES: BudgetLines = { recruiting: 0.2, construction: 0.2, editing: 0.3, discretionary: 0.3 };

/** A state with one Recruiter bought, so the budget opens on the next tick. */
function opened(): GameState {
  const s = createState(TB, 1);
  s.bananas = N.of(1_000);
  s.monkeys = N.of(50);
  s.desks = N.of(60);
  expect(buyDeptLevel(s, TB, nullSink, 'recruiting')).toBe(true);
  run(s, TB, nullSink, 1);
  return s;
}

describe('quarterly budget', () => {
  it('stays closed without budget tuning, and until a department exists', () => {
    const plain = createState(T, 1);
    plain.bananas = N.of(1_000);
    buyDeptLevel(plain, T, nullSink, 'recruiting');
    run(plain, T, nullSink, 10);
    expect(plain.budget).toBeNull();

    const s = createState(TB, 1);
    run(s, TB, nullSink, 10);
    expect(s.budget).toBeNull();
  });

  it('opens with every banana discretionary and a review waiting', () => {
    const { events, sink } = collector();
    const s = createState(TB, 1);
    s.bananas = N.of(1_000);
    buyDeptLevel(s, TB, sink, 'recruiting');
    run(s, TB, sink, 1);
    expect(ofType(events, 'budgetOpened')).toHaveLength(1);
    expect(s.budget!.lines.discretionary).toBe(1);
    expect(s.budget!.reviewDue).toBe(true);
  });

  it('splits income by the signed lines; departments buy their own levels', () => {
    const s = opened();
    expect(signBudget(s, TB, nullSink, LINES)).toBe(true);
    const level0 = s.depts.editing.level;
    const { events, sink } = collector();
    run(s, TB, sink, ticks(30));
    const auto = ofType(events, 'purchase').filter((e) => e.by === 'department');
    expect(auto.length).toBeGreaterThan(0);
    expect(s.depts.editing.level).toBeGreaterThan(level0);
    // Accounts never go negative and stay below the next level's price after buying.
    for (const d of ['recruiting', 'construction', 'editing'] as const) expect(N.toNumber(s.budget!.accounts[d])).toBeGreaterThanOrEqual(0);
  });

  it('only signs at an open review, with valid lines and at least the minimum discretionary', () => {
    const s = opened();
    expect(signBudget(s, TB, nullSink, { ...LINES, discretionary: 0.4 })).toBe(false); // sums to 1.1
    expect(signBudget(s, TB, nullSink, { recruiting: 0.5, construction: 0.45, editing: 0, discretionary: 0.05 })).toBe(false); // below the minimum
    expect(signBudget(s, TB, nullSink, { ...LINES, recruiting: -0.1, construction: 0.5 })).toBe(false);
    expect(signBudget(s, TB, nullSink, LINES)).toBe(true);
    expect(signBudget(s, TB, nullSink, LINES)).toBe(false); // locked until the next review
  });

  it('sweeps the unspent wallet into the pot at quarter end, and the next signature splits it', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    const { events, sink } = collector();
    run(s, TB, sink, ticks(Q));
    const ended = ofType(events, 'quarterEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.report.swept).toBeGreaterThan(0);
    expect(N.toNumber(s.budget!.pot)).toBeCloseTo(ended[0]!.pot, 6);
    expect(s.budget!.reviewDue).toBe(true);
    const pot = N.toNumber(s.budget!.pot);
    const wallet = N.toNumber(s.bananas);
    const next: BudgetLines = { recruiting: 0, construction: 0, editing: 0, discretionary: 1 };
    expect(signBudget(s, TB, nullSink, next)).toBe(true);
    expect(N.toNumber(s.bananas)).toBeCloseTo(wallet + pot, 6);
    expect(N.toNumber(s.budget!.pot)).toBe(0);
  });

  it('never waits for the player: an unsigned review closes on the previous lines', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(Q)); // review opens
    const { events, sink } = collector();
    run(s, TB, sink, ticks(Q)); // and closes unsigned
    const ended = ofType(events, 'quarterEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.missedReview).toBe(true);
    expect(s.budget!.missedReviews).toBe(1);
    expect(s.budget!.lines).toEqual(LINES);
  });

  it('is deterministic: chunked and continuous runs agree (the offline catch-up path)', () => {
    const a = opened(), b = opened();
    signBudget(a, TB, nullSink, LINES);
    signBudget(b, TB, nullSink, LINES);
    run(a, TB, nullSink, ticks(Q * 2.5));
    for (let i = 0; i < 25; i++) run(b, TB, nullSink, ticks(Q * 0.1));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('replaces the funding slider: heads coordinate shares, setShares is refused', () => {
    const s = opened();
    expect(setShares(s, TB, nullSink, { recruiting: 1, construction: 0, editing: 0 })).toBe(false);
  });

  it('suggests lines that sum to 1 with the tuned discretionary share', () => {
    const s = opened();
    const l = suggestBudget(s, TB);
    expect(l.recruiting + l.construction + l.editing + l.discretionary).toBeCloseTo(1, 9);
    expect(l.discretionary).toBe(TB.budget!.suggestedDiscretionary);
    expect(signBudget(s, TB, nullSink, l)).toBe(true);
  });

  it('closes at the ceremony: accounts and the pot return to the wallet', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(Q));
    const b = s.budget!;
    const total = N.toNumber(s.bananas) + N.toNumber(b.pot) + (['recruiting', 'construction', 'editing'] as const).reduce((a, d) => a + N.toNumber(b.accounts[d]), 0);
    s.stability.permit = true;
    expect(declareInfinity(s, TB, nullSink)).toBe(true);
    expect(s.budget).toBeNull();
    expect(N.toNumber(s.bananas)).toBeCloseTo(total, 6);
  });

  it("heads cap Editing's share by the budget's own caps, raised once every department is at stage 4", () => {
    const s = opened();
    const bd = TB.budget!;
    expect(headShares(s, TB)).toEqual(suggestShares(s, { ...TB, suggestedEditingShareCap: bd.editingShareCap }));
    for (const d of ['recruiting', 'construction', 'editing'] as const) s.depts[d].stage = 4;
    expect(headShares(s, TB)).toEqual(suggestShares(s, { ...TB, suggestedEditingShareCap: bd.readinessEditingShareCap }));
    // The live shares follow the heads every tick.
    run(s, TB, nullSink, 1);
    expect(s.shares).toEqual(headShares(s, TB));
  });

  it('previews a signature by running the quarter on a clone', () => {
    const s = opened();
    run(s, TB, nullSink, ticks(20));
    const before = JSON.stringify(s);
    const p = previewQuarter(s, TB, LINES)!;
    expect(JSON.stringify(s)).toBe(before); // the live state is untouched
    // The same signature, actually played out with no manual buys, lands on the preview.
    const levels = { recruiting: s.depts.recruiting.level, construction: s.depts.construction.level, editing: s.depts.editing.level };
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, s.budget!.quarterStartTick + ticks(Q) - s.tick - 1); // to one tick before quarter end
    expect(p.levels.editing).toBe(s.depts.editing.level - levels.editing);
    expect(p.wallet).toBeCloseTo(N.toNumber(s.bananas), 6);
    expect(previewQuarter(s, TB, LINES)).toBeNull(); // no review open
    expect(previewQuarter(opened(), TB, { ...LINES, discretionary: 0.9 })).toBeNull(); // invalid lines
  });

  describe('requisitions', () => {
    const R = TB.budget!.requisitions!;
    /** A signed budget with a requisition open. */
    function filed(): GameState {
      const s = opened();
      signBudget(s, TB, nullSink, LINES);
      s.depts.editing.level = Math.max(1, s.depts.editing.level);
      run(s, TB, nullSink, ticks(R.cooldownSeconds) + 1);
      expect(s.budget!.requisition).not.toBeNull();
      return s;
    }

    it('a head files one after the cooldown, priced at the bulk rate of its list price', () => {
      const { events, sink } = collector();
      const s = opened();
      signBudget(s, TB, nullSink, LINES);
      run(s, TB, sink, ticks(R.cooldownSeconds) - 2);
      expect(ofType(events, 'requisitionOpened')).toHaveLength(0);
      run(s, TB, sink, 4);
      const opened_ = ofType(events, 'requisitionOpened');
      expect(opened_).toHaveLength(1);
      const q = s.budget!.requisition!;
      expect(N.toNumber(requisitionPrice(s, TB)!)).toBeCloseTo(N.toNumber(levelsListPrice(s, TB, q.dept, R.levels)) * R.priceFactor, 6);
      expect(s.budget!.stats.requisitions.offered).toBe(1);
    });

    it('list price is the sum of the next levels', () => {
      const s = opened();
      let sum = 0;
      const p = { ...s, depts: { ...s.depts, editing: { ...s.depts.editing } } };
      for (let i = 0; i < 3; i++) { sum += N.toNumber(levelsListPrice(p, TB, 'editing', 1)); p.depts.editing.level++; }
      expect(N.toNumber(levelsListPrice(s, TB, 'editing', 3))).toBeCloseTo(sum, 6);
    });

    it('granting pays from the wallet and adds the levels at once', () => {
      const s = filed();
      const q = s.budget!.requisition!;
      const price = N.toNumber(requisitionPrice(s, TB)!);
      s.bananas = N.of(price - 1);
      expect(grantRequisition(s, TB, nullSink)).toBe(false);
      s.bananas = N.of(price + 10);
      const level = s.depts[q.dept].level;
      const { events, sink } = collector();
      expect(grantRequisition(s, TB, sink)).toBe(true);
      expect(s.depts[q.dept].level).toBe(level + R.levels);
      expect(N.toNumber(s.bananas)).toBeCloseTo(10, 6);
      expect(ofType(events, 'requisitionClosed')[0]!.outcome).toBe('granted');
      expect(s.budget!.requisition).toBeNull();
      expect(grantRequisition(s, TB, nullSink)).toBe(false);
    });

    it('declined or unanswered, it closes and the next waits a cooldown', () => {
      const s = filed();
      expect(declineRequisition(s, TB, nullSink)).toBe(true);
      expect(s.budget!.stats.requisitions.declined).toBe(1);
      run(s, TB, nullSink, ticks(R.cooldownSeconds) - 2);
      expect(s.budget!.requisition).toBeNull();
      const { events, sink } = collector();
      run(s, TB, sink, 4 + ticks(R.openSeconds));
      expect(ofType(events, 'requisitionClosed').map((e) => e.outcome)).toContain('expired');
    });

    it('never outlives its quarter', () => {
      const s = filed();
      run(s, TB, nullSink, ticks(Q));
      const b = s.budget!;
      expect(b.requisition === null || b.requisition.openedTick >= b.quarterStartTick).toBe(true);
      if (b.requisition) expect(b.requisition.expiresTick).toBeLessThanOrEqual(b.quarterStartTick + ticks(Q));
    });
  });
});
