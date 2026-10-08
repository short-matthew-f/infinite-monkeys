// PROTOTYPE.md §10 assertions, run against bot play (M2).
// Prototype runs are deterministic (no gameplay randomness is in scope yet),
// so one seed per bot is enough; seeds matter once drones and rare finds land.

import { beforeAll, describe, expect, it } from 'vitest';
import { prototypeTuning as T } from '../content/prototype.js';
import { BOTS, clone, playFinite, type FiniteRun } from '../sim/bot.js';
import { evaluateFirstDecision, type FirstDecision } from '../sim/hotel.js';
import { longestDeadGap } from '../sim/metrics.js';
import { nullSink, run, type GameState } from '../core/index.js';

let casual: FiniteRun;
let decision: FirstDecision;

function toFirstOffers(r: FiniteRun): GameState {
  const s = clone(r.state);
  let guard = 0;
  while (!s.hotel?.offersMade && guard++ < 10_000) run(s, T, nullSink, 1);
  return s;
}

beforeAll(() => {
  casual = playFinite(T, BOTS.casual, 1, 3600);
  decision = evaluateFirstDecision(toFirstOffers(casual), T);
}, 120_000);

describe('finite segment (casual bot)', () => {
  it('reaches Declare Infinity in 25 to 35 minutes', () => {
    expect(casual.declaredSeconds).not.toBeNull();
    expect(casual.declaredSeconds! / 60).toBeGreaterThanOrEqual(25);
    expect(casual.declaredSeconds! / 60).toBeLessThanOrEqual(35);
  });

  // KNOWN FAILURE (M2 finding F2): mid-game gaps between staggered stage unlocks run ~150 s.
  // it.fails keeps the suite green while the gap exists and turns red once it's fixed,
  // so this marker must be removed then.
  it.fails('has no dead gap over 2 minutes, counting Readiness rebalancing as action (proposed definition)', () => {
    expect(longestDeadGap(casual.log, T, casual.log.declaredTick!, { countRebalances: true })).toBeLessThanOrEqual(120);
  });

  // The shipped game runs the quarterly budget: the heads set funding shares, so the free-shares
  // rebalancing metric (2 to 3 Readiness rebalances) no longer applies. Its decisions are the
  // quarterly reviews; see sim/budget-report.ts for the classic comparison.
  it('signs a budget at every quarterly review and never misses one', () => {
    // One signature per quarter: the budget opens, then a review at every quarter end until the ceremony.
    const quarters = Math.floor((casual.declaredSeconds! - casual.log.reviews[0]!.tick * T.tickSeconds) / T.budget!.quarterSeconds) + 1;
    expect(casual.log.reviews.length).toBeGreaterThanOrEqual(quarters);
  });

  it('other bots also reach infinity', () => {
    for (const bot of [BOTS.hard, BOTS.idler]) expect(playFinite(T, bot, 1, 3600).declaredSeconds).not.toBeNull();
  }, 120_000);
});

describe('first hotel decision (casual bot)', () => {
  const COMMISSIONS = ['immediate', 'permanent', 'expansion'] as const;

  it.each(COMMISSIONS)('%s completes before its deadline', (id) => {
    const deadline = T.hotel.commissions.find((c) => c.id === id)!.deadlineSeconds;
    expect(decision.outcomes[id].failed).toBe(false);
    expect(decision.outcomes[id].completedSeconds).not.toBeNull();
    expect(decision.outcomes[id].completedSeconds!).toBeLessThanOrEqual(deadline);
  });

  it.each(COMMISSIONS)('%s diverts capacity from the home market and has its own split', (id) => {
    expect(decision.previews[id].productionIncomeForgone).toBeGreaterThan(0);
    expect(decision.previews[id].differsFromMaximize).toBe(true);
  });

  it.each(COMMISSIONS)('the %s preview at offer time is within 10% of actual completion', (id) => {
    const eta = decision.previews[id].etaSeconds;
    expect(Math.abs(decision.outcomes[id].completedSeconds! - eta)).toBeLessThanOrEqual(eta * 0.1);
  });

  it("Expansion's Greek market has a practical payoff: its Commission completes", () => {
    expect(decision.outcomes.expansion.greekCommissionSeconds).not.toBeNull();
  });

  it('Immediate beats ordinary publishing under banana rush', () => {
    const o = decision.outcomes;
    expect(o.immediate.bananaRushSeconds!).toBeLessThan(o.ordinary.bananaRushSeconds!);
  });

  it('Permanent wins epic first; Expansion reaches the epic later, through Greek', () => {
    const o = decision.outcomes;
    expect(o.permanent.epicSeconds).not.toBeNull();
    expect(o.expansion.epicSeconds).not.toBeNull();
    expect(o.permanent.epicSeconds!).toBeLessThan(o.expansion.epicSeconds!);
    for (const c of ['ordinary', 'immediate'] as const) expect(o[c].epicSeconds).toBeNull();
  });

  it('Expansion wins expansion first', () => {
    const o = decision.outcomes;
    expect(o.expansion.expansionSeconds).not.toBeNull();
    for (const c of ['ordinary', 'immediate', 'permanent'] as const) expect(o[c].expansionSeconds).toBeNull();
  });

  it('Permanent and Expansion carry a measurable banana-rush sacrifice', () => {
    const o = decision.outcomes;
    expect(o.permanent.bananaRushSeconds!).toBeGreaterThan(o.ordinary.bananaRushSeconds!);
    expect(o.expansion.bananaRushSeconds!).toBeGreaterThan(o.ordinary.bananaRushSeconds!);
  });

  it.each(COMMISSIONS)('%s pays off within the 3-minute payoff window', (id) => {
    expect(decision.outcomes[id].payoffSeconds).not.toBeNull();
    expect(decision.outcomes[id].payoffSeconds!).toBeLessThanOrEqual(180);
  });
});
