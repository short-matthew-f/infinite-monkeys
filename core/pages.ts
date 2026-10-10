// Sightings and the Complete Works. Now and then a monkey types a real line
// from a public-domain passage (t.pages.works). It stays on the floor for a
// few seconds: a catch pays some seconds of income and files the line; a miss
// costs nothing. Completing a work makes the Editors faster (they know it by
// heart). Which line, and when, come from the gameplay stream, so live play
// and catch-up agree. Like requests, sightings during catch-up simply expire.

import { N } from './num.js';
import type { EventSink } from './events.js';
import { nextFloat } from './rng.js';
import { certifyMarkets, certifyTiers, editingPool, hotelPool, secondsToTicks } from './model.js';
import type { GameState, PagesState } from './state.js';
import type { Tuning, WorkDef } from './tuning.js';

/** Lines found so far for a work. */
export function foundLines(s: GameState, id: string): number[] {
  return s.save.works?.[id] ?? [];
}

export function workComplete(s: GameState, w: WorkDef): boolean {
  return foundLines(s, w.id).length >= w.lines.length;
}

export { worksReviewMult } from './model.js';

/** Works the monkeys can be typing now: home works before Infinity (once the unlock tier is found), and works in online markets after. */
export function availableWorks(s: GameState, t: Tuning): WorkDef[] {
  const p = t.pages;
  if (!p) return [];
  if (s.phase === 'finite') {
    if (!s.tiers[p.unlockTier]?.discovered) return [];
    return p.works.filter((w) => w.market === (t.hotel.homeMarket));
  }
  const h = s.hotel;
  if (!h) return [];
  return p.works.filter((w) => h.markets[w.market]?.status === 'online');
}

/** Current income per second, either phase. */
export function incomeRate(s: GameState, t: Tuning): number {
  if (s.phase === 'hotel' && s.hotel) return N.toNumber(certifyMarkets(s, t, hotelPool(s, t), s.hotel.allocation).income);
  return N.toNumber(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income);
}

function gapTicks(s: GameState, t: Tuning): number {
  const [lo, hi] = t.pages!.gapSeconds;
  return secondsToTicks(t, lo + (hi - lo) * nextFloat(s.rng.gameplay));
}

/** Expires an uncaught sighting, or makes the next one when it's due. Called every tick. */
export function maybeSighting(s: GameState, t: Tuning, sink: EventSink): void {
  const p = t.pages;
  if (!p) return;
  const works = availableWorks(s, t);
  if (!s.pages) {
    if (!works.length) return;
    s.pages = { open: null, nextTick: s.tick + gapTicks(s, t), caught: 0, missed: 0 };
    return;
  }
  const ps: PagesState = s.pages;
  if (ps.open) {
    if (s.tick >= ps.open.expiresTick) {
      const { work, line } = ps.open;
      ps.open = null;
      ps.missed++;
      ps.nextTick = s.tick + gapTicks(s, t);
      sink({ type: 'sightingMissed', tick: s.tick, work, line });
    }
    return;
  }
  if (s.tick < ps.nextTick || !works.length) return;
  // Prefer works with lines still missing; once everything available is found, lines repeat (copies still pay).
  const open = works.filter((w) => !workComplete(s, w));
  const pool = open.length ? open : works;
  const w = pool[Math.min(pool.length - 1, Math.floor(nextFloat(s.rng.gameplay) * pool.length))]!;
  const have = new Set(foundLines(s, w.id));
  const missing = w.lines.map((_, i) => i).filter((i) => !have.has(i));
  const lines = missing.length ? missing : w.lines.map((_, i) => i);
  const line = lines[Math.min(lines.length - 1, Math.floor(nextFloat(s.rng.gameplay) * lines.length))]!;
  const reward = incomeRate(s, t) * p.rewardIncomeSeconds;
  ps.open = { work: w.id, line, openedTick: s.tick, expiresTick: s.tick + secondsToTicks(t, p.openSeconds), reward };
  sink({ type: 'sightingOpened', tick: s.tick, work: w.id, line, expiresTick: ps.open.expiresTick, reward });
}

/** Catches the open sighting: pays its quoted reward and files the line. False if nothing is open or it has expired. */
export function catchSighting(s: GameState, t: Tuning, sink: EventSink): boolean {
  const p = t.pages;
  const ps = s.pages;
  const o = ps?.open;
  if (!p || !ps || !o || s.tick >= o.expiresTick) return false;
  const w = p.works.find((x) => x.id === o.work);
  if (!w) return false;
  ps.open = null;
  ps.caught++;
  ps.nextTick = s.tick + gapTicks(s, t);
  s.bananas = N.add(s.bananas, N.of(o.reward));
  s.save.works ??= {};
  const found = (s.save.works[w.id] ??= []);
  const isNew = !found.includes(o.line);
  if (isNew) found.push(o.line);
  const completed = isNew && found.length === w.lines.length;
  // The line that completes a work is the jackpot.
  const bonus = completed ? incomeRate(s, t) * p.completionIncomeSeconds : 0;
  if (bonus > 0) s.bananas = N.add(s.bananas, N.of(bonus));
  sink({ type: 'sightingCaught', tick: s.tick, work: w.id, line: o.line, reward: o.reward + bonus, isNew, completed });
  if (completed) sink({ type: 'workCompleted', tick: s.tick, work: w.id });
  return true;
}
