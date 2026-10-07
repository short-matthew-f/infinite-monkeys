// Player actions. Each validates, mutates, and emits. Returns false (and
// changes nothing) when the action isn't allowed.

import { N, type Num } from './num.js';
import type { EventSink, Objective, Shares } from './events.js';
import { startCommission } from './commissions.js';
import {
  capability,
  deptLevelCost,
  deptStageCost,
  deskCost,
  finiteBottleneck,
  hireCooldownSeconds,
  hotelUpgradeCost,
  referenceHotelPool,
  meters,
  secondsToTicks,
  suggestMarketAllocation,
  suggestTierAllocation,
  typingResearchCost,
  reviewResearchCost,
  zenoCost,
} from './model.js';
import type { GameState, HotelUpgrade, MarketState } from './state.js';
import { DEPTS, type DeptId, type Tuning } from './tuning.js';

/** Every number crossing the action boundary must be finite and non-negative. */
const validAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function validSplit(next: Record<string, number>, keys: string[]): boolean {
  const entries = Object.entries(next);
  return entries.length > 0 && entries.every(([k, v]) => keys.includes(k) && validAmount(v)) && entries.some(([, v]) => v > 0);
}

function bottleneck(s: GameState, t: Tuning) {
  return s.phase === 'finite' ? finiteBottleneck(s, t) : 'editing';
}

function spendBananas(s: GameState, t: Tuning, sink: EventSink, item: string, cost: Num, apply: () => void): boolean {
  if (N.lt(s.bananas, cost)) return false;
  const before = bottleneck(s, t);
  s.bananas = N.sub(s.bananas, cost);
  apply();
  sink({ type: 'purchase', tick: s.tick, item, cost: N.toNumber(cost), currency: 'bananas', bottleneckBefore: before, bottleneckAfter: bottleneck(s, t) });
  // An Immediate Commission's payout counts as used at the first purchase after it lands.
  const pr = s.hotel?.pendingReward;
  if (s.hotel && pr && pr.kind === 'immediate') {
    sink({ type: 'rewardUsed', tick: s.tick, commission: pr.commission, how: `purchase ${item}` });
    s.hotel.pendingReward = null;
  }
  return true;
}

// ---------- finite phase ----------

export function tapHire(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite' || s.tick < s.hireReadyTick) return false;
  if (N.lt(N.sub(s.desks, s.monkeys), N.one)) return false;
  s.monkeys = N.add(s.monkeys, N.one);
  s.hireReadyTick = s.tick + secondsToTicks(t, hireCooldownSeconds(t, s.zenoLevel));
  sink({ type: 'hire', tick: s.tick, manual: true });
  return true;
}

export function buyDesk(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite') return false;
  return spendBananas(s, t, sink, 'desk', deskCost(s, t), () => {
    s.desks = N.add(s.desks, N.one);
    s.desksBought++;
  });
}

export function buyZeno(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite') return false;
  return spendBananas(s, t, sink, `zeno:${s.zenoLevel + 1}`, zenoCost(s, t), () => {
    s.zenoLevel++;
  });
}

/** Department levels are a finite-phase purchase; after infinity, hotel upgrades replace them. */
export function buyDeptLevel(s: GameState, t: Tuning, sink: EventSink, d: DeptId): boolean {
  if (s.phase !== 'finite') return false;
  return spendBananas(s, t, sink, `${d}:level:${s.depts[d].level + 1}`, deptLevelCost(s, t, d), () => {
    s.depts[d].level++;
  });
}

export function buyDeptStage(s: GameState, t: Tuning, sink: EventSink, d: DeptId): boolean {
  if (s.phase !== 'finite') return false;
  const cost = deptStageCost(s, t, d);
  if (cost === null) return false;
  return spendBananas(s, t, sink, `${d}:stage:${s.depts[d].stage + 1}`, cost, () => {
    s.depts[d].stage = (s.depts[d].stage + 1) as 1 | 2 | 3 | 4;
  });
}

/** Common research: faster typewriters. */
export function buyTypingResearch(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite') return false;
  return spendBananas(s, t, sink, `research:typing:${s.typingLevel + 1}`, typingResearchCost(s, t), () => {
    s.typingLevel++;
  });
}

/** Common research: review cost reduction. */
export function buyReviewResearch(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite') return false;
  return spendBananas(s, t, sink, `research:review:${s.reviewLevel + 1}`, reviewResearchCost(s, t), () => {
    s.reviewLevel++;
  });
}

/** Research that makes a tier discoverable. Discovery then accumulates on its own. */
export function researchTier(s: GameState, t: Tuning, sink: EventSink, id: string): boolean {
  const ts = s.tiers[id];
  const def = t.tiers.find((x) => x.id === id);
  if (s.phase !== 'finite' || !ts || !def || ts.discoverable) return false;
  return spendBananas(s, t, sink, `research:${id}`, N.of(def.researchCost), () => {
    ts.discoverable = true;
  });
}

/** Funding shares are free to change. Shares must be non-negative and sum to 1. */
export function setShares(s: GameState, t: Tuning, sink: EventSink, next: Shares): boolean {
  const vals = DEPTS.map((d) => next[d]);
  if (!vals.every(validAmount) || Math.abs(vals.reduce((a, b) => a + b, 0) - 1) > 1e-6) return false;
  const previous = { ...s.shares };
  s.shares = { ...next };
  sink({ type: 'fundingChanged', tick: s.tick, previous, next: { ...next }, meters: meters(s, t) });
  return true;
}

