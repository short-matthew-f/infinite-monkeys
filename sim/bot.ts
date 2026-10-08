// Finite-phase bots (DESIGN.md §10, PROTOTYPE.md §10).
//
// Bots act at fixed decision intervals. At each decision they:
//   1. follow the suggested tier split and suggested funding shares
//      (casual definition: "follows the suggested split"),
//   2. tap Hire if they tap,
//   3. buy greedily by lookahead: each affordable purchase is tried on a
//      clone, the clone runs forward under the same policy, and the purchase
//      is made only if it beats waiting,
//   4. pin Readiness once every department reaches stage 4, and declare
//      infinity when the permit is stamped.
//
// Bots use only the public core API and the same tick function as the game.

import {
  applySuggestedAllocation,
  buyDeptLevel,
  buyDeptStage,
  buyDesk,
  buyTypingResearch,
  buyZeno,
  certifyTiers,
  createState,
  declareInfinity,
  deptLevelCost,
  deskCost,
  DEPTS,
  editingPool,
  grantRequisition,
  meters,
  nullSink,
  N,
  pinObjective,
  researchTier,
  run,
  setShares,
  signBudget,
  suggestBudget,
  suggestShares,
  tapHire,
  type EventSink,
  type GameState,
  type Meters,
  type Tuning,
} from '../core/index.js';

export interface BotConfig {
  name: string;
  decisionSeconds: number;
  manualHire: boolean;
  lookaheadSeconds: number;
  terminalSeconds: number;
  maxPurchasesPerDecision: number;
  /** A purchase must beat waiting by this fraction of the waiting score. */
  minGain: number;
  /** Re-balance funding only when the suggested shares improve average meters by this fraction. */
  rebalanceThreshold: number;
}

const base = { lookaheadSeconds: 90, terminalSeconds: 120, maxPurchasesPerDecision: 6, minGain: 0.0, rebalanceThreshold: 0.1 };

export const BOTS: Record<'casual' | 'hard' | 'idler', BotConfig> = {
  casual: { ...base, name: 'casual', decisionSeconds: 10, manualHire: true },
  hard: { ...base, name: 'hard', decisionSeconds: 2, manualHire: true },
  idler: { ...base, name: 'idler', decisionSeconds: 10, manualHire: false },
};

export const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

interface Candidate {
  id: string;
  apply: (s: GameState, t: Tuning, sink: EventSink) => boolean;
  unlock: boolean;
}

export function candidates(s: GameState, t: Tuning, bot: BotConfig): Candidate[] {
  const out: Candidate[] = [{ id: 'desk', apply: buyDesk, unlock: false }];
  if (bot.manualHire) out.push({ id: 'zeno', apply: buyZeno, unlock: false });
  for (const d of DEPTS) {
    out.push({ id: `${d}:level`, apply: (x, tt, k) => buyDeptLevel(x, tt, k, d), unlock: s.depts[d].level === 0 });
    // Bulk buy (Egg, Inc.-style ×10): all ten or none.
    out.push({
      id: `${d}:level×10`,
      apply: (x, tt, k) => {
        if (N.lt(x.bananas, N.mul(deptLevelCost(x, tt, d), 10))) return false;
        for (let i = 0; i < 10; i++) if (!buyDeptLevel(x, tt, k, d)) return i > 0;
        return true;
      },
      unlock: false,
    });
    out.push({ id: `${d}:stage`, apply: (x, tt, k) => buyDeptStage(x, tt, k, d), unlock: true });
  }
  // Paired purchases. Recruiting and Construction only raise growth together,
  // and a greedy single-step search can't see that; players buy them as a pair.
  const pair = (n: number): Candidate['apply'] => (x, tt, k) => {
    const cost = N.mul(N.add(deptLevelCost(x, tt, 'recruiting'), deptLevelCost(x, tt, 'construction')), n * 1.2);
    if (N.lt(x.bananas, cost)) return false;
    for (let i = 0; i < n; i++) {
      if (!buyDeptLevel(x, tt, k, 'recruiting') || !buyDeptLevel(x, tt, k, 'construction')) return i > 0;
    }
    return true;
  };
  out.push({ id: 'growth-pair', apply: pair(1), unlock: false });
  out.push({ id: 'growth-pair×10', apply: pair(10), unlock: false });
  // Desk plus Recruiter: the first automated hire needs both.
  out.push({
    id: 'desk+recruiter',
    apply: (x, tt, k) => N.gte(x.bananas, N.add(deskCost(x, tt), deptLevelCost(x, tt, 'recruiting'))) && buyDesk(x, tt, k) && buyDeptLevel(x, tt, k, 'recruiting'),
    unlock: s.depts.recruiting.level === 0,
  });
  out.push({ id: 'research:typing', apply: buyTypingResearch, unlock: false });
  // Budget mode: an open requisition is weighed like any other purchase.
  if (s.budget?.requisition) out.push({ id: 'requisition', apply: grantRequisition, unlock: false });
  const next = t.tiers.find((x) => !s.tiers[x.id]?.discoverable);
  if (next) out.push({ id: `research:${next.id}`, apply: (x, tt, k) => researchTier(x, tt, k, next.id), unlock: true });
  return out;
}

