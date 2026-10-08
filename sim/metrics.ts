// Metric definitions (DESIGN.md §10).

import type { DecisionLog } from './bot.js';
import type { Tuning } from '../core/index.js';

/**
 * Longest gap between meaningful purchases, in seconds.
 * Meaningful: an unlock (stage, research, a department's first level), or a
 * purchase the bot valued at least 5% above waiting.
 */
export function longestDeadGap(log: DecisionLog, t: Tuning, untilTick: number, opts: { countRebalances?: boolean; countReviews?: number; countRequisitions?: boolean } = {}): number {
  // Budget mode: answering a head's requisition is a decision whatever its size, when asked.
  const ticks = log.purchases.filter((p) => (p.meaningful || (opts.countRequisitions && p.id === 'requisition')) && p.tick <= untilTick).map((p) => p.tick);
  // Budget mode: a review counts as action only when the signed lines moved by at least this much.
  // Department auto-buys never count (they aren't player decisions and aren't in the log).
  if (opts.countReviews !== undefined) for (const r of log.reviews) if (r.change >= opts.countReviews && r.tick <= untilTick) ticks.push(r.tick);
  // Proposed (M2): a Readiness rebalancing episode is a meaningful action too.
  if (opts.countRebalances) for (const r of readinessRebalances(log)) if (r.tick <= untilTick) ticks.push(r.tick);
  ticks.sort((a, b) => a - b);
  if (Number.isFinite(untilTick)) ticks.push(untilTick); // the stretch before the segment ends counts too
  let worst = 0;
  for (let i = 1; i < ticks.length; i++) worst = Math.max(worst, (ticks[i]! - ticks[i - 1]!) * t.tickSeconds);
  return worst;
}

/** Rebalances during Readiness (pinned → declared). */
export function readinessRebalances(log: DecisionLog) {
  const from = log.readinessPinnedTick ?? Infinity;
  const to = log.declaredTick ?? Infinity;
  return log.rebalances.filter((r) => r.tick >= from && r.tick <= to);
}

/**
 * Rebalancing decisions as currently defined (DESIGN.md §10): a funding change
 * that improves progress toward the objective (Readiness: the lowest meter)
 * by at least Y (10%).
 */
export function rebalancingDecisionsY(log: DecisionLog, y = 0.1): number {
  return readinessRebalances(log).filter((r) => r.after >= r.before * (1 + y)).length;
}

/**
 * Proposed alternative: every rebalance made because a meter had dropped
 * below full (a rebalancing episode), whatever its size.
 */
export function rebalancingEpisodes(log: DecisionLog): number {
  return readinessRebalances(log).length;
}
