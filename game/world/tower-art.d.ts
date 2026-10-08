// Typed boundary for tower-art.js: the Bureau as a building of floors.
import type { FloorProps } from './floor-art.js';

export type FloorId = 'personnel' | 'pool' | 'departments' | 'admin' | 'research' | 'director';
export type DeptId = 'recruiting' | 'construction' | 'editing';

export interface TowerFloor {
  id: FloorId;
  /** Markup for the floor's <svg>. */
  svg: string;
  /** [width, height] of the art's own coordinates. */
  viewBox: [number, number];
}

export interface Tower {
  floors: TowerFloor[];
  /** Changes only when the picture can change. */
  key: string;
}

export const FLOOR_NAMES: Record<FloorId, string>;
export const FLOOR_BOX: Record<FloorId, [number, number]>;
/** The whole building as a function of state. Pure: same props, same markup. */
export function buildTower(props: FloorProps): Tower;
/** The roof strip (static). */
export function roofSVG(): string;
/** Normalized props: the key the building rebuilds on. */
export function towerKey(props: FloorProps): string;
/** Patches the live numbers (every `[data-live]` text and `[data-bar]` bar) in place. Returns nothing. */
export function patchLive(root: Element, props: FloorProps): void;
/** One line of status for a floor: the same words on the plate, the aria-label and the Directory. */
export function floorHint(id: string, props: FloorProps): string;
/** The short form for the plate's status tag. */
export function floorTag(id: string, props: FloorProps): string;
/** "Level 2, stage 1 of 4" for a Departments wing. */
export function deptHint(id: DeptId, props: FloorProps): string;
/** One line of status for an Administration wing (facilities | accounting | training). */
export function officeHint(id: 'facilities' | 'accounting' | 'training', props: FloorProps): string;
