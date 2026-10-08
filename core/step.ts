import { N } from './num.js';
import type { EventSink } from './events.js';
import { isComplete, offerCommission, rewardData } from './commissions.js';
import {
  bestHotelIncome,
  busSpeed,
  onboardSpeed,
  certifyMarkets,
  certifyTiers,
  deptOutput,
  editingPool,
  editorInChiefSplit,
  hotelPool,
  meters,
  metersFull,
  secondsToTicks,
} from './model.js';
import type { GameState } from './state.js';
import { activeBudget, autoBuy, headShares, maybeRequisition, bankIncome, maybeEndQuarter, maybeOpenBudget } from './budget.js';
import { DEPTS, type Tuning } from './tuning.js';

/** Advances the game by exactly one tick. The only way time passes in core. */
export function step(s: GameState, t: Tuning, sink: EventSink): void {
  if (s.phase === 'finite') stepFinite(s, t, sink);
  else stepHotel(s, t, sink);
  s.tick++;
}

/** Runs `ticks` ticks. */
export function run(s: GameState, t: Tuning, sink: EventSink, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(s, t, sink);
}

/**
 * Offline catch-up: the same tick function the live game uses, capped by the
 * offline allowance (Break Room). Equivalence with continuous play is by
 * construction and asserted in tests.
 */
export function catchUp(s: GameState, t: Tuning, sink: EventSink, elapsedSeconds: number): number {
  const ticks = Math.floor(Math.max(0, Math.min(elapsedSeconds, t.offlineCapSeconds)) / t.tickSeconds);
  run(s, t, sink, ticks);
  return ticks;
}

function stepFinite(s: GameState, t: Tuning, sink: EventSink): void {
  const dt = t.tickSeconds;
  maybeOpenBudget(s, t, sink);
  const b = activeBudget(s, t);
  // Budget mode: the heads coordinate how hard each department works.
  if (b) s.shares = headShares(s, t);

  // Recruiting fills free desks; anything beyond waits in the lobby (waste).
  const free = N.max(N.zero, N.sub(s.desks, s.monkeys));
  const hires = N.min(N.mul(deptOutput(s, t, 'recruiting'), dt), free);
  s.monkeys = N.add(s.monkeys, hires);
  if (b) b.stats.hires += N.toNumber(hires);

  // Construction builds up to a buffer above headcount; beyond that is empty floors (waste).
  const buffer = Math.max(t.desks.constructionBufferMin, N.toNumber(s.monkeys) * t.desks.constructionBufferFrac);
  const room = N.max(N.zero, N.sub(N.add(s.monkeys, N.of(buffer)), s.desks));
  const built = N.min(N.mul(deptOutput(s, t, 'construction'), dt), room);
  s.desks = N.add(s.desks, built);
  if (b) b.stats.desksBuilt += N.toNumber(built);

  // Discovery: the Editor-in-Chief's review of undiscovered tiers accumulates deterministically.
  const eic = editorInChiefSplit(s, t);
  for (const [id, rate] of Object.entries(eic.discovery)) {
    const ts = s.tiers[id];
    if (!ts) continue;
    ts.acc += N.toNumber(rate) * dt;
    if (ts.acc >= 1 && !ts.discovered) discoverTier(s, t, id, sink);
  }

  // Certification and income.
  const cert = certifyTiers(s, t, editingPool(s, t), s.tierAllocation);
  if (b) {
    // Budget: income splits by the signed lines; departments then buy their own levels.
    bankIncome(s, b, N.mul(cert.income, dt));
    b.stats.certifiedFinds += N.toNumber(N.sum(Object.values(cert.certified))) * dt;
    b.stats.discardedFinds += N.toNumber(cert.discarded) * dt;
    autoBuy(s, t, b, sink);
    maybeRequisition(s, t, b, sink);
  } else {
    s.bananas = N.add(s.bananas, N.mul(cert.income, dt));
  }

  // Self-replication at stage 4.
  for (const d of DEPTS) {
    const st = s.depts[d];
    if (st.stage === 4 && st.level > 0) st.rep *= 1 + t.depts[d].selfRepRate * dt;
  }

  // Milestones.
  for (const m of t.milestones) {
    if (!s.milestonesReached.includes(m.id) && N.gte(s.desks, N.of(m.desks))) {
      s.milestonesReached.push(m.id);
      sink({ type: 'stageReached', tick: s.tick, stage: m.id });
    }
  }

  if (b) maybeEndQuarter(s, t, b, sink);

  // Infinity Readiness: the Stability Window needs all meters full continuously.
  if (!s.stability.permit) {
    if (metersFull(meters(s, t))) {
      s.stability.heldTicks++;
      if (s.stability.heldTicks >= secondsToTicks(t, t.readiness.stabilitySeconds)) {
        s.stability.permit = true;
        sink({ type: 'permitStamped', tick: s.tick });
      }
    } else {
      s.stability.heldTicks = 0;
    }
  }
}

