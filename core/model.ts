// Pure derived quantities: rates, capacity, certification, allocation,
// meters, previews. No state mutation here.

import { N, type Num } from './num.js';
import type { Bottleneck, Meters, Objective } from './events.js';
import type { CommissionState, GameState, HotelUpgrade } from './state.js';
import { DEPTS, type DeptId, type Tuning } from './tuning.js';

// ---------- epics ----------

export function hasEpic(s: GameState, id: string): boolean {
  return s.save.epics.includes(id);
}

function epicMult(s: GameState, t: Tuning, pick: (e: Tuning['epics'][number]['effect']) => number | null): number {
  let m = 1;
  for (const e of t.epics) {
    if (!hasEpic(s, e.id)) continue;
    const v = pick(e.effect);
    if (v !== null) m *= v;
  }
  return m;
}

export const reviewSpeedMult = (s: GameState, t: Tuning) => epicMult(s, t, (e) => (e.type === 'reviewSpeed' ? e.mult : null));
export const onboardingMult = (s: GameState, t: Tuning) => epicMult(s, t, (e) => (e.type === 'onboardingTime' ? e.mult : null));
export const marketCostMult = (s: GameState, t: Tuning, market: string) =>
  epicMult(s, t, (e) => (e.type === 'marketReviewCost' && e.market === market ? e.mult : null));

// ---------- departments ----------

export function fundingEffect(t: Tuning, share: number): number {
  return share * t.fundingScale;
}

/** Permanent capability, independent of funding (units/s). */
export function capability(s: GameState, t: Tuning, d: DeptId): Num {
  const def = t.depts[d];
  const st = s.depts[d];
  return N.of(st.level * def.perLevel * (def.stageMult[st.stage - 1] ?? 1) * st.rep);
}

/** Effective output = capability × funding effect. */
export function deptOutput(s: GameState, t: Tuning, d: DeptId): Num {
  return N.mul(capability(s, t, d), fundingEffect(t, s.shares[d]));
}

export function deptLevelCost(s: GameState, t: Tuning, d: DeptId): Num {
  const def = t.depts[d];
  return N.mul(N.pow(def.levelCostGrowth, s.depts[d].level), def.levelCostBase);
}

export function deptStageCost(s: GameState, t: Tuning, d: DeptId): Num | null {
  const st = s.depts[d].stage;
  if (st >= 4) return null;
  return N.of(t.depts[d].stageCosts[st - 1] as number);
}

export function deskCost(s: GameState, t: Tuning): Num {
  return N.mul(N.pow(t.desks.costGrowth, s.desksBought), t.desks.costBase);
}

export function zenoCost(s: GameState, t: Tuning): Num {
  return N.mul(N.pow(t.hire.zenoCostGrowth, s.zenoLevel), t.hire.zenoCostBase);
}

/** Zeno's cooldown: halves per level, approaches zero, never reaches it. */
export function hireCooldownSeconds(t: Tuning, zenoLevel: number): number {
  return t.hire.baseCooldownSeconds / 2 ** zenoLevel;
}

// ---------- finite production ----------

export function keystrokeRate(s: GameState, t: Tuning): Num {
  return N.mul(s.monkeys, t.typingSpeed * t.typingResearch.mult ** s.typingLevel);
}

/** Review cost of a tier after review research (tier ordering is unaffected: the multiplier is uniform). */
export function tierCost(s: GameState, t: Tuning, tier: { reviewCost: number }): number {
  return tier.reviewCost * t.reviewResearch.mult ** s.reviewLevel;
}

export function reviewResearchCost(s: GameState, t: Tuning): Num {
  return N.mul(N.pow(t.reviewResearch.costGrowth, s.reviewLevel), t.reviewResearch.costBase);
}

export function typingResearchCost(s: GameState, t: Tuning): Num {
  return N.mul(N.pow(t.typingResearch.costGrowth, s.typingLevel), t.typingResearch.costBase);
}

/** Hired editing capacity (review units/s), excluding the Editor-in-Chief. */
export function hiredEditingCapacity(s: GameState, t: Tuning): Num {
  const hotelMult = s.hotel ? t.hotel.upgrades.editingMult ** s.hotel.upgradeLevels.editors : 1;
  return N.mul(deptOutput(s, t, 'editing'), t.reviewSpeedPerEditor * reviewSpeedMult(s, t) * hotelMult);
}

