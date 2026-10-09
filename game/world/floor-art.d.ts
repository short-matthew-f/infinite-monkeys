// Typed boundary for floor-art.js and tower-art.js (art code, kept as plain JS so art agents can edit it).

export type TierArtState = 'locked' | 'researching' | 'discovered';

export interface FloorProps {
  /** Monkeys seated (1 at a new game, up to 50,000+). */
  seated: number;
  /** Desks owned (>= seated). */
  desks: number;
  /** A free desk exists, so a candidate waits at the entrance. */
  candidate: boolean;
  /** Editing department level; 0 means only the Editor-in-Chief. */
  editors: number;
  tiers: { id: string; state: TierArtState }[];
  depts: Record<'recruiting' | 'construction' | 'editing', { level: number; stage: number }>;
  /** Subset of 'office' | 'building' | 'tall'. */
  milestones: string[];
  permit: boolean;
  /** First hire not made yet: the pointing hand on Personnel. */
  tutorial: boolean;
  /** Readiness meters from core (0..1). The building patches these in place. */
  meters: Record<'recruiting' | 'construction' | 'editing', number>;
  /** Unfloored values for presentation bands (present.ts). Absent in tests and previews. */
  raw?: {
    /** Desks minus monkeys, unfloored (a desk is free to hire into at 1). */
    free: number;
    /** Review demand / review pool (core's finiteBottleneck compares these); null outside the finite phase. */
    pressure: number | null;
  };
  /** What limits income right now (core's finiteBottleneck), or null outside the finite phase. */
  bottleneck: 'typing' | 'editing' | null;
  /** The office heads' projects, once the budget has opened (absent before). */
  office?: {
    on: boolean;
    /** Amenities the Foreman has built. */
    built: { bathrooms: boolean; breakRoom: boolean; snackMachine: boolean };
  };
}

export type RoomId = 'personnel' | 'pool' | 'departments' | 'research' | 'director';

export interface RoomScene {
  /** Markup for an <svg> with the given viewBox. */
  svg: string;
  viewBox: [number, number, number, number];
  /** Changes only when the picture can change; rebuild the SVG only then. */
  key: string;
}

/** Desks drawn in the Typing Pool; past this a placard carries the true count. */
export const CAP: number;
/** One room's full-width scene (the pop-up room), as a function of state. */
export function buildRoom(id: RoomId, props: FloorProps): RoomScene;
/** Shared <defs> (lamp-glow gradient). Put once in the document. */
export function roomDefs(): string;
export function normalize(props: FloorProps): unknown;
/** Patches the headcount placard text in place (it changes more often than the picture). */
export function updateHeadcount(root: Element, seated: number): void;

// parts kit (used by tower-art.js)
export function f1(n: number): number;
export function hash(i: number): number;
export const CAST: Record<string, unknown>[];
export const EDITOR: Record<string, unknown>;
export const CANDIDATE: Record<string, unknown>;
export function pbox(o: { x: number; yb: number; w: number; h: number; d?: number; c?: string; extra?: string; before?: string; cls?: string; tabs?: boolean; shadow?: boolean; glass?: boolean; sk?: number }): string;
export function sign(cx: number, top: number, w: number, h: number, text: string, nd?: number): string;
export function lamp(x: number, yb: number, dl?: number, breathe?: boolean): string;
export function nextCue(x: number, y: number): string;
export function ficus(cx: number, yb: number, s?: number): string;
export function snake(cx: number, yb: number, s?: number): string;
export function cactus(cx: number, yb: number, s?: number): string;
export function umbrellaStand(cx: number, yb: number): string;
export function wasteBin(cx: number, yb: number): string;
export function noticeBoard(cx: number, yb: number): string;
export const T: (x: number, y: number, inner: string, cls?: string, st?: string) => string;
export function headSVG(s: Record<string, unknown>, hx: number, hy: number, hr: number): string;
export function seatSVG(i: number, cx: number, yb: number, o?: { over?: Record<string, unknown>; dw?: number; vacant?: boolean; arrive?: boolean }): string;
export function stand(s: Record<string, unknown>, pose?: { hl?: [number, number]; hr?: [number, number]; xl?: string; xr?: string; body?: string; front?: string }): string;
export function deskMark(cx: number, yb: number, dw: number, faint: boolean, label: string): string;
export const stagePlate: (cx: number, y: number, stage: number) => string;
export const drawers: (x: number, y0: number, w: number, n: number, rh: number, hasLabel?: boolean) => string;
export function shelfBooks(x: number, yb: number, w: number, seed: number, hmax: number): string;
export function volume(x: number, yb: number, state: TierArtState, id: string, w?: number, h?: number): string;
