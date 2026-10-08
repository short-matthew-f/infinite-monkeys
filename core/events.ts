// Event interface (PROTOTYPE.md §7). Core emits; game/ and sim/ consume.
// Fields are plain numbers so events serialize directly to JSON.

import type { CommissionKind, DeptId, HeadId } from './tuning.js';

export type Objective =
  | { kind: 'bananas' }
  | { kind: 'readiness' }
  | { kind: 'commission'; id: string };

export type Bottleneck = 'typing' | 'editing';

export interface Shares {
  recruiting: number;
  construction: number;
  editing: number;
}

export type Meters = Record<DeptId, number>;

/** Budget lines: the three departments plus the player's discretionary wallet. Sum to 1. */
export interface BudgetLines extends Shares {
  discretionary: number;
}

/** What happened in one quarter, kept for the quarterly review. Plain numbers. */
export interface QuarterReport {
  quarter: number;
  seconds: number;
  income: number;
  /** Monkeys seated by Recruiting (automatic) and by hand. */
  hires: number;
  manualHires: number;
  /** Desks built by Construction and bought by hand. */
  desksBuilt: number;
  desksBought: number;
  certifiedFinds: number;
  discardedFinds: number;
  /** Levels each department bought from its own account. */
  autoLevels: Record<DeptId, number>;
  /** Bananas spent from the wallet. */
  walletSpent: number;
  /** The quarter's review was never signed, so it ran on the previous quarter's lines. */
  ranOnOldLines: boolean;
  /** Requisitions the heads filed this quarter, and how each closed. */
  requisitions: { offered: number; granted: number; declined: number; expired: number };
  /** Every request this quarter and how it closed (accepted, declined, expired), for Accounting's slides. */
  requests: { kind: string; from: HeadId; dept: DeptId | null; price: number; outcome: 'granted' | 'declined' | 'expired' }[];
  /** Funds the quarter's audits found (paid into the pot). */
  auditFound: number;
  /** Unspent wallet swept back into the pot at quarter end. */
  swept: number;
}

export interface FrozenRewardData {
  bananas?: number;
  golden?: number;
  market?: string;
}

export type GameEvent =
  | { type: 'purchase'; tick: number; item: string; cost: number; currency: 'bananas' | 'golden'; bottleneckBefore: Bottleneck; bottleneckAfter: Bottleneck; by?: 'department' }
  | { type: 'hire'; tick: number; manual: boolean }
  | { type: 'allocationChanged'; tick: number; layer: 'tiers' | 'markets'; previous: Record<string, number>; next: Record<string, number>; suggested: Record<string, number>; objective: Objective }
  | { type: 'fundingChanged'; tick: number; previous: Shares; next: Shares; meters: Meters }
  | { type: 'objectivePinned'; tick: number; objective: Objective; previous: Objective }
  | { type: 'previewOpened'; tick: number; screen: string; item: string }
  | { type: 'tierDiscovered'; tick: number; tier: string; bananas: number; golden: number }
  | { type: 'stageReached'; tick: number; stage: string }
  | { type: 'permitStamped'; tick: number }
  | { type: 'infinityDeclared'; tick: number }
  | { type: 'titleFlipped'; tick: number; from: string; to: string }
  | { type: 'busArrived'; tick: number; market: string }
  | { type: 'marketOnline'; tick: number; market: string }
  | { type: 'commissionOffered'; tick: number; id: string; kind: CommissionKind; deliveries: Record<string, number>; reward: FrozenRewardData; deadlineSeconds: number }
  | { type: 'commissionCompleted'; tick: number; id: string; kind: CommissionKind; ticksTaken: number; productionIncomeForgone: number; reward: FrozenRewardData }
  | { type: 'commissionFailed'; tick: number; id: string }
  | { type: 'rewardUsed'; tick: number; commission: string; how: string }
  | { type: 'budgetOpened'; tick: number }
  | { type: 'quarterEnded'; tick: number; report: QuarterReport; pot: number; missedReview: boolean }
  | { type: 'budgetSigned'; tick: number; quarter: number; previous: BudgetLines; next: BudgetLines; pot: number }
  | { type: 'requisitionOpened'; tick: number; kind: string; from: HeadId; dept: DeptId | null; levels: number; price: number }
  | { type: 'requisitionClosed'; tick: number; kind: string; from: HeadId; dept: DeptId | null; outcome: 'granted' | 'declined' | 'expired'; price: number }
  /** An accepted project took effect (the payoff moment). */
  | { type: 'projectDone'; tick: number; project: string; from: HeadId }
  /** An audit came back: funds found go to the pot. */
  | { type: 'auditFound'; tick: number; amount: number };

export type EventSink = (e: GameEvent) => void;

export const nullSink: EventSink = () => {};