export function hotelUpgradeCost(s: GameState, t: Tuning, line: HotelUpgrade): Num | null {
  if (!s.hotel) return null;
  return N.mul(s.hotel.upgradeCostBase, t.hotel.upgrades.costGrowth ** s.hotel.upgradeLevels[line]);
}

export function findRates(s: GameState, t: Tuning): Record<string, Num> {
  const ks = keystrokeRate(s, t);
  const out: Record<string, Num> = {};
  for (const tier of t.tiers) out[tier.id] = N.mul(ks, tier.p);
  return out;
}

export interface EicSplit {
  /** Certified finds/s going to each discoverable-but-undiscovered tier. */
  discovery: Record<string, Num>;
  /** Baseline capacity left over for normal production. */
  leftover: Num;
}

/** The Editor-in-Chief reviews discoverable-but-undiscovered tiers first, lowest tier first. */
export function editorInChiefSplit(s: GameState, t: Tuning): EicSplit {
  let remaining = N.of(t.editorInChiefCapacity * reviewSpeedMult(s, t));
  const discovery: Record<string, Num> = {};
  if (s.phase === 'finite') {
    const finds = findRates(s, t);
    for (const tier of t.tiers) {
      const ts = s.tiers[tier.id];
      if (!ts || !ts.discoverable || ts.discovered) continue;
      const need = N.mul(finds[tier.id] ?? N.zero, tierCost(s, t, tier));
      const used = N.min(need, remaining);
      discovery[tier.id] = N.div(used, tierCost(s, t, tier));
      remaining = N.sub(remaining, used);
    }
  }
  return { discovery, leftover: remaining };
}

/** Capacity available for allocation (hired Editors + Editor-in-Chief leftover). */
export function editingPool(s: GameState, t: Tuning): Num {
  return N.add(hiredEditingCapacity(s, t), editorInChiefSplit(s, t).leftover);
}

export interface Certification {
  certified: Record<string, Num>;
  income: Num;
  /** Review units needed to certify every available find. */
  demand: Num;
  idle: Num;
  discarded: Num;
}

function normalized(alloc: Record<string, number>, keys: string[]): Record<string, number> {
  let sum = 0;
  for (const k of keys) sum += Math.max(0, alloc[k] ?? 0);
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = sum > 0 ? Math.max(0, alloc[k] ?? 0) / sum : 0;
  return out;
}

export function discoveredTiers(s: GameState, t: Tuning) {
  return t.tiers.filter((x) => s.tiers[x.id]?.discovered);
}

export function certifyTiers(s: GameState, t: Tuning, pool: Num, alloc: Record<string, number>): Certification {
  const tiers = discoveredTiers(s, t);
  const a = normalized(alloc, tiers.map((x) => x.id));
  const finds = findRates(s, t);
  const certified: Record<string, Num> = {};
  let income = N.zero, demand = N.zero, idle = N.zero, discarded = N.zero;
  for (const tier of tiers) {
    const f = finds[tier.id] ?? N.zero;
    const cap = N.div(N.mul(pool, a[tier.id] ?? 0), tierCost(s, t, tier));
    const c = N.min(f, cap);
    certified[tier.id] = c;
    income = N.add(income, N.mul(c, tier.value));
    demand = N.add(demand, N.mul(f, tierCost(s, t, tier)));
    idle = N.add(idle, N.mul(N.sub(cap, c), tierCost(s, t, tier)));
    discarded = N.add(discarded, N.sub(f, c));
  }
  return { certified, income, demand, idle, discarded };
}

/**
 * Suggested split for Maximize bananas (finite phase). Fractional-knapsack
 * water-fill: fill tiers in order of value per review unit until each is
 * saturated by its find rate. Optimal for this objective.
 */
