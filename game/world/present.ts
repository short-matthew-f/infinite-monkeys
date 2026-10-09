// Presentation steadiness: what the building DISPLAYS from quantities that jitter at an integer edge.
//
// Late in a run, desks and monkeys sit within one of each other, so "free desks", the waiting
// candidate, the vacant desk and "typing is the limit" can flip several times a second. The number
// on screen still comes from core; this only decides when a changed number is allowed to replace
// the one already shown (hysteresis). It is presentation state, never part of GameState.
//
// Rule: a new value replaces the shown one when it has held for DWELL ticks (2 s), or when it is
// far from the shown one (a real jump, not jitter), or when the player just acted (snap).
import type { FloorProps } from './floor-art.js';

/** Ticks a changed value must hold before the display follows it (10 ticks per second). */
export const DWELL = 20;
const DEPT_KEYS = ['recruiting', 'construction', 'editing'] as const;

/** One displayed value with dwell hysteresis. */
export class Hold<T> {
  private shown!: T;
  private cand!: T;
  private since = 0;
  private has = false;

  /** `far` marks a jump big enough to follow at once. `snap` takes the new value immediately. */
  get(v: T, now: number, far?: (shown: T, v: T) => boolean, snap = false): T {
    if (!this.has || snap) {
      this.shown = this.cand = v;
      this.since = now;
      this.has = true;
      return v;
    }
    if (Object.is(v, this.shown)) {
      this.cand = v;
      this.since = now;
      return this.shown;
    }
    if (!Object.is(v, this.cand)) {
      this.cand = v;
      this.since = now;
    }
    if (now - this.since >= DWELL || far?.(this.shown, v)) {
      this.shown = v;
      this.since = now;
    }
    return this.shown;
  }
}

/** Steadies the floor props the building and the room scenes are drawn from. */
export class Presenter {
  private free = new Hold<number>();
  private bottleneck = new Hold<FloorProps['bottleneck']>();
  private full = DEPT_KEYS.map(() => new Hold<boolean>());
  private snapNext = true;

  /** The player acted (or a screen was rebuilt): show the true values now. */
  snap(): void {
    this.snapNext = true;
  }

  view(p: FloorProps, tick: number, snap = false): FloorProps {
    const sn = snap || this.snapNext;
    this.snapNext = false;
    // Free desks jitter by one. Follow a change of two or more at once, anything smaller after it holds.
    const rawFree = Math.max(0, Math.floor(p.desks) - Math.floor(p.seated));
    const free = this.free.get(rawFree, tick, (a, b) => Math.abs(a - b) >= 2, sn);
    const bottleneck = this.bottleneck.get(p.bottleneck, tick, undefined, sn);
    // A meter that crosses full and back: hold the "full" flag, and keep the drawn fill on the same side of it.
    const meters = { ...p.meters };
    DEPT_KEYS.forEach((k, i) => {
      const raw = p.meters[k] ?? 0;
      const full = this.full[i]!.get(raw >= 1 - 1e-9, tick, undefined, sn);
      meters[k] = full ? Math.max(raw, 1) : Math.min(raw, 0.995);
    });
    return { ...p, desks: Math.floor(p.seated) + free, candidate: free > 0, bottleneck, meters };
  }
}
