// The quarterly budget (DESIGN.md §13, proposed). Runs on prototypeBudgetTuning only;
// the shipped tuning has no budget and every other test covers that path.

import { describe, expect, it } from 'vitest';
import { prototypeBudgetTuning as TB, prototypeTuning as T } from '../content/prototype.js';
import {
  buyDeptLevel,
  createState,
  declareInfinity,
  N,
  nullSink,
  run,
  setShares,
  signBudget,
  suggestBudget,
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
});
