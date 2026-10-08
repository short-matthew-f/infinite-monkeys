// Typed boundary for ceremony-art.js (SVG builders for the quarter-end ceremony).

export const HEADS: Record<string, unknown>[];
export const CLIP: Record<'phone' | 'people' | 'hat' | 'pencil' | 'star' | 'ledger' | 'lens', string>;
export const SIGNATURE: string;

export interface ChartPoint {
  v: number;
  label: string;
  text: string;
}

export function banana(x: number, y: number, s?: number): string;
export function potSVG(x: number, yb: number, s?: number): string;
/** Boardroom arrival scene (viewBox 0 0 360 200). `heads: false` leaves the room empty (first budget). */
/** `accountant`: the Chief Accountant walks in too (a fourth head). */
export function arrivalSVG(sign: string, heads: boolean, accountant?: boolean): string;
/** Presenters' strip (viewBox 0 0 360 116): floor, projector, door, and the three `.presenter` groups. */
export function stripSVG(): string;
/** The Bursar's pot band (viewBox 0 0 360 104). */
export function potBandSVG(sweeping: boolean): string;
export function barChart(bars: ChartPoint[], unit: string): string;
export function lineChart(points: ChartPoint[]): string;
export function creamPie(frac: number, lines: [string, string]): string;
