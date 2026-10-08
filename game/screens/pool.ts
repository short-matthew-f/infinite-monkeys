// Typing Pool: typing vs editing per tier, plus the Editor allocation (current vs suggested vs a
// draft split, with a before → after preview). Contents of a paper sheet.
import {
  N,
  applySuggestedAllocation,
  certifyTiers,
  editingPool,
  editorInChiefSplit,
  finiteBottleneck,
  findRates,
  nullSink,
  recordPreview,
  setTierAllocation,
  suggestTierAllocation,
  type Certification,
  type GameState,
} from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { dial, field, figure, formbox, ledger, setWhy, stack, stamp, why } from '../ui/forms.js';
import './pool.css';

const name = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

function certNow(s: GameState, ctx: Ctx): Certification {
  return certifyTiers(s, ctx.t, editingPool(s, ctx.t), s.tierAllocation);
}

/** Splits `total` into whole parts proportional to `raw` (largest remainder), so the parts always sum to `total`. */
function distribute(raw: number[], total: number): number[] {
  const sum = raw.reduce((a, x) => a + x, 0);
  const share = raw.map((x) => (sum > 0 ? (x / sum) * total : total / raw.length));
  const out = share.map(Math.floor);
  let left = total - out.reduce((a, x) => a + x, 0);
  const order = share.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    left--;
  }
  return out;
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  /** Draft split as whole percents over the discovered tiers (sums to 100), or null when the player isn't editing. */
  let draft: Record<string, number> | null = null;

  const discoveredIds = (s: GameState): string[] => t.tiers.filter((x) => s.tiers[x.id]?.discovered).map((x) => x.id);
  /** The live split as whole percents over the discovered tiers. */
  const currentPercents = (s: GameState): Record<string, number> => {
    const ids = discoveredIds(s);
    const parts = distribute(ids.map((id) => s.tierAllocation[id] ?? 0), 100);
    return Object.fromEntries(ids.map((id, i) => [id, parts[i] ?? 0]));
  };

  // ---------- bottleneck dials ----------
  const busyDial = dial('Editors busy');
  const keptDial = dial('Finds kept');
  const bottleneck = h('p', { class: 'note' });
  const dialsBox = formbox('Ref. 7-T / Bottleneck',
    h('div', { class: 'gauges' }, busyDial.el, keptDial.el),
    bottleneck,
  );

  // ---------- allocation ----------
  const aRows = t.tiers.map((tier) => {
    const share = h('span', { class: 'big' });
    const input = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${name(tier.id)} share of Editors` });
    const info = h('p', { class: 'why' });
    const el = h('div', { class: 'pool-alloc' }, field(name(tier.id), share), input, info);
    input.addEventListener('input', () => {
      const s = ctx.state();
      if (!draft) {
        draft = currentPercents(s);
        recordPreview(s, ctx.sink, 'allocation', 'tiers');
      }
      const ids = discoveredIds(s);
      const v = Number(input.value);
      const others = ids.filter((x) => x !== tier.id);
      const parts = distribute(others.map((x) => draft?.[x] ?? 0), 100 - v);
      const next: Record<string, number> = { [tier.id]: v };
      others.forEach((x, i) => { next[x] = parts[i] ?? 0; });
      draft = next;
      render();
    });
    return { tier, el, input, share, info };
  });

  const singleNote = h('p', { class: 'note' });
  const useSuggested = h('button', { type: 'button', onclick: () => { draft = null; ctx.act(applySuggestedAllocation); render(); } }, 'Use suggested');
  const useWhy = why();
  const applyBtn = h('button', { class: 'strong', type: 'button', onclick: () => {
    const next = splitOf(ctx.state());
    if (!next) return;
    if (ctx.act((s, tt, k) => setTierAllocation(s, tt, k, next))) draft = null;
    render();
  } }, 'Apply split');
  const applyWhy = why();
  const resetBtn = h('button', { class: 'quiet', type: 'button', onclick: () => { draft = null; render(); } }, 'Discard draft');
  const incomeDelta = h('p', { class: 'delta' });
  const flowDelta = h('p', { class: 'delta' });
  const preview = h('div', { class: 'pool-preview' }, incomeDelta, flowDelta);
  const allocControls = h('div', { class: 'form-stack' },
    ...aRows.map((r) => r.el),
    preview,
    h('div', { class: 'btn-row' }, applyBtn, useSuggested, resetBtn),
    applyWhy,
    useWhy,
  );
  const allocBox = formbox('Req. 7-T / Editor allocation', singleNote, allocControls);

  /** Draft as fractions over discovered tiers, or null. */
  function splitOf(s: GameState): Record<string, number> | null {
    if (!draft) return null;
    const ids = discoveredIds(s);
    const sum = ids.reduce((a, id) => a + (draft?.[id] ?? 0), 0);
    if (sum <= 0) return null;
    return Object.fromEntries(ids.map((id) => [id, (draft?.[id] ?? 0) / sum]));
  }

  // ---------- tiers ----------
  const rows = t.tiers.map((tier, i) => {
    const inc = figure();
    const bar = ledger(`${name(tier.id)} certified`);
    const typing = h('b');
    const editing = h('b');
    const waste = h('p', { class: 'why alert' });
    const line = h('p', { class: 'delta' }, 'Typing ', typing, ' · Certified ', editing);
    const open = h('div', { class: 'form-stack tight' }, field('Income', inc), bar.el, line, waste);
    const discBar = ledger(`${name(tier.id)} discovery`, 'gold');
    const discLine = h('p', { class: 'delta' });
    const locked = h('div', { class: 'form-stack tight' }, h('p', {}, stamp('Under review', 'plain')), discBar.el, discLine);
    const el = formbox(`Ref. 7-T/${i + 1} / ${name(tier.id)}`, open, locked);
    return { tier, el, inc, bar, typing, editing, waste, open, locked, discBar, discLine };
  });

  // ---------- figures ----------
  const poolV = figure();
  const demandV = figure();
  const idleV = figure();
  const discardedV = figure();
  const totalV = figure();
  const figures = formbox('Ref. 7-T/9 / Figures',
    field('Editing pool', poolV),
    field('Review demand', demandV),
    field('Idle capacity', idleV),
    field('Discarded finds', discardedV),
    field('Certified income', totalV),
  );

  root.append(stack(dialsBox, allocBox, ...rows.map((r) => r.el), figures));

  function render(): void {
    const s = ctx.state();
    const pool = editingPool(s, t);
    const finds = findRates(s, t);
    const eic = editorInChiefSplit(s, t);
    const cert = certNow(s, ctx);
    const suggested = suggestTierAllocation(s, t);
    const discovered = discoveredIds(s);
    const hasPool = N.gt(pool, N.zero);

    // Figures and dials
    text(poolV, f.rate(pool));
    text(demandV, f.rate(cert.demand));
    text(idleV, f.rate(cert.idle));
    text(discardedV, f.rate(cert.discarded));
    text(totalV, `${f.rate(cert.income)}`);
    const busy = hasPool ? Math.min(1, N.ratio(cert.demand, pool)) : 0;
    const findsTotal = Object.values(finds).reduce((a, x) => N.add(a, x), N.zero);
    const keptTotal = Object.values(cert.certified).reduce((a, x) => N.add(a, x), N.zero);
    const kept = N.gt(findsTotal, N.zero) ? Math.min(1, N.ratio(keptTotal, findsTotal)) : 0;
    busyDial.set(busy, f.meterWord(busy), `Editors busy: ${f.meterPct(busy)}, ${f.meterWord(busy)}`);
    keptDial.set(kept, f.meterWord(kept), `Finds kept: ${f.meterPct(kept)}, ${f.meterWord(kept)}`);
    const discarding = N.gt(cert.discarded, N.zero);
    const idle = N.gt(cert.idle, N.zero);
    const limiter = finiteBottleneck(s, t);
    text(bottleneck, limiter === 'editing'
      ? `Bottleneck: Editing. ${discarding ? `${f.rate(cert.discarded)} of submissions are being discarded.` : 'Review capacity is fully committed.'}`
      : `Bottleneck: Typing. ${idle ? `${f.pct(hasPool ? Math.min(1, N.ratio(cert.idle, pool)) : 0)} of review capacity has nothing to review.` : 'Editors are waiting on submissions.'}`);

    // Per-tier ledgers
    for (const r of rows) {
      const id = r.tier.id;
      const ts = s.tiers[id];
      const isOpen = !!ts?.discovered;
      const isLocked = !!ts && !ts.discovered && ts.discoverable;
      r.el.hidden = !isOpen && !isLocked;
      r.open.hidden = !isOpen;
      r.locked.hidden = !isLocked;
      if (isOpen) {
        const fr = finds[id] ?? N.zero;
        const c = cert.certified[id] ?? N.zero;
        const lost = N.sub(fr, c);
        const hasFinds = N.gt(fr, N.zero);
        const okFrac = hasFinds ? N.ratio(c, fr) : 0;
        const lostFrac = hasFinds ? N.ratio(lost, fr) : 0;
        r.bar.set(okFrac, `${f.pct(okFrac)} of ${name(id)} finds certified`, lostFrac);
        text(r.typing, f.rate(fr));
        text(r.editing, f.rate(c));
        const wasting = N.gt(lost, N.zero) && lostFrac > 0.0005;
        text(r.waste, wasting ? `Discarded ${f.rate(lost)} (${f.pct(lostFrac)}). Editing is the bottleneck.` : '');
        r.waste.hidden = !wasting;
        text(r.inc, `${f.rate(N.mul(c, r.tier.value))}`);
      } else if (isLocked) {
        const acc = Math.min(1, ts?.acc ?? 0);
        r.discBar.set(Math.min(acc, 0.99), `${name(id)} discovery ${f.meterPct(acc)}`);
        const d = eic.discovery[id] ?? N.zero;
        text(r.discLine, `Editor-in-Chief review ${f.meterPct(acc)} · ${f.rate(d)} certified toward discovery`);
      }
    }

    // Allocation
    const multi = discovered.length > 1;
    allocControls.hidden = !multi;
    singleNote.hidden = multi;
    allocBox.hidden = discovered.length === 0;
    if (!multi) {
      const only = discovered[0];
      text(singleNote, only ? `Only ${name(only)} is discovered, so every Editor reviews it. Discover more tiers to split Editors.` : '');
      draft = null;
      return;
    }
    const cur = currentPercents(s);
    const split = splitOf(s);
    for (const r of aRows) {
      const id = r.tier.id;
      const on = discovered.includes(id);
      r.el.hidden = !on;
      if (!on) continue;
      // Slider = share. The label and slider always read the same whole percent.
      const v = draft ? (draft[id] ?? 0) : (cur[id] ?? 0);
      if (r.input.value !== String(v)) r.input.value = String(v);
      r.input.setAttribute('aria-valuetext', `${v} percent of Editors`);
      text(r.share, `${v}%`);
      text(r.info, `Current ${cur[id] ?? 0}% · Suggested ${f.pct(suggested[id] ?? 0)}`);
    }
    const same = discovered.every((id) => f.pct(s.tierAllocation[id] ?? 0) === f.pct(suggested[id] ?? 0));
    const canSuggest = !same && ctx.can('applySuggestedAllocation', applySuggestedAllocation);
    enable(useSuggested, canSuggest);
    setWhy(useWhy, canSuggest ? null : same ? 'Already on the suggested split.' : 'Closed after Infinity.');
    resetBtn.hidden = !draft;
    preview.hidden = !draft;
    const differs = !!draft && discovered.some((id) => (draft?.[id] ?? 0) !== (cur[id] ?? 0));
    const canApply = !!split && differs && ctx.can('setTierAllocation', (cs, tt, k) => setTierAllocation(cs, tt, k, split));
    enable(applyBtn, canApply);
    setWhy(applyWhy, canApply ? null : !draft ? 'Move a slider to draft a new split.' : !split ? 'Give at least one tier a share.' : !differs ? 'The draft matches the current split.' : 'Closed after Infinity.');
    if (draft && split) {
      const c = ctx.preview((cs) => { setTierAllocation(cs, t, nullSink, split); });
      const after = certNow(c, ctx);
      text(incomeDelta, `Certified income ${f.change(f.rate(cert.income), f.rate(after.income))}`);
      text(flowDelta, `Idle ${f.change(f.rate(cert.idle), f.rate(after.idle))} · Discarded ${f.change(f.rate(cert.discarded), f.rate(after.discarded))}`);
    }
  }

  return render;
}

export const pool: Screen = { id: 'pool', label: 'Typing Pool', mount };
