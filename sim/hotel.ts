// The first hotel decision, evaluated under the declared strategy profiles
// (PROTOTYPE.md §10). From the state where the first bus has arrived with
// three offers, each choice is played forward on a clone:
//   ordinary    keep Maximize bananas (the home market)
//   immediate / permanent / expansion
//               pin it, follow the suggested split and suggested hotel
//               funding (re-applied every 10 s and whenever a bus arrives or
//               a market comes online), use the reward on completion, then
//               pin Maximize bananas again (the "second objective").
//               On the Expansion path, the Greek Commission is pinned when
//               it's offered, to measure Expansion's practical payoff.
//
// These are four fixed policies, not a search: Commission order, alternative
// epic choices, and off-suggestion funding are not explored.
// Profile goals, fixed before tuning:
//   banana rush      bananas reach the cheapest upgrade not affordable at the decision
//   epic first       the specified epic item is owned
//   expansion first  the next market (Greek) is online

import {
  applySuggestedAllocation,
  buyEpic,
  HOTEL_UPGRADES,
  hotelUpgradeCost,
  N,
  pinObjective,
  previewCommission,
  run,
  setShares,
  suggestMarketAllocation,
  suggestShares,
  type EventSink,
  type GameEvent,
  type GameState,
  type Tuning,
} from '../core/index.js';
import { clone } from './bot.js';

export type Choice = 'ordinary' | 'immediate' | 'permanent' | 'expansion';
export const CHOICES: readonly Choice[] = ['ordinary', 'immediate', 'permanent', 'expansion'];

export interface ProfileTargets {
  bananaTarget: number;
  epic: string;
  market: string;
}

export interface ChoiceOutcome {
  choice: Choice;
  bananaRushSeconds: number | null;
  epicSeconds: number | null;
  expansionSeconds: number | null;
  completedSeconds: number | null;
  /** Seconds from completion until the reward was used (rewardUsed event). */
  payoffSeconds: number | null;
  /** Expansion path: when the Greek Commission completed. */
  greekCommissionSeconds: number | null;
  productionIncomeForgone: number | null;
  failed: boolean;
}

export interface FirstDecision {
  targets: ProfileTargets;
  outcomes: Record<Choice, ChoiceOutcome>;
  previews: Record<Exclude<Choice, 'ordinary'>, { etaSeconds: number; productionIncomeForgone: number; differsFromMaximize: boolean }>;
}

/** Cheapest hotel upgrade at this moment (affordable or not). */
export function cheapestUpgrade(s: GameState, t: Tuning): number {
  return Math.min(...HOTEL_UPGRADES.map((u) => N.toNumber(hotelUpgradeCost(s, t, u)!)));
}

export function profileTargets(s: GameState, t: Tuning): ProfileTargets {
  const costs = HOTEL_UPGRADES.map((u) => N.toNumber(hotelUpgradeCost(s, t, u)!)).filter((c) => c > N.toNumber(s.bananas));
  return { bananaTarget: costs.length ? Math.min(...costs) : cheapestUpgrade(s, t), epic: 'cyrillicSpecialists', market: 'greek' };
}

export function playChoice(start: GameState, t: Tuning, choice: Choice, targets: ProfileTargets, horizonSeconds: number): ChoiceOutcome {
  const s = clone(start);
  const out: ChoiceOutcome = { choice, bananaRushSeconds: null, epicSeconds: null, expansionSeconds: null, completedSeconds: null, payoffSeconds: null, greekCommissionSeconds: null, productionIncomeForgone: null, failed: false };
  const t0 = s.tick;
  const secs = () => (s.tick - t0) * t.tickSeconds;
  let completedTick: number | null = null;
  let immediateTarget: number | null = null;
  const pending: GameEvent[] = [];
  const sink: EventSink = (e) => pending.push(e);

  const follow = () => {
    applySuggestedAllocation(s, t, sink);
    setShares(s, t, sink, suggestShares(s, t));
  };
  if (choice !== 'ordinary') pinObjective(s, t, sink, { kind: 'commission', id: choice });
  follow();
  const every = Math.round(10 / t.tickSeconds);

  const limit = Math.round(horizonSeconds / t.tickSeconds);
  for (let i = 0; i < limit; i++) {
    run(s, t, sink, 1);
    if (i % every === 0) follow();
    for (const e of pending.splice(0)) {
      if (e.type === 'marketOnline' || e.type === 'busArrived') follow();
      if (e.type === 'commissionOffered' && e.id === 'greekVerse' && choice === 'expansion') {
        pinObjective(s, t, sink, { kind: 'commission', id: e.id });
        follow();
      }
      if (e.type === 'commissionFailed' && e.id === choice) out.failed = true;
      if (e.type === 'commissionCompleted' && e.id === 'greekVerse') {
        out.greekCommissionSeconds = secs();
        pinObjective(s, t, sink, { kind: 'bananas' });
        follow();
        continue;
      }
      if (e.type === 'commissionCompleted') {
        completedTick = e.tick;
        out.completedSeconds = secs();
        out.productionIncomeForgone = e.productionIncomeForgone;
        if (e.reward.bananas) immediateTarget = cheapestUpgrade(s, t);
        pinObjective(s, t, sink, { kind: 'bananas' });
        follow();
      }
      if (e.type === 'rewardUsed' && completedTick !== null && out.payoffSeconds === null) {
        out.payoffSeconds = (e.tick - completedTick) * t.tickSeconds;
      }
    }
    // Every policy buys the target epic as soon as it can afford it.
    if (!s.save.epics.includes(targets.epic) && buyEpic(s, t, sink, targets.epic) && completedTick !== null && out.payoffSeconds === null && choice === 'permanent') {
      out.payoffSeconds = (s.tick - completedTick) * t.tickSeconds;
    }
    if (out.bananaRushSeconds === null && N.toNumber(s.bananas) >= targets.bananaTarget) out.bananaRushSeconds = secs();
    // Immediate's payoff: the payout makes the next upgrade affordable.
    if (immediateTarget !== null && completedTick !== null && out.payoffSeconds === null && N.toNumber(s.bananas) >= immediateTarget) {
      out.payoffSeconds = (s.tick - completedTick) * t.tickSeconds;
    }
    if (out.epicSeconds === null && s.save.epics.includes(targets.epic)) out.epicSeconds = secs();
    if (out.expansionSeconds === null && s.hotel?.markets[targets.market]?.status === 'online') out.expansionSeconds = secs();
  }
  return out;
}

export function evaluateFirstDecision(atOffers: GameState, t: Tuning, horizonSeconds = 25 * 60): FirstDecision {
  const targets = profileTargets(atOffers, t);
  const outcomes = {} as Record<Choice, ChoiceOutcome>;
  for (const c of CHOICES) outcomes[c] = playChoice(atOffers, t, c, targets, horizonSeconds);
  const maximize = suggestMarketAllocation(atOffers, t, { kind: 'bananas' });
  const previews = {} as FirstDecision['previews'];
  for (const c of ['immediate', 'permanent', 'expansion'] as const) {
    const p = previewCommission(atOffers, t, c)!;
    const planned = suggestMarketAllocation(atOffers, t, { kind: 'commission', id: c }, 'planned');
    previews[c] = { etaSeconds: p.etaSeconds, productionIncomeForgone: p.productionIncomeForgone, differsFromMaximize: JSON.stringify(planned) !== JSON.stringify(maximize) };
  }
  return { targets, outcomes, previews };
}
