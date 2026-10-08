// `node --import tsx sim/budget-report.ts`: the quarterly budget (DESIGN.md §13)
// against today's free funding shares, with the same bots and metrics.

import { prototypeBudgetTuning as TB, prototypeTuning as T } from '../content/prototype.js';
import { BOTS, playFinite, type FiniteRun } from './bot.js';
import { longestDeadGap } from './metrics.js';
import type { GameEvent, Tuning } from '../core/index.js';

const min = (x: number | null) => (x === null ? '—' : `${(x / 60).toFixed(1)}m`);
const sec = (x: number | null) => (x === null ? '—' : `${x.toFixed(0)}s`);

function play(t: Tuning, bot: keyof typeof BOTS) {
  const stages: Record<string, number> = {};
  let autoBuys = 0, manualLevels = 0;
  const sink = (e: GameEvent) => {
    if (e.type === 'purchase' && e.item.includes(':stage:')) stages[e.item] ??= e.tick * t.tickSeconds;
    if (e.type === 'purchase' && e.item.includes(':level:')) e.by === 'department' ? autoBuys++ : manualLevels++;
  };
  const r: FiniteRun = playFinite(t, BOTS[bot], 1, 3600, sink);
  const until = r.log.declaredTick ?? Infinity;
  const firstStage = (n: number) => { const v = Object.entries(stages).filter(([k]) => k.endsWith(`:stage:${n}`)).map(([, v]) => v); return v.length ? Math.min(...v) : null; };
  return {
    declare: r.declaredSeconds, tall: r.milestones.tall ?? null, s2: firstStage(2), s3: firstStage(3), s4: firstStage(4),
    gap: longestDeadGap(r.log, t, until), gapRev: longestDeadGap(r.log, t, until, { countRebalances: true, countReviews: 0.05 }),
    reviews: r.log.reviews.length, bigReviews: r.log.reviews.filter((x) => x.change >= 0.05).length, autoBuys, manualLevels,
  };
}

function row(label: string, t: Tuning, bot: keyof typeof BOTS) {
  const x = play(t, bot);
  console.log(`${label.padEnd(30)} declare ${min(x.declare).padStart(6)} tall ${min(x.tall).padStart(6)} stage2 ${min(x.s2).padStart(6)} stage3 ${min(x.s3).padStart(6)} stage4 ${min(x.s4).padStart(6)} | gap ${sec(x.gap).padStart(5)} (w/ reviews ${sec(x.gapRev).padStart(5)}) | reviews ${String(x.reviews).padStart(3)} (${x.bigReviews} moved ≥5%) | levels auto ${x.autoBuys} / hand ${x.manualLevels}`);
}

const variant = (q: number, disc: number, sweep = 1): Tuning => ({ ...TB, budget: { ...TB.budget!, quarterSeconds: q, suggestedDiscretionary: disc, sweepShare: sweep } });
const arg = process.argv[2] ?? 'casual';
const bot = arg as keyof typeof BOTS;
console.log(`# ${bot} bot\n`);
row('today (free shares)', T, bot);
const mode = process.argv[3] ?? 'grid';
if (mode === 'grid') for (const q of [90, 120, 180, 240]) for (const d of [0.3, 0.5, 0.7]) row(`budget q=${q}s disc=${d}`, variant(q, d), bot);
else for (const [q, d] of [[180, 0.7], [180, 0.5], [240, 0.7]] as const) for (const sw of [1, 0.5, 0]) row(`budget q=${q}s disc=${d} sweep=${sw}`, variant(q, d, sw), bot);
