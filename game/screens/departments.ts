// Departments: funding shares with a live preview of the Readiness meters, levels and stages,
// and the paired Recruiter + Builder purchase (F6). Contents of a paper sheet.
import {
  DEPTS, N, buyDeptLevel, buyDeptStage, deptLevelCost, deptOutput, deptStageCost, fundingEffect,
  meters, nullSink, recordPreview, setShares, suggestShares,
  type DeptId, type GameState, type Shares,
} from '../../core/index.js';
import type { Action, Ctx, Screen } from '../ctx.js';
import { h, text, enable } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, field, figure, formbox, ledger, readinessBottleneck, setCost, setWhy, stack, stamp, why, type Ledger } from '../ui/forms.js';
import './departments.css';

const NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
const UNITS: Record<DeptId, string> = { recruiting: 'monkeys/s', construction: 'desks/s', editing: 'review units/s' };
const BLURB: Record<DeptId, string> = {
  recruiting: 'Hires monkeys for you. Each new monkey needs a desk.',
  construction: 'Builds desks for the monkeys.',
  editing: 'Reviews submissions. Without Editors, finds go to waste.',
};
const REF: Record<DeptId, string> = { recruiting: '5-D/1', construction: '5-D/2', editing: '5-D/3' };

const balancedBuy: Action = (s, t, k) => buyDeptLevel(s, t, k, 'recruiting') && buyDeptLevel(s, t, k, 'construction');

const CLOSED = 'Closed after Infinity.';

interface DeptEls {
  level: HTMLElement; stage: HTMLElement; out: HTMLElement;
  levelDelta: HTMLElement; levelCost: HTMLElement; levelBtn: HTMLButtonElement; levelWhy: HTMLElement;
  stageDelta: HTMLElement; stageCost: HTMLElement; stageBtn: HTMLButtonElement; stageWhy: HTMLElement;
  stageRow: HTMLElement; finalRow: HTMLElement; finalNote: HTMLElement;
}
interface FundEls {
  slider: HTMLInputElement; share: HTMLElement; now: Ledger; next: Ledger; nextRow: HTMLElement; out: HTMLElement;
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  let draft: Shares | null = null;

  const outOf = (s: GameState, d: DeptId): string => f.rate(deptOutput(s, t, d));

