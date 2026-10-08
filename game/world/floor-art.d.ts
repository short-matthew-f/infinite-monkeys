// Typed boundary for floor-art.js (art code, kept as plain JS so art agents can edit it).

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
}

export interface FloorZone {
  id: 'personnel' | 'pool' | 'departments' | 'research' | 'director';
  label: string;
  /** Hot area, world coordinates [x, y, w, h]. */
  box: [number, number, number, number];
  extra?: [number, number, number, number][];
  /** The part of the room that must show above an open sheet. */
  frame: [number, number, number, number];
  /** Play-view camera anchor [x, y, where the anchor sits on screen]. */
  cam: [number, number, 'top' | 'mid'];
  centre: [number, number];
  /** Plan-view tag anchor; `a` is which side of the anchor the tag sits on. */
  chip: { x: number; y: number; a: 'l' | 'r' | 'c' };
}

export interface Floor {
  svg: string;
  zones: FloorZone[];
  /** Changes only when the picture can change; rebuild the SVG only then. */
  key: string;
  size: [number, number];
}

export const FLOOR_W: number;
export const FLOOR_H: number;
/** Desks drawn in the Typing Pool; past this a placard carries the true count. */
export const CAP: number;
export const PERS_DY: number;
export function buildFloor(props: FloorProps): Floor;
export function normalize(props: FloorProps): unknown;
/** Patches the headcount placard text in place (it changes more often than the picture). */
export function updateHeadcount(root: Element, seated: number): void;
/** World point in front of drawn desk i, for the hire walk. */
export function deskSpot(i: number): [number, number];
export function installRouteCSS(): void;
