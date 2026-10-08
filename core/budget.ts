// The quarterly budget (DESIGN.md §13, proposed; on only when tuning has `budget`).
//
// Income is split live by the signed lines. Department lines fill department
// accounts, and each department buys its own levels from its account; the
// discretionary line fills the player's wallet (`s.bananas`), which pays for
// every manual purchase. At quarter end the unspent wallet is swept into the
// pot, and the next signed budget splits the pot as a lump.
//
// The budget decides how fast each department grows; how hard each one works
// is coordinated by the heads themselves (the funding shares follow
// suggestShares every tick), so the free funding slider is gone in this mode.
//
// Nothing here waits for the player: a review left unsigned closes at the next
// quarter end and the quarter runs on the previous lines, so offline catch-up
// and live play take the same path.

import { N, type Num } from './num.js';
import type { BudgetLines, EventSink, QuarterReport } from './events.js';
import { capability, certifyTiers, deptLevelCost, deptOutput, editingPool, finiteBottleneck, hiredEditingCapacity, reviewSpeedMult, secondsToTicks, suggestShares } from './model.js';
import type { BudgetState, GameState } from './state.js';
import { DEPTS, type DeptId, type Tuning } from './tuning.js';

const LINES = [...DEPTS, 'discretionary'] as const;
/** Department auto-buys per tick are capped so one tick stays cheap after a large lump. */
const MAX_AUTO_BUYS_PER_TICK = 50;

export function emptyReport(quarter: number): QuarterReport {
  return {
    quarter, seconds: 0, income: 0, hires: 0, manualHires: 0, desksBuilt: 0, desksBought: 0,
    certifiedFinds: 0, discardedFinds: 0, autoLevels: { recruiting: 0, construction: 0, editing: 0 }, walletSpent: 0, swept: 0,
  };
}

/** Budget mode is on for this tuning and the budget has opened. */
export function activeBudget(s: GameState, t: Tuning): BudgetState | null {
  return t.budget && s.phase === 'finite' ? (s.budget ?? null) : null;
}

export function validLines(t: Tuning, next: BudgetLines): boolean {
  const vals = LINES.map((k) => next[k]);
  if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) return false;
  if (Math.abs(vals.reduce((a, b) => a + b, 0) - 1) > 1e-6) return false;
  return next.discretionary >= (t.budget?.minDiscretionary ?? 0) - 1e-9;
}

/** Planning cap for suggestBudget's level-by-level plan. */
const PLAN_STEPS = 400;

/**
 * Suggested lines, the same rule as suggestShares applied to growth money:
 * after a fixed discretionary share, plan the quarter's department money level
 * by level, covering Editing's projected review demand at quarter end first,
 * then growing Recruiting and Construction together. Lines are the plan's
 * spending proportions. A suggestion only; the review states facts and never
 * says which lines to sign.
 */
export function suggestBudget(s: GameState, t: Tuning): BudgetLines {
  const disc = t.budget?.suggestedDiscretionary ?? 1;
  const rest = 1 - disc;
  const q = t.budget?.quarterSeconds ?? 0;
  const income = N.toNumber(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income);
  let money = (income * q + N.toNumber(s.budget?.pot ?? N.zero)) * rest;
  // Plan on a copy of the departments; nothing in s changes.
  const p: GameState = { ...s, depts: { recruiting: { ...s.depts.recruiting }, construction: { ...s.depts.construction }, editing: { ...s.depts.editing } }, shares: suggestShares(s, t) };
  const growth = 1 + Math.min(2, (N.toNumber(deptOutput(p, t, 'recruiting')) * q) / Math.max(1, N.toNumber(s.monkeys)));
  const demand = N.toNumber(certifyTiers(s, t, N.zero, s.tierAllocation).demand) * growth;
  const spent: Record<DeptId, number> = { recruiting: 0, construction: 0, editing: 0 };
  for (let i = 0; i < PLAN_STEPS && money > 0; i++) {
    p.shares = suggestShares(p, t);
    const pool = N.toNumber(hiredEditingCapacity(p, t)) + t.editorInChiefCapacity * reviewSpeedMult(p, t);
    const d: DeptId = pool < demand ? 'editing' : N.lte(capability(p, t, 'recruiting'), capability(p, t, 'construction')) ? 'recruiting' : 'construction';
    const cost = N.toNumber(deptLevelCost(p, t, d));
    if (cost > money) break;
    money -= cost;
    spent[d] += cost;
    p.depts[d].level++;
  }
  const total = DEPTS.reduce((a, d) => a + spent[d], 0);
  // Nothing affordable yet: fall back to the funding suggestion's proportions.
  const w = total > 0 ? spent : suggestShares(s, t);
  const wt = DEPTS.reduce((a, d) => a + w[d], 0) || 1;
  return {
    recruiting: (w.recruiting / wt) * rest,
    construction: (w.construction / wt) * rest,
    editing: (w.editing / wt) * rest,
    discretionary: disc,
  };
}

