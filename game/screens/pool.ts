// Typing Pool: typing vs editing bars per tier, plus the tier allocation
// (current vs suggested vs a draft split, with a before/after preview).
import {
  N,
  applySuggestedAllocation,
  certifyTiers,
  editingPool,
  editorInChiefSplit,
  findRates,
  nullSink,
  recordPreview,
  setTierAllocation,
  suggestTierAllocation,
  type Certification,
  type GameState,
  type Num,
} from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './pool.css';

const LAMPS = 10;
const name = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);
const income = (x: Num | number): string => `🍌 ${f.amount(x)}/s`;
const hasAny = (d: Record<string, number>): boolean => Object.values(d).some((v) => v > 0);

function certNow(s: GameState, ctx: Ctx): Certification {
  return certifyTiers(s, ctx.t, editingPool(s, ctx.t), s.tierAllocation);
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  /** Draft weights (0..100 per discovered tier), or null when the player isn't editing. */
  let draft: Record<string, number> | null = null;

  // ---------- bars ----------
  const rows = t.tiers.map((tier) => {
    const title = h('h3', {}, name(tier.id));
    const inc = h('span', { class: 'pool-income' });
    const okBar = h('span', { class: 'pool-ok' });
    const wasteBar = h('span', { class: 'pool-waste' });
    const bar = h('div', { class: 'pool-bar', role: 'img' }, okBar, wasteBar);
    const typing = h('b');
    const editing = h('b');
    const waste = h('span', { class: 'pool-warn' });
    const line = h('p', { class: 'pool-line' }, 'Typing ', typing, ' · Certified ', editing);
    const discBar = h('span', { class: 'pool-disc' });
    const discTrack = h('div', { class: 'pool-bar', role: 'img' }, discBar);
    const discLine = h('p', { class: 'pool-line' });
    const lockedBlock = h('div', { class: 'pool-hide' }, h('p', { class: 'label' }, 'Not yet discovered'), discTrack, discLine);
    const openBlock = h('div', { class: 'pool-hide' }, bar, line, waste);
    const el = h('div', { class: 'pool-row' }, h('div', { class: 'pool-head' }, title, inc), openBlock, lockedBlock);
    return { tier, el, inc, okBar, wasteBar, bar, typing, editing, waste, openBlock, lockedBlock, discBar, discTrack, discLine };
  });

  const poolV = h('span', { class: 'value' });
  const demandV = h('span', { class: 'value' });
  const idleV = h('span', { class: 'value' });
  const discardedV = h('span', { class: 'value' });
  const totalV = h('span', { class: 'value' });
  const lamps = Array.from({ length: LAMPS }, () => h('span'));
  const lampNote = h('p', { class: 'pool-line' });
  const poolNote = h('p', { class: 'pool-line' });

  // ---------- allocation ----------
  const aRows = t.tiers.map((tier) => {
    const input = h('input', { class: 'pool-slider', type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${name(tier.id)} share of Editors` });
    const info = h('p', { class: 'pool-line' });
    const el = h('div', { class: 'pool-row' }, h('div', { class: 'pool-head' }, h('h3', {}, name(tier.id))), input, info);
    input.addEventListener('input', () => {
      if (!draft) {
        // First edit starts a draft from the live split, and counts as a preview view.
        draft = currentWeights(ctx.state());
        recordPreview(ctx.state(), ctx.sink, 'allocation', 'tiers');
      }
      draft[tier.id] = Number(input.value);
      render();
    });
    return { tier, el, input, info };
  });

  function currentWeights(s: GameState): Record<string, number> {
    const w: Record<string, number> = {};
    for (const tier of t.tiers) w[tier.id] = Math.round((s.tierAllocation[tier.id] ?? 0) * 100);
    return w;
  }
  function discoveredIds(s: GameState): string[] {
    return t.tiers.filter((x) => s.tiers[x.id]?.discovered).map((x) => x.id);
  }
  /** Draft weights over discovered tiers as fractions summing to 1; null if all zero. */
  function draftSplit(s: GameState): Record<string, number> | null {
    if (!draft) return null;
    const ids = discoveredIds(s);
    const sum = ids.reduce((a, id) => a + (draft?.[id] ?? 0), 0);
    if (sum <= 0) return null;
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = (draft[id] ?? 0) / sum;
    return out;
  }

  const suggestedNote = h('p', { class: 'label' }, 'Suggested: maximizes bananas');
  const singleNote = h('p', { class: 'pool-line pool-hide' });
  const useSuggested = h('button', { onclick: () => { draft = null; ctx.act(applySuggestedAllocation); render(); } }, 'Use suggested');
  const applyBtn = h('button', { class: 'primary', onclick: () => {
    const next = draftSplit(ctx.state());
    if (!next) return;
    if (ctx.act((s, tt, k) => setTierAllocation(s, tt, k, next))) draft = null;
    render();
  } }, 'Apply');
  const resetBtn = h('button', { class: 'quiet', onclick: () => { draft = null; render(); } }, 'Discard draft');
  const nowInc = h('span', { class: 'value' });
  const draftInc = h('span', { class: 'value' });
  const deltaNote = h('p', { class: 'pool-line' });
  const compare = h('div', { class: 'pool-hide' },
    h('div', { class: 'pool-compare' },
      h('div', {}, h('span', { class: 'label' }, 'Income now'), nowInc),
      h('div', {}, h('span', { class: 'label' }, 'Income with draft'), draftInc),
    ),
    deltaNote,
  );
  const controls = h('div', { class: 'pool-hide' }, ...aRows.map((r) => r.el), suggestedNote, compare,
    h('div', { class: 'pool-actions' }, useSuggested, applyBtn, resetBtn));

  root.append(
    h('section', { class: 'panel' },
      h('h2', {}, 'Typing vs editing'),
      h('div', { class: 'pool-stats' },
        h('div', {}, h('span', { class: 'label' }, 'Editing pool'), poolV),
        h('div', {}, h('span', { class: 'label' }, 'Review demand'), demandV),
        h('div', {}, h('span', { class: 'label' }, 'Idle review capacity'), idleV),
        h('div', {}, h('span', { class: 'label' }, 'Discarded finds'), discardedV),
        h('div', {}, h('span', { class: 'label' }, 'Certified income'), totalV),
      ),
      h('span', { class: 'label' }, 'Editors at work (unlit = idle)'),
      h('div', { class: 'pool-lamps', role: 'img', 'aria-label': 'Editor utilisation' }, ...lamps),
      lampNote,
      poolNote,
    ),
    h('section', { class: 'panel' }, h('h2', {}, 'Tiers'), ...rows.map((r) => r.el)),
    h('section', { class: 'panel' }, h('h2', {}, 'Allocation'), singleNote, controls),
  );

  function render(): void {
    const s = ctx.state();
    const pool = editingPool(s, t);
    const finds = findRates(s, t);
    const eic = editorInChiefSplit(s, t);
    const cert = certNow(s, ctx);
    const suggested = suggestTierAllocation(s, t);
    const discovered = discoveredIds(s);

    // Summary
    text(poolV, f.rate(pool));
    text(demandV, f.rate(cert.demand));
    text(idleV, f.rate(cert.idle));
    text(discardedV, f.rate(cert.discarded));
    text(totalV, income(cert.income));
    const idleFrac = N.gt(pool, N.zero) ? Math.min(1, N.ratio(cert.idle, pool)) : 0;
    const lit = Math.round((1 - idleFrac) * LAMPS);
    lamps.forEach((l, i) => l.classList.toggle('lit', i < lit && N.gt(pool, N.zero)));
    const idle = N.gt(cert.idle, N.zero);
    const discarding = N.gt(cert.discarded, N.zero);
    text(lampNote, idle ? `○ Idle: ${f.pct(idleFrac)} of review capacity has nothing to review. Typing is the bottleneck.` : '● All review capacity is in use.');
    text(poolNote, discarding ? `▲ Discarding ${f.rate(cert.discarded)} of submissions. Editing is the bottleneck.` : 'No submissions discarded.');
    poolNote.classList.toggle('pool-warn', discarding);

    // Per-tier bars
    for (const r of rows) {
      const id = r.tier.id;
      const ts = s.tiers[id];
      const isOpen = !!ts?.discovered;
      const isLocked = !!ts && !ts.discovered && ts.discoverable;
      r.el.hidden = !isOpen && !isLocked;
      r.openBlock.hidden = !isOpen;
      r.lockedBlock.hidden = !isLocked;
      if (isOpen) {
        const fr = finds[id] ?? N.zero;
        const c = cert.certified[id] ?? N.zero;
        const lost = N.sub(fr, c);
        const hasFinds = N.gt(fr, N.zero);
        fill(r.okBar, hasFinds ? N.ratio(c, fr) : 0);
        fill(r.wasteBar, hasFinds ? N.ratio(lost, fr) : 0);
        text(r.typing, f.rate(fr));
        text(r.editing, f.rate(c));
        const wasting = N.gt(lost, N.zero) && N.ratio(lost, fr) > 0.0005;
        text(r.waste, wasting ? `▲ Discarded ${f.rate(lost)} (${f.pct(N.ratio(lost, fr))})` : '');
        text(r.inc, income(N.mul(c, r.tier.value)));
        r.bar.setAttribute('aria-label', `${name(id)}: ${hasFinds ? f.pct(N.ratio(c, fr)) : '0%'} certified`);
      } else if (isLocked) {
        const acc = Math.min(1, ts?.acc ?? 0);
        fill(r.discBar, acc);
        const d = eic.discovery[id] ?? N.zero;
        text(r.discLine, `Editor-in-Chief review ${f.pct(acc)} · ${f.rate(d)} certified toward discovery`);
        text(r.inc, '');
        r.discTrack.setAttribute('aria-label', `${name(id)} discovery ${f.pct(acc)}`);
      }
    }

    // Allocation
    const multi = discovered.length > 1;
    controls.hidden = !multi;
    singleNote.hidden = multi;
    if (!multi) {
      const only = discovered[0];
      text(singleNote, only ? `Only ${name(only)} is discovered, so every Editor reviews it. Discover more tiers to split Editors.` : 'No tiers discovered.');
      draft = null;
      return;
    }
    const cur = currentWeights(s);
    const split = draftSplit(s);
    for (const r of aRows) {
      const id = r.tier.id;
      const on = discovered.includes(id);
      r.el.hidden = !on;
      if (!on) continue;
      const w = draft ? (draft[id] ?? 0) : cur[id] ?? 0;
      if (r.input.value !== String(w) && document.activeElement !== r.input) r.input.value = String(w);
      else if (draft && r.input.value !== String(w)) r.input.value = String(w);
      const share = draft ? (split?.[id] ?? 0) : (s.tierAllocation[id] ?? 0);
      text(r.info, draft ? `Draft ${f.pct(share)} · Current ${f.pct(s.tierAllocation[id] ?? 0)} · Suggested ${f.pct(suggested[id] ?? 0)}` : `Current ${f.pct(s.tierAllocation[id] ?? 0)} · Suggested ${f.pct(suggested[id] ?? 0)}`);
    }
    const same = discovered.every((id) => f.pct(s.tierAllocation[id] ?? 0) === f.pct(suggested[id] ?? 0));
    enable(useSuggested, !same && ctx.can('applySuggestedAllocation', applySuggestedAllocation));
    enable(resetBtn, !!draft);
    resetBtn.hidden = !draft;
    compare.hidden = !draft;
    enable(applyBtn, !!split && ctx.can('setTierAllocation', (cs, tt, k) => setTierAllocation(cs, tt, k, split)));
    if (draft) {
      text(nowInc, income(cert.income));
      if (split) {
        const c = ctx.preview((cs) => { setTierAllocation(cs, t, nullSink, split); });
        const after = certifyTiers(c, t, editingPool(c, t), c.tierAllocation);
        text(draftInc, income(after.income));
        const diff = N.sub(after.income, cert.income);
        const verdict = N.gt(diff, N.zero) ? `▲ Gain ${income(diff)}` : N.lt(diff, N.zero) ? `▼ Loss ${income(N.sub(N.zero, diff))}` : '＝ No change in income';
        text(deltaNote, `${verdict}. Idle ${f.rate(after.idle)}, discarded ${f.rate(after.discarded)}.`);
      } else {
        text(draftInc, '—');
        text(deltaNote, 'Give at least one tier a share.');
      }
    }
  }

  return render;
}

export const pool: Screen = { id: 'pool', label: 'Typing Pool', mount };
