// Presentation steadiness: what the building DISPLAYS from quantities that jitter at an edge.
//
// Late in a run, desks and monkeys sit within one of each other, so "free desks", the waiting
// candidate, the vacant desk and "typing is the limit" would flip several times a second if they
// followed the raw numbers. The number on screen still comes from core; this only decides when a
// changing number is allowed to change what is shown.
//
// The rule is hysteresis on the underlying VALUE, with no clock. Each readout has a band chosen
// from the value it reads: it turns on at one edge and off at another, so noise inside the band
// changes nothing, and a real move past an edge shows on the very next frame. Changes that only
// go one way (a desk becoming free, an applicant arriving) are never held. Player actions snap.
// It is presentation state, never part of GameState.
import type { FloorProps } from './floor-art.js';

const DEPT_KEYS = ['recruiting', 'construction', 'editing'] as const;

/** Free desks: a rise shows at once; a fall waits until the value is half a desk under the count shown. */
export const FREE_FALL_MARGIN = 0.5;
/** Review pressure (demand / pool): "pages piling up" on above this, off below the lower edge. */
export const PRESSURE_ON = 1.04;
export const PRESSURE_OFF = 0.96;
/** A department meter counts as full on reaching 1 and stops counting as full only below this. */
export const METER_FULL_ON = 1 - 1e-9;
export const METER_FULL_OFF = 0.97;

/** A two-edge switch. Between the edges it keeps its state; first sight (or a snap) takes the nearer side. */
export class Band {
  private on = false;
  private has = false;
  constructor(private hi: number, private lo: number) {}
  get(v: number, snap = false): boolean {
    if (!this.has || snap) {
      this.on = v >= (this.hi + this.lo) / 2;
      this.has = true;
    } else if (v >= this.hi) this.on = true;
    else if (v <= this.lo) this.on = false;
    return this.on;
  }
}

/** A whole-number count read from a continuous value (free desks). Up at once, down past a margin. */
export class Count {
  private shown = 0;
  private has = false;
  constructor(private margin: number) {}
  get(v: number, snap = false): number {
    const k = Math.max(0, Math.floor(v));
    if (!this.has || snap) {
      this.shown = k;
      this.has = true;
    } else if (k > this.shown) this.shown = k;
    else if (v < this.shown - this.margin) this.shown = k;
    return this.shown;
  }
}

/** Steadies the floor props the building and the room scenes are drawn from. */
export class Presenter {
  private free = new Count(FREE_FALL_MARGIN);
  private piling = new Band(PRESSURE_ON, PRESSURE_OFF);
  private full = DEPT_KEYS.map(() => new Band(METER_FULL_ON, METER_FULL_OFF));
  private snapNext = true;

  /** The player acted (or a screen was rebuilt): show the true values now. */
  snap(): void {
    this.snapNext = true;
  }

  view(p: FloorProps, _tick?: number, snap = false): FloorProps {
    const sn = snap || this.snapNext;
    this.snapNext = false;
    // Free desks from the unfloored difference (desks - monkeys); the floors can differ by one while the true gap barely moves.
    const rawFree = p.raw ? p.raw.free : Math.max(0, p.desks - p.seated);
    const free = this.free.get(rawFree, sn);
    // Which of typing or editing limits income: held on the review pressure, so a ratio hovering near 1 does not flip it.
    let bottleneck = p.bottleneck;
    if (p.bottleneck && p.raw?.pressure != null) bottleneck = this.piling.get(p.raw.pressure, sn) ? 'editing' : 'typing';
    // A meter that touches full and slips back: keep the "full" flag inside its band, and the drawn fill on the same side of it.
    const meters = { ...p.meters };
    DEPT_KEYS.forEach((k, i) => {
      const raw = p.meters[k] ?? 0;
      const full = this.full[i]!.get(raw, sn);
      meters[k] = full ? Math.max(raw, 1) : Math.min(raw, 0.995);
    });
    return { ...p, desks: Math.floor(p.seated) + free, candidate: free > 0, bottleneck, meters };
  }
}
