// Research: tier research (make a tier discoverable, then wait for the Editor-in-Chief to
// review it) and common research (faster typewriters). Review research exists in core but
// is deliberately not offered (finding F4). Contents of a paper sheet.
import { N, buyTypingResearch, keystrokeRate, nullSink, researchTier, tierCost, typingResearchCost } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, field, figure, formbox, ledger, setCost, setWhy, stack, stamp, why } from '../ui/forms.js';
import './research.css';

/** Locked tiers shown at once. Two keeps the next goal visible without spoiling the whole ladder. */
const LOCKED_VISIBLE = 2;

const title = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);
const CLOSED = 'Closed after Infinity.';

interface TierRow {
  id: string;
  root: HTMLElement;
  locked: HTMLElement;
  costEl: HTMLElement;
  btn: HTMLButtonElement;
  delta: HTMLElement;
  worth: HTMLElement;
  why: HTMLElement;
  review: HTMLElement;
  bar: ReturnType<typeof ledger>;
  rewardNote: HTMLElement;
  done: HTMLElement;
  doneNote: HTMLElement;
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;

  const rows: TierRow[] = t.tiers
    .filter((tier) => !tier.startsDiscovered)
    .map((tier, i) => {
      const id = tier.id;
      const costEl = h('span', { class: 'cost' });
      const btn = h('button', { class: 'strong wide', type: 'button', onclick: () => ctx.act((s, tu, k) => researchTier(s, tu, k, id)) }, h('span', {}, 'Fund research'), costEl);
      const delta = h('p', { class: 'delta' });
      const worth = h('p', { class: 'why' });
      const whyEl = why();
      const locked = h('div', { class: 'form-stack tight' }, h('p', {}, stamp('Not researched', 'plain')), btn, whyEl, delta, worth);

      const bar = ledger(`${title(id)} review progress`, 'gold');
      const rewardNote = h('p', { class: 'why' });
      const review = h('div', { class: 'form-stack tight' },
        h('p', {}, stamp('Under review', 'plain')),
        h('p', { class: 'note' }, 'The Editor-in-Chief is reviewing submissions for this tier. Discovery completes by itself.'),
        bar.el,
        rewardNote,
      );

      const doneNote = h('p', { class: 'delta' });
      const done = h('div', { class: 'form-stack tight' }, h('p', {}, stamp('Discovered', 'ok')), doneNote);

      const rowEl = formbox(`Ref. 4-R/${i + 1} / ${title(id)}`, locked, review, done);
      return { id, root: rowEl, locked, costEl, btn, delta, worth, why: whyEl, review, bar, rewardNote, done, doneNote };
    });

  const typingLevel = figure();
  const typingCost = h('span', { class: 'cost' });
  const typingBtn = h('button', { type: 'button', onclick: () => ctx.act(buyTypingResearch) }, h('span', {}, 'Fund'), typingCost);
  const typingDelta = h('p', { class: 'delta' });
  const typingWhy = why();
  const typingNote = h('p', { class: 'why' });
  const golden = figure();

  root.append(
    stack(
      ...rows.map((r) => r.root),
      formbox('Req. 4-R/9 / Faster typewriters',
        field('Typewriter level', typingLevel),
        h('div', { class: 'row2' }, typingDelta, typingBtn, typingWhy),
        typingNote,
      ),
      formbox('Ref. 4-R/G / Reserve', field('Golden Bananas', golden)),
    ),
  );

  return () => {
    const s = ctx.state();

    let lockedSeen = 0;
    for (const r of rows) {
      const tier = t.tiers.find((x) => x.id === r.id)!;
      const ts = s.tiers[r.id];
      if (!ts) continue;
      const state = ts.discovered ? 'done' : ts.discoverable ? 'review' : 'locked';
      let visible = true;
      if (state === 'locked') visible = lockedSeen++ < LOCKED_VISIBLE;
      r.root.hidden = !visible;
      if (!visible) continue;
      r.locked.hidden = state !== 'locked';
      r.review.hidden = state !== 'review';
      r.done.hidden = state !== 'done';

      if (state === 'locked') {
        const cost = N.of(tier.researchCost);
        setCost(r.btn, r.costEl, `Fund research for ${title(r.id)}`, tier.researchCost);
        const can = ctx.can(`researchTier:${r.id}`, (st, tu, k) => researchTier(st, tu, k, r.id));
        enable(r.btn, can);
        setWhy(r.why, can ? null : f.shortBy(cost, s.bananas) ?? CLOSED);
        const after = ctx.preview((c) => { afford(c, tier.researchCost); researchTier(c, t, nullSink, r.id); });
        const opens = !!after.tiers[r.id]?.discoverable;
        text(r.delta, opens ? `Tier ${f.change('Not researched', 'Under review')} ${can ? `· Bananas ${f.change(f.count(s.bananas), f.count(after.bananas))}` : ''}` : '');
        r.delta.hidden = !opens;
        text(r.worth, `Worth ${f.bananaText(tier.value)} per find.`);
      } else if (state === 'review') {
        const acc = Math.min(ts.acc, 1);
        r.bar.set(Math.min(acc, 0.99), `${title(r.id)} review ${f.meterPct(acc)}`);
        const claimed = s.save.discoveryRewardsClaimed.includes(r.id);
        const gold = tier.discoveryGolden > 0 ? ` and ${f.count(tier.discoveryGolden)} Golden ${tier.discoveryGolden === 1 ? 'Banana' : 'Bananas'} (once per save)` : '';
        text(r.rewardNote, `${f.meterPct(acc)} reviewed. ${claimed ? 'Discovery reward already claimed on an earlier run.' : `On discovery: ${f.bananaText(tier.discoveryBananas)}${gold}.`}`);
      } else {
        text(r.doneNote, `Worth ${f.bananaText(tier.value)} per find. Review cost ${f.amount(tierCost(s, t, tier))} per find.`);
      }
    }

    text(typingLevel, String(s.typingLevel));
    const tCost = typingResearchCost(s, t);
    setCost(typingBtn, typingCost, 'Fund faster typewriters', N.toNumber(tCost));
    const canTyping = ctx.can('buyTypingResearch', buyTypingResearch);
    enable(typingBtn, canTyping);
    setWhy(typingWhy, canTyping ? null : f.shortBy(tCost, s.bananas) ?? CLOSED);
    const afterTyping = ctx.preview((c) => { afford(c, N.toNumber(tCost)); buyTypingResearch(c, t, nullSink); });
    text(typingDelta, `Level ${f.change(String(s.typingLevel), String(afterTyping.typingLevel))} · Keystrokes ${f.change(f.rate(keystrokeRate(s, t)), f.rate(keystrokeRate(afterTyping, t)))}`);
    text(typingNote, `×${t.typingResearch.mult} typing per level. Each level costs ×${t.typingResearch.costGrowth} more.`);
    text(golden, f.count(s.save.golden));
  };
}

export const research: Screen = { id: 'research', label: 'Research', mount };