export function suggestTierAllocation(s: GameState, t: Tuning): Record<string, number> {
  const tiers = [...discoveredTiers(s, t)].sort((x, y) => y.value / y.reviewCost - x.value / x.reviewCost);
  const pool = editingPool(s, t);
  const finds = findRates(s, t);
  const out: Record<string, number> = {};
  for (const tier of t.tiers) out[tier.id] = 0;
  if (tiers.length === 0) return out;
  if (N.lte(pool, N.zero)) {
    out[(tiers[0] as (typeof tiers)[number]).id] = 1;
    return out;
  }
  let remaining = pool;
  for (const tier of tiers) {
    const need = N.mul(finds[tier.id] ?? N.zero, tierCost(s, t, tier));
    const take = N.min(need, remaining);
    out[tier.id] = N.ratio(take, pool);
    remaining = N.sub(remaining, take);
  }
  // Leftover capacity is idle wherever it goes; park it on the best tier.
  if (N.gt(remaining, N.zero)) {
    const best = (tiers[0] as (typeof tiers)[number]).id;
    out[best] = (out[best] ?? 0) + N.ratio(remaining, pool);
  }
  return out;
}

export function finiteBottleneck(s: GameState, t: Tuning): Bottleneck {
  const c = certifyTiers(s, t, editingPool(s, t), s.tierAllocation);
  return N.gt(c.demand, editingPool(s, t)) ? 'editing' : 'typing';
}

// ---------- readiness ----------

/**
 * Meters (0..1). Full requires: stage 4, output keeping pace with the other
 * departments (within the ratio threshold), and enough scale.
 * Recruiting vs Construction are compared with each other; Editing is
 * compared with the review demand of all discovered finds.
 */
export function meters(s: GameState, t: Tuning): Meters {
  const R = deptOutput(s, t, 'recruiting');
  const C = deptOutput(s, t, 'construction');
  const pool = N.add(hiredEditingCapacity(s, t), N.of(t.editorInChiefCapacity * reviewSpeedMult(s, t)));
  const demand = certifyTiers(s, t, N.zero, s.tierAllocation).demand;
  const th = t.readiness.ratioThreshold;
  const scale = Math.min(1, N.log10(s.monkeys) / Math.log10(t.readiness.minMonkeys));
  const pace = (num: Num, den: Num) => (N.lte(den, N.zero) ? (N.gt(num, N.zero) ? 1 : 0) : Math.min(1, N.ratio(num, den) / th));
  const stage = (d: DeptId) => s.depts[d].stage / 4;
  return {
    recruiting: stage('recruiting') * pace(R, C) * scale,
    construction: stage('construction') * pace(C, R) * scale,
    editing: stage('editing') * pace(pool, demand) * scale,
  };
}

export function metersFull(m: Meters): boolean {
  return DEPTS.every((d) => m[d] >= 1 - 1e-9);
}

/**
 * Suggested funding shares: cover editing demand first, then split the rest
 * so Recruiting and Construction keep pace with each other.
 */
export function suggestShares(s: GameState, t: Tuning): Record<DeptId, number> {
  if (s.phase === 'hotel') return suggestHotelShares(s, t);
  const aR = N.toNumber(capability(s, t, 'recruiting'));
  const aC = N.toNumber(capability(s, t, 'construction'));
  const aE = N.toNumber(capability(s, t, 'editing')) * t.reviewSpeedPerEditor * reviewSpeedMult(s, t);
  const demand = N.toNumber(certifyTiers(s, t, N.zero, s.tierAllocation).demand);
  // Editing is "keeping pace" when pool >= threshold × demand. The suggestion
  // aims at full demand, leaving headroom above the threshold so the meter
  // doesn't drop the moment demand grows.
  const need = Math.max(0, demand - t.editorInChiefCapacity * reviewSpeedMult(s, t));
  // Editing gets what covers demand, capped so growth is never starved.
  let e = aE > 0 ? Math.min(t.suggestedEditingShareCap, need / (aE * t.fundingScale)) : 0;
  if (aR + aC === 0) e = aE > 0 ? 1 : 1 / 3;
  const rest = 1 - e;
  // Balance Recruiting against Construction only when both exist; a department
  // with no capability gets no share (desks can still be bought by hand).
  let r: number;
  if (aR > 0 && aC > 0) r = (rest * aC) / (aR + aC);
  else if (aR > 0) r = rest;
  else if (aC > 0) r = 0;
  else r = rest / 2;
  return { recruiting: r, construction: rest - r, editing: e };
}

