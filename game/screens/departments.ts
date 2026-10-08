// Departments: one screen with views. Summary (the Next card plus jump rows), one view per
// department (Level up, Stage, Balanced buy, readiness), and Funding (the budget facts and readiness meters).
// Contents of a paper sheet; mounted once, so the view survives the sheet closing until reset.
import {
  DEPTS, N, buyDeptLevel, buyDeptStage, certifyTiers, deptLevelCost, deptOutput, deptStageCost, editingPool,
  meters, nullSink,
  type DeptId, type GameState, type Num, type Shares,
} from '../../core/index.js';
import type { Action, Ctx, Screen } from '../ctx.js';
import { h, show, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, buyRow, ledger, nextCard, readinessBottleneck, stamp, type Ledger } from '../ui/forms.js';
import './departments.css';

type View = 'summary' | DeptId | 'funding';

const NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
const UNITS: Record<DeptId, string> = { recruiting: 'monkeys/s', construction: 'desks/s', editing: 'review units/s' };
const BLURB: Record<DeptId, string> = {
  recruiting: 'Recruiters hire monkeys for you. Each new monkey needs a desk.',
  construction: 'Builders build desks for the monkeys.',
  editing: 'Editors review finds. Without Editors, finds are thrown away.',
};
const REF: Record<DeptId, string> = { recruiting: '5-D/1', construction: '5-D/2', editing: '5-D/3' };
const CLOSED = 'Closed after Infinity.';

/** A stage row appears once bananas reach this share of its price. */
const STAGE_REACH = 0.4;
/** Ignore taps on the Next card's button this long after any action (ms): the button under the finger may change. */
const TAP_GUARD_MS = 350;

const balancedBuy: Action = (s, t, k) => buyDeptLevel(s, t, k, 'recruiting') && buyDeptLevel(s, t, k, 'construction');

