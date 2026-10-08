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
import { h, text, enable, show } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { dial, field, figure, folder, formbox, ledger, nextCard, presetRow, setWhy, stack, stamp, why } from '../ui/forms.js';
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
  /** Which preset chip the draft came from ('sug' | 'common' | 'rare'), or null for a hand-made draft. */
  let draftPreset: string | null = null;

  const discoveredIds = (s: GameState): string[] => t.tiers.filter((x) => s.tiers[x.id]?.discovered).map((x) => x.id);
  /** The live split as whole percents over the discovered tiers. */
  const currentPercents = (s: GameState): Record<string, number> => {
    const ids = discoveredIds(s);
    const parts = distribute(ids.map((id) => s.tierAllocation[id] ?? 0), 100);
    return Object.fromEntries(ids.map((id, i) => [id, parts[i] ?? 0]));
  };
  /** The three honest presets as whole percents. Suggested is core's; the others put every Editor on one tier. */
  const presetPercents = (s: GameState): Record<string, Record<string, number>> => {
    const ids = discoveredIds(s);
    const tiers = t.tiers.filter((x) => ids.includes(x.id));
    const common = tiers.reduce((a, x) => (x.p > a.p ? x : a), tiers[0]!);
    const rare = tiers.reduce((a, x) => (x.value > a.value ? x : a), tiers[0]!);
    const pct = (frac: Record<string, number>): Record<string, number> => {
      const parts = distribute(ids.map((id) => frac[id] ?? 0), 100);
      return Object.fromEntries(ids.map((id, i) => [id, parts[i] ?? 0]));
    };
    return {
      sug: pct(suggestTierAllocation(s, t)),
      common: pct({ [common.id]: 1 }),
      rare: pct({ [rare.id]: 1 }),
    };
  };
  const samePercents = (a: Record<string, number>, b: Record<string, number>, ids: string[]): boolean => ids.every((id) => (a[id] ?? 0) === (b[id] ?? 0));

  // ---------- next ----------
  const next = nextCard({ heading: 'Next step' });
  next.button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('im:goto', { detail: 'departments' })));

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
      draftPreset = null;
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

  const nowLine = h('p', { class: 'seatline' });
  const pre = presetRow(
    {
      label: 'Editor allocation',
      key: 'pool-adjust',
      options: [
        { id: 'sug', label: 'Suggested: most bananas' },
        { id: 'common', label: 'Favour common finds' },
        { id: 'rare', label: 'Favour rare finds' },
      ],
      onPick: (id) => {
        const s = ctx.state();
        if (!draft) recordPreview(s, ctx.sink, 'allocation', 'tiers');
        draft = presetPercents(s)[id] ?? null;
        draftPreset = id;
        render();
      },
    },
    ...aRows.map((r) => r.el),
  );

  const applyBtn = h('button', { class: 'strong', type: 'button', onclick: () => {
    const s = ctx.state();
    const ok = draftPreset === 'sug' ? ctx.act(applySuggestedAllocation) : (() => {
      const next = splitOf(s);
      return !!next && ctx.act((cs, tt, k) => setTierAllocation(cs, tt, k, next));
    })();
    if (ok) { draft = null; draftPreset = null; }
    render();
  } }, 'Apply this split');
  const resetBtn = h('button', { class: 'quiet', type: 'button', onclick: () => { draft = null; draftPreset = null; render(); } }, 'Discard');
  const applyWhy = why();
  const incomeDelta = h('p', { class: 'delta' });
  const flowDelta = h('p', { class: 'delta' });
  const preview = h('div', { class: 'pool-preview', hidden: true }, incomeDelta, flowDelta);
  const actions = h('div', { class: 'btn-row', hidden: true }, applyBtn, resetBtn);
  const allocBox = formbox('Who reviews what', h('p', { class: 'note' }, 'Editors split their time between find types.'), nowLine, pre.el, preview, actions, applyWhy);

  /** Draft as fractions over discovered tiers, or null. */
  function splitOf(s: GameState): Record<string, number> | null {
    if (!draft) return null;
    const ids = discoveredIds(s);
    const sum = ids.reduce((a, id) => a + (draft?.[id] ?? 0), 0);
    if (sum <= 0) return null;
    return Object.fromEntries(ids.map((id) => [id, (draft?.[id] ?? 0) / sum]));
  }

  // ---------- bottleneck dials ----------
  const busyDial = dial('Editors busy');
  const keptDial = dial('Finds kept');
  const bottleneck = h('p', { class: 'note' });
  const dialsBox = formbox('Ref. 7-T / Bottleneck',
    h('div', { class: 'gauges' }, busyDial.el, keptDial.el),
    bottleneck,
  );

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

  const detail = folder({ key: 'pool-detail', title: 'How the pool is doing' }, dialsBox, ...rows.map((r) => r.el), figures);

  root.append(stack(next.el, allocBox, detail.el));

  function render(): void {
    const s = ctx.state();
    const pool = editingPool(s, t);
    const finds = findRates(s, t);
    const eic = editorInChiefSplit(s, t);
    const cert = certNow(s, ctx);
    const discovered = discoveredIds(s);
    const hasPool = N.gt(pool, N.zero);

    const findsTotal = Object.values(finds).reduce((a, x) => N.add(a, x), N.zero);
    const keptTotal = Object.values(cert.certified).reduce((a, x) => N.add(a, x), N.zero);
    const discarding = N.gt(cert.discarded, N.zero) && N.ratio(cert.discarded, findsTotal) > 0.0005;
    const idle = N.gt(cert.idle, N.zero);

    // ----- Next card -----
    if (discarding) {
      next.update({
        label: 'Go to Departments',
        why: `Editors review ${f.amount(keptTotal)} of ${f.amount(findsTotal)} finds a second. The rest are thrown away.`,
        secondary: 'A find is a usable piece of typing: a letter, word or phrase. Editors turn finds into bananas.',
      });
    } else {
      next.update({
        label: null,
        hint: `${N.gt(findsTotal, N.zero) ? 'Every find is reviewed.' : 'No finds yet. Monkeys at their desks make them.'} A find is a usable piece of typing: a letter, word or phrase.`,
      });
    }

    // ----- Folder summary (collapsed line) -----
    detail.setSummary(`${f.amount(keptTotal)} of ${f.amount(findsTotal)} finds reviewed · ${f.rate(cert.income)}`);

    // Figures and dials
    text(poolV, f.rate(pool));
    text(demandV, f.rate(cert.demand));
    text(idleV, f.rate(cert.idle));
    text(discardedV, f.rate(cert.discarded));
    text(totalV, `${f.rate(cert.income)}`);
    const busy = hasPool ? Math.min(1, N.ratio(cert.demand, pool)) : 0;
    const kept = N.gt(findsTotal, N.zero) ? Math.min(1, N.ratio(keptTotal, findsTotal)) : 0;
    busyDial.set(busy, f.meterWord(busy), `Editors busy: ${f.meterPct(busy)}, ${f.meterWord(busy)}`);
    keptDial.set(kept, f.meterWord(kept), `Finds kept: ${f.meterPct(kept)}, ${f.meterWord(kept)}`);
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

    // ----- Allocation: nothing to split until two tiers are discovered -----
    const multi = discovered.length > 1;
    show(allocBox, multi);
    if (!multi) {
      draft = null;
      draftPreset = null;
      return;
    }
    const cur = currentPercents(s);
    const presets = presetPercents(s);
    text(nowLine, `Reviewing now: ${discovered.map((id) => `${name(id)} ${cur[id] ?? 0}%`).join(' · ')}`);
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
      text(r.info, `Current ${cur[id] ?? 0}% · Suggested ${presets.sug?.[id] ?? 0}%`);
    }
    // Chips show the pending pick, or else whichever preset the live split already matches.
    const live = (['sug', 'common', 'rare'] as const).find((k) => samePercents(presets[k] ?? {}, cur, discovered)) ?? null;
    pre.select(draft ? draftPreset : live);
    const differs = !!draft && discovered.some((id) => (draft?.[id] ?? 0) !== (cur[id] ?? 0));
    show(preview, !!draft);
    show(actions, !!draft);
    const canApply = !!split && differs && ctx.can('setTierAllocation', (cs, tt, k) => setTierAllocation(cs, tt, k, split));
    enable(applyBtn, canApply);
    setWhy(applyWhy, !draft || canApply ? null : !split ? 'Give at least one tier a share.' : !differs ? 'This is already how Editors are split.' : 'Closed after Infinity.');
    if (draft && split) {
      const c = ctx.preview((cs) => { setTierAllocation(cs, t, nullSink, split); });
      const after = certNow(c, ctx);
      text(incomeDelta, `Income ${f.change(f.rate(cert.income), f.rate(after.income))}`);
      text(flowDelta, `Thrown away ${f.change(f.rate(cert.discarded), f.rate(after.discarded))} · Idle Editors ${f.change(f.rate(cert.idle), f.rate(after.idle))}`);
    }
  }

  return render;
}

export const pool: Screen = { id: 'pool', label: 'Typing Pool', mount };
