// Departments: one screen with views. Summary (the Next card plus jump rows), one view per
// department (Level up, Stage, Balanced buy, readiness), and Funding (presets, meters, Apply).
// Contents of a paper sheet; mounted once, so the view survives the sheet closing until reset.
import {
  DEPTS, N, buyDeptLevel, buyDeptStage, certifyTiers, deptLevelCost, deptOutput, deptStageCost, editingPool,
  meters, nullSink, recordPreview, setShares, suggestShares,
  type DeptId, type GameState, type Num, type Shares,
} from '../../core/index.js';
import type { Action, Ctx, Screen } from '../ctx.js';
import { h, show, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, buyRow, ledger, nextCard, presetRow, readinessBottleneck, stamp, type Ledger } from '../ui/forms.js';
import './departments.css';

type View = 'summary' | DeptId | 'funding';
type PresetId = 'sug' | 'gro' | 'edi';

const NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
const UNITS: Record<DeptId, string> = { recruiting: 'monkeys/s', construction: 'desks/s', editing: 'review units/s' };
const BLURB: Record<DeptId, string> = {
  recruiting: 'Recruiters hire monkeys for you. Each new monkey needs a desk.',
  construction: 'Builders build desks for the monkeys.',
  editing: 'Editors review finds. Without Editors, finds are thrown away.',
};
const REF: Record<DeptId, string> = { recruiting: '5-D/1', construction: '5-D/2', editing: '5-D/3' };
const CLOSED = 'Closed after Infinity.';

/** UI constants (not game math): how far the Favour presets move Editing from the suggestion; the gap that triggers the Next card. */
const PRESET_STEP = 0.15;
const FUNDING_GAP = 0.1;
const SAME = 0.005;
/** A stage row appears once bananas reach this share of its price. */
const STAGE_REACH = 0.4;
/** Ignore taps on the Next card's button this long after any action (ms): the button under the finger may change. */
const TAP_GUARD_MS = 350;

const balancedBuy: Action = (s, t, k) => buyDeptLevel(s, t, k, 'recruiting') && buyDeptLevel(s, t, k, 'construction');

const isView = (v: unknown): v is View => v === 'summary' || v === 'funding' || DEPTS.includes(v as DeptId);

