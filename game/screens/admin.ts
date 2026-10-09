// The three support offices (Administration floor): Facilities, Accounting, Training.
// Each room shows what its head has set running, from `state.office` and the quarter's request log:
//   morale          <- moraleMult, tuning's fade rate, permMult(moraleFade)
//   timed boosts    <- office.timed (untilTick), the project's own multiplier
//   owned upgrades  <- office.owned counts, ProjectDef.max
//   audits          <- office.audits (amount, dueTick)
//   this quarter    <- budget.stats.requests and budget.stats.requisitions
// Facts only. The Foreman's amenities are listed under Facilities. Countdowns are plain text,
// never a live region (MOBILE-UX rule 24).
import { DEPTS, N, moraleMult, projectDef, type GameState, type QuarterReport, type Tuning } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { formbox, stack } from '../ui/forms.js';
import { DEPT_LABEL, HEAD_NAMES, OFFICE_NAMES, aboutTime, fadeMultOf, officeOf, projectFact, projectTitle, type OfficeId } from '../world/projects.js';
import './admin.css';

interface Row {
  title: string;
  fact: string;
  /** Right-hand figure: time left, a count. */
  tag?: string;
}

const FORM: Record<OfficeId, string> = { facilities: 'Ref. 2-F', accounting: 'Ref. 1-A', training: 'Ref. 6-T' };
const WHO: Record<OfficeId, string> = {
  facilities: 'The Facilities Manager files the morale projects: parties and exercises. The Foreman files the amenities, listed here too.',
  accounting: 'The Chief Accountant files audits and efficiency findings.',
  training: 'The Training Officer files courses.',
};

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function list(rows: Row[], empty: string): HTMLElement {
  if (!rows.length) return h('p', { class: 'ofc-none' }, empty);
  return h('ul', { class: 'ofc-list' }, ...rows.map((r) => h('li', {}, h('b', {}, r.title), r.tag ? h('span', { class: 'tl' }, r.tag) : '', h('span', { class: 'lx' }, r.fact))));
}

/** What is in effect now for an office. */
function inEffect(id: OfficeId, s: GameState, t: Tuning): Row[] {
  const o = s.office;
  if (!o) return [];
  const rows: Row[] = [];
  if (id === 'facilities') {
    const m = moraleMult(s);
    const fade = t.budget?.morale.fadePerSecond ?? 0;
    const back = fade > 0 ? (m - 1) / (fade * fadeMultOf(s, t)) : 0;
    rows.push({
      title: `Morale ${Math.round(m * 100)}%`,
      fact: m > 1.0004 ? `All staff work ${Math.round((m - 1) * 100)}% faster, fading back to 100% in about ${aboutTime(back)}.` : 'At 100%: no bonus. It never drops below 100%.',
    });
  }
  for (const e of o.timed) {
    const p = projectDef(t, e.project);
    if (!p || e.untilTick <= s.tick || officeOf(p.from) !== id) continue;
    rows.push({ title: projectTitle(e.project), fact: projectFact(t, p), tag: `${mmss((e.untilTick - s.tick) * t.tickSeconds)} left` });
  }
  if (id === 'accounting') {
    for (const a of o.audits) {
      rows.push({ title: 'Audit under way', fact: `Findings of ${f.bananas(a.amount)} go to the pot.`, tag: `${mmss((a.dueTick - s.tick) * t.tickSeconds)} left` });
    }
  }
  return rows;
}

/** Projects owned for an office, with counts. The permanent ones; repeatable projects show in the quarter's log. */
function owned(id: OfficeId, s: GameState, t: Tuning): Row[] {
  const o = s.office;
  const rows: Row[] = [];
  if (!o || !t.budget) return rows;
  for (const p of t.budget.projects) {
    const n = o.owned[p.id] ?? 0;
    if (n < 1 || officeOf(p.from) !== id) continue;
    if (p.effect.type === 'morale' || p.effect.type === 'timed' || p.effect.type === 'audit') continue;
    rows.push({ title: `✓ ${projectTitle(p.id)}`, fact: `${projectFact(t, p)} each.`, tag: p.max ? `${n} of ${p.max}` : `×${n}` });
  }
  return rows;
}

