// Typed boundary for office-art.js: the support offices' art (heads, payoff vignettes).

export type PayoffId = 'pizza' | 'team' | 'escape' | 'bath' | 'brk' | 'snack' | 'audit' | 'stamp' | 'mgr' | 'comm' | 'read';

/** Real figures a scene prints: the audit's find, the finding number, the cost cut. */
export interface PayoffInfo {
  amount?: string;
  finding?: number;
  pct?: number;
}

export interface PayoffMeta {
  /** The room that hosts the scene when it is open; null plays it as an inset. */
  room: 'pool' | null;
  /** How long the action runs (ms). */
  ms: number;
  cap: string;
}

export const PAYOFF_META: Record<PayoffId, PayoffMeta>;
/** One payoff scene's markup for a 0 0 360 220 viewBox. */
export function payoffSVG(id: PayoffId, info?: PayoffInfo): string;
export const CA: Record<string, unknown>;
export const TO: Record<string, unknown>;
export function clipboard(x: number, y: number): string;
export function pizzaBox(x: number, y: number, w?: number, open?: boolean): string;