export function minMeter(m: Meters): number {
  return Math.min(...DEPTS.map((d) => m[d]));
}

export function avgMeters(m: Meters): number {
  return DEPTS.reduce((a, d) => a + m[d], 0) / DEPTS.length;
}

function allStage4(s: GameState): boolean {
  return DEPTS.every((d) => s.depts[d].stage === 4);
}

/** Policy upkeep every decision: suggested tier split, and funding shares when they help enough. */
function upkeep(s: GameState, t: Tuning, bot: BotConfig, sink: EventSink, log?: DecisionLog): void {
  applySuggestedAllocation(s, t, sink);
  if (t.budget && s.phase === 'finite') {
    // Budget mode: the heads set shares; at an open review the bot signs the suggested lines.
    if (s.budget?.reviewDue) {
      const prev = { ...s.budget.lines };
      const next = suggestBudget(s, t);
      if (signBudget(s, t, sink, next)) log?.reviews.push({ tick: s.tick, change: (['recruiting', 'construction', 'editing', 'discretionary'] as const).reduce((a, k) => a + Math.abs(next[k] - prev[k]), 0) / 2 });
    }
    return;
  }
  const suggested = suggestShares(s, t);
  const changed = DEPTS.some((d) => Math.abs(suggested[d] - s.shares[d]) > 1e-3);
  if (!changed) return;
  if (s.objective.kind === 'readiness') {
    // During Readiness, progress is the lowest meter (the Stability Window needs all full).
    // The bot rebalances when a meter has dropped below full and the suggestion raises the lowest one.
    const m0 = meters(s, t);
    const before = minMeter(m0);
    if (before >= 1 - 1e-9) return;
    const probe = clone(s);
    setShares(probe, t, nullSink, suggested);
    const m1 = meters(probe, t);
    const after = minMeter(m1);
    // Lexicographic: raise the lowest meter, or raise the others without lowering it.
    if (after > before + 1e-6 || (after >= before - 1e-9 && avgMeters(m1) > avgMeters(m0) + 1e-6)) {
      setShares(s, t, sink, suggested);
      log?.rebalances.push({ tick: s.tick, before, after });
    }
  } else {
    setShares(s, t, sink, suggested);
  }
}

function incomeRate(s: GameState, t: Tuning): number {
  return N.toNumber(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income);
}

/** Lookahead score: bananas after the horizon plus terminal income value, under the bot's own upkeep. */
export function score(s: GameState, t: Tuning, bot: BotConfig): number {
  const chunk = Math.round(bot.decisionSeconds / t.tickSeconds);
  const total = Math.round(bot.lookaheadSeconds / t.tickSeconds);
  for (let done = 0; done < total; done += chunk) {
    upkeep(s, t, bot, nullSink);
    if (bot.manualHire) tapHire(s, t, nullSink);
    run(s, t, nullSink, Math.min(chunk, total - done));
  }
  const bananas = N.toNumber(s.bananas) + incomeRate(s, t) * bot.terminalSeconds;
  if (s.objective.kind !== 'readiness') return bananas;
  // Readiness pinned: progress is the lowest meter, then the average; bananas only break ties.
  const m = meters(s, t);
  return minMeter(m) * 1e6 + avgMeters(m) * 1e3 + Math.min(1, bananas / 1e30);
}