/** The last closed quarter as plain facts: the route back to the review's report once it is signed. */
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

/** This quarter's requests from this office's heads, newest first. */
function requests(id: OfficeId, s: GameState, t: Tuning): Row[] {
  const rows: Row[] = [];
  const b = s.budget;
  if (!b) return rows;
  const q = b.requisition;
  if (q && officeOf(q.from) === id && q.kind !== 'levels') {
    rows.push({ title: `${projectTitle(q.kind)}: open`, fact: `${f.bananas(q.price)} asked. Answer from the memo tab.`, tag: `${mmss((q.expiresTick - s.tick) * t.tickSeconds)} left` });
  }
  for (const r of [...b.stats.requests].reverse()) {
    if (r.kind === 'levels' || officeOf(r.from) !== id) continue;
    rows.push({ title: projectTitle(r.kind), fact: `${f.bananas(r.price)} · ${HEAD_NAMES[r.from]}`, tag: r.outcome === 'granted' ? 'Accepted' : r.outcome === 'declined' ? 'Declined' : 'Expired' });
  }
  return rows;
}

function office(id: OfficeId): Screen {
  return {
    id,
    label: OFFICE_NAMES[id],
    mount(root: HTMLElement, ctx: Ctx): () => void {
      const { t } = ctx;
      const note = h('p', { class: 'ofc-note' }, WHO[id]);
      const effectBox = h('div', {});
      const ownedBox = h('div', {});
      const reqBox = h('div', {});
      const tally = h('p', { class: 'ofc-tally' });
      const reportBox = h('div', {});
      root.append(
        stack(
          formbox(`${FORM[id]} / ${OFFICE_NAMES[id]}`, note),
          ...(id === 'accounting' ? [formbox(`${FORM[id]} / Last quarter's report`, reportBox)] : []),
          formbox(`${FORM[id]} / In effect`, effectBox),
          formbox(`${FORM[id]} / ${id === 'facilities' ? 'Built and owned' : 'Owned upgrades'}`, ownedBox),
          formbox(`${FORM[id]} / This quarter's requests`, reqBox, tally),
        ),
      );
      const keys = ['', '', '', '', ''];
      const fill = (box: HTMLElement, i: number, rows: Row[], empty: string) => {
        const k = JSON.stringify(rows);
        if (k === keys[i]) return;
        keys[i] = k;
        box.replaceChildren(list(rows, empty));
      };
      return () => {
        const s = ctx.state();
        fill(effectBox, 0, inEffect(id, s, t), 'Nothing running right now.');
        fill(ownedBox, 1, owned(id, s, t), 'None yet.');
        fill(reqBox, 2, requests(id, s, t), 'No requests from this office yet this quarter.');
        if (id === 'accounting') fill(reportBox, 4, lastReport(s.budget?.lastReport), 'No quarter has closed yet. The report appears here after the first one.');
        const st = s.budget?.stats;
        if (st) {
          const r = st.requisitions;
          const extra = id === 'accounting' ? ` Audits found ${f.bananas(st.auditFound)} so far. Pot for next quarter: ${f.bananas(N.toNumber(s.budget!.pot))}.` : '';
          const line = `All heads together: ${f.count(r.offered)} offered, ${f.count(r.granted)} accepted, ${f.count(r.declined)} declined, ${f.count(r.expired)} expired. Spent ${f.bananas(st.walletSpent)} from the wallet.${extra}`;
          if (tally.textContent !== line) tally.textContent = line;
        }
      };
    },
  };
}

export const facilities = office('facilities');
export const accounting = office('accounting');
export const training = office('training');