/** Largest gap between two splits, as a fraction. */
const gap = (a: Shares, b: Shares): number => Math.max(...DEPTS.map((d) => Math.abs(a[d] - b[d])));

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  let view: View = 'summary';
  let pick: PresetId | null = null;
  let hand: Shares | null = null;
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
  const pctWords = (sh: Shares): string => DEPTS.map((d) => `${NAMES[d]} ${f.pct(sh[d])}`).join(' · ');

  // ----- presets: computed from core's suggestion -----
  const presetShares = (s: GameState): Record<PresetId, Shares> => {
    const sug = suggestShares(s, t);
    const around = (e: number): Shares => {
      const rest = 1 - e;
      const rc = sug.recruiting + sug.construction;
      const r = rc > 0 ? (rest * sug.recruiting) / rc : rest / 2;
      return { recruiting: r, construction: Math.max(0, rest - r), editing: e };
    };
    return {
      sug,
      gro: around(Math.max(0, sug.editing - PRESET_STEP)),
      edi: around(Math.min(1, sug.editing + PRESET_STEP)),
    };
  };
  const draftOf = (s: GameState): Shares | null => (pick ? presetShares(s)[pick] : hand);

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
    h('div', { class: 'jumps' }, ...DEPTS.map((d) => jumpRow(d, NAMES[d])), jumpRow('funding', 'Funding')),
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
  const unfunded = h('p', { class: 'stage-line', hidden: true });
  const finalRow = h('div', { class: 'final-row' }, stamp('Final stage', 'ok'),
    h('p', { class: 'why' }, 'This department now self-replicates, so balance drifts. Watch the meters.'));
  const pairRow = buyRow({ verb: '', onBuy: () => act(balancedBuy) });
  const meterTxt = h('span', { class: 'ready-txt' });
  const meterLed = ledger('Readiness');
  const fundLink = h('button', { type: 'button', class: 'quiet', onclick: () => setView('funding', true) }, 'Change funding');
  const readyBlock = h('div', { class: 'ready' },
    h('div', { class: 'ready-head' }, h('span', { class: 'm-nm' }, 'Readiness'), meterTxt),
    meterLed.el, fundLink);
  const blurb = h('p', { class: 'blurb' });
  const legend = h('p', { class: 'legend' }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), 'Levels add a little. Stages multiply.');
  const deptView = h('div', { class: 'dview dview-dept' }, deptBack.btn, levelRow.el, unfunded, stageRow.el, stageLine, finalRow, pairRow.el, readyBlock, blurb, legend);

  // ----- funding view -----
  const fundBack = backBtn('All departments');
  fundBack.id.textContent = 'Funding';
  const sliders = {} as Record<DeptId, { input: HTMLInputElement; share: HTMLElement }>;
  const setHandFor = (d: DeptId, pctValue: number) => {
    const s = ctx.state();
    const base: Shares = draftOf(s) ?? { ...s.shares };
    if (!pick && !hand) recordPreview(s, ctx.sink, 'funding', 'shares');
    const v = Math.max(0, Math.min(1, pctValue / 100));
    const others = DEPTS.filter((x) => x !== d);
    const sum = others.reduce((a, x) => a + base[x], 0);
    const nx = { ...base, [d]: v } as Shares;
    others.forEach((x) => { nx[x] = sum > 0 ? (base[x] / sum) * (1 - v) : (1 - v) / others.length; });
    const last = others[others.length - 1] as DeptId;
    nx[last] = Math.max(0, 1 - v - others.slice(0, -1).reduce((a, x) => a + nx[x], 0));
    hand = nx;
    pick = null;
    render();
  };
  const handBits = DEPTS.map((d) => {
    const share = h('span', { class: 'big' });
    const input = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${NAMES[d]} funding share`, oninput: () => setHandFor(d, Number(input.value)) });
    sliders[d] = { input, share };
    return h('div', { class: 'hand-row' }, h('div', { class: 'hand-head' }, h('span', { class: 'm-nm' }, NAMES[d]), share), input);
  });
  const pre = presetRow({
    label: 'Funding split',
    options: [{ id: 'sug', label: 'Suggested' }, { id: 'gro', label: 'Favour growth' }, { id: 'edi', label: 'Favour editing' }],
    key: 'departments-adjust',
    onPick: (id) => {
      const s = ctx.state();
      if (!pick && !hand) recordPreview(s, ctx.sink, 'funding', 'shares');
      pick = id as PresetId;
      hand = null;
      render();
    },
  }, ...handBits);
  pre.el.classList.add('dept-presets');
  const explain = h('p', { class: 'explain' });
  const mRows = {} as Record<DeptId, { led: Ledger; txt: HTMLElement; share: HTMLElement }>;
  const meterBlock = h('div', { class: 'meters3' }, ...DEPTS.map((d) => {
    const led = ledger(`${NAMES[d]} readiness`);
    const txt = h('span', { class: 'm-txt' });
    const share = h('span', { class: 'm-share' });
    mRows[d] = { led, txt, share };
    return h('div', { class: 'm-row' }, h('span', { class: 'm-name' }, h('span', { class: 'm-nm' }, NAMES[d]), share), led.el, txt);
  }));
  const applyBtn = h('button', { type: 'button', class: 'strong wide apply', onclick: () => {
    const s = ctx.state();
    const d = draftOf(s);
    if (!d) return;
    const nx = { ...d };
    if (act((st, tt, k) => setShares(st, tt, k, nx))) { pick = null; hand = null; }
    render();
  } }, 'Apply funding');
  // The disclosure (and the sliders behind it) go below Apply, so the peek holds chips, meters and Apply.
  const [presetGroup, adjustToggle, adjustBody] = Array.from(pre.el.children) as HTMLElement[];
  pre.el.replaceChildren(presetGroup as HTMLElement);
  const fundView = h('div', { class: 'dview dview-fund' }, fundBack.btn, pre.el, meterBlock, applyBtn, explain,
    h('div', { class: 'presetrow adjust-wrap' }, adjustToggle as HTMLElement, adjustBody as HTMLElement));

  root.append(h('div', { class: 'dept-screen' }, summaryView, deptView, fundView));

  // ----- view switching -----
  function applyView(): void {
    show(summaryView, view === 'summary');
    show(deptView, view !== 'summary' && view !== 'funding');
    show(fundView, view === 'funding');
  }
  function setView(v: View, focus = false): void {
    const from = view;
    if (from === 'funding' && v !== 'funding') { pick = null; hand = null; }
    if (v === 'funding' && from !== 'funding') {
      const s = ctx.state();
      const sug = suggestShares(s, t);
      if (!hand && gap(sug, s.shares) > SAME) {
        recordPreview(s, ctx.sink, 'funding', 'shares');
        pick = 'sug';
      }
    }
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
    const sug = suggestShares(s, t);
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
      const dd = DEPTS.reduce((a, d) => (Math.abs(sug[d] - s.shares[d]) > Math.abs(sug[a] - s.shares[a]) ? d : a), DEPTS[0] as DeptId);
      const g = gap(sug, s.shares);
      text(fj.out, `Split: ${pctWords(s.shares)}`);
      const status = g > SAME ? `${NAMES[dd]} is at ${f.pct(s.shares[dd])}; suggested ${f.pct(sug[dd])}.` : 'On the suggested split.';
      text(fj.status, status);
      fj.el.setAttribute('aria-label', `Funding. ${fj.out.textContent}. ${status}`);
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
        secondary: outNum(after, 'recruiting') === 0 ? 'Recruiting has no funding yet, so funding is the step after this.' : null,
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
      levelNext('editing', `Finds are being thrown away: ${f.rate(cert.discarded)} of submissions go unreviewed.`,
        open && gap(sug, s.shares) > FUNDING_GAP ? 'Funding is also off the suggested split.' : undefined);
      return;
    }
    if (open && gap(sug, s.shares) > FUNDING_GAP) {
      const dd = DEPTS.reduce((a, d) => (Math.abs(sug[d] - s.shares[d]) > Math.abs(sug[a] - s.shares[a]) ? d : a), DEPTS[0] as DeptId);
      const after = ctx.preview((c) => { setShares(c, t, nullSink, sug); });
      const mAfter = meters(after, t);
      const low = DEPTS.reduce((a, d) => (mNow[d] < mNow[a] - 1e-9 ? d : a), DEPTS[0] as DeptId);
      const can = ctx.can('setShares:suggested', (st, tt, k) => setShares(st, tt, k, sug));
      nextAct = () => { act((st, tt, k) => setShares(st, tt, k, suggestShares(st, tt))); };
      next.update({
        label: 'Apply suggested funding', enabled: can,
        why: `${NAMES[dd]} is funded at ${f.pct(s.shares[dd])}; the suggestion is ${f.pct(sug[dd])}.`,
        effect: `${NAMES[dd]} funding ${f.pct(s.shares[dd])} → ${f.pct(sug[dd])} · ${NAMES[low]} readiness ${f.meterPct(mNow[low])} → ${f.meterPct(mAfter[low])}`,
        reason: CLOSED, secondary: null,
      });
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

    const dry = s.shares[d] <= SAME;
    show(unfunded, dry);
    if (dry) text(unfunded, `${NAMES[d]} has no funding, so its output stays at 0 until you fund it.`);

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
      text(meterTxt, `${f.meterPct(m[d])} ${f.meterWord(m[d])} · funded ${f.pct(s.shares[d])}`);
      meterLed.set(m[d], `${NAMES[d]} readiness ${f.meterPct(m[d])}, ${f.meterWord(m[d])}, funded ${f.pct(s.shares[d])}`);
    }
    text(blurb, BLURB[d]);
    show(legend, hasStages);
  }

  const presetText = (id: PresetId, ps: Record<PresetId, Shares>): string => {
    const move = f.pct(Math.abs(ps[id].editing - ps.sug.editing));
    if (id === 'sug') return 'Covers review demand; Recruiting and Construction keep pace.';
    return id === 'gro' ? `Editing ${move} below suggested. Faster growth, fewer reviews.` : `Editing ${move} above suggested. More reviews, slower growth.`;
  };

  const PRESET_NAME: Record<PresetId, string> = { sug: 'Suggested', gro: 'Favour growth', edi: 'Favour editing' };

  function renderFunding(s: GameState): void {
    const presets = presetShares(s);
    const draft = draftOf(s);
    const shown = draft ?? s.shares;
    const mNow = meters(s, t);
    const differs = draft !== null && gap(draft, s.shares) > 1e-9;
    const clone = differs ? ctx.preview((c) => { setShares(c, t, nullSink, draft as Shares); }) : null;
    const mNew = clone ? meters(clone, t) : mNow;

    // Which chip is lit: the picked one, or the one the current split matches
    const matching = (['sug', 'gro', 'edi'] as PresetId[]).find((id) => gap(presets[id], s.shares) <= SAME) ?? null;
    pre.select(draft ? pick : matching);

    const lit = draft ? pick : matching;
    text(explain, lit ? presetText(lit, presets) : draft ? 'A hand-made split.' : 'Your own split. Pick a preset to compare.');

    for (const d of DEPTS) {
      const r = mRows[d];
      const before = `${f.meterPct(mNow[d])}`;
      const after = `${f.meterPct(mNew[d])} ${f.meterWord(mNew[d])}`;
      text(r.share, f.pct(shown[d]));
      text(r.txt, clone ? `${before} → ${after}` : after);
      r.led.set(mNew[d], clone
        ? `${NAMES[d]} readiness ${before} now, ${after} if applied`
        : `${NAMES[d]} readiness ${after}`);
      const pctVal = Math.round(shown[d] * 100);
      const sl = sliders[d];
      if (sl.input.value !== String(pctVal)) sl.input.value = String(pctVal);
      sl.input.setAttribute('aria-valuetext', `${pctVal} percent`);
      text(sl.share, f.pct(shown[d]));
    }

    const key = draft ? `setShares:${DEPTS.map((d) => draft[d].toFixed(6)).join(':')}` : 'setShares:none';
    const canApply = differs && ctx.can(key, (st, tt, k) => setShares(st, tt, k, draft as Shares));
    text(applyBtn, lit && pick ? `Apply ${PRESET_NAME[lit]}` : 'Apply this split');
    if (applyBtn.disabled === canApply) applyBtn.disabled = !canApply;
    show(applyBtn, differs);
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
