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
// headShares every tick), so the free funding slider is gone in this mode.
//
// Nothing here waits for the player: a review left unsigned closes at the next
// quarter end and the quarter runs on the previous lines, so offline catch-up
// and live play take the same path.

import { N, type Num } from './num.js';
import type { BudgetLines, EventSink, QuarterReport } from './events.js';
import { capability, certifyTiers, deptLevelCost, deptOutput, editingPool, finiteBottleneck, hiredEditingCapacity, reviewSpeedMult, secondsToTicks, suggestShares } from './model.js';
import type { BudgetState, GameState } from './state.js';
import { DEPTS, type DeptId, type ProjectDef, type Tuning } from './tuning.js';
import { newOffice, projectAvailable } from './office.js';
import { nextFloat } from './rng.js';
import { run } from './step.js';
import { nullSink } from './events.js';

const LINES = [...DEPTS, 'discretionary'] as const;
/** Department auto-buys per tick are capped so one tick stays cheap after a large lump. */
const MAX_AUTO_BUYS_PER_TICK = 50;

export function emptyReport(quarter: number): QuarterReport {
  return {
    quarter, seconds: 0, income: 0, hires: 0, manualHires: 0, desksBuilt: 0, desksBought: 0,
    certifiedFinds: 0, discardedFinds: 0, autoLevels: { recruiting: 0, construction: 0, editing: 0 },
    ranOnOldLines: false, requisitions: { offered: 0, granted: 0, declined: 0, expired: 0 }, requests: [], auditFound: 0, walletSpent: 0, swept: 0,
  };
}

/**
 * The heads' coordinated output shares in budget mode: the suggestShares rule
 * with the budget's own Editing cap. Growth is paid for by the lines, so the
 * heads can give Editing more of the effort than the free-shares suggestion
 * does; once every department reaches stage 4 (the meters can fill), more
 * again. Keyed on stages, not the pinned objective, because the game never
 * asks the player to pin Readiness.
 */
export function headShares(s: GameState, t: Tuning): Record<DeptId, number> {
  const bd = t.budget;
  if (!bd) return suggestShares(s, t);
  const cap = DEPTS.every((d) => s.depts[d].stage === 4) ? bd.readinessEditingShareCap : bd.editingShareCap;
  return suggestShares(s, cap === t.suggestedEditingShareCap ? t : { ...t, suggestedEditingShareCap: cap });
}

/**
 * Brings a save from an older build up to the current shape: quarter reports
 * gain the fields added since (requests, audit funds, ranOnOldLines), the
 * office state exists once the budget is open, and an open request filed in
 * the old format is withdrawn (its quote is unknown). Idempotent; cheap when
 * nothing is missing. The game calls it on load, and step() guards with it.
 */
