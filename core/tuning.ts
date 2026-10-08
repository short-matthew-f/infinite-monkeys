// Tuning contract. Values live in content/ (data only); core only defines
// the shape. The accelerated prototype and the full game differ only in the
// tuning table they pass in (DESIGN.md §10, PROTOTYPE.md §3).

export type DeptId = 'recruiting' | 'construction' | 'editing';
export const DEPTS: readonly DeptId[] = ['recruiting', 'construction', 'editing'];

export interface TierDef {
  id: string;
  /** Expected submissions classified into this tier per keystroke (exclusive). */
  p: number;
  /** Review units needed to certify one find. */
  reviewCost: number;
  /** Bananas per certified find. */
  value: number;
  startsDiscovered: boolean;
  /** Banana cost of the research that makes this tier discoverable. */
  researchCost: number;
  /** One-time rewards on first discovery, once per save. */
  discoveryBananas: number;
  discoveryGolden: number;
}

export interface DeptDef {
  /** Output per capability level at stage 1, equal funding (units/s). */
  perLevel: number;
  levelCostBase: number;
  levelCostGrowth: number;
  /** Banana cost to reach stages 2, 3, 4. */
  stageCosts: [number, number, number];
  /** Output multiplier at stages 1..4. */
  stageMult: [number, number, number, number];
  /** Fractional growth per second of the replication multiplier at stage 4. */
  selfRepRate: number;
}

export interface MarketDef {
  id: string;
  value: number;
  reviewCost: number;
}

export type CommissionKind = 'immediate' | 'permanent' | 'expansion';

export type CommissionRewardDef =
  | { type: 'bananas'; forgoneMultiplier: number }
  | { type: 'golden'; amount: number }
  | { type: 'market'; market: string };

export interface CommissionDef {
  id: string;
  kind: CommissionKind;
  /** Capacity-minutes per market, frozen into delivery counts when offered. */
  requirements: { market: string; capacityMinutes: number }[];
  /** When to offer it. Default: with the first bus. */
  offerWhen?: { marketOnline: string };
  deadlineSeconds: number;
  reward: CommissionRewardDef;
}

export type EpicEffect =
  | { type: 'reviewSpeed'; mult: number }
  | { type: 'marketReviewCost'; market: string; mult: number }
  | { type: 'onboardingTime'; mult: number };

export interface EpicDef {
  id: string;
  cost: number;
  effect: EpicEffect;
}

/**
 * The quarterly budget (DESIGN.md §13, proposed). When present, income is split
 * live by signed budget lines: department lines fill department accounts that
 * buy their own levels, the discretionary line fills the player's wallet. At
 * each quarter end the unspent wallet goes back into the pot, which the next
 * signed budget splits. Absent or null: today's free funding shares.
 */
export interface BudgetDef {
  /** Length of a quarter. */
  quarterSeconds: number;
  /** Discretionary share in the suggested budget. */
  suggestedDiscretionary: number;
  /** A signed budget must leave at least this much discretionary. */
  minDiscretionary: number;
  /** Share of the unspent wallet swept into the pot at quarter end (1 = all of it; the rest stays in the wallet). */
  sweepShare: number;
  /** The heads' cap on Editing's output share (the free-shares suggestion caps it at suggestedEditingShareCap). */
  editingShareCap: number;
  /** Once every department is at stage 4, the heads' cap on Editing's output share. */
  readinessEditingShareCap: number;
  /** Requisitions: the short department's head asks the wallet for levels at a bulk rate. Null turns them off. */
  requisitions: RequisitionDef | null;
}

export interface RequisitionDef {
  /** Levels one requisition buys. */
  levels: number;
  /** Price as a share of those levels' list price. */
  priceFactor: number;
  /** An unanswered requisition expires after this long (or at quarter end, whichever is first). */
  openSeconds: number;
  /** Quiet time after one closes before the next can open. */
  cooldownSeconds: number;
}

export interface Milestone {
  id: string;
  desks: number;
}

export interface Tuning {
  tickSeconds: number;
  typingSpeed: number;
  editorInChiefCapacity: number;
  reviewSpeedPerEditor: number;
  /** Each funding share's effect is share × this (3 → equal shares give 1.0×). */
  fundingScale: number;
  /** Upper bound on Editing's suggested funding share, so suggestions never starve growth. */
  suggestedEditingShareCap: number;
  hire: { baseCooldownSeconds: number; zenoCostBase: number; zenoCostGrowth: number };
  desks: { start: number; costBase: number; costGrowth: number; constructionBufferMin: number; constructionBufferFrac: number };
  depts: Record<DeptId, DeptDef>;
  tiers: TierDef[];
  /** Common research: faster typewriters. Each level multiplies typing speed. */
  typingResearch: { costBase: number; costGrowth: number; mult: number };
  /** Common research: review cost reduction. Each level multiplies every tier's review cost. */
  reviewResearch: { costBase: number; costGrowth: number; mult: number };
  milestones: Milestone[];
  readiness: { minMonkeys: number; ratioThreshold: number; stabilitySeconds: number };
  hotel: {
    homeMarket: string;
    ceremonyMarket: string;
    markets: MarketDef[];
    busWaitSeconds: number;
    onboardingSeconds: number;
    /**
     * Hotel upgrades re-price at the ceremony: the first level of each line
     * costs this many seconds of home-market income at declaration, so banana
     * purchases stay meaningful after infinity.
     */
    upgrades: { costSeconds: number; costGrowth: number; editingMult: number; busWaitMult: number; onboardingMult: number };
    /**
     * Suggested hotel funding. With nothing pending, Editing gets `idleEditing`
     * and the rest is split evenly; while a bus is in transit or a market is
     * onboarding, that crew gets `pendingCrew`.
     * `referenceEditing` is the fixed share used to freeze offers and price
     * hotel upgrades, so capacity-minutes match normal play and can't be gamed
     * by funding. It's separate so the suggestion can be tuned without
     * repricing anything.
     */
    funding: { idleEditing: number; referenceEditing: number; pendingCrew: number; minCrew: number };
    commissions: CommissionDef[];
  };
  epics: EpicDef[];
  offlineCapSeconds: number;
  budget?: BudgetDef | null;
}
