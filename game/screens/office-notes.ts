// The Director's Office, below the finish line: what the support heads' requests have done.
// Morale, timed boosts, owned upgrades, audits and the last quarter's report, as plain facts.
//   morale          <- moraleMult, tuning's fade rate, permMult(moraleFade)
//   timed boosts    <- office.timed (untilTick), the project's own multiplier
//   upgrades        <- office.owned counts, ProjectDef.max
//   audits          <- office.audits (amount, dueTick)
//   last report     <- budget.lastReport
// Countdowns are plain text, never a live region (MOBILE-UX rule 24). Nothing here computes game math.
import { DEPTS, moraleMult, projectDef, type GameState, type QuarterReport, type Tuning } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { formbox } from '../ui/forms.js';
import { DEPT_LABEL, aboutTime, fadeMultOf, projectFact, projectTitle } from '../world/projects.js';
import './office-notes.css';

interface Row {
  title: string;
  fact: string;
  /** Right-hand figure: time left, a count. */
  tag?: string;
}

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function list(rows: Row[], empty: string): HTMLElement {
  if (!rows.length) return h('p', { class: 'ofc-none' }, empty);
  return h('ul', { class: 'ofc-list' }, ...rows.map((r) => h('li', {}, h('b', {}, r.title), r.tag ? h('span', { class: 'tl' }, r.tag) : '', h('span', { class: 'lx' }, r.fact))));
}

