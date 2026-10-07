// The single big-number seam (DESIGN.md §10).
//
// Every quantity that can grow without bound (bananas, rates, capacity,
// costs, deliveries) is a `Num`. Formulas use `N.*` operations, never raw
// operators, so swapping the backing to break_infinity.js (or decimal.js)
// means reimplementing this file only. The brand makes accidental raw
// arithmetic a type error: `a + b` on two Nums yields `number`, not `Num`.
//
// Bounded values (probabilities, shares, multipliers, meter fractions) stay
// plain `number`.
//
// Backing for M1: JS number. Prototype values stay far below 1e15.

declare const NumBrand: unique symbol;
export type Num = number & { readonly [NumBrand]: true };

const w = (x: number): Num => x as Num;

export const N = {
  of: w,
  zero: w(0),
  one: w(1),
  add: (a: Num, b: Num): Num => w(a + b),
  sub: (a: Num, b: Num): Num => w(a - b),
  mul: (a: Num, k: Num | number): Num => w(a * k),
  div: (a: Num, k: Num | number): Num => w(k === 0 ? 0 : a / k),
  /** a / b as a plain ratio; 0 when b is 0. */
  ratio: (a: Num, b: Num): number => (b === 0 ? 0 : a / b),
  min: (a: Num, b: Num): Num => w(Math.min(a, b)),
  max: (a: Num, b: Num): Num => w(Math.max(a, b)),
  gte: (a: Num, b: Num): boolean => a >= b,
  gt: (a: Num, b: Num): boolean => a > b,
  lt: (a: Num, b: Num): boolean => a < b,
  lte: (a: Num, b: Num): boolean => a <= b,
  ceil: (a: Num): Num => w(Math.ceil(a)),
  floor: (a: Num): Num => w(Math.floor(a)),
  sum: (xs: Num[]): Num => w(xs.reduce((s, x) => s + x, 0)),
  /** base ** exp for cost curves. */
  pow: (base: number, exp: number): Num => w(base ** exp),
  log10: (a: Num): number => (a <= 0 ? 0 : Math.log10(a)),
  toNumber: (a: Num): number => a,
};
