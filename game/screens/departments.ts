// Departments: levels, stages, funding shares with a live preview of the
// Readiness meters, and the paired Recruiter + Builder purchase (F6).
import {
  DEPTS, N, buyDeptLevel, buyDeptStage, capability, deptLevelCost, deptOutput, deptStageCost, fundingEffect,
  meters, nullSink, recordPreview, setShares, suggestShares,
  type DeptId, type GameState, type Shares,
} from '../../core/index.js';
import type { Action, Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './departments.css';

const NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
const UNITS: Record<DeptId, string> = { recruiting: 'monkeys/s', construction: 'desks/s', editing: 'review units/s' };
const BLURB: Record<DeptId, string> = {
  recruiting: 'Hires monkeys for you. Each new monkey needs a desk.',
  construction: 'Builds desks for the monkeys.',
  editing: 'Reviews submissions. Without Editors, finds go to waste.',
};

/** Presentation-only wording for a 0..1 meter, so color is never the only signal. */
function meterWord(v: number): string {
  if (v >= 1 - 1e-9) return 'Full';
  if (v >= 0.75) return 'Nearly';
  if (v >= 0.4) return 'Partial';
  if (v > 0) return 'Low';
  return 'Idle';
}

const balancedBuy: Action = (s, t, k) => buyDeptLevel(s, t, k, 'recruiting') && buyDeptLevel(s, t, k, 'construction');

interface DeptEls {
  level: HTMLElement; stage: HTMLElement; cap: HTMLElement; out: HTMLElement; note: HTMLElement;
  levelCost: HTMLElement; levelBtn: HTMLButtonElement; stageCost: HTMLElement; stageBtn: HTMLButtonElement;
}
interface FundEls {
  slider: HTMLInputElement; share: HTMLElement; mult: HTMLElement; outNow: HTMLElement; outNew: HTMLElement;
  barNow: HTMLElement; barNew: HTMLElement; wordNow: HTMLElement; wordNew: HTMLElement; newRow: HTMLElement;
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  let draft: Shares | null = null;

  // ----- first-Recruiter prompt + balanced buy -----
  const pairBtn = (primary: boolean) => {
    const cost = h('span', { class: 'cost' });
    const btn = h('button', { class: primary ? 'primary' : '', onclick: () => ctx.act(balancedBuy) }, 'Balanced buy ', cost);
    return { btn, cost };
  };
  const prompt = pairBtn(true);
  const promptPanel = h('section', { class: 'panel dept-prompt', role: 'note' },
    h('h2', {}, 'Your first Recruiter'),
    h('p', {}, 'Recruiters hire for you, but each new monkey needs a desk. Buy a Recruiter and a Builder together.'),
    prompt.btn,
  );
  const pair = pairBtn(false);
  const pairPanel = h('section', { class: 'panel' },
    h('h2', {}, 'Balanced buy'),
    h('p', { class: 'label' }, 'One requisition, two lines: +1 Recruiting level and +1 Construction level, signed once.'),
    pair.btn,
  );

  // ----- departments -----
  const deptEls = {} as Record<DeptId, DeptEls>;
  const deptPanels = DEPTS.map((d) => {
    const e: DeptEls = {
      level: h('span', { class: 'value' }), stage: h('span', { class: 'value' }), cap: h('span', { class: 'value' }),
      out: h('span', { class: 'value' }), note: h('p', { class: 'label' }),
      levelCost: h('span', { class: 'cost' }), stageCost: h('span', { class: 'cost' }),
      levelBtn: h('button', { onclick: () => ctx.act((s, tt, k) => buyDeptLevel(s, tt, k, d)) }),
      stageBtn: h('button', { onclick: () => ctx.act((s, tt, k) => buyDeptStage(s, tt, k, d)) }),
    };
    e.levelBtn.append('Level up ', e.levelCost);
    e.stageBtn.append(e.stageCost);
    deptEls[d] = e;
    return h('section', { class: 'panel' },
      h('h2', {}, NAMES[d]),
      h('p', { class: 'label' }, BLURB[d]),
      h('div', { class: 'dept-stats' },
        h('div', {}, h('span', { class: 'label' }, 'Level'), e.level),
        h('div', {}, h('span', { class: 'label' }, 'Stage'), e.stage),
        h('div', {}, h('span', { class: 'label' }, 'Capability'), e.cap),
        h('div', {}, h('span', { class: 'label' }, `Output (${UNITS[d]})`), e.out),
      ),
      h('div', { class: 'dept-buttons' }, e.levelBtn, e.stageBtn),
      e.note,
    );
  });

  // ----- funding -----
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
  const sliders = DEPTS.map((d) => {
    const slider = h('input', {
      type: 'range', min: 0, max: 100, step: 1, class: 'fund-slider', 'aria-label': `${NAMES[d]} funding share`,
      oninput: () => setDraftFor(d, Number(slider.value)),
    });
    const e: FundEls = {
      slider, share: h('span', { class: 'value' }), mult: h('span', { class: 'label' }),
      outNow: h('span', { class: 'cost' }), outNew: h('span', { class: 'cost' }),
      barNow: h('span', { class: 'meter-fill' }), barNew: h('span', { class: 'meter-fill' }),
      wordNow: h('span', { class: 'meter-word' }), wordNew: h('span', { class: 'meter-word' }),
      newRow: h('div', { class: 'meter-row', hidden: true }),
    };
    e.newRow.append(h('span', { class: 'label' }, 'If applied'), h('span', { class: 'meter' }, e.barNew), e.wordNew);
    fundEls[d] = e;
    return h('div', { class: 'fund-row' },
      h('div', { class: 'fund-head' }, h('span', { class: 'fund-name' }, NAMES[d]), e.share, e.mult),
      slider,
      h('div', { class: 'meter-row' }, h('span', { class: 'label' }, 'Readiness'), h('span', { class: 'meter' }, e.barNow), e.wordNow),
      e.newRow,
      h('p', { class: 'label' }, `Output ${UNITS[d]}: `, e.outNow, e.outNew),
    );
  });

  const suggestBtn = h('button', { onclick: () => {
    const s = ctx.state();
    if (!draft) recordPreview(s, ctx.sink, 'funding', 'shares');
    draft = { ...suggestShares(s, t) };
    render();
  } }, 'Use suggested');
  const resetBtn = h('button', { class: 'quiet', onclick: () => { draft = null; render(); } }, 'Discard changes');
  const applyBtn = h('button', { class: 'primary', onclick: () => {
    if (!draft) return;
    const next = draft;
    if (ctx.act((s, tt, k) => setShares(s, tt, k, next))) draft = null;
    render();
  } }, 'Apply');
  const fundNote = h('p', { class: 'label' });
  const suggestNote = h('p', { class: 'label' });

  root.append(
    promptPanel,
    ...deptPanels,
    pairPanel,
    h('section', { class: 'panel' },
      h('h2', {}, 'Funding shares'),
      fundNote,
      ...sliders,
      suggestNote,
      h('div', { class: 'dept-buttons' }, suggestBtn, applyBtn),
      resetBtn,
    ),
  );

  function render(): void {
    const s = ctx.state();

    const noRecruiter = s.depts.recruiting.level === 0;
    if (promptPanel.hidden !== !noRecruiter) promptPanel.hidden = !noRecruiter;
    const pairCostTotal = f.bananas(N.add(deptLevelCost(s, t, 'recruiting'), deptLevelCost(s, t, 'construction')));
    const canPair = ctx.can('balancedBuy', balancedBuy);
    text(prompt.cost, pairCostTotal);
    text(pair.cost, pairCostTotal);
    enable(prompt.btn, canPair);
    enable(pair.btn, canPair);

    for (const d of DEPTS) {
      const e = deptEls[d];
      const dep = s.depts[d];
      text(e.level, f.count(dep.level));
      text(e.stage, `Stage ${dep.stage} of 4`);
      text(e.cap, f.amount(capability(s, t, d)));
      text(e.out, f.rate(deptOutput(s, t, d)));
      text(e.levelCost, f.bananas(deptLevelCost(s, t, d)));
      enable(e.levelBtn, ctx.can(`buyDeptLevel:${d}`, (st, tt, k) => buyDeptLevel(st, tt, k, d)));
      const sc = deptStageCost(s, t, d);
      text(e.stageCost, sc === null ? 'Final stage' : `Next stage ${f.bananas(sc)}`);
      enable(e.stageBtn, sc !== null && ctx.can(`buyDeptStage:${d}`, (st, tt, k) => buyDeptStage(st, tt, k, d)));
      text(e.note, sc === null ? 'Final stage: this department now self-replicates, so balance drifts. Keep an eye on the meters.' : '');
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
    text(fundNote, `Effective output = capability × share × ${f.amount(fundingEffect(t, 1))}. Equal shares (${f.pct(1 / 3)} each) give ${f.amount(fundingEffect(t, 1 / 3))}×.`);
    for (const d of DEPTS) {
      const e = fundEls[d];
      const pctVal = Math.round(shown[d] * 100);
      if (e.slider.value !== String(pctVal)) e.slider.value = String(pctVal);
      text(e.share, f.pct(shown[d]));
      text(e.mult, `${f.amount(fundingEffect(t, shown[d]))}× · suggested ${f.pct(suggested[d])}`);
      fill(e.barNow, mNow[d]);
      text(e.wordNow, `${f.pct(mNow[d])} ${meterWord(mNow[d])}`);
      text(e.outNow, f.rate(deptOutput(s, t, d)));
      if (e.newRow.hidden !== !draft) e.newRow.hidden = !draft;
      if (clone) {
        fill(e.barNew, mNew[d]);
        text(e.wordNew, `${f.pct(mNew[d])} ${meterWord(mNew[d])}`);
        text(e.outNew, ` → ${f.rate(deptOutput(clone, t, d))}`);
      } else {
        text(e.outNew, '');
      }
    }
    const differs = draft !== null && DEPTS.some((d) => Math.abs((draft as Shares)[d] - now[d]) > 1e-9);
    const key = draft ? `setShares:${DEPTS.map((d) => (draft as Shares)[d].toFixed(6)).join(':')}` : 'setShares:none';
    enable(applyBtn, differs && ctx.can(key, (st, tt, k) => setShares(st, tt, k, draft as Shares)));
    enable(suggestBtn, DEPTS.some((d) => Math.abs(suggested[d] - shown[d]) > 1e-9));
    if (resetBtn.hidden !== !draft) resetBtn.hidden = !draft;
    text(suggestNote, draft ? 'Previewing: nothing changes until you press Apply.' : 'Move a slider to preview its effect on all three meters.');
  }

  return render;
}

export const departments: Screen = { id: 'departments', label: 'Departments', mount };