// ---------- hotel ----------

export function marketDef(t: Tuning, id: string) {
  const m = t.hotel.markets.find((x) => x.id === id);
  if (!m) throw new Error(`unknown market ${id}`);
  return m;
}

export function marketCost(s: GameState, t: Tuning, id: string): number {
  return marketDef(t, id).reviewCost * marketCostMult(s, t, id);
}

export function onlineMarkets(s: GameState): string[] {
  if (!s.hotel) return [];
  return Object.entries(s.hotel.markets).filter(([, m]) => m.status === 'online').map(([id]) => id);
}

export function certifyMarkets(s: GameState, t: Tuning, pool: Num, alloc: Record<string, number>): { certified: Record<string, Num>; income: Num } {
  const certified: Record<string, Num> = {};
  let income = N.zero;
  const online = new Set(onlineMarkets(s));
  const keys = Object.keys(s.hotel?.markets ?? {});
  const a = normalized(alloc, keys);
  for (const id of keys) {
    // Capacity allocated to a market that isn't online yet produces nothing.
    const c = online.has(id) ? N.div(N.mul(pool, a[id] ?? 0), marketCost(s, t, id)) : N.zero;
    certified[id] = c;
    income = N.add(income, N.mul(c, marketDef(t, id).value));
  }
  return { certified, income };
}

export function bestMarket(s: GameState, t: Tuning, candidates = onlineMarkets(s)): string | null {
  let best: string | null = null;
  let bestRatio = -1;
  for (const id of candidates) {
    const r = marketDef(t, id).value / marketCost(s, t, id);
    if (r > bestRatio) {
      bestRatio = r;
      best = id;
    }
  }
  return best;
}

export function bestHotelIncome(s: GameState, t: Tuning, pool: Num): Num {
  const best = bestMarket(s, t);
  if (!best) return N.zero;
  return N.mul(N.div(pool, marketCost(s, t, best)), marketDef(t, best).value);
}

function remaining(c: CommissionState): Record<string, Num> {
  const out: Record<string, Num> = {};
  for (const [m, req] of Object.entries(c.required)) out[m] = N.max(N.zero, N.sub(req, c.delivered[m] ?? N.zero));
  return out;
}

/**
 * Suggested market split for an objective.
 * - Maximize bananas: everything to the best online market.
 * - A Commission: fastest completion. Capacity is split in proportion to
 *   remaining review work per market, so all requirements finish together.
 *
 * `live` (default): only markets that are online right now receive capacity;
 * a required market still in transit or onboarding gets nothing until it
 * comes online, so no capacity is wasted. Re-apply when a market comes
 * online (the game prompts; bots re-apply on `marketOnline`).
 * `planned`: treats every unlocked required market as online. Used for
 * previews and for freezing rewards at offer time.
 */
export function suggestMarketAllocation(s: GameState, t: Tuning, objective: Objective, mode: 'live' | 'planned' = 'live'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(s.hotel?.markets ?? {})) out[id] = 0;
  if (objective.kind === 'commission' && s.hotel) {
    const c = s.hotel.commissions[objective.id];
    if (c && (c.status === 'offered' || c.status === 'active')) {
      const usable = (m: string) => {
        const st = s.hotel?.markets[m]?.status;
        return mode === 'live' ? st === 'online' : st !== undefined && st !== 'locked';
      };
      const rem = Object.entries(remaining(c)).filter(([m, r]) => N.toNumber(r) > 0 && usable(m));
      let total = 0;
      for (const [m, r] of rem) total += N.toNumber(r) * marketCost(s, t, m);
      if (total > 0) {
        for (const [m, r] of rem) out[m] = (N.toNumber(r) * marketCost(s, t, m)) / total;
        return out;
      }
    }
  }
  const best = bestMarket(s, t);
  if (best) out[best] = 1;
  return out;
}

/** Hotel pool: hired Editors plus the full Editor-in-Chief baseline. */
export function hotelPool(s: GameState, t: Tuning): Num {
  return N.add(hiredEditingCapacity(s, t), N.of(t.editorInChiefCapacity * reviewSpeedMult(s, t)));
}