/** Seconds left in the current quarter (0 while a review is open counts the running quarter). */
export function quarterSecondsLeft(s: GameState, t: Tuning): number {
  const b = s.budget;
  if (!b || !t.budget) return 0;
  return Math.max(0, t.budget.quarterSeconds - (s.tick - b.quarterStartTick) * t.tickSeconds);
}

/** Opens the budget the first time a department exists; until then all income is discretionary. */
export function maybeOpenBudget(s: GameState, t: Tuning, sink: EventSink): void {
  if (!t.budget || s.phase !== 'finite' || s.budget) return;
  if (!DEPTS.some((d) => s.depts[d].level > 0)) return;
  s.budget = {
    lines: { recruiting: 0, construction: 0, editing: 0, discretionary: 1 },
    accounts: { recruiting: N.zero, construction: N.zero, editing: N.zero },
    pot: N.zero,
    quarter: 1,
    quarterStartTick: s.tick,
    reviewDue: true,
    missedReviews: 0,
    stats: emptyReport(1),
    lastReport: null,
  };
  sink({ type: 'budgetOpened', tick: s.tick });
}

/** Splits a lump (the pot) by lines: discretionary to the wallet, the rest to department accounts. */
function distribute(s: GameState, b: BudgetState, lump: Num, lines: BudgetLines): void {
  s.bananas = N.add(s.bananas, N.mul(lump, lines.discretionary));
  for (const d of DEPTS) b.accounts[d] = N.add(b.accounts[d], N.mul(lump, lines[d]));
}

/** Banks one tick of income by the signed lines. Returns the wallet's part. */
export function bankIncome(s: GameState, b: BudgetState, income: Num): void {
  distribute(s, b, income, b.lines);
  b.stats.income += N.toNumber(income);
}

/** Departments buy their own levels from their accounts. */
export function autoBuy(s: GameState, t: Tuning, b: BudgetState, sink: EventSink): void {
  for (const d of DEPTS) {
    for (let k = 0; k < MAX_AUTO_BUYS_PER_TICK; k++) {
      const cost = deptLevelCost(s, t, d);
      if (N.lt(b.accounts[d], cost)) break;
      const before = finiteBottleneck(s, t);
      b.accounts[d] = N.sub(b.accounts[d], cost);
      s.depts[d].level++;
      b.stats.autoLevels[d]++;
      sink({ type: 'purchase', tick: s.tick, item: `${d}:level:${s.depts[d].level}`, cost: N.toNumber(cost), currency: 'bananas', bottleneckBefore: before, bottleneckAfter: finiteBottleneck(s, t), by: 'department' });
    }
  }
}

/** Closes the quarter if it's over: report, sweep the wallet into the pot, open the review. */
export function maybeEndQuarter(s: GameState, t: Tuning, b: BudgetState, sink: EventSink): void {
  if (!t.budget || s.tick - b.quarterStartTick < secondsToTicks(t, t.budget.quarterSeconds)) return;
  // A review left open for a whole quarter closes on the lines already signed.
  const missedReview = b.reviewDue;
  if (missedReview) {
    distribute(s, b, b.pot, b.lines);
    b.pot = N.zero;
    b.missedReviews++;
  }
  b.stats.seconds = (s.tick - b.quarterStartTick) * t.tickSeconds;
  const swept = N.mul(s.bananas, t.budget.sweepShare);
  b.stats.swept = N.toNumber(swept);
  b.pot = N.add(b.pot, swept);
  s.bananas = N.sub(s.bananas, swept);
  b.lastReport = b.stats;
  sink({ type: 'quarterEnded', tick: s.tick, report: b.stats, pot: N.toNumber(b.pot), missedReview });
  b.quarter++;
  b.quarterStartTick = s.tick;
  b.reviewDue = true;
  b.stats = emptyReport(b.quarter);
}

/** Signs the budget at an open review: the pot is split by the new lines, which hold until the next review. */
export function signBudget(s: GameState, t: Tuning, sink: EventSink, next: BudgetLines): boolean {
  const b = activeBudget(s, t);
  if (!b || !b.reviewDue || !validLines(t, next)) return false;
  const previous = { ...b.lines };
  const pot = b.pot;
  distribute(s, b, pot, next);
  b.pot = N.zero;
  b.lines = { ...next };
  b.reviewDue = false;
  sink({ type: 'budgetSigned', tick: s.tick, quarter: b.quarter, previous, next: { ...next }, pot: N.toNumber(pot) });
  return true;
}

/** At the ceremony the budget closes: accounts and the pot return to the wallet. */
export function closeBudget(s: GameState): void {
  const b = s.budget;
  if (!b) return;
  let total = b.pot;
  for (const d of DEPTS) total = N.add(total, b.accounts[d]);
  s.bananas = N.add(s.bananas, total);
  s.budget = null;
}

export const budgetLineIds: readonly (DeptId | 'discretionary')[] = LINES;