function discoverTier(s: GameState, t: Tuning, id: string, sink: EventSink): void {
  const ts = s.tiers[id];
  const def = t.tiers.find((x) => x.id === id);
  if (!ts || !def) return;
  ts.discovered = true;
  // Discovery rewards are once per save, so resets can't farm them.
  let bananas = 0, golden = 0;
  if (!s.save.discoveryRewardsClaimed.includes(id)) {
    s.save.discoveryRewardsClaimed.push(id);
    bananas = def.discoveryBananas;
    golden = def.discoveryGolden;
    s.bananas = N.add(s.bananas, N.of(bananas));
    s.save.golden += golden;
  }
  sink({ type: 'tierDiscovered', tick: s.tick, tier: id, bananas, golden });
}

function stepHotel(s: GameState, t: Tuning, sink: EventSink): void {
  const h = s.hotel;
  if (!h) return;
  const dt = t.tickSeconds;

  // Unlock chain: access → bus in transit → Shift Crews onboarding → online.
  // Work is spent at the current speed every tick, so upgrades and funding
  // changes affect jobs already underway.
  const bus = busSpeed(s, t);
  const onboard = onboardSpeed(s, t);
  for (const [id, m] of Object.entries(h.markets)) {
    if (m.status === 'inTransit') {
      m.workLeft -= dt * bus;
      if (m.workLeft <= 1e-9) {
        m.status = 'onboarding';
        m.workLeft = t.hotel.onboardingSeconds;
        sink({ type: 'busArrived', tick: s.tick, market: id });
        // The first bus arrives alongside the opening Commission offers.
        if (!h.offersMade) {
          h.offersMade = true;
          for (const def of t.hotel.commissions) if (!def.offerWhen) offerCommission(s, t, def, sink);
        }
      }
    } else if (m.status === 'onboarding') {
      m.workLeft -= dt * onboard;
      if (m.workLeft <= 1e-9) {
        m.status = 'online';
        m.workLeft = 0;
        sink({ type: 'marketOnline', tick: s.tick, market: id });
        if (m.fromCommission && h.pendingReward?.commission === m.fromCommission) {
          sink({ type: 'rewardUsed', tick: s.tick, commission: m.fromCommission, how: `market ${id} online` });
          h.pendingReward = null;
        }
        for (const def of t.hotel.commissions) {
          if (def.offerWhen?.marketOnline === id && !h.commissions[def.id]) offerCommission(s, t, def, sink);
        }
      }
    }
  }

  // Certification and income.
  const pool = hotelPool(s, t);
  const cert = certifyMarkets(s, t, pool, h.allocation);
  s.bananas = N.add(s.bananas, N.mul(cert.income, dt));
  const forgone = N.mul(N.max(N.zero, N.sub(bestHotelIncome(s, t, pool), cert.income)), dt);

  // Only the pinned Commission receives deliveries.
  if (s.objective.kind === 'commission') {
    const c = h.commissions[s.objective.id];
    if (c && c.status === 'active') {
      for (const m of Object.keys(c.required)) {
        const req = c.required[m] ?? N.zero;
        const have = c.delivered[m] ?? N.zero;
        c.delivered[m] = N.min(req, N.add(have, N.mul(cert.certified[m] ?? N.zero, dt)));
      }
      c.productionIncomeForgone = N.add(c.productionIncomeForgone, forgone);
      if (isComplete(c)) completeCommission(s, t, c.id, sink);
    }
  }

  // Deadlines run from first pin, pinned or not.
  for (const c of Object.values(h.commissions)) {
    if (c.status === 'active' && c.deadlineTick !== null && s.tick >= c.deadlineTick && !isComplete(c)) {
      c.status = 'failed';
      sink({ type: 'commissionFailed', tick: s.tick, id: c.id });
    }
  }
}

function completeCommission(s: GameState, t: Tuning, id: string, sink: EventSink): void {
  const h = s.hotel;
  const c = h?.commissions[id];
  if (!h || !c) return;
  c.status = 'completed';
  if (c.reward.bananas !== null) s.bananas = N.add(s.bananas, c.reward.bananas);
  if (c.reward.golden !== null) s.save.golden += c.reward.golden;
  if (c.reward.market !== null) {
    const m = h.markets[c.reward.market];
    if (m && m.status === 'locked') {
      m.status = 'inTransit';
      m.workLeft = t.hotel.busWaitSeconds;
      m.fromCommission = id;
    }
  }
  h.pendingReward = { commission: id, kind: c.kind };
  sink({
    type: 'commissionCompleted',
    tick: s.tick,
    id,
    kind: c.kind,
    ticksTaken: s.tick - (c.startedTick ?? s.tick),
    productionIncomeForgone: N.toNumber(c.productionIncomeForgone),
    reward: rewardData(c.reward),
  });
}
