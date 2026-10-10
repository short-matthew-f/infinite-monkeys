// Typed boundary for tower-art.js: the Bureau as a building of floors.
import type { FloorProps } from './floor-art.js';

export type FloorId = 'personnel' | 'pool' | 'departments' | 'research' | 'director';
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

/** After Infinity the same five floors change their names. */
export const HOTEL_NAMES: Record<FloorId, string>;
/** The three Departments wings become Bus Wranglers, Shift Crews and Editors. */
export const HOTEL_WINGS: Record<DeptId, string>;
export interface MarketLook {
  name: string;
  /** The alphabet painted on the bus. */
  glyphs: string;
  /** One glyph, for a share bar. */
  short: string;
  paint: string;
}
export const MARKET_LOOK: Record<string, MarketLook>;
export function marketLook(id: string): MarketLook;
export const KIND_NAMES: Record<string, string>;
/** m:ss for a time left in seconds. */
export function mmss(seconds: number): string;
/** A floor's name in the current phase (hotel names once `props.hotel` exists). */
export function floorName(id: FloorId | string, props: FloorProps): string;
export function wingName(id: DeptId | string, props: FloorProps): string;
type HotelMarket = NonNullable<FloorProps['hotel']>['markets'][number];
/** The bus nearest to its stop: on the road first, else being seated. */
export function nextArrival(hotel: NonNullable<FloorProps['hotel']>): HotelMarket | null;
/** The online markets that carry a share of the Editors, as words. */
export function splitParts(hotel: NonNullable<FloorProps['hotel']>): { id: string; glyph: string; name: string; pct: number; share: number }[];
/** A bus painted with its market's alphabet (a `<g class="bus bus-{market}">`, 110 wide). */
export function busSVG(market: string, x: number, yb?: number): string;
/** The hotel roof: ghost floors fading upward, a brass plaque (viewBox "0 -72 400 98"). */
export function skySVG(): string;