/**
 * Reference hotel pool: owned editorial capability at the reference funding
 * share (the suggested idle Editing share). Used to freeze Commission
 * requirements and rewards and to price hotel upgrades, so moving funding
 * around before an offer or the ceremony changes nothing.
 */
export function referenceHotelPool(s: GameState, t: Tuning): Num {
  return poolAtEditingShare(s, t, t.hotel.funding.referenceEditing);
}

/** Pool under the suggested idle funding: what previews assume once every required market is online. */
export function suggestedIdlePool(s: GameState, t: Tuning): Num {
  return poolAtEditingShare(s, t, t.hotel.funding.idleEditing);
}

function poolAtEditingShare(s: GameState, t: Tuning, share: number): Num {
  const hotelMult = t.hotel.upgrades.editingMult ** (s.hotel?.upgradeLevels.editors ?? 0);
  const hired = N.mul(capability(s, t, 'editing'), fundingEffect(t, share) * t.reviewSpeedPerEditor * reviewSpeedMult(s, t) * hotelMult);
  return N.add(hired, N.of(t.editorInChiefCapacity * reviewSpeedMult(s, t)));
}

// ---------- hotel crews and timers ----------

function crewFactor(s: GameState, t: Tuning, d: 'recruiting' | 'construction'): number {
  const atDeclare = s.hotel?.declareCapability[d] ?? 0;
  return atDeclare > 0 ? Math.max(0.1, N.toNumber(deptOutput(s, t, d)) / atDeclare) : 1;
}

/** Bus speed (base-seconds of transit work per second). */
export function busSpeed(s: GameState, t: Tuning): number {
  return crewFactor(s, t, 'recruiting') / t.hotel.upgrades.busWaitMult ** (s.hotel?.upgradeLevels.busWranglers ?? 0);
}

/** Onboarding speed (base-seconds of onboarding work per second). */
export function onboardSpeed(s: GameState, t: Tuning): number {
  return crewFactor(s, t, 'construction') / (onboardingMult(s, t) * t.hotel.upgrades.onboardingMult ** (s.hotel?.upgradeLevels.shiftCrews ?? 0));
}

/** Estimated ticks for a full bus trip at current speed. */
export function busWaitTicks(s: GameState, t: Tuning): number {
  return secondsToTicks(t, t.hotel.busWaitSeconds / busSpeed(s, t));
}

/** Estimated ticks for a full onboarding at current speed. */
export function onboardingTicks(s: GameState, t: Tuning): number {
  return secondsToTicks(t, t.hotel.onboardingSeconds / onboardSpeed(s, t));
}

/** Seconds until a market is online at current speeds (Infinity if locked). */
export function readySeconds(s: GameState, t: Tuning, market: string): number {
  const m = s.hotel?.markets[market];
  if (!m || m.status === 'locked') return Infinity;
  if (m.status === 'online') return 0;
  if (m.status === 'onboarding') return m.workLeft / onboardSpeed(s, t);
  return m.workLeft / busSpeed(s, t) + t.hotel.onboardingSeconds / onboardSpeed(s, t);
}

/** Suggested hotel funding: Editing-heavy, shifting to a crew while its work is pending. */
export function suggestHotelShares(s: GameState, t: Tuning): Record<DeptId, number> {
  const f = t.hotel.funding;
  const markets = Object.values(s.hotel?.markets ?? {});
  const transit = markets.some((m) => m.status === 'inTransit');
  const onboarding = markets.some((m) => m.status === 'onboarding');
  if (!transit && !onboarding) {
    const crew = (1 - f.idleEditing) / 2;
    return { recruiting: crew, construction: crew, editing: f.idleEditing };
  }
  if (transit && onboarding) return { recruiting: f.pendingCrew / 2, construction: f.pendingCrew / 2, editing: 1 - f.pendingCrew };
  const busy = f.pendingCrew;
  return transit
    ? { recruiting: busy, construction: f.minCrew, editing: 1 - busy - f.minCrew }
    : { recruiting: f.minCrew, construction: busy, editing: 1 - busy - f.minCrew };
}

