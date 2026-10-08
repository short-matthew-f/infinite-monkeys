import { N, type Num } from './num.js';
import { seedStreams, type RngStreams } from './rng.js';
import type { BudgetLines, Objective, QuarterReport, Shares } from './events.js';
import { DEPTS, type CommissionKind, type DeptId, type Tuning } from './tuning.js';

export interface DeptState {
  level: number;
  stage: 1 | 2 | 3 | 4;
  /** Self-replication multiplier; grows only at stage 4. */
  rep: number;
}

export interface TierState {
  discoverable: boolean;
  discovered: boolean;
  /** Discovery accumulator: expected certified finds so far. Discovery at 1.0. */
  acc: number;
}

export type MarketStatus = 'locked' | 'inTransit' | 'onboarding' | 'online';

export interface MarketState {
  status: MarketStatus;
  /**
   * Remaining work in the current stage (transit or onboarding), in seconds
   * at base speed. Speed is applied every tick, so upgrades and funding
   * changes affect a job already underway.
   */
  workLeft: number;
  /** Commission whose reward unlocked this market, if any. */
  fromCommission: string | null;
}

export interface FrozenReward {
  bananas: Num | null;
  golden: number | null;
  market: string | null;
}

export type CommissionStatus = 'offered' | 'active' | 'completed' | 'failed';

export interface CommissionState {
  id: string;
  kind: CommissionKind;
  status: CommissionStatus;
  /** Frozen when offered. Upgrades shorten completion, never move these. */
  required: Record<string, Num>;
  delivered: Record<string, Num>;
  /** Frozen when offered. */
  reward: FrozenReward;
  offeredTick: number;
  /** Set when first pinned; the deadline runs from then. */
  startedTick: number | null;
  deadlineTick: number | null;
  productionIncomeForgone: Num;
}

export type HotelUpgrade = 'editors' | 'busWranglers' | 'shiftCrews';
export const HOTEL_UPGRADES: readonly HotelUpgrade[] = ['editors', 'busWranglers', 'shiftCrews'];

export interface HotelState {
  markets: Record<string, MarketState>;
  allocation: Record<string, number>;
  commissions: Record<string, CommissionState>;
  offersMade: boolean;
  /**
   * Department capability (unfunded) at declaration. Bus Wrangler and Shift
   * Crew speed is funded output relative to this, so equal funding gives 1×
   * and funding at declaration can't be gamed.
   */
  declareCapability: { recruiting: number; construction: number };
  upgradeLevels: Record<HotelUpgrade, number>;
  /** Banana cost of the first level of each upgrade line, fixed at declaration. */
  upgradeCostBase: Num;
  /** A completed Commission whose reward hasn't been used yet. */
  pendingReward: { commission: string; kind: CommissionKind } | null;
}

export interface BudgetState {
  /** The signed lines, locked until the next review. */
  lines: BudgetLines;
  /** Each department's account; the department buys its own levels from it. */
  accounts: Record<DeptId, Num>;
  /** Swept wallet waiting for a signature, split by the next signed lines. */
  pot: Num;
  quarter: number;
  quarterStartTick: number;
  /** A review is open: the pot waits and the lines can be signed. */
  reviewDue: boolean;
  /** Reviews that closed unsigned (the quarter ran on the previous lines). */
  missedReviews: number;
  /** Running totals for the current quarter. */
  stats: QuarterReport;
  /** The last finished quarter, for the review. */
  lastReport: QuarterReport | null;
}

/** Persists across runs (Publish). */
export interface SaveState {
  golden: number;
  epics: string[];
  discoveryRewardsClaimed: string[];
  clues: string[];
}

export interface GameState {
  tick: number;
  rng: RngStreams;
  save: SaveState;
  phase: 'finite' | 'hotel';
  bananas: Num;
  monkeys: Num;
  desks: Num;
  desksBought: number;
  hireReadyTick: number;
  zenoLevel: number;
  typingLevel: number;
  reviewLevel: number;
  depts: Record<DeptId, DeptState>;
  shares: Shares;
  tiers: Record<string, TierState>;
  tierAllocation: Record<string, number>;
  objective: Objective;
  stability: { heldTicks: number; permit: boolean };
  milestonesReached: string[];
  hotel: HotelState | null;
  /** Quarterly budget, once opened (budget tuning only). Older saves lack it. */
  budget?: BudgetState | null;
}

export function newSave(): SaveState {
  return { golden: 0, epics: [], discoveryRewardsClaimed: [], clues: [] };
}

export function createState(t: Tuning, seed: number, save: SaveState = newSave()): GameState {
  const tiers: Record<string, TierState> = {};
  const tierAllocation: Record<string, number> = {};
  for (const tier of t.tiers) {
    tiers[tier.id] = { discoverable: tier.startsDiscovered, discovered: tier.startsDiscovered, acc: tier.startsDiscovered ? 1 : 0 };
    tierAllocation[tier.id] = 0;
  }
  const first = t.tiers.find((x) => x.startsDiscovered);
  if (first) tierAllocation[first.id] = 1;

  const depts = {} as Record<DeptId, DeptState>;
  for (const d of DEPTS) depts[d] = { level: 0, stage: 1, rep: 1 };

  return {
    tick: 0,
    rng: seedStreams(seed),
    save,
    phase: 'finite',
    bananas: N.zero,
    monkeys: N.one,
    desks: N.of(t.desks.start),
    desksBought: 0,
    hireReadyTick: 0,
    zenoLevel: 0,
    typingLevel: 0,
    reviewLevel: 0,
    depts,
    shares: { recruiting: 1 / 3, construction: 1 / 3, editing: 1 / 3 },
    tiers,
    tierAllocation,
    objective: { kind: 'bananas' },
    stability: { heldTicks: 0, permit: false },
    milestonesReached: [],
    hotel: null,
    budget: null,
  };
}

/** Starts a new run, carrying the save forward (used by Publish later). */
export function newRun(t: Tuning, seed: number, previous: GameState): GameState {
  const save = previous.save;
  return createState(t, seed, { golden: save.golden, epics: [...save.epics], discoveryRewardsClaimed: [...save.discoveryRewardsClaimed], clues: [...save.clues] });
}
