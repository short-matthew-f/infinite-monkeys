// `npm run sim`: plays the prototype with each bot and prints the §10 report.

import { prototypeTuning as T } from '../content/prototype.js';
import { BOTS, clone, playFinite, type FiniteRun } from './bot.js';
import { evaluateFirstDecision, playChoice, profileTargets } from './hotel.js';
import { longestDeadGap, rebalancingDecisionsY, rebalancingEpisodes } from './metrics.js';
import { certifyMarkets, referenceHotelPool, N, nullSink, previewCommission, run, type GameState } from '../core/index.js';

const fmt = (x: number | null) => (x === null ? '—' : `${(x / 60).toFixed(1)} min`);
const sec = (x: number | null) => (x === null ? '—' : `${x.toFixed(0)} s`);

export function toFirstOffers(r: FiniteRun): GameState {
  const s = clone(r.state);
  let guard = 0;
  while (!s.hotel?.offersMade && guard++ < 10_000) run(s, T, nullSink, 1);
  return s;
}

console.log('# Finite phase\n');
const runs: Record<string, FiniteRun> = {};
for (const bot of Object.values(BOTS)) {
  const r = playFinite(T, bot, 1, 3600);
  runs[bot.name] = r;
  const m = r.milestones;
  const stage4 = r.log.readinessPinnedTick === null ? null : r.log.readinessPinnedTick * T.tickSeconds;
  console.log(`${bot.name.padEnd(7)} declare ${fmt(r.declaredSeconds)} | office ${fmt(m.office ?? null)} building ${fmt(m.building ?? null)} tall ${fmt(m.tall ?? null)} all-stage-4 ${fmt(stage4)}`);
  const until = r.log.declaredTick ?? Infinity;
  console.log(`        longest dead gap ${sec(longestDeadGap(r.log, T, until))} purchases only, ${sec(longestDeadGap(r.log, T, until, { countRebalances: true }))} counting rebalances | Readiness rebalances: ${rebalancingDecisionsY(r.log)} at Y=10%, ${rebalancingEpisodes(r.log)} episodes`);
}

const casual = runs.casual!;
if (casual.declaredSeconds !== null) {
  const atOffers = toFirstOffers(casual);
  const d = evaluateFirstDecision(atOffers, T);
  console.log('\n# First hotel decision (casual)\n');
  // Income at the reference (suggested idle) funding: what a player following suggestions earns.
  const income = N.toNumber(certifyMarkets(atOffers, T, referenceHotelPool(atOffers, T), { home: 1 }).income);
  console.log(`bank ${(N.toNumber(atOffers.bananas) / income).toFixed(0)} s of income; banana-rush target ${(d.targets.bananaTarget / income).toFixed(0)} s of income\n`);
  console.log('Four fixed policies following the suggested split and funding (not a search).\n');
  console.log('choice      banana rush  epic first  expansion first  completed  payoff  Greek Commission  forgone (s of income)');
  for (const o of Object.values(d.outcomes)) {
    console.log(`${o.choice.padEnd(11)} ${sec(o.bananaRushSeconds).padStart(11)}  ${sec(o.epicSeconds).padStart(10)}  ${sec(o.expansionSeconds).padStart(15)}  ${sec(o.completedSeconds).padStart(9)}  ${sec(o.payoffSeconds).padStart(6)}  ${sec(o.greekCommissionSeconds).padStart(16)}  ${o.productionIncomeForgone === null ? '—' : (o.productionIncomeForgone / income).toFixed(0)}`);
  }
  console.log('\npreview vs actual completion:');
  for (const c of ['immediate', 'permanent', 'expansion'] as const) console.log(`  ${c.padEnd(10)} preview ${sec(d.previews[c].etaSeconds)} actual ${sec(d.outcomes[c].completedSeconds)}`);

  console.log('\n# Candidate: cheaper first hotel upgrade, across arrival balances (×1.5)\n');
  console.log('first upgrade (s of income) | bank at arrival (s of income) → ordinary / immediate to target, Immediate payoff');
  for (const costSeconds of [300, 450, 600]) {
    const cells: string[] = [];
    for (const bank of [0, 60, 120, 180, 240]) {
      const s = clone(atOffers);
      s.hotel!.upgradeCostBase = N.of(income * costSeconds);
      s.bananas = N.of(income * bank);
      const targets = profileTargets(s, T);
      const ord = playChoice(s, T, 'ordinary', targets, 1500).bananaRushSeconds;
      const imm = playChoice(s, T, 'immediate', targets, 1500);
      const win = imm.bananaRushSeconds !== null && ord !== null && imm.bananaRushSeconds < ord;
      const pay = imm.payoffSeconds !== null && imm.payoffSeconds <= 180;
      cells.push(`${bank}s: ${sec(ord)}/${sec(imm.bananaRushSeconds)} pay ${sec(imm.payoffSeconds)} ${win && pay ? '✓✓' : win ? '✓·' : pay ? '·✓' : '··'}`);
    }
    console.log(`${String(costSeconds).padStart(4)} s | ${cells.join(' | ')}`);
  }
  console.log('(✓✓ = Immediate wins banana rush AND pays off within 3 min)');

  console.log(`\n# Suggested idle funding: 90% vs 100% Editing (reference share fixed at ${T.hotel.funding.referenceEditing * 100}%; current: ${T.hotel.funding.idleEditing * 100}%)\n`);
  const T90 = JSON.parse(JSON.stringify(T)) as typeof T;
  T90.hotel.funding.idleEditing = 0.9;
  const T100 = JSON.parse(JSON.stringify(T)) as typeof T;
  T100.hotel.funding.idleEditing = 1;
  const d90 = evaluateFirstDecision(atOffers, T90);
  const d100 = evaluateFirstDecision(atOffers, T100);
  console.log('choice      completed (90% / 100%)   banana rush (90% / 100%)   expansion first (90% / 100%)');
  for (const c of ['ordinary', 'immediate', 'permanent', 'expansion'] as const) {
    const a = d90.outcomes[c], b = d100.outcomes[c];
    console.log(`${c.padEnd(11)} ${sec(a.completedSeconds)} / ${sec(b.completedSeconds)}`.padEnd(37) + `${sec(a.bananaRushSeconds)} / ${sec(b.bananaRushSeconds)}`.padEnd(27) + `${sec(a.expansionSeconds)} / ${sec(b.expansionSeconds)}`);
  }

  console.log('\n# Immediate vs ordinary under banana rush: sensitivity\n');
  console.log('upgrade cost (s of income) × payout multiplier → ordinary / immediate (seconds to target)');
  for (const costSeconds of [300, 600, 900]) {
    // costSeconds overrides the tuning for this table only.
    const row: string[] = [];
    for (const mult of [1.5, 2, 3]) {
      const s = clone(atOffers);
      s.hotel!.upgradeCostBase = N.of(income * costSeconds);
      const c = s.hotel!.commissions.immediate!;
      c.reward.bananas = N.of(previewCommission(s, T, 'immediate')!.productionIncomeForgone * mult);
      const targets = profileTargets(s, T);
      const ord = playChoice(s, T, 'ordinary', targets, 1500).bananaRushSeconds;
      const imm = playChoice(s, T, 'immediate', targets, 1500).bananaRushSeconds;
      row.push(`×${mult}: ${sec(ord)} / ${sec(imm)}${imm !== null && ord !== null && imm < ord ? ' ✓' : ''}`);
    }
    console.log(`${String(costSeconds).padStart(4)} s   ${row.join('   ')}`);
  }
}