  // ----- funding (first: Apply is the screen's main action once a slider moves) -----
  const fundEls = {} as Record<DeptId, FundEls>;
  const setDraftFor = (d: DeptId, pctValue: number) => {
    const s = ctx.state();
    const base: Shares = draft ?? { ...s.shares };
    if (!draft) recordPreview(s, ctx.sink, 'funding', 'shares');
    const v = Math.max(0, Math.min(1, pctValue / 100));
    const others = DEPTS.filter((x) => x !== d);
    const rest = 1 - v;
    const sum = others.reduce((a, x) => a + base[x], 0);
    const next = { ...base, [d]: v } as Shares;
    others.forEach((x) => { next[x] = sum > 0 ? (base[x] / sum) * rest : rest / others.length; });
    // Make the total exactly 1 (core requires it within 1e-6).
    const last = others[others.length - 1] as DeptId;
    next[last] = Math.max(0, 1 - v - others.slice(0, -1).reduce((a, x) => a + next[x], 0));
    draft = next;
    render();
  };
  const fundRows = DEPTS.map((d) => {
    const slider = h('input', {
      type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${NAMES[d]} funding share`,
      oninput: () => setDraftFor(d, Number(slider.value)),
    });
    const e: FundEls = {
      slider, share: figure(), now: ledger(`${NAMES[d]} readiness now`), next: ledger(`${NAMES[d]} readiness if applied`),
      nextRow: h('div', { class: 'fund-next' }), out: h('p', { class: 'delta' }),
    };
    e.nextRow.append(h('span', { class: 'lab' }, 'If applied'), e.next.el);
    fundEls[d] = e;
    return h('div', { class: 'fund-row' },
      field(NAMES[d], e.share),
      slider,
      h('div', { class: 'fund-meter' }, h('span', { class: 'lab' }, 'Readiness'), e.now.el),
      e.nextRow,
      e.out,
    );
  });

  const bottleneck = h('p', { class: 'note' });
  const suggestBtn = h('button', { type: 'button', onclick: () => {
    const s = ctx.state();
    if (!draft) recordPreview(s, ctx.sink, 'funding', 'shares');
    draft = { ...suggestShares(s, t) };
    render();
  } }, 'Use suggested');
  const resetBtn = h('button', { class: 'quiet', type: 'button', onclick: () => { draft = null; render(); } }, 'Discard changes');
  const applyBtn = h('button', { class: 'strong', type: 'button', onclick: () => {
    if (!draft) return;
    const next = draft;
    if (ctx.act((s, tt, k) => setShares(s, tt, k, next))) draft = null;
    render();
  } }, 'Apply funding');
  const applyWhy = why();
  const suggestWhy = why();
  const fundNote = h('p', { class: 'why' });
  const fundBox = formbox('Ref. 5-D / Funding',
    bottleneck,
    h('div', { class: 'btn-row' }, applyBtn, suggestBtn, resetBtn),
    applyWhy,
    suggestWhy,
    ...fundRows,
    fundNote,
  );

  // ----- first-Recruiter prompt + balanced buy (never both on screen) -----
  const pairBtn = () => {
    const cost = h('span', { class: 'cost' });
    const btn = h('button', { class: 'strong', type: 'button', onclick: () => ctx.act(balancedBuy) }, h('span', {}, 'Balanced buy'), cost);
    return { btn, cost, why: why(), delta: h('p', { class: 'delta' }) };
  };
  const prompt = pairBtn();
  const promptBox = formbox('Req. 5-D/0 / Your first Recruiter',
    h('p', { class: 'note' }, 'Recruiters hire for you, but each new monkey needs a desk. Buy a Recruiter and a Builder together.'),
    h('div', { class: 'row2' }, prompt.delta, prompt.btn, prompt.why),
  );
  const pair = pairBtn();
  const pairBox = formbox('Req. 5-D/4 / Balanced buy',
    h('p', { class: 'why' }, 'One requisition, two lines: +1 Recruiting level and +1 Construction level, signed once.'),
    h('div', { class: 'row2' }, pair.delta, pair.btn, pair.why),
  );

  // ----- departments -----
  const deptEls = {} as Record<DeptId, DeptEls>;
  const deptBoxes = DEPTS.map((d) => {
    const e: DeptEls = {
      level: figure(), stage: figure(), out: figure(),
      levelDelta: h('p', { class: 'delta' }), levelCost: h('span', { class: 'cost' }), levelWhy: why(),
      stageDelta: h('p', { class: 'delta' }), stageCost: h('span', { class: 'cost' }), stageWhy: why(),
      levelBtn: h('button', { type: 'button', onclick: () => ctx.act((s, tt, k) => buyDeptLevel(s, tt, k, d)) }),
      stageBtn: h('button', { type: 'button', onclick: () => ctx.act((s, tt, k) => buyDeptStage(s, tt, k, d)) }),
      stageRow: h('div', { class: 'row2' }), finalRow: h('div', { class: 'form-stack tight' }), finalNote: h('p', { class: 'why' }),
    };
    e.levelBtn.append(h('span', {}, 'Level up'), e.levelCost);
    e.stageBtn.append(h('span', {}, 'Next stage'), e.stageCost);
    e.stageRow.append(e.stageDelta, e.stageBtn, e.stageWhy);
    e.finalRow.append(stamp('Final stage', 'ok'), e.finalNote);
    deptEls[d] = e;
    return formbox(`Ref. ${REF[d]} / ${NAMES[d]}`,
      h('p', { class: 'why' }, BLURB[d]),
      field('Level', e.level),
      field('Stage', e.stage),
      field(`Output (${UNITS[d]})`, e.out),
      h('div', { class: 'row2' }, e.levelDelta, e.levelBtn, e.levelWhy),
      e.stageRow,
      e.finalRow,
    );
  });

  root.append(stack(promptBox, fundBox, ...deptBoxes, pairBox));

  function render(): void {
    const s = ctx.state();

    // First Recruiter prompt or balanced buy
    const noRecruiter = s.depts.recruiting.level === 0;
    promptBox.hidden = !noRecruiter;
    pairBox.hidden = noRecruiter;
    const rCost = deptLevelCost(s, t, 'recruiting');
    const cCost = deptLevelCost(s, t, 'construction');
    const total = N.add(rCost, cCost);
    const afterPair = ctx.preview((c) => { afford(c, N.toNumber(total)); balancedBuy(c, t, nullSink); });
    const canPair = ctx.can('balancedBuy', balancedBuy);
    const pairWhy = canPair ? null : f.shortBy(total, s.bananas) ?? CLOSED;
    const pairDelta = `Recruiting ${f.change(outOf(s, 'recruiting'), outOf(afterPair, 'recruiting'))} · Construction ${f.change(outOf(s, 'construction'), outOf(afterPair, 'construction'))}`;
    for (const p of [prompt, pair]) {
      setCost(p.btn, p.cost, 'Balanced buy', N.toNumber(total));
      enable(p.btn, canPair);
      setWhy(p.why, pairWhy);
      text(p.delta, pairDelta);
    }

    // Departments
    for (const d of DEPTS) {
      const e = deptEls[d];
      const dep = s.depts[d];
      text(e.level, f.count(dep.level));
      text(e.stage, `${dep.stage} of 4`);
      text(e.out, outOf(s, d));

      const lCost = deptLevelCost(s, t, d);
      const lAfter = ctx.preview((c) => { afford(c, N.toNumber(lCost)); buyDeptLevel(c, t, nullSink, d); });
      text(e.levelDelta, `Level ${f.change(f.count(dep.level), f.count(lAfter.depts[d].level))} · Output ${f.change(outOf(s, d), outOf(lAfter, d))}`);
      setCost(e.levelBtn, e.levelCost, `Level up ${NAMES[d]}`, N.toNumber(lCost));
      const canLevel = ctx.can(`buyDeptLevel:${d}`, (st, tt, k) => buyDeptLevel(st, tt, k, d));
      enable(e.levelBtn, canLevel);
      setWhy(e.levelWhy, canLevel ? null : f.shortBy(lCost, s.bananas) ?? CLOSED);

      const sc = deptStageCost(s, t, d);
      e.stageRow.hidden = sc === null;
      e.finalRow.hidden = sc !== null;
      if (sc === null) {
        text(e.finalNote, 'This department now self-replicates, so balance drifts. Watch the meters.');
      } else {
        const sAfter = ctx.preview((c) => { afford(c, N.toNumber(sc)); buyDeptStage(c, t, nullSink, d); });
        text(e.stageDelta, `Stage ${f.change(String(dep.stage), String(sAfter.depts[d].stage))} · Output ${f.change(outOf(s, d), outOf(sAfter, d))}`);
        setCost(e.stageBtn, e.stageCost, `Next stage ${NAMES[d]}`, N.toNumber(sc));
        const canStage = ctx.can(`buyDeptStage:${d}`, (st, tt, k) => buyDeptStage(st, tt, k, d));
        enable(e.stageBtn, canStage);
        setWhy(e.stageWhy, canStage ? null : f.shortBy(sc, s.bananas) ?? CLOSED);
      }
    }

    // Funding
    const now = s.shares;
    const shown: Shares = draft ?? now;
    const suggested = suggestShares(s, t);
    const mNow = meters(s, t);
    let clone: GameState | null = null;
    let mNew = mNow;
    if (draft) {
      const dr = draft;
      clone = ctx.preview((c) => { setShares(c, t, nullSink, dr); });
      mNew = meters(clone, t);
    }
    text(bottleneck, readinessBottleneck(s, t));
    text(fundNote, `Effective output = capability × share × ${f.amount(fundingEffect(t, 1))}. Equal shares (${f.pct(1 / 3)} each) give ${f.amount(fundingEffect(t, 1 / 3))}×. Suggested: ${DEPTS.map((d) => `${NAMES[d]} ${f.pct(suggested[d])}`).join(', ')}.`);
    for (const d of DEPTS) {
      const e = fundEls[d];
      const pctVal = Math.round(shown[d] * 100);
      if (e.slider.value !== String(pctVal)) e.slider.value = String(pctVal);
      e.slider.setAttribute('aria-valuetext', `${pctVal} percent`);
      text(e.share, f.pct(shown[d]));
      e.now.set(mNow[d], `${NAMES[d]} readiness ${f.meterPct(mNow[d])}, ${f.meterWord(mNow[d])}`);
      e.nextRow.hidden = !clone;
      if (clone) e.next.set(mNew[d], `${NAMES[d]} readiness if applied ${f.meterPct(mNew[d])}, ${f.meterWord(mNew[d])}`);
      const base = `Readiness ${f.meterPct(mNow[d])} ${f.meterWord(mNow[d])}`;
      text(e.out, clone
        ? `${base} → ${f.meterPct(mNew[d])} ${f.meterWord(mNew[d])} · Output ${f.change(outOf(s, d), outOf(clone, d))}`
        : `${base} · Output ${outOf(s, d)}`);
    }
    const differs = draft !== null && DEPTS.some((d) => Math.abs((draft as Shares)[d] - now[d]) > 1e-9);
    const key = draft ? `setShares:${DEPTS.map((d) => (draft as Shares)[d].toFixed(6)).join(':')}` : 'setShares:none';
    const canApply = differs && ctx.can(key, (st, tt, k) => setShares(st, tt, k, draft as Shares));
    enable(applyBtn, canApply);
    setWhy(applyWhy, canApply ? null : !draft ? 'Move a slider to preview a new split.' : !differs ? 'The draft matches the current funding.' : CLOSED);
    const canSuggest = DEPTS.some((d) => Math.abs(suggested[d] - shown[d]) > 1e-9);
    enable(suggestBtn, canSuggest);
    setWhy(suggestWhy, canSuggest ? null : 'Already on the suggested split.');
    resetBtn.hidden = !draft;
  }

  return render;
}

export const departments: Screen = { id: 'departments', label: 'Departments', mount };