export interface CommissionPreview {
  /** Seconds until every required market is online (0 if they all are). */
  readySeconds: number;
  /** Seconds of review work at this capacity, ignoring waiting. */
  productionSeconds: number;
  /** Full estimate: waiting plus production, following the live suggested split. */
  etaSeconds: number;
  bestIncomeRate: number;
  /** Bananas given up versus publishing the same work in the best online market. */
  productionIncomeForgone: number;
}

/**
 * What pinning this Commission costs and how long it takes (PROTOTYPE.md §6).
 *
 * Two phases, matching the live suggested split: while some required market
 * isn't online, capacity works the online requirements (or the best market);
 * once all are online, capacity splits so everything finishes together.
 * Forgone income depends only on what work is done where:
 * Σ work × (best ratio − market ratio).
 */
export function previewCommission(s: GameState, t: Tuning, id: string, poolOverride?: Num): CommissionPreview | null {
  const c = s.hotel?.commissions[id];
  if (!c || c.status === 'completed' || c.status === 'failed') return null;
  // While waiting: capacity at current funding. Once everything is online:
  // capacity at the suggested idle funding, since the suggestion returns
  // funding to Editing then. (Not the reference pool: that's a pricing
  // convention and may differ.) The UI labels this "assuming suggested funding".
  const P = N.toNumber(poolOverride ?? hotelPool(s, t));
  const PB = N.toNumber(poolOverride ?? suggestedIdlePool(s, t));
  const best = bestMarket(s, t);
  const bestRatio = best ? marketDef(t, best).value / marketCost(s, t, best) : 0;
  let ready = 0, wOn = 0, wOff = 0, forgone = 0;
  for (const [m, r] of Object.entries(remaining(c))) {
    const work = N.toNumber(r) * marketCost(s, t, m);
    if (work <= 0) continue;
    const rs = readySeconds(s, t, m);
    ready = Math.max(ready, rs);
    if (rs === 0) wOn += work;
    else wOff += work;
    forgone += work * Math.max(0, bestRatio - marketDef(t, m).value / marketCost(s, t, m));
  }
  const production = PB > 0 ? (wOn + wOff) / PB : Infinity;
  let eta: number;
  if (wOff === 0) eta = production;
  else {
    const doneWhileWaiting = Math.min(wOn, P * ready);
    eta = ready + (PB > 0 ? (wOff + wOn - doneWhileWaiting) / PB : Infinity);
  }
  return { readySeconds: ready, productionSeconds: production, etaSeconds: eta, bestIncomeRate: PB * bestRatio, productionIncomeForgone: forgone };
}

export interface AllocationPreview {
  /** Income right now under this split (markets not yet online earn nothing). */
  incomeRate: number;
  /** Pinned Commission's ETA if this split and the current funding are kept; null if none is pinned. */
  objectiveEtaSeconds: number | null;
}

/**
 * Effect of a proposed market split on income and on the pinned Commission's
 * ETA, assuming the player keeps this split and the current funding.
 * Readiness uses the same timers as the Commission preview: a required
 * market that isn't online delivers nothing until it's ready.
 * (The Commission preview instead assumes the player follows the suggested
 * split and funding; both assumptions are labeled in the UI.)
 */
export function previewMarketAllocation(s: GameState, t: Tuning, alloc: Record<string, number>): AllocationPreview {
  const pool = hotelPool(s, t);
  const income = N.toNumber(certifyMarkets(s, t, pool, alloc).income);
  let eta: number | null = null;
  if (s.objective.kind === 'commission' && s.hotel) {
    const c = s.hotel.commissions[s.objective.id];
    if (c) {
      const a = normalized(alloc, Object.keys(s.hotel.markets));
      eta = 0;
      for (const [m, r] of Object.entries(remaining(c))) {
        if (N.toNumber(r) <= 0) continue;
        const rate = (N.toNumber(pool) * (a[m] ?? 0)) / marketCost(s, t, m);
        eta = Math.max(eta, rate > 0 ? readySeconds(s, t, m) + N.toNumber(r) / rate : Infinity);
      }
    }
  }
  return { incomeRate: income, objectiveEtaSeconds: eta };
}

export function secondsToTicks(t: Tuning, seconds: number): number {
  return Math.max(1, Math.ceil(seconds / t.tickSeconds - 1e-9));
}
