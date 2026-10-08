// Typed boundary for office-art.js: the support offices' art (morale dial, heads, office scenes, payoff vignettes).
import type { FloorProps, RoomScene } from './floor-art.js';

export type PayoffId = 'pizza' | 'team' | 'escape' | 'bath' | 'brk' | 'snack' | 'audit' | 'stamp' | 'mgr' | 'comm' | 'read';

/** Real figures a scene prints: the audit's find, the finding number, the cost cut. */
export interface PayoffInfo {
  amount?: string;
  finding?: number;
  pct?: number;
}

export interface PayoffMeta {
  /** The room that hosts the scene when it is open; null plays it as an inset. */
  room: 'pool' | 'accounting' | 'training' | null;
  /** How long the action runs (ms). */
  ms: number;
  cap: string;
}

export const PAYOFF_META: Record<PayoffId, PayoffMeta>;
/** One payoff scene's markup for a 0 0 360 220 viewBox. */
export function payoffSVG(id: PayoffId, info?: PayoffInfo): string;
/** The brass morale dial. Its needle group carries `data-needle` (patched from morale). */
export function moraleDial(cx: number, cy: number, r: number): string;
/** Needle rotation (degrees) for a 0..1 position along the dial. */
export function needleAngle(frac: number): number;
export const FM: Record<string, unknown>;
export const CA: Record<string, unknown>;
export const TO: Record<string, unknown>;
export function clipboard(x: number, y: number): string;
export function pizzaBox(x: number, y: number, w?: number, open?: boolean): string;
/** The three office rooms' scenes (facilities, accounting, training). */
export function buildOfficeRoom(id: 'facilities' | 'accounting' | 'training', props: FloorProps): RoomScene;
