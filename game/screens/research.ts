// Research: tier research (make a tier discoverable, then wait for the Editor-in-Chief to
// review it) and common research (faster typewriters). Review research exists in core but
// is deliberately not offered (finding F4).
import { buyTypingResearch, researchTier, tierCost, typingResearchCost } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './research.css';

/** Locked tiers shown at once. Two keeps the next goal visible without spoiling the whole ladder. */
const LOCKED_VISIBLE = 2;

const title = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

interface TierRow {
  id: string;
  root: HTMLElement;
  status: HTMLElement;
  locked: HTMLElement;
  costEl: HTMLElement;
  btn: HTMLButtonElement;
  lockedNote: HTMLElement;
  review: HTMLElement;
  bar: HTMLElement;
  barText: HTMLElement;
  rewardNote: HTMLElement;
  done: HTMLElement;
  doneNote: HTMLElement;
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;

  const rows: TierRow[] = t.tiers
    .filter((tier) => !tier.startsDiscovered)
    .map((tier) => {
      const id = tier.id;
      const status = h('span', { class: 'research-status' });
      const costEl = h('span', { class: 'cost' });
      const btn = h('button', { onclick: () => ctx.act((s, tu, k) => researchTier(s, tu, k, id)) }, 'Fund research ', costEl);
      const lockedNote = h('p', { class: 'label' });
      const locked = h('div', { class: 'research-state' }, btn, lockedNote);

      const barText = h('span', { class: 'value research-bar-text' });
      const bar = h('div', { class: 'research-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { class: 'research-bar-fill' }));
      const rewardNote = h('p', { class: 'label' });
      const review = h('div', { class: 'research-state' },
        h('p', {}, 'The Editor-in-Chief is reviewing submissions for this tier. Discovery completes by itself.'),
        bar,
        barText,
        rewardNote,
      );

      const doneNote = h('p', { class: 'label' });
      const done = h('div', { class: 'research-state' }, doneNote);

      const rowEl = h('div', { class: 'research-tier' },
        h('div', { class: 'research-head' }, h('h3', {}, title(id)), status),
        locked, review, done,
      );
      return { id, root: rowEl, status, locked, costEl, btn, lockedNote, review, bar, barText, rewardNote, done, doneNote };
    });

  const tierList = h('div', { class: 'research-list' }, ...rows.map((r) => r.root));

  const typingLevel = h('span', { class: 'value' });
  const typingCost = h('span', { class: 'cost' });
  const typingBtn = h('button', { onclick: () => ctx.act(buyTypingResearch) }, 'Faster typewriters ', typingCost);
  const typingNote = h('p', { class: 'label' });

  root.append(
    h('section', { class: 'panel' },
      h('h2', {}, 'Tier research'),
      h('p', { class: 'label' }, 'Funding research makes a tier discoverable. Discovery is then reviewed by the Editor-in-Chief.'),
      tierList,
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Common research'),
      h('div', {}, h('span', { class: 'label' }, 'Typewriter level '), typingLevel),
      typingBtn,
      typingNote,
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
      r.root.dataset.state = state;
      text(r.status, state === 'done' ? 'Discovered' : state === 'review' ? 'Under review' : 'Not researched');

      if (state === 'locked') {
        text(r.costEl, f.bananas(tier.researchCost));
        enable(r.btn, ctx.can(`researchTier:${r.id}`, (st, tu, k) => researchTier(st, tu, k, r.id)));
        text(r.lockedNote, `Worth ${f.bananas(tier.value)} per find.`);
      } else if (state === 'review') {
        fill(r.bar.firstElementChild as HTMLElement, ts.acc);
        const p = f.pct(Math.min(ts.acc, 0.99));
        r.bar.setAttribute('aria-valuenow', String(Math.round(Math.min(ts.acc, 1) * 100)));
        text(r.barText, p);
        const claimed = s.save.discoveryRewardsClaimed.includes(r.id);
        const golden = tier.discoveryGolden > 0 ? ` and ${f.count(tier.discoveryGolden)} Golden ${tier.discoveryGolden === 1 ? 'Banana' : 'Bananas'} (once per save)` : '';
        text(r.rewardNote, claimed ? 'Discovery reward already claimed on an earlier run.' : `On discovery: ${f.bananas(tier.discoveryBananas)}${golden}.`);
      } else {
        text(r.doneNote, `Worth ${f.bananas(tier.value)} per find. Review cost ${f.amount(tierCost(s, t, tier))} per find.`);
      }
    }

    text(typingLevel, String(s.typingLevel));
    text(typingCost, f.bananas(typingResearchCost(s, t)));
    enable(typingBtn, ctx.can('buyTypingResearch', buyTypingResearch));
    text(typingNote, `×${t.typingResearch.mult} typing per level. Each level costs ×${t.typingResearch.costGrowth} more.`);
  };
}

export const research: Screen = { id: 'research', label: 'Research', mount };