export function upgradeSave(s: GameState): void {
  const b = s.budget;
  if (!b) return;
  for (const r of [b.stats, b.lastReport]) {
    if (!r) continue;
    r.requests ??= [];
    r.auditFound ??= 0;
    r.ranOnOldLines ??= false;
    r.requisitions ??= { offered: 0, granted: 0, declined: 0, expired: 0 };
  }
  if (s.phase === 'finite') s.office ??= newOffice();
  const q = b.requisition as Partial<NonNullable<BudgetState['requisition']>> | null;
  if (q && (typeof q.kind !== 'string' || typeof q.price !== 'number' || !q.from)) b.requisition = null;
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
  const p: GameState = { ...s, depts: { recruiting: { ...s.depts.recruiting }, construction: { ...s.depts.construction }, editing: { ...s.depts.editing } }, shares: headShares(s, t) };
  const growth = 1 + Math.min(2, (N.toNumber(deptOutput(p, t, 'recruiting')) * q) / Math.max(1, N.toNumber(s.monkeys)));
  const demand = N.toNumber(certifyTiers(s, t, N.zero, s.tierAllocation).demand) * growth;
  const spent: Record<DeptId, number> = { recruiting: 0, construction: 0, editing: 0 };
  for (let i = 0; i < PLAN_STEPS && money > 0; i++) {
    p.shares = headShares(p, t);
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
  const w = total > 0 ? spent : headShares(s, t);
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
    requisition: null,
    lastRequisitionTick: s.tick,
  };
  s.office = newOffice();
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
  if (b.requisition) closeRequisition(s, b, sink, 'expired');
  b.stats.seconds = (s.tick - b.quarterStartTick) * t.tickSeconds;
  b.stats.ranOnOldLines = missedReview;
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

// ---------- requisitions and projects ----------
//
// Mid-quarter the heads file requests, one at a time, as memos. Two kinds:
// - 'levels': the short department's head asks for a block of levels at a
//   bulk rate. Short uses suggestBudget's rule: Editing while review demand
//   outruns the editing pool, otherwise the lower-capability of Recruiting
//   and Construction.
// - projects (t.budget.projects): the support offices' and heads' projects
//   (pizza parties, audits, managers...), priced as a share of a quarter's
//   reference wallet income so they stay meaningful as the Bureau grows.
// The price is quoted when the memo is filed. Accepting pays from the
// wallet; declining costs nothing. Unanswered memos expire, and nothing
// waits for the player. Which request comes next is drawn from the gameplay
// stream, so live play and catch-up agree.

/** The department whose head would file a level requisition now. */
export function requisitionDept(s: GameState, t: Tuning): DeptId {
  if (finiteBottleneck(s, t) === 'editing') return 'editing';
  return N.lte(capability(s, t, 'recruiting'), capability(s, t, 'construction')) ? 'recruiting' : 'construction';
}

/** List price of a department's next `levels` levels. */
export function levelsListPrice(s: GameState, t: Tuning, d: DeptId, levels: number): Num {
  const def = t.depts[d];
  // Geometric series: base × g^L × (g^n − 1) / (g − 1).
  const g = def.levelCostGrowth;
  return N.mul(deptLevelCost(s, t, d), (Math.pow(g, levels) - 1) / (g - 1));
}

/** A quarter's reference wallet income: what projects are priced against. Independent of the signed lines. */
export function referenceWalletIncome(s: GameState, t: Tuning): Num {
  const bd = t.budget;
  if (!bd) return N.zero;
  return N.mul(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income, bd.quarterSeconds * bd.suggestedDiscretionary);
}

export function projectDef(t: Tuning, id: string): ProjectDef | null {
  return t.budget?.projects.find((p) => p.id === id) ?? null;
}

/** What a project would cost if filed now. */
export function projectPrice(s: GameState, t: Tuning, p: ProjectDef): Num {
  const owned = s.office?.owned[p.id] ?? 0;
  return N.mul(referenceWalletIncome(s, t), p.price * p.priceGrowth ** owned);
}

/** The open request's quoted price, or null. */
export function requisitionPrice(s: GameState, t: Tuning): Num | null {
  const b = activeBudget(s, t);
  return b?.requisition ? N.of(b.requisition.price) : null;
}

function closeRequisition(s: GameState, b: BudgetState, sink: EventSink, outcome: 'granted' | 'declined' | 'expired'): void {
  const q = b.requisition;
  if (!q) return;
  b.requisition = null;
  b.lastRequisitionTick = s.tick;
  b.stats.requisitions[outcome]++;
  b.stats.requests.push({ kind: q.kind, from: q.from, dept: q.dept, price: q.price, outcome });
  sink({ type: 'requisitionClosed', tick: s.tick, kind: q.kind, from: q.from, dept: q.dept, outcome, price: q.price });
}

/** Expires an unanswered request, or files the next one once the cooldown has passed. */
export function maybeRequisition(s: GameState, t: Tuning, b: BudgetState, sink: EventSink): void {
  const r = t.budget?.requisitions;
  if (!r) return;
  s.office ??= newOffice();
  if (b.requisition) {
    if (s.tick >= b.requisition.expiresTick) closeRequisition(s, b, sink, 'expired');
    return;
  }
  if (s.tick - b.lastRequisitionTick < secondsToTicks(t, r.cooldownSeconds)) return;
  // Don't file one that couldn't stay open for its full window this quarter.
  const quarterEnd = b.quarterStartTick + secondsToTicks(t, t.budget!.quarterSeconds);
  const expiresTick = s.tick + secondsToTicks(t, r.openSeconds);
  if (expiresTick > quarterEnd) return;
  // What's on offer: a level block from the short department, and every available project.
  const dept = requisitionDept(s, t);
  const options: string[] = [];
  if (s.depts[dept].level > 0) options.push('levels');
  for (const p of t.budget!.projects) if (projectAvailable(s, p)) options.push(p.id);
  // Never the same kind twice in a row while there's a choice.
  const pool = options.length > 1 ? options.filter((k) => k !== b.lastRequisitionKind) : options;
  if (!pool.length) return;
  const kind = pool[Math.min(pool.length - 1, Math.floor(nextFloat(s.rng.gameplay) * pool.length))]!;
  const p = kind === 'levels' ? null : projectDef(t, kind)!;
  const price = p ? projectPrice(s, t, p) : N.mul(levelsListPrice(s, t, dept, r.levels), r.priceFactor);
  b.requisition = { kind, from: p ? p.from : dept, dept: p ? null : dept, price: N.toNumber(price), openedTick: s.tick, expiresTick };
  b.lastRequisitionKind = kind;
  b.stats.requisitions.offered++;
  sink({ type: 'requisitionOpened', tick: s.tick, kind, from: b.requisition.from, dept: b.requisition.dept, levels: p ? 0 : r.levels, price: N.toNumber(price) });
}

/** Accepts the open request, paying its quoted price from the wallet. */
export function grantRequisition(s: GameState, t: Tuning, sink: EventSink): boolean {
  const b = activeBudget(s, t);
  const r = t.budget?.requisitions;
  const q = b?.requisition;
  if (!b || !q || !r) return false;
  const price = N.of(q.price);
  if (N.lt(s.bananas, price)) return false;
  const before = finiteBottleneck(s, t);
  s.bananas = N.sub(s.bananas, price);
  b.stats.walletSpent += q.price;
  if (q.kind === 'levels' && q.dept) {
    s.depts[q.dept].level += r.levels;
    sink({ type: 'purchase', tick: s.tick, item: `${q.dept}:requisition:${s.depts[q.dept].level}`, cost: q.price, currency: 'bananas', bottleneckBefore: before, bottleneckAfter: finiteBottleneck(s, t) });
  } else {
    const p = projectDef(t, q.kind);
    if (p) applyProject(s, t, p, q.price);
    sink({ type: 'purchase', tick: s.tick, item: `project:${q.kind}`, cost: q.price, currency: 'bananas', bottleneckBefore: before, bottleneckAfter: finiteBottleneck(s, t) });
    sink({ type: 'projectDone', tick: s.tick, project: q.kind, from: q.from });
  }
  closeRequisition(s, b, sink, 'granted');
  return true;
}

function applyProject(s: GameState, t: Tuning, p: ProjectDef, price: number): void {
  const o = (s.office ??= newOffice());
  o.owned[p.id] = (o.owned[p.id] ?? 0) + 1;
  const e = p.effect;
  switch (e.type) {
    case 'morale':
      o.morale = Math.min(t.budget!.morale.max, o.morale + e.add);
      break;
    case 'timed':
      o.timed.push({ target: e.target, mult: e.mult, untilTick: s.tick + secondsToTicks(t, e.seconds), project: p.id });
      break;
    case 'audit':
      o.audits.push({ amount: price * e.returnMult, dueTick: s.tick + secondsToTicks(t, e.seconds) });
      break;
    case 'reviewResearch':
      s.reviewLevel++;
      break;
    case 'perm':
    case 'offline':
      break; // owned count is the effect
  }
}

/** Audits that are due pay their findings into the pot. */
export function settleAudits(s: GameState, b: BudgetState, sink: EventSink): void {
  const o = s.office;
  if (!o || !o.audits.length || !o.audits.some((a) => a.dueTick <= s.tick)) return;
  for (const a of o.audits) {
    if (a.dueTick > s.tick) continue;
    b.pot = N.add(b.pot, N.of(a.amount));
    b.stats.auditFound += a.amount;
    sink({ type: 'auditFound', tick: s.tick, amount: a.amount });
  }
  o.audits = o.audits.filter((a) => a.dueTick > s.tick);
}

/** Turns the open request down. The cooldown starts as if it had expired. */
export function declineRequisition(s: GameState, t: Tuning, sink: EventSink): boolean {
  const b = activeBudget(s, t);
  if (!b?.requisition) return false;
  closeRequisition(s, b, sink, 'declined');
  return true;
}

// ---------- review preview ----------

export interface QuarterPreview {
  /** Levels each department would buy from its account by quarter end. */
  levels: Record<DeptId, number>;
  /** Wallet at quarter end, before the sweep, if nothing is bought by hand. */
  wallet: number;
  /** Income per second at quarter end. */
  income: number;
  /** Review demand and the editing pool at quarter end (finds per second). */
  demand: number;
  pool: number;
}

/**
 * What signing `lines` now would do by quarter end if the player bought
 * nothing by hand: clone, sign, run the quarter out, read. Null when no
 * review is open or the lines aren't valid. The review shows these as facts.
 */
export function previewQuarter(s: GameState, t: Tuning, lines: BudgetLines): QuarterPreview | null {
  const b = activeBudget(s, t);
  if (!b || !b.reviewDue || !validLines(t, lines)) return null;
  const p = JSON.parse(JSON.stringify(s)) as GameState;
  if (!signBudget(p, t, nullSink, lines)) return null;
  const before = Object.fromEntries(DEPTS.map((d) => [d, p.depts[d].level])) as Record<DeptId, number>;
  // Stop one tick short of the quarter end so the sweep hasn't run.
  run(p, t, nullSink, Math.max(0, secondsToTicks(t, quarterSecondsLeft(p, t)) - 1));
  const cert = certifyTiers(p, t, editingPool(p, t), p.tierAllocation);
  return {
    levels: Object.fromEntries(DEPTS.map((d) => [d, p.depts[d].level - before[d]])) as Record<DeptId, number>,
    wallet: N.toNumber(p.bananas),
    income: N.toNumber(cert.income),
    demand: N.toNumber(certifyTiers(p, t, N.zero, p.tierAllocation).demand),
    pool: N.toNumber(editingPool(p, t)),
  };
}

/** At the ceremony the budget closes: accounts and the pot return to the wallet. */
export function closeBudget(s: GameState): void {
  const b = s.budget;
  if (!b) return;
  let total = b.pot;
  for (const d of DEPTS) total = N.add(total, b.accounts[d]);
  // Audits still under way report at the ceremony.
  for (const a of s.office?.audits ?? []) total = N.add(total, N.of(a.amount));
  if (s.office) s.office.audits = [];
  s.bananas = N.add(s.bananas, total);
  s.budget = null;
}

export const budgetLineIds: readonly (DeptId | 'discretionary')[] = LINES;
