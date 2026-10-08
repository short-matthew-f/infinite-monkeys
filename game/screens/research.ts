// Records Library: fund research on a tier (a size of text the monkeys can find), then wait while
// the Editor-in-Chief reviews it. Faster typewriters appear once they are within reach.
// Review research exists in core but is deliberately not offered (finding F4).
// Layout: one next card on top, finished tiers as chips, then what comes after.
import { N, buyTypingResearch, keystrokeRate, nullSink, researchTier, typingResearchCost } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, show, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, buyRow, chip, ledger, nextCard, sealed, stack } from '../ui/forms.js';
import './research.css';

const title = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);
const CLOSED = 'Closed after Infinity.';
/** Faster typewriters appear once the balance is this share of their cost (or they are already bought). */
const TYPING_REACH = 0.25;

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const tiers = t.tiers.filter((tier) => !tier.startsDiscovered);
  const fund = (id: string) => () => ctx.act((s, tu, k) => researchTier(s, tu, k, id));

  // 1. Next card (fund the next tier, or wait for the review in progress).
  const next = nextCard({ heading: 'Research' });
  const glossary = h('p', { class: 'note' }, 'A tier is a size of text the monkeys can type: letters, words, phrases and so on. A find is a typed piece of a researched tier. Each find the Editor-in-Chief reviews pays bananas.');
  const reviewBar = ledger('Review progress', 'gold');
  const reviewNote = h('p', { class: 'why' });
  const reviewLine = h('p', { class: 'next-calm' });
  const review = h('section', { class: 'next calm review', 'aria-label': 'Research under review' }, h('h3', { class: 'typed' }, 'Research'), reviewLine, reviewBar.el, reviewNote);

  // 2. Finished tiers as chips.
  const chips = tiers.map((tier) => chip(title(tier.id), 'Discovered'));
  const chipRow = h('div', { class: 'chip-row' }, ...chips.map((c) => c.el));

  // 3. The next locked tier (only while another tier is under review), then a sealed envelope.
  const laterRow = buyRow({ verb: 'Fund research for' });
  const laterWrap = h('div', { class: 'later' }, laterRow.el);
  const seal = sealed('');

  // 4. Faster typewriters.
  const typingRow = buyRow({ onBuy: () => ctx.act(buyTypingResearch), verb: 'Fund' });
  const typingNote = h('p', { class: 'note' }, 'Faster typing means more finds, and more to review.');
  const typingWrap = h('div', { class: 'typing' }, h('h3', { class: 'typed' }, 'Faster typewriters'), typingRow.el, typingNote);

  // 5. Golden Bananas.
  const golden = h('p', { class: 'note golden' });

  root.append(stack(next.el, review, glossary, chipRow, laterWrap, seal.el, typingWrap, golden));

  return () => {
    const s = ctx.state();
    const status = tiers.map((tier) => {
      const ts = s.tiers[tier.id];
      return ts?.discovered ? 'done' : ts?.discoverable ? 'review' : 'locked';
    });
    const bananasNow = N.toNumber(s.bananas);
    const reviewing = tiers.findIndex((_, i) => status[i] === 'review');
    const lockedIdx = tiers.map((_, i) => i).filter((i) => status[i] === 'locked');

    // Chips: only the finished ones.
    let anyDone = false;
    tiers.forEach((_, i) => {
      show(chips[i]!.el, status[i] === 'done');
      if (status[i] === 'done') anyDone = true;
    });
    show(chipRow, anyDone);

    /** The locked tier that is a full card right now: first locked, unless a review is in progress (then it is a row below). */
    const fundIdx = lockedIdx[0];
    const fundTier = fundIdx === undefined ? undefined : tiers[fundIdx]!;
    const price = (tier: (typeof tiers)[number]) => tier.researchCost;

    show(next.el, reviewing < 0);
    if (reviewing >= 0) {
      const tier = tiers[reviewing]!;
      const ts = s.tiers[tier.id]!;
      const acc = Math.min(ts.acc, 1);
      const claimed = s.save.discoveryRewardsClaimed.includes(tier.id);
      const gold = tier.discoveryGolden > 0 ? ` and ${f.count(tier.discoveryGolden)} Golden ${tier.discoveryGolden === 1 ? 'Banana' : 'Bananas'}` : '';
      text(reviewLine, `The Editor-in-Chief is reviewing ${tier.id}. Nothing to do but wait.`);
      show(review, true);
      reviewBar.set(Math.min(acc, 0.99), `${title(tier.id)} discovery ${f.meterPct(acc)}`);
      text(reviewNote, `${title(tier.id)} discovery ${f.meterPct(acc)}. ${claimed ? 'Discovery reward already claimed on an earlier run.' : `On discovery: ${f.bananaText(tier.discoveryBananas)}${gold}, once.`}`);
      show(glossary, false);
    } else if (fundTier) {
      const can = ctx.can(`researchTier:${fundTier.id}`, (st, tu, k) => researchTier(st, tu, k, fundTier.id));
      next.update({
        label: `Fund research: ${title(fundTier.id)}`,
        cost: price(fundTier),
        enabled: can,
        onAct: fund(fundTier.id),
        why: `Research lets the Editor-in-Chief start finding ${fundTier.id}. Each ${fundTier.id.replace(/s$/, '')} reviewed pays ${f.bananaText(fundTier.value)}.`,
        reason: can ? null : f.shortBy(price(fundTier), bananasNow) ?? CLOSED,
      });
      show(review, false);
      show(glossary, true);
    } else {
      next.update({ label: null, hint: 'Every tier is discovered. Nothing left to research here.' });
      show(review, false);
      show(glossary, false);
    }

    // The next locked tier below the card (only while one is under review), and the sealed envelope after it.
    const rowIdx = reviewing >= 0 ? lockedIdx[0] : undefined;
    const sealIdx = reviewing >= 0 ? lockedIdx[1] : lockedIdx[1];
    if (rowIdx !== undefined) {
      const tier = tiers[rowIdx]!;
      const can = ctx.can(`researchTier:${tier.id}`, (st, tu, k) => researchTier(st, tu, k, tier.id));
      laterRow.update({
        label: `Fund research: ${title(tier.id)}`,
        effect: `Each find pays ${f.bananaText(tier.value)}.`,
        price: price(tier),
        have: bananasNow,
        progress: bananasNow / price(tier),
        enabled: can,
        onBuy: fund(tier.id),
      });
    }
    show(laterWrap, rowIdx !== undefined);
    // Sealed: names the tier ahead of it as the one to file first.
    const gate = reviewing >= 0 ? tiers[reviewing]! : fundTier;
    const beyond = reviewing >= 0 ? (rowIdx !== undefined ? tiers[rowIdx]! : gate) : gate;
    const sealTier = sealIdx !== undefined ? tiers[sealIdx]! : undefined;
    if (sealTier && beyond) seal.set(`${title(sealTier.id)}: opens when ${title(beyond.id)} is filed`);
    show(seal.el, !!sealTier);

    // Faster typewriters: hidden until within reach, or already bought.
    const tCost = typingResearchCost(s, t);
    const tNum = N.toNumber(tCost);
    const reach = s.typingLevel > 0 || bananasNow >= tNum * TYPING_REACH;
    show(typingWrap, reach);
    if (reach) {
      const canTyping = ctx.can('buyTypingResearch', buyTypingResearch);
      const afterTyping = ctx.preview((c) => { afford(c, tNum); buyTypingResearch(c, t, nullSink); });
      typingRow.update({
        label: `Level ${s.typingLevel + 1}: typing ×${t.typingResearch.mult}`,
        effect: { label: 'Keystrokes', from: f.rate(keystrokeRate(s, t)), to: f.rate(keystrokeRate(afterTyping, t)) },
        price: tNum,
        have: bananasNow,
        progress: bananasNow / tNum,
        enabled: canTyping,
        reason: canTyping ? null : bananasNow >= tNum ? CLOSED : null,
      });
    }

    // Golden Bananas: only once the player has any.
    const g = s.save.golden;
    show(golden, g > 0);
    if (g > 0) text(golden, `Golden Bananas in reserve: ${f.count(g)}. They carry over past Infinity.`);
  };
}

export const research: Screen = { id: 'research', label: 'Research', mount };
