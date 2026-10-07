// Event interface (PROTOTYPE.md §7). Core emits; game/ and sim/ consume.
// Fields are plain numbers so events serialize directly to JSON.

import type { CommissionKind, DeptId } from './tuning.js';

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

export interface FrozenRewardData {
  bananas?: number;
  golden?: number;
  market?: string;
}

export type GameEvent =
  | { type: 'purchase'; tick: number; item: string; cost: number; currency: 'bananas' | 'golden'; bottleneckBefore: Bottleneck; bottleneckAfter: Bottleneck }
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
  | { type: 'rewardUsed'; tick: number; commission: string; how: string };

export type EventSink = (e: GameEvent) => void;

export const nullSink: EventSink = () => {};
