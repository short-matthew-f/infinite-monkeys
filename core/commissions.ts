import { N, type Num } from './num.js';
import type { EventSink, FrozenRewardData } from './events.js';
import { marketCost, previewCommission, referenceHotelPool, secondsToTicks } from './model.js';
import type { CommissionState, FrozenReward, GameState } from './state.js';
import type { CommissionDef, Tuning } from './tuning.js';

export function rewardData(r: FrozenReward): FrozenRewardData {
  const out: FrozenRewardData = {};
  if (r.bananas !== null) out.bananas = N.toNumber(r.bananas);
  if (r.golden !== null) out.golden = r.golden;
  if (r.market !== null) out.market = r.market;
  return out;
}

/**
 * Offers a Commission. Requirements are converted from capacity-minutes to
 * fixed delivery counts using capacity at this moment, and the reward is
 * frozen too. Later upgrades shorten completion; they never move the target.
 */
export function offerCommission(s: GameState, t: Tuning, def: CommissionDef, sink: EventSink): void {
  if (!s.hotel) throw new Error('commissions require the hotel phase');
  // Frozen against the reference pool (owned capability at the reference
  // funding share), so funding at offer time can't shrink the target.
  const pool = referenceHotelPool(s, t);
  const required: Record<string, Num> = {};
  const delivered: Record<string, Num> = {};
  for (const r of def.requirements) {
    required[r.market] = N.ceil(N.div(N.mul(pool, r.capacityMinutes * 60), marketCost(s, t, r.market)));
    delivered[r.market] = N.zero;
  }
  const c: CommissionState = {
    id: def.id,
    kind: def.kind,
    status: 'offered',
    required,
    delivered,
    reward: { bananas: null, golden: null, market: null },
    offeredTick: s.tick,
    startedTick: null,
    deadlineTick: null,
    productionIncomeForgone: N.zero,
  };
  s.hotel.commissions[def.id] = c;

  if (def.reward.type === 'bananas') {
    const p = previewCommission(s, t, def.id, pool);
    c.reward.bananas = N.of((p?.productionIncomeForgone ?? 0) * def.reward.forgoneMultiplier);
  } else if (def.reward.type === 'golden') {
    c.reward.golden = def.reward.amount;
  } else {
    c.reward.market = def.reward.market;
  }

  const deliveries: Record<string, number> = {};
  for (const [m, n] of Object.entries(required)) deliveries[m] = N.toNumber(n);
  sink({ type: 'commissionOffered', tick: s.tick, id: def.id, kind: def.kind, deliveries, reward: rewardData(c.reward), deadlineSeconds: def.deadlineSeconds });
}

export function startCommission(s: GameState, t: Tuning, id: string): boolean {
  const c = s.hotel?.commissions[id];
  const def = t.hotel.commissions.find((d) => d.id === id);
  if (!c || !def) return false;
  if (c.status === 'offered') {
    c.status = 'active';
    c.startedTick = s.tick;
    c.deadlineTick = s.tick + secondsToTicks(t, def.deadlineSeconds);
  }
  return c.status === 'active';
}

export function isComplete(c: CommissionState): boolean {
  return Object.entries(c.required).every(([m, req]) => N.gte(c.delivered[m] ?? N.zero, req));
}
