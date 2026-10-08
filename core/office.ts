// The support offices' effects (DESIGN.md §13, "Projects"): morale, timed
// boosts, permanent upgrades and audits. Read by the model's rate and cost
// functions, which multiply by these. Finite phase only: in the hotel phase
// every multiplier is 1.

import type { GameState, OfficeState } from './state.js';
import type { PermTarget, ProjectDef, Tuning } from './tuning.js';

/** The office state while it applies (finite phase, opened), else null. */
function live(s: GameState): OfficeState | null {
  return s.phase === 'finite' ? (s.office ?? null) : null;
}

/** Morale multiplier on typing and department output (1 = normal). */
export function moraleMult(s: GameState): number {
  return live(s)?.morale ?? 1;
}

/** Product of active timed multipliers for a target. */
export function timedMult(s: GameState, target: 'output' | 'review'): number {
  const o = live(s);
  if (!o) return 1;
  let m = 1;
  for (const e of o.timed) if (e.target === target && e.untilTick > s.tick) m *= e.mult;
  return m;
}

/** Product of permanent multipliers for a target, from projects owned. */
export function permMult(s: GameState, t: Tuning, target: PermTarget): number {
  const o = live(s);
  const projects = t.budget?.projects;
  if (!o || !projects) return 1;
  let m = 1;
  for (const p of projects) {
    const n = o.owned[p.id] ?? 0;
    if (n > 0 && p.effect.type === 'perm' && p.effect.target === target) m *= p.effect.mult ** n;
  }
  return m;
}

/** Extra time-away allowance (seconds) from projects owned. Applies in either phase: it's about the save, not the economy. */
export function offlineBonusSeconds(s: GameState, t: Tuning): number {
  const o = s.office;
  const projects = t.budget?.projects;
  if (!o || !projects) return 0;
  let add = 0;
  for (const p of projects) if (p.effect.type === 'offline') add += p.effect.seconds * (o.owned[p.id] ?? 0);
  return add;
}

export function newOffice(): OfficeState {
  return { morale: 1, timed: [], owned: {}, audits: [] };
}

/** Morale fades toward 1 (never below); expired timed effects drop off. */
export function fadeOffice(s: GameState, t: Tuning, dt: number): void {
  const o = live(s);
  const m = t.budget?.morale;
  if (!o || !m) return;
  if (o.morale > 1) o.morale = Math.max(1, o.morale - m.fadePerSecond * permMult(s, t, 'moraleFade') * dt);
  if (o.timed.length && o.timed.some((e) => e.untilTick <= s.tick)) o.timed = o.timed.filter((e) => e.untilTick > s.tick);
}

/** Is this project on offer yet (unlocked and not at its cap)? */
export function projectAvailable(s: GameState, p: ProjectDef): boolean {
  const o = s.office;
  if (!o) return false;
  if (p.max !== null && (o.owned[p.id] ?? 0) >= p.max) return false;
  if (p.unlock.milestone && !s.milestonesReached.includes(p.unlock.milestone)) return false;
  if (p.unlock.minStage && !Object.values(s.depts).some((d) => d.stage >= p.unlock.minStage!)) return false;
  // A timed or morale project already running isn't offered again until it's over.
  if (p.effect.type === 'timed' && o.timed.some((e) => e.project === p.id && e.untilTick > s.tick)) return false;
  return true;
}