const isView = (v: unknown): v is View => v === 'summary' || v === 'funding' || DEPTS.includes(v as DeptId);

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  let view: View = 'summary';
  let guarded = false;
  let nextAct: (() => void) | null = null;

  const act = (a: Action): boolean => {
    const ok = ctx.act(a);
    if (ok) {
      guarded = true;
      window.setTimeout(() => { guarded = false; }, TAP_GUARD_MS);
    }
    return ok;
  };
  const outNum = (s: GameState, d: DeptId): number => N.toNumber(deptOutput(s, t, d));
  const outText = (s: GameState, d: DeptId): string => f.amount(outNum(s, d));
  const funded = (s: GameState): boolean => DEPTS.filter((d) => s.depts[d].level > 0).length >= 2;
  const budgetLines = (s: GameState): string => {
    const l = s.budget?.lines;
    return l ? `${DEPTS.map((d) => `${NAMES[d]} ${f.pct(l[d])}`).join(' · ')} · Wallet ${f.pct(l.discretionary)}` : '';
  };
  const pctWords = (sh: Shares): string => DEPTS.map((d) => `${NAMES[d]} ${f.pct(sh[d])}`).join(' · ');

  // ----- summary view -----
  const next = nextCard({ onAct: () => { if (!guarded) nextAct?.(); } });
  const jumpEls = {} as Record<DeptId | 'funding', { el: HTMLButtonElement; out: HTMLElement; status: HTMLElement }>;
  const jumpRow = (id: DeptId | 'funding', name: string): HTMLButtonElement => {
    const out = h('span', { class: 'jump-out' });
    const status = h('span', { class: 'jump-status' });
    const el = h('button', { type: 'button', class: 'jump', onclick: () => setView(id, true) },
      h('span', { class: 'jump-main' }, h('span', { class: 'jump-name' }, name), out, status),
      h('span', { class: 'jump-chev', 'aria-hidden': 'true' }));
    jumpEls[id] = { el, out, status };
    return el;
  };
  const summaryView = h('div', { class: 'dview dview-summary' },
    next.el,
    h('div', { class: 'jumps' }, ...DEPTS.map((d) => jumpRow(d, NAMES[d])), jumpRow('funding', 'Budget and effort')),
  );

  // ----- department view -----
  const backBtn = (label: string): { btn: HTMLButtonElement; id: HTMLElement } => {
    const id = h('span', { class: 'back-id' });
    const btn = h('button', { type: 'button', class: 'quiet back', onclick: () => setView('summary', true) },
      h('span', { class: 'back-chev', 'aria-hidden': 'true' }), h('span', { class: 'back-label' }, label), id);
    return { btn, id };
  };
  const deptBack = backBtn('All departments');
  const levelRow = buyRow({ verb: 'Buy', onBuy: () => act((s, tt, k) => buyDeptLevel(s, tt, k, view as DeptId)) });
  const stageRow = buyRow({ verb: 'Buy', onBuy: () => act((s, tt, k) => buyDeptStage(s, tt, k, view as DeptId)) });
  const stageLine = h('p', { class: 'stage-line' });
  const finalRow = h('div', { class: 'final-row' }, stamp('Final stage', 'ok'),
    h('p', { class: 'why' }, 'This department now self-replicates, so balance drifts. Watch the meters.'));
  const pairRow = buyRow({ verb: '', onBuy: () => act(balancedBuy) });
  const meterTxt = h('span', { class: 'ready-txt' });
  const meterLed = ledger('Readiness');
  const fundLink = h('button', { type: 'button', class: 'quiet', onclick: () => setView('funding', true) }, 'See the budget');
  const acctLine = h('p', { class: 'stage-line acct-line', hidden: true });
  const readyBlock = h('div', { class: 'ready' },
    h('div', { class: 'ready-head' }, h('span', { class: 'm-nm' }, 'Readiness'), meterTxt),
    meterLed.el, fundLink);
  const blurb = h('p', { class: 'blurb' });
  const legend = h('p', { class: 'legend' }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), 'Levels add a little. Stages multiply.');
  const deptView = h('div', { class: 'dview dview-dept' }, deptBack.btn, levelRow.el, acctLine, stageRow.el, stageLine, finalRow, pairRow.el, readyBlock, blurb, legend);

  // ----- funding view -----
  const fundBack = backBtn('All departments');
  fundBack.id.textContent = 'Budget';
  const mRows = {} as Record<DeptId, { led: Ledger; txt: HTMLElement; share: HTMLElement }>;
  const meterBlock = h('div', { class: 'meters3' }, ...DEPTS.map((d) => {
    const led = ledger(`${NAMES[d]} readiness`);
    const txt = h('span', { class: 'm-txt' });
    const share = h('span', { class: 'm-share' });
    mRows[d] = { led, txt, share };
    return h('div', { class: 'm-row' }, h('span', { class: 'm-name' }, h('span', { class: 'm-nm' }, NAMES[d]), share), led.el, txt);
  }));
  // Facts, not controls: core refuses setShares while the budget runs.
  const bf = {} as Record<DeptId, { eff: HTMLElement; line: HTMLElement; acct: HTMLElement; bar: HTMLElement }>;
  const walletFact = h('p', { class: 'explain' });
  const budgetFacts = h('div', { class: 'bfacts' },
    h('h3', { class: 'bf-head' }, 'The heads coordinate effort'),
    h('p', { class: 'explain' }, 'The department heads split their effort among themselves. Money reaches each department through the budget lines signed at the quarterly review.'),
    ...DEPTS.map((d) => {
      const eff = h('dd', { class: 'bf-v' });
      const line = h('dd', { class: 'bf-v' });
      const acct = h('dd', { class: 'bf-v' });
      const bar = h('span', { class: 'bf-bar', role: 'progressbar', 'aria-label': `${NAMES[d]} account toward its next level`, 'aria-valuemin': '0', 'aria-valuemax': '100' });
      bf[d] = { eff, line, acct, bar };
      return h('dl', { class: 'bfact' },
        h('dt', { class: 'bf-name' }, NAMES[d]),
        h('div', { class: 'bf-row' }, h('dt', { class: 'bf-k' }, 'Effort'), eff),
        h('div', { class: 'bf-row' }, h('dt', { class: 'bf-k' }, 'Budget line'), line),
        h('div', { class: 'bf-row' }, h('dt', { class: 'bf-k' }, 'Account'), acct),
        bar);
    }),
    walletFact);
  const fundView = h('div', { class: 'dview dview-fund dview-budget' }, fundBack.btn, budgetFacts, meterBlock);

  root.append(h('div', { class: 'dept-screen' }, summaryView, deptView, fundView));

  // ----- view switching -----
  function applyView(): void {
    show(summaryView, view === 'summary');
    show(deptView, view !== 'summary' && view !== 'funding');
    show(fundView, view === 'funding');
  }
  function setView(v: View, focus = false): void {
    const from = view;
    view = v;
    applyView();
    render();
    const scroller = root.parentElement;
    if (scroller) scroller.scrollTop = 0;
    if (!focus) return;
    const target = v === 'summary' ? (from !== 'summary' ? jumpEls[from]?.el : null) ?? next.button : (v === 'funding' ? fundBack.btn : deptBack.btn);
    target.focus({ preventScroll: true });
  }

  window.addEventListener('im:dept-view', (e) => {
    const d = (e as CustomEvent<unknown>).detail;
    if (isView(d)) setView(d);
  });
  // Reopening the room from its floor starts at the summary: reset when it closes or another room replaces it.
  const reset = () => { if (view !== 'summary') setView('summary'); };
  let wasOpen = document.body.classList.contains('room-open');
  new MutationObserver(() => {
    const now = document.body.classList.contains('room-open');
    if (wasOpen && !now) reset();
    wasOpen = now;
  })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => { if (root.hidden) reset(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  applyView();

  // ----- render -----
  function renderSummary(s: GameState): void {
    const bananas = N.toNumber(s.bananas);
    const open = funded(s);
    const mNow = meters(s, t);

    for (const d of DEPTS) {
      const dep = s.depts[d];
      const j = jumpEls[d];
      text(j.out, `Level ${f.count(dep.level)} · ${outText(s, d)} ${UNITS[d]}`);
      const sc = deptStageCost(s, t, d);
      let status: string;
      if (dep.level === 0) status = `Not started. Level 1 costs ${f.bananaText(deptLevelCost(s, t, d))}.`;
      else {
        const parts = [`Stage ${dep.stage} of 4`];
        if (sc !== null && bananas >= N.toNumber(sc)) parts.push('next stage affordable');
        else if (open) parts.push(`readiness ${f.meterPct(mNow[d])} ${f.meterWord(mNow[d])}`);
        status = parts.join(' · ');
      }
      text(j.status, status);
      j.el.setAttribute('aria-label', `${NAMES[d]}. ${j.out.textContent}. ${status}`);
    }
    const fj = jumpEls.funding;
    show(fj.el, open);
    if (open) {
      text(fj.out, `Effort: ${pctWords(s.shares)}`);
      const status = s.budget ? `Budget lines: ${budgetLines(s)}.` : 'The budget has not opened yet.';
      text(fj.status, status);
      fj.el.setAttribute('aria-label', `Budget and effort. ${fj.out.textContent}. ${status}`);
    }

    // ----- Next card: chosen by situation, never by payoff -----
    const levelNext = (d: DeptId, why: string, secondary?: string) => {
      const cost = deptLevelCost(s, t, d);
      const after = ctx.preview((c) => { afford(c, N.toNumber(cost)); buyDeptLevel(c, t, nullSink, d); });
      const can = ctx.can(`buyDeptLevel:${d}`, (st, tt, k) => buyDeptLevel(st, tt, k, d));
      nextAct = () => { act((st, tt, k) => buyDeptLevel(st, tt, k, d)); };
      next.update({
        label: `Level up ${NAMES[d]}`, cost: N.toNumber(cost), enabled: can, why,
        effect: { label: 'Output', from: outText(s, d), to: `${outText(after, d)} ${UNITS[d]}` },
        reason: f.shortBy(cost, s.bananas) ?? CLOSED, secondary: secondary ?? null,
      });
    };

    if (s.depts.recruiting.level === 0) {
      const total = N.add(deptLevelCost(s, t, 'recruiting'), deptLevelCost(s, t, 'construction'));
      const after = ctx.preview((c) => { afford(c, N.toNumber(total)); balancedBuy(c, t, nullSink); });
      const can = ctx.can('balancedBuy', balancedBuy);
      nextAct = () => { act(balancedBuy); };
      next.update({
        label: 'Hire a Recruiter and a Builder', cost: N.toNumber(total), enabled: can,
        why: 'Recruiters hire for you; each new monkey needs a desk, so buy a Recruiter and a Builder together.',
        effect: `Monkeys ${outText(s, 'recruiting')} → ${outText(after, 'recruiting')}/s · desks ${outText(s, 'construction')} → ${outText(after, 'construction')}/s`,
        reason: f.shortBy(total, s.bananas) ?? CLOSED,
        secondary: null,
      });
      return;
    }
    const stageD = DEPTS.find((d) => {
      const sc = deptStageCost(s, t, d);
      return s.depts[d].level > 0 && sc !== null && bananas >= N.toNumber(sc);
    });
    if (stageD) {
      const sc = deptStageCost(s, t, stageD) as Num;
      const after = ctx.preview((c) => { buyDeptStage(c, t, nullSink, stageD); });
      const can = ctx.can(`buyDeptStage:${stageD}`, (st, tt, k) => buyDeptStage(st, tt, k, stageD));
      nextAct = () => { act((st, tt, k) => buyDeptStage(st, tt, k, stageD)); };
      next.update({
        label: `${NAMES[stageD]} stage ${s.depts[stageD].stage + 1}`, cost: N.toNumber(sc), enabled: can,
        why: 'You can afford a stage. Levels add a little; stages multiply.',
        effect: { label: 'Output', from: outText(s, stageD), to: `${outText(after, stageD)} ${UNITS[stageD]}` },
        reason: f.shortBy(sc, s.bananas) ?? CLOSED, secondary: null,
      });
      return;
    }
    const cert = certifyTiers(s, t, editingPool(s, t), s.tierAllocation);
    const keptTotal = Object.values(cert.certified).reduce((a, x) => N.add(a, x), N.zero);
    const findsTotal = N.add(keptTotal, cert.discarded);
    const discarding = N.gt(cert.discarded, N.zero) && N.ratio(cert.discarded, findsTotal) > 0.0005;
    if (discarding) {
      levelNext('editing', `Finds are being thrown away: ${f.rate(cert.discarded)} of submissions go unreviewed.`);
      return;
    }
    nextAct = null;
    next.update({ label: null, hint: open ? readinessBottleneck(s, t) : 'Level up a department from the rows below.' });
  }

  function renderDept(s: GameState, d: DeptId): void {
    const dep = s.depts[d];
    const bananas = N.toNumber(s.bananas);
    const open = funded(s);
    text(deptBack.id, `${NAMES[d]} · ${REF[d]}`);

    // Level up: before -> after from core's preview
    const lCost = deptLevelCost(s, t, d);
    const lAfter = ctx.preview((c) => { afford(c, N.toNumber(lCost)); buyDeptLevel(c, t, nullSink, d); });
    const canLevel = ctx.can(`buyDeptLevel:${d}`, (st, tt, k) => buyDeptLevel(st, tt, k, d));
    levelRow.update({
      label: `${NAMES[d]} level ${f.count(dep.level)} → ${f.count(lAfter.depts[d].level)}`,
      effect: { label: 'Output', from: outText(s, d), to: `${outText(lAfter, d)} ${UNITS[d]}` },
      price: N.toNumber(lCost), have: bananas, progress: N.ratio(s.bananas, lCost), enabled: canLevel,
      reason: f.shortBy(lCost, s.bananas) ?? CLOSED,
    });

    const bud = s.budget;
    show(acctLine, !!bud);
    if (bud) text(acctLine, `${NAMES[d]} account: ${f.bananaText(bud.accounts[d])} of ${f.bananaText(lCost)} for its next level. The department buys it on its own; you can also buy it from your wallet.`);

    // Stage: only at level 1+, a row once within reach, otherwise one line
    const sc = deptStageCost(s, t, d);
    const hasStages = dep.level > 0;
    const reach = hasStages && sc !== null && bananas >= STAGE_REACH * N.toNumber(sc);
    show(stageRow.el, reach);
    show(stageLine, hasStages && sc !== null && !reach);
    show(finalRow, hasStages && sc === null);
    if (sc !== null && hasStages) {
      if (reach) {
        const sAfter = ctx.preview((c) => { afford(c, N.toNumber(sc)); buyDeptStage(c, t, nullSink, d); });
        const canStage = ctx.can(`buyDeptStage:${d}`, (st, tt, k) => buyDeptStage(st, tt, k, d));
        stageRow.update({
          label: `${NAMES[d]} stage ${dep.stage} → ${sAfter.depts[d].stage}`,
          effect: { label: 'Output', from: outText(s, d), to: `${outText(sAfter, d)} ${UNITS[d]}` },
          price: N.toNumber(sc), have: bananas, progress: N.ratio(s.bananas, sc), enabled: canStage,
          reason: f.shortBy(sc, s.bananas) ?? CLOSED,
        });
      } else {
        text(stageLine, dep.stage === 1 ? `Stage 1 of 4. Stages unlock at ${f.count(sc)}.` : `Stage ${dep.stage} of 4. The next stage unlocks at ${f.count(sc)}.`);
      }
    }

    // Balanced buy (Recruiting and Construction only)
    const paired = d !== 'editing';
    show(pairRow.el, paired);
    if (paired) {
      const total = N.add(deptLevelCost(s, t, 'recruiting'), deptLevelCost(s, t, 'construction'));
      const pAfter = ctx.preview((c) => { afford(c, N.toNumber(total)); balancedBuy(c, t, nullSink); });
      const canPair = ctx.can('balancedBuy', balancedBuy);
      pairRow.update({
        label: 'Hire a Recruiter and a Builder',
        effect: `+1 level each. Monkeys ${outText(s, 'recruiting')} → ${outText(pAfter, 'recruiting')}/s, desks ${outText(s, 'construction')} → ${outText(pAfter, 'construction')}/s`,
        price: N.toNumber(total), have: bananas, progress: N.ratio(s.bananas, total), enabled: canPair,
        reason: f.shortBy(total, s.bananas) ?? CLOSED,
      });
    }

    // Readiness (nothing to fund until two departments have a level)
    const showReady = hasStages && open;
    show(readyBlock, showReady);
    if (showReady) {
      const m = meters(s, t);
      const w = 'effort';
      text(meterTxt, `${f.meterPct(m[d])} ${f.meterWord(m[d])} · ${w} ${f.pct(s.shares[d])}`);
      meterLed.set(m[d], `${NAMES[d]} readiness ${f.meterPct(m[d])}, ${f.meterWord(m[d])}, ${w} ${f.pct(s.shares[d])}`);
    }
    text(blurb, BLURB[d]);
    show(legend, hasStages);
  }

  /** Every figure is read from state; nothing here can be changed. */
  function renderBudget(s: GameState): void {
    const b = s.budget;
    const mNow = meters(s, t);
    for (const d of DEPTS) {
      const r = bf[d];
      const price = deptLevelCost(s, t, d);
      text(r.eff, `${f.pct(s.shares[d])} of the team's effort`);
      text(r.line, b ? f.pct(b.lines[d]) + ' of income' : 'Not set yet');
      text(r.acct, b ? `${f.count(b.accounts[d])} of ${f.count(price)} for level ${s.depts[d].level + 1}` : 'Not open yet');
      const frac = b ? Math.min(1, N.ratio(b.accounts[d], price)) : 0;
      r.bar.style.setProperty('--fill', `${(frac * 100).toFixed(1)}%`);
      r.bar.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
      r.bar.setAttribute('aria-valuetext', b ? `${f.count(b.accounts[d])} of ${f.count(price)}` : 'Not open yet');
      const m = mRows[d];
      text(m.share, f.pct(s.shares[d]));
      text(m.txt, `${f.meterPct(mNow[d])} ${f.meterWord(mNow[d])}`);
      m.led.set(mNow[d], `${NAMES[d]} readiness ${f.meterPct(mNow[d])} ${f.meterWord(mNow[d])}`);
    }
    const pot = b && N.gt(b.pot, N.zero) ? ` The pot holds ${f.bananaText(b.pot)}, split when the next budget is signed.` : '';
    text(walletFact, b
      ? `Your wallet holds ${f.bananaText(s.bananas)}, the ${f.pct(b.lines.discretionary)} wallet line. Manual purchases are paid from it.${pot}`
      : `The budget opens when a department first starts. Until then, all income goes to your wallet: ${f.bananaText(s.bananas)}.`);
  }

  function renderFunding(s: GameState): void {
    renderBudget(s);
  }

  function render(): void {
    const s = ctx.state();
    if (view === 'summary') renderSummary(s);
    else if (view === 'funding') renderFunding(s);
    else renderDept(s, view);
  }

  return render;
}

export const departments: Screen = { id: 'departments', label: 'Departments', mount };
