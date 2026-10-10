// Records Library, hotel: the Golden Banana vault. Golden Bananas are paid by Permanent Commissions and
// buy epic research, which lasts across runs. Each epic shows its cost, what it changes now → after,
// and whether it is owned. Previews are core calls on a clone.
import {
  buyEpic, certifyMarkets, hasEpic, hotelPool, marketCost, nullSink, onboardingTicks, onlineMarkets,
  type EpicDef, type GameState, type Tuning,
} from '../../../core/index.js';
import type { Ctx, Screen } from '../../ctx.js';
import { h, show, text } from '../../ui/dom.js';
import * as f from '../../ui/format.js';
import { field, figure, formbox, setWhy, stack, stamp, why } from '../../ui/forms.js';
import { epicName, goldenText, marketName } from './names.js';
import './hotel.css';

/** What an epic changes, as words (numbers from tuning) and as a read of one value in a state. */
function describe(def: EpicDef): string {
  const e = def.effect;
  if (e.type === 'reviewSpeed') return `Editors review ${Math.round((e.mult - 1) * 100)}% faster, in every market.`;
  if (e.type === 'marketReviewCost') return `A ${marketName(e.market)} review costs ×${e.mult} of the Editors' time.`;
  return `Onboarding takes ×${e.mult} as long.`;
}
function read(def: EpicDef, s: GameState, t: Tuning): { label: string; value: string } {
  const e = def.effect;
  if (e.type === 'reviewSpeed') return { label: 'Editing capacity', value: `${f.amount(hotelPool(s, t))} reviews/s` };
  if (e.type === 'marketReviewCost') {
    // Editor-seconds per review in that market, and what the whole pool would clear there.
    const cleared = onlineMarkets(s).includes(e.market) ? certifyMarkets(s, t, hotelPool(s, t), { [e.market]: 1 }).certified[e.market] : undefined;
    return cleared === undefined
      ? { label: `${marketName(e.market)} review cost`, value: `${f.amount(marketCost(s, t, e.market))} Editor-s` }
      : { label: `${marketName(e.market)} if all Editors work it`, value: `${f.amount(cleared)} reviews/s` };
  }
  return { label: 'Full onboarding', value: f.duration(onboardingTicks(s, t) * t.tickSeconds) };
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const balance = figure();
  const vault = formbox('Ref. 4-R / Golden Banana vault',
    field('Golden Bananas', balance),
    h('p', { class: 'note' }, 'Permanent Commissions pay Golden Bananas. They buy epic research, and both carry over to every later run.'));

  const items = t.epics.map((def) => {
    const own = stamp('Owned', 'ok');
    const fx = h('p', { class: 'delta' });
    const costV = h('span', { class: 'big' });
    const reason = why();
    const buy = h('button', { class: 'strong', type: 'button', onclick: () => ctx.act((s, tt, k) => buyEpic(s, tt, k, def.id)) });
    const el = h('section', { class: 'epic', 'aria-label': epicName(def.id) },
      h('div', { class: 'pb-head' }, h('h4', { class: 'st-title' }, epicName(def.id)), own),
      h('p', { class: 'why' }, describe(def)), fx, field('Cost', costV), buy, reason);
    return { def, el, own, fx, costV, buy, reason };
  });
  root.append(stack(vault, ...items.map((i) => i.el)));

  return () => {
    const s = ctx.state();
    const g = s.save.golden;
    text(balance, `${f.count(g)}`);
    for (const it of items) {
      const owned = hasEpic(s, it.def.id);
      const can = ctx.can(`buyEpic:${it.def.id}`, (cs, tt, k) => buyEpic(cs, tt, k, it.def.id));
      show(it.own, owned);
      text(it.costV, goldenText(it.def.cost));
      if (owned) {
        const now = read(it.def, s, t);
        text(it.fx, `In effect. ${now.label} ${now.value}.`);
      } else {
        // Golden Bananas only: the clone is given the balance so the effect shows even while the real one is short.
        const after = ctx.preview((c) => { c.save.golden = Math.max(c.save.golden, it.def.cost); buyEpic(c, t, nullSink, it.def.id); });
        const a = read(it.def, s, t);
        const b = read(it.def, after, t);
        text(it.fx, `${a.label}: ${f.change(a.value, b.value)}`);
      }
      show(it.buy, !owned);
      text(it.buy, `Buy · ${goldenText(it.def.cost)}`);
      it.buy.disabled = !can;
      setWhy(it.reason, owned || can ? null : g < it.def.cost ? `Need ${goldenText(it.def.cost - g)} more. Permanent Commissions pay them.` : 'Cannot be bought right now.');
    }
  };
}

export const vault: Screen = { id: 'vault', label: 'Records Library', mount };
