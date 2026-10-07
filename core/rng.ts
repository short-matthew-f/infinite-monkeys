// Seeded randomness (DESIGN.md §10). Two independent streams:
//   gameplay      drones, rare finds, clue drops (affects the economy)
//   presentation  feed selection, cosmetics (never affects the economy)
// Drawing from one never advances the other.

export interface RngState {
  s: number;
}

export interface RngStreams {
  gameplay: RngState;
  presentation: RngState;
}

export function seedStreams(seed: number): RngStreams {
  return {
    gameplay: { s: seed >>> 0 },
    presentation: { s: (seed ^ 0x9e3779b9) >>> 0 },
  };
}

/** mulberry32: returns a float in [0, 1) and advances the stream. */
export function nextFloat(r: RngState): number {
  let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
