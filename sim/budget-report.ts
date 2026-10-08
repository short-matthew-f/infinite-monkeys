// `node --import tsx sim/budget-report.ts <bot> [grid|sweep|caps|requisitions]`:
// the quarterly budget (DESIGN.md §13) against today's free funding shares,
// with the same bots and metrics.

import { prototypeTuning as TB, classicTuning as T } from '../content/prototype.js';
import { BOTS, playFinite, type FiniteRun } from './bot.js';
import { longestDeadGap } from './metrics.js';
import type { BudgetDef, GameEvent, Tuning } from '../core/index.js';

const min = (x: number | null) => (x === null ? '—' : `${(x / 60).toFixed(1)}m`);
const sec = (x: number | null) => (x === null ? '—' : `${x.toFixed(0)}s`);

function play(t: Tuning, bot: keyof typeof BOTS) {
  const stages: Record<string, number> = {};
  let autoBuys = 0, manualLevels = 0;
  const req = { offered: 0, granted: 0 };
  const sink = (e: GameEvent) => {
    if (e.type === 'purchase' && e.item.includes(':stage:')) stages[e.item] ??= e.tick * t.tickSeconds;
    if (e.type === 'purchase' && e.item.includes(':level:')) e.by === 'department' ? autoBuys++ : manualLevels++;
    if (e.type === 'requisitionOpened') req.offered++;
    if (e.type === 'requisitionClosed' && e.outcome === 'granted') req.granted++;
  };
  const r: FiniteRun = playFinite(t, BOTS[bot], 1, 3600, sink);
  const until = r.log.declaredTick ?? Infinity;
  const firstStage = (n: number) => { const v = Object.entries(stages).filter(([k]) => k.endsWith(`:stage:${n}`)).map(([, v]) => v); return v.length ? Math.min(...v) : null; };
  return {
    declare: r.declaredSeconds, s4: firstStage(4),
    gap: longestDeadGap(r.log, t, until),
    gapAct: longestDeadGap(r.log, t, until, { countRebalances: true, countReviews: 0.05, countRequisitions: true }),
    reviews: r.log.reviews.length, bigReviews: r.log.reviews.filter((x) => x.change >= 0.05).length, autoBuys, manualLevels, req,
  };
}

function row(label: string, t: Tuning, bot: keyof typeof BOTS) {
  const x = play(t, bot);
  console.log(`${label.padEnd(44)} declare ${min(x.declare).padStart(6)} stage4 ${min(x.s4).padStart(6)} | gap ${sec(x.gap).padStart(5)} (counting all decisions ${sec(x.gapAct).padStart(5)}) | reviews ${String(x.reviews).padStart(3)} (${x.bigReviews} moved ≥5%) | requisitions ${x.req.granted}/${x.req.offered} paid | levels auto ${x.autoBuys} / hand ${x.manualLevels}`);
}

const variant = (b: Partial<BudgetDef>): Tuning => ({ ...TB, budget: { ...TB.budget!, ...b } });
const bot = (process.argv[2] ?? 'casual') as keyof typeof BOTS;
const mode = process.argv[3] ?? 'grid';
console.log(`# ${bot} bot, ${mode}\n`);
row('today (free shares)', T, bot);
row('budget (prototypeTuning)', TB, bot);
if (mode === 'grid') for (const q of [90, 120, 180, 240]) for (const d of [0.3, 0.5, 0.7]) row(`q=${q}s disc=${d}`, variant({ quarterSeconds: q, suggestedDiscretionary: d }), bot);
if (mode === 'sweep') for (const sw of [1, 0.5, 0]) row(`sweep=${sw}`, variant({ sweepShare: sw }), bot);
if (mode === 'caps') for (const [e, r] of [[0.5, 0.5], [0.5, 0.8], [0.35, 0.5], [0.35, 0.8], [0.35, 1], [0.2, 0.8]] as const) row(`editing cap ${e}, at stage 4 ${r}`, variant({ editingShareCap: e, readinessEditingShareCap: r }), bot);
if (mode === 'requisitions') {
  const rq = TB.budget!.requisitions!;
  row('no requisitions', variant({ requisitions: null }), bot);
  for (const f of [1, 0.8, 0.6]) for (const l of [3, 5, 10]) row(`requisitions ${l} levels at ${f}×`, variant({ requisitions: { ...rq, levels: l, priceFactor: f } }), bot);
}
