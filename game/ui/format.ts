// The only number formatting in game/. Screens never call toFixed/toLocaleString directly.
import { N, type Num } from '../../core/index.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

const toNum = (x: Num | number): number => (typeof x === 'number' ? x : N.toNumber(x));

/** Whole counts: 1,234 then 12.3K, 4.56M, … */
export function count(x: Num | number): string {
  const v = toNum(x);
  if (!Number.isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a < 10_000) return Math.floor(v).toLocaleString();
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(a) / 3));
  if (tier >= SUFFIXES.length - 1 && a >= 1e36) return v.toExponential(2);
  const scaled = v / 10 ** (tier * 3);
  return `${scaled.toFixed(scaled < 100 ? 2 : 1)}${SUFFIXES[tier]}`;
}

/** Rates and small quantities: keeps decimals below 10. */
export function amount(x: Num | number): string {
  const v = toNum(x);
  if (Math.abs(v) >= 10_000) return count(v);
  if (Math.abs(v) >= 10) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  if (v === 0) return '0';
  return v.toFixed(2);
}

/** Per-second rate, e.g. "12.3/s". */
export function rate(x: Num | number): string {
  return `${amount(x)}/s`;
}

/** Banana price, e.g. "🍌 1.2K". */
export function bananas(x: Num | number): string {
  return `🍌 ${count(x)}`;
}

/** Fraction 0..1 as a percent, e.g. "33%". */
export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Durations: "45 s", "3 min 20 s", "1 h 5 min", "—" for infinite. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
