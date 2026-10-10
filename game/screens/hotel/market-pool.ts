// Typing Pool, hotel: the Editors' market split. Automatic by default (it follows the pinned objective);
// "Set by hand" holds a split of the player's own until "Back to automatic". Same pattern as the tier split
// in game/screens/pool.ts. Per-market throughput and income come from certifyMarkets; the preview from
// previewMarketAllocation ("keeping this split and current funding").
import {
  N, certifyMarkets, hotelPool, marketAutoOn, marketDef, onlineMarkets, previewMarketAllocation, recordPreview, setMarketAllocation, setMarketAuto,
  type GameState,
} from '../../../core/index.js';
import type { Ctx, Screen } from '../../ctx.js';
import { h, enable, show, text } from '../../ui/dom.js';
import * as f from '../../ui/format.js';
import { field, figure, formbox, ledger, presetRow, setWhy, stack, why } from '../../ui/forms.js';
import { marketName } from './names.js';
import './hotel.css';

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
  const marketIds = t.hotel.markets.map((m) => m.id);
  /** Draft split as whole percents over the online markets (sums to 100), or null when the player isn't editing. */
  let draft: Record<string, number> | null = null;

  const online = (s: GameState): string[] => marketIds.filter((id) => onlineMarkets(s).includes(id));
  const currentPercents = (s: GameState): Record<string, number> => {
    const ids = online(s);
    const parts = distribute(ids.map((id) => s.hotel?.allocation[id] ?? 0), 100);
    return Object.fromEntries(ids.map((id, i) => [id, parts[i] ?? 0]));
  };
  const splitOf = (s: GameState): Record<string, number> | null => {
    if (!draft) return null;
    const ids = online(s);
    const sum = ids.reduce((a, id) => a + (draft?.[id] ?? 0), 0);
    if (sum <= 0) return null;
    return Object.fromEntries(marketIds.map((id) => [id, ids.includes(id) ? (draft?.[id] ?? 0) / sum : 0]));
  };

  // ----- the live split -----
  const modeLine = h('p', { class: 'note' });
  const backBtn = h('button', { class: 'quiet', type: 'button', onclick: () => { ctx.act((s, tt, k) => setMarketAuto(s, tt, k, true)); draft = null; render(); } }, 'Back to automatic');
  const backRow = h('div', { class: 'btn-row', hidden: true }, backBtn);
  const handNote = h('p', { class: 'why', hidden: true }, 'A market that comes online starts with no share. Go back to automatic, or give it one.');
  const rows = marketIds.map((id) => {
    const share = figure();
    const bar = ledger(`${marketName(id)} share of Editors`);
    const line = h('p', { class: 'delta' });
    const el = h('div', { class: 'mk-row' }, field(marketName(id), share), bar.el, line);
    return { id, el, share, bar, line };
  });
  const poolV = figure();
  const incomeV = figure();
  const bottleneck = h('p', { class: 'note' }, 'Bottleneck: Editors. Text to review is unlimited, so Editors\' time is what limits income.');
  const liveBox = formbox('Ref. 7-T / Who reviews what', modeLine, backRow, handNote, ...rows.map((r) => r.el), field('Editing capacity', poolV), field('Income', incomeV), bottleneck);

  // ----- set by hand -----
  const sliders = marketIds.map((id) => {
    const share = figure();
    const input = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${marketName(id)} share of Editors` });
    const el = h('div', { class: 'pool-alloc' }, field(marketName(id), share), input);
    input.addEventListener('input', () => {
      const s = ctx.state();
      if (!draft) {
        draft = currentPercents(s);
        recordPreview(s, ctx.sink, 'allocation', 'markets');
      }
      const ids = online(s);
      const v = Number(input.value);
      const others = ids.filter((x) => x !== id);
      const parts = distribute(others.map((x) => draft?.[x] ?? 0), 100 - v);
      const next: Record<string, number> = { [id]: v };
      others.forEach((x, i) => { next[x] = parts[i] ?? 0; });
      draft = next;
      render();
    });
    return { id, el, share, input };
  });
  const pre = presetRow(
    {
      label: 'Market split',
      key: 'hotel-pool-adjust',
      adjustLabel: 'Set by hand',
      options: [{ id: 'auto', label: 'Automatic' }],
      onPick: () => {
        // Automatic applies at once.
        const s = ctx.state();
        draft = null;
        if (!marketAutoOn(s, t)) ctx.act((cs, tt, k) => setMarketAuto(cs, tt, k, true));
        render();
      },
    },
    ...sliders.map((r) => r.el),
  );
  const incomeDelta = h('p', { class: 'delta' });
  const etaDelta = h('p', { class: 'delta' });
  const previewLabel = h('p', { class: 'why' }, 'Keeping this split and current funding.');
  const preview = h('div', { class: 'pool-preview', hidden: true }, previewLabel, incomeDelta, etaDelta);
  const applyBtn = h('button', { class: 'strong', type: 'button', onclick: () => {
    const next = splitOf(ctx.state());
    const ok = !!next && ctx.act((cs, tt, k) => setMarketAllocation(cs, tt, k, next));
    if (ok) draft = null;
    render();
  } }, 'Apply this split');
  const discardBtn = h('button', { class: 'quiet', type: 'button', onclick: () => { draft = null; render(); } }, 'Discard');
  const actions = h('div', { class: 'btn-row', hidden: true }, applyBtn, discardBtn);
  const applyWhy = why();
  const handBox = formbox('Ref. 7-T / Set the split yourself',
    h('p', { class: 'note' }, 'Editors follow your pinned Commission on their own. Set a split by hand only to hold it there; automatic stays off until you switch it back.'),
    pre.el, preview, actions, applyWhy);

  root.append(stack(liveBox, handBox));

  function render(): void {
    const s = ctx.state();
    const hot = s.hotel;
    if (!hot) return;
    const pool = hotelPool(s, t);
    const auto = marketAutoOn(s, t);
    const cert = certifyMarkets(s, t, pool, hot.allocation);
    const on = online(s);
    const cur = currentPercents(s);

    text(modeLine, auto
      ? `Automatic: Editors follow your pinned objective${s.objective.kind === 'commission' ? ' (a Commission)' : ' (maximize bananas)'}.`
      : 'Set by hand. Automatic is off.');
    show(backRow, !auto && ctx.can('setMarketAuto', (cs, tt, k) => setMarketAuto(cs, tt, k, true)));
    show(handNote, !auto);
    text(poolV, `${f.amount(pool)} reviews/s`);
    text(incomeV, f.rate(cert.income));
    for (const r of rows) {
      const isOn = on.includes(r.id);
      const status = hot.markets[r.id]?.status ?? 'locked';
      const certified = cert.certified[r.id] ?? N.zero;
      const pct = isOn ? (cur[r.id] ?? 0) : 0;
      text(r.share, isOn ? `${pct}%` : status === 'locked' ? 'Locked' : 'Not online');
      r.bar.set(pct / 100, `${marketName(r.id)}: ${pct}% of Editors`);
      text(r.line, isOn
        ? `${f.amount(certified)} reviews/s · income ${f.rate(N.mul(certified, marketDef(t, r.id).value))} · pays ${f.count(marketDef(t, r.id).value)} per review`
        : status === 'locked' ? 'Opens when a Commission reward sends its bus.' : 'Arriving. Editors cannot work here until it is online.');
    }

    // ----- by hand -----
    const split = splitOf(s);
    if (on.length < 2) draft = null;
    show(handBox, on.length > 1);
    if (on.length < 2) return;
    for (const r of sliders) {
      const isOn = on.includes(r.id);
      show(r.el, isOn);
      if (!isOn) continue;
      const v = draft ? (draft[r.id] ?? 0) : (cur[r.id] ?? 0);
      if (r.input.value !== String(v)) r.input.value = String(v);
      r.input.setAttribute('aria-valuetext', `${v} percent of Editors`);
      text(r.share, `${v}%`);
    }
    pre.select(draft ? null : auto ? 'auto' : null);
    const differs = !!draft && on.some((id) => (draft?.[id] ?? 0) !== (cur[id] ?? 0));
    show(preview, !!draft);
    show(actions, !!draft);
    const canApply = !!split && differs && ctx.can('setMarketAllocation', (cs, tt, k) => setMarketAllocation(cs, tt, k, split));
    enable(applyBtn, canApply);
    setWhy(applyWhy, !draft || canApply ? null : !split ? 'Give at least one market a share.' : !differs ? 'This is already how Editors are split.' : 'Cannot be applied right now.');
    if (draft && split) {
      const before = previewMarketAllocation(s, t, hot.allocation);
      const after = previewMarketAllocation(s, t, split);
      text(incomeDelta, `Income ${f.change(f.rate(before.incomeRate), f.rate(after.incomeRate))}`);
      show(etaDelta, after.objectiveEtaSeconds !== null);
      if (after.objectiveEtaSeconds !== null) {
        const b = before.objectiveEtaSeconds;
        text(etaDelta, `Pinned Commission ETA ${f.change(b === null ? '—' : f.duration(b), f.duration(after.objectiveEtaSeconds))}`);
      }
    }
  }

  return render;
}

export const marketPool: Screen = { id: 'market-pool', label: 'Typing Pool', mount };