export interface PurchaseRecord {
  tick: number;
  id: string;
  meaningful: boolean;
  gain: number;
}

export interface DecisionLog {
  purchases: PurchaseRecord[];
  rebalances: { tick: number; before: number; after: number }[];
  /** Budget reviews signed, with how much the lines moved (0..1, half the L1 distance). */
  reviews: { tick: number; change: number }[];
  readinessPinnedTick: number | null;
  declaredTick: number | null;
}

export function newLog(): DecisionLog {
  return { purchases: [], rebalances: [], reviews: [], readinessPinnedTick: null, declaredTick: null };
}

/** One decision. Mutates the real state. */
export function decide(s: GameState, t: Tuning, bot: BotConfig, sink: EventSink, log: DecisionLog): void {
  if (s.phase !== 'finite') return;
  if (s.stability.permit) {
    if (declareInfinity(s, t, sink)) log.declaredTick = s.tick;
    return;
  }
  upkeep(s, t, bot, sink, log);
  if (bot.manualHire) tapHire(s, t, sink);

  // Unlocks (the next stage, the next research) are bought as soon as they're
  // affordable: the game presents them as the next goal, and a casual player
  // takes the shiny next step rather than computing its payback.
  for (const c of candidates(s, t, bot)) {
    if (!c.id.includes(':stage') && !(c.id.startsWith('research:') && c.id !== 'research:typing')) continue;
    if (c.apply(s, t, sink)) {
      log.purchases.push({ tick: s.tick, id: c.id, gain: 0, meaningful: true });
      upkeep(s, t, bot, sink, log);
    }
  }

  for (let k = 0; k < bot.maxPurchasesPerDecision; k++) {
    const waitScore = score(clone(s), t, bot);
    let best: { c: Candidate; sc: number } | null = null;
    for (const c of candidates(s, t, bot)) {
      const probe = clone(s);
      if (!c.apply(probe, t, nullSink)) continue;
      const sc = score(probe, t, bot);
      if (!best || sc > best.sc) best = { c, sc };
    }
    if (!best || best.sc <= waitScore * (1 + bot.minGain)) break;
    const gain = waitScore > 0 ? best.sc / waitScore - 1 : Infinity;
    if (!best.c.apply(s, t, sink)) break;
    log.purchases.push({ tick: s.tick, id: best.c.id, gain, meaningful: best.c.unlock || gain >= 0.05 });
    upkeep(s, t, bot, sink, log);
  }

  if (allStage4(s) && s.objective.kind !== 'readiness') {
    pinObjective(s, t, sink, { kind: 'readiness' });
    log.readinessPinnedTick = s.tick;
  }
}

export interface FiniteRun {
  state: GameState;
  log: DecisionLog;
  declaredSeconds: number | null;
  milestones: Record<string, number>;
}

/** Plays the finite phase until infinity is declared or the time budget runs out. */
export function playFinite(t: Tuning, bot: BotConfig, seed: number, maxSeconds: number, sink: EventSink = nullSink, onDecision?: (s: GameState) => void): FiniteRun {
  const s = createState(t, seed);
  const log = newLog();
  const milestones: Record<string, number> = {};
  const wrapped: EventSink = (e) => {
    if (e.type === 'stageReached') milestones[e.stage] = e.tick * t.tickSeconds;
    sink(e);
  };
  const chunk = Math.round(bot.decisionSeconds / t.tickSeconds);
  const limit = Math.round(maxSeconds / t.tickSeconds);
  while (s.tick < limit && s.phase === 'finite') {
    decide(s, t, bot, wrapped, log);
    onDecision?.(s);
    if (s.phase !== 'finite') break;
    run(s, t, wrapped, chunk);
  }
  return { state: s, log, declaredSeconds: log.declaredTick === null ? null : log.declaredTick * t.tickSeconds, milestones };
}