/** Morale as a percentage, what it will do, and the accepted morale projects of this quarter that are lifting it. */
function morale(s: GameState, t: Tuning): Row[] {
  const m = moraleMult(s);
  const fade = t.budget?.morale.fadePerSecond ?? 0;
  const back = fade > 0 ? (m - 1) / (fade * fadeMultOf(s, t)) : 0;
  const rows: Row[] = [
    {
      title: `Morale ${Math.round(m * 100)}%`,
      fact: m > 1.0004 ? `All staff work ${Math.round((m - 1) * 100)}% faster, fading back to 100% in about ${aboutTime(back)}.` : 'At 100%: no bonus. It never drops below 100%.',
    },
  ];
  if (m > 1.0004) {
    const names = new Map<string, number>();
    for (const r of s.budget?.stats.requests ?? []) {
      if (r.outcome === 'granted' && projectDef(t, r.kind)?.effect.type === 'morale') names.set(projectTitle(r.kind), (names.get(projectTitle(r.kind)) ?? 0) + 1);
    }
    if (names.size) rows.push({ title: 'Lifted by', fact: [...names].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ') + ' this quarter.' });
  }
  return rows;
}

/** Timed effects now running. */
function boosts(s: GameState, t: Tuning): Row[] {
  const rows: Row[] = [];
  for (const e of s.office?.timed ?? []) {
    const p = projectDef(t, e.project);
    if (!p || e.untilTick <= s.tick) continue;
    rows.push({ title: projectTitle(e.project), fact: projectFact(t, p), tag: `${mmss((e.untilTick - s.tick) * t.tickSeconds)} left` });
  }
  return rows;
}

/** Permanent upgrades owned, with counts. */
function upgrades(s: GameState, t: Tuning): Row[] {
  const o = s.office;
  const rows: Row[] = [];
  if (!o || !t.budget) return rows;
  for (const p of t.budget.projects) {
    const n = o.owned[p.id] ?? 0;
    if (n < 1) continue;
    if (p.effect.type === 'morale' || p.effect.type === 'timed' || p.effect.type === 'audit') continue;
    rows.push({ title: projectTitle(p.id), fact: `${projectFact(t, p)} each.`, tag: p.max ? `${n} of ${p.max}` : `×${n}` });
  }
  return rows;
}

function audits(s: GameState, t: Tuning): Row[] {
  return (s.office?.audits ?? []).map((a) => ({ title: 'Audit under way', fact: `Findings of ${f.bananas(a.amount)} go to the pot.`, tag: `${mmss((a.dueTick - s.tick) * t.tickSeconds)} left` }));
}

/** The last closed quarter as plain facts. */
function lastReport(r: QuarterReport | null | undefined): Row[] {
  if (!r) return [];
  const n = (x: number, one: string, many = `${one}s`) => `${f.count(x)} ${x === 1 ? one : many}`;
  const levels = DEPTS.reduce((a, d) => a + r.autoLevels[d], 0);
  const q = r.requisitions;
  const rows: Row[] = [
    { title: `Q${r.quarter} income`, fact: `Over ${f.duration(r.seconds)}.`, tag: f.bananas(r.income) },
    { title: 'Levels bought by departments', fact: levels > 0 ? DEPTS.filter((d) => r.autoLevels[d] > 0).map((d) => `${DEPT_LABEL[d]} +${f.count(r.autoLevels[d])}`).join(', ') + '.' : 'None bought from their accounts.', tag: f.count(levels) },
    { title: 'Staff and desks', fact: `${n(r.hires + r.manualHires, 'monkey')} seated (${f.count(r.manualHires)} by hand); ${n(r.desksBuilt + r.desksBought, 'desk')} added (${f.count(r.desksBought)} bought).` },
    { title: 'Finds', fact: `${f.count(r.certifiedFinds)} certified, ${f.count(r.discardedFinds)} discarded.` },
    { title: 'Wallet and pot', fact: `${f.bananas(r.walletSpent)} spent from the wallet; ${f.bananas(r.swept)} swept to the pot${r.auditFound > 0 ? `; audits found ${f.bananas(r.auditFound)}` : ''}.` },
    { title: 'Requests', fact: q.offered ? `${f.count(q.offered)} filed: ${f.count(q.granted)} accepted, ${f.count(q.declined)} declined, ${f.count(q.expired)} expired.` : 'None filed.' },
  ];
  if (r.ranOnOldLines) rows.push({ title: 'Review left unsigned', fact: 'This quarter ran on the previous lines.' });
  return rows;
}

export interface OfficeNotes {
  /** The sections, to append below the Director's Office content. Hidden until the budget opens. */
  el: HTMLElement;
  /** The "Last quarter's report" section, to scroll to. */
  report: HTMLElement;
  render(s: GameState): void;
}

export function mountOfficeNotes(ctx: Ctx): OfficeNotes {
  const { t } = ctx;
  const keys: string[] = [];
  const boxes: { el: HTMLElement; body: HTMLElement; rows: (s: GameState) => Row[]; empty: string; hideEmpty: boolean; section: HTMLElement }[] = [];
  const add = (title: string, rows: (s: GameState) => Row[], empty: string, hideEmpty = false, id?: string) => {
    const body = h('div', {});
    const section = formbox(title, body);
    if (id) section.id = id;
    boxes.push({ el: section, body, rows, empty, hideEmpty, section });
    return section;
  };
  add('Staff morale', (s) => morale(s, t), '');
  add('Active boosts', (s) => boosts(s, t), 'Nothing running right now.');
  add('Office upgrades', (s) => upgrades(s, t), 'None yet. The heads send requests during the quarter.');
  add('Audits under way', (s) => audits(s, t), '', true);
  const report = add("Last quarter's report", (s) => lastReport(s.budget?.lastReport), 'No quarter has closed yet. The report appears here after the first one.');
  report.dataset.section = 'report';
  const el = h('div', { class: 'form-stack office-notes', hidden: true }, ...boxes.map((b) => b.el));
  return {
    el,
    report,
    render(s) {
      const on = !!s.office;
      if (el.hidden === on) el.hidden = !on;
      if (!on) return;
      boxes.forEach((b, i) => {
        const rows = b.rows(s);
        b.section.hidden = b.hideEmpty && !rows.length;
        const k = JSON.stringify(rows);
        if (k === keys[i]) return;
        keys[i] = k;
        b.body.replaceChildren(list(rows, b.empty));
      });
    },
  };
}