export function setTierAllocation(s: GameState, t: Tuning, sink: EventSink, next: Record<string, number>): boolean {
  if (s.phase !== 'finite' || !validSplit(next, t.tiers.map((x) => x.id))) return false;
  const previous = { ...s.tierAllocation };
  s.tierAllocation = { ...previous, ...next };
  sink({ type: 'allocationChanged', tick: s.tick, layer: 'tiers', previous, next: { ...s.tierAllocation }, suggested: suggestTierAllocation(s, t), objective: s.objective });
  return true;
}

export function setMarketAllocation(s: GameState, t: Tuning, sink: EventSink, next: Record<string, number>): boolean {
  const h = s.hotel;
  if (!h || !validSplit(next, Object.keys(h.markets))) return false;
  const previous = { ...h.allocation };
  h.allocation = { ...previous, ...next };
  sink({ type: 'allocationChanged', tick: s.tick, layer: 'markets', previous, next: { ...h.allocation }, suggested: suggestMarketAllocation(s, t, s.objective), objective: s.objective });
  return true;
}

/** One tap: adopt the suggested split for the pinned objective. */
export function applySuggestedAllocation(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase === 'finite') return setTierAllocation(s, t, sink, suggestTierAllocation(s, t));
  return setMarketAllocation(s, t, sink, suggestMarketAllocation(s, t, s.objective));
}

/** One objective is pinned at a time. Pinning a Commission starts it (its deadline runs from first pin). */
export function pinObjective(s: GameState, t: Tuning, sink: EventSink, objective: Objective): boolean {
  if (objective.kind === 'commission') {
    if (s.phase !== 'hotel' || !startCommission(s, t, objective.id)) return false;
  }
  if (objective.kind === 'readiness' && s.phase !== 'finite') return false;
  const previous = s.objective;
  s.objective = objective;
  sink({ type: 'objectivePinned', tick: s.tick, objective, previous });
  return true;
}

/** Game layer reports preview views; core only records them. */
export function recordPreview(s: GameState, sink: EventSink, screen: string, item: string): void {
  sink({ type: 'previewOpened', tick: s.tick, screen, item });
}

// ---------- the ceremony ----------



export function declareInfinity(s: GameState, t: Tuning, sink: EventSink): boolean {
  if (s.phase !== 'finite' || !s.stability.permit) return false;
  const markets: Record<string, MarketState> = {};
  const allocation: Record<string, number> = {};
  for (const m of t.hotel.markets) {
    markets[m.id] = { status: 'locked', workLeft: 0, fromCommission: null };
    allocation[m.id] = 0;
  }
  const home = markets[t.hotel.homeMarket];
  if (!home) throw new Error('home market missing from tuning');
  home.status = 'online';
  allocation[t.hotel.homeMarket] = 1;

  // Priced from the reference pool, so funding at declaration can't make upgrades cheap.
  const pool = referenceHotelPool(s, t);
  const homeDef = t.hotel.markets.find((m) => m.id === t.hotel.homeMarket)!;
  const homeIncome = N.mul(N.div(pool, homeDef.reviewCost), homeDef.value);
  s.hotel = {
    markets,
    allocation,
    commissions: {},
    offersMade: false,
    upgradeLevels: { editors: 0, busWranglers: 0, shiftCrews: 0 },
    upgradeCostBase: N.mul(homeIncome, t.hotel.upgrades.costSeconds),
    declareCapability: {
      recruiting: N.toNumber(capability(s, t, 'recruiting')),
      construction: N.toNumber(capability(s, t, 'construction')),
    },
    pendingReward: null,
  };
  s.phase = 'hotel';
  s.objective = { kind: 'bananas' };
  sink({ type: 'infinityDeclared', tick: s.tick });
  sink({ type: 'titleFlipped', tick: s.tick, from: 'Builder', to: 'Shift Crew' });
  sink({ type: 'titleFlipped', tick: s.tick, from: 'Recruiter', to: 'Bus Wrangler' });
  sink({ type: 'stageReached', tick: s.tick, stage: 'aleph0' });

  // The ceremony grants access to the first new market; its bus is already on the way.
  const first = markets[t.hotel.ceremonyMarket];
  if (!first) throw new Error('ceremony market missing from tuning');
  first.status = 'inTransit';
  first.workLeft = t.hotel.busWaitSeconds;
  return true;
}

/** Hotel upgrades: Editors (capacity), Bus Wranglers (bus wait), Shift Crews (onboarding). */
export function buyHotelUpgrade(s: GameState, t: Tuning, sink: EventSink, line: HotelUpgrade): boolean {
  const h = s.hotel;
  const cost = hotelUpgradeCost(s, t, line);
  if (!h || cost === null) return false;
  return spendBananas(s, t, sink, `hotel:${line}:${h.upgradeLevels[line] + 1}`, cost, () => {
    h.upgradeLevels[line]++;
  });
}

// ---------- epic research ----------

export function buyEpic(s: GameState, t: Tuning, sink: EventSink, id: string): boolean {
  const def = t.epics.find((e) => e.id === id);
  if (!def || s.save.epics.includes(id) || s.save.golden < def.cost) return false;
  const before = bottleneck(s, t);
  s.save.golden -= def.cost;
  s.save.epics.push(id);
  sink({ type: 'purchase', tick: s.tick, item: `epic:${id}`, cost: def.cost, currency: 'golden', bottleneckBefore: before, bottleneckAfter: bottleneck(s, t) });
  const pr = s.hotel?.pendingReward;
  if (s.hotel && pr && pr.kind === 'permanent') {
    sink({ type: 'rewardUsed', tick: s.tick, commission: pr.commission, how: `epic ${id}` });
    s.hotel.pendingReward = null;
  }
  return true;
}
