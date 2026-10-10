// Staff (Departments, hotel): the three hotel upgrades. They replace department levels after Infinity:
// Editors raise review capacity, Bus Wranglers (formerly Recruiters) shorten bus trips, and Shift Crews
// (formerly Builders) shorten onboarding. Funding between them is automatic and shown here as fact.
// Every before → after is a core preview on a clone.
import {
  N, buyHotelUpgrade, hotelPool, hotelUpgradeCost, nullSink, onlineMarkets,
  type GameState, type HotelUpgrade,
} from '../../../core/index.js';
import type { Ctx, Screen } from '../../ctx.js';
import { h, show, text } from '../../ui/dom.js';
import * as f from '../../ui/format.js';
import { afford, buyRow, formbox, stack } from '../../ui/forms.js';
import { tripSeconds } from './names.js';
import './hotel.css';

interface Line {
  id: HotelUpgrade;
  name: string;
  formerly: string | null;
  /** What a level changes, in words (the numbers come from tuning). */
  does: (t: Ctx['t']) => string;
  /** The value this line changes, as text, read from a state. */
  read: (s: GameState, t: Ctx['t']) => { label: string; value: string };
}

const pctMore = (m: number) => `+${Math.round((m - 1) * 100)}%`;
const LINES: Line[] = [
  {
    id: 'editors', name: 'Editors', formerly: null,
    does: (t) => `Each level adds ${pctMore(t.hotel.upgrades.editingMult)} review capacity.`,
    read: (s, t) => ({ label: 'Editing capacity', value: `${f.amount(hotelPool(s, t))} reviews/s` }),
  },
  {
    id: 'busWranglers', name: 'Bus Wranglers', formerly: 'Recruiters',
    does: (t) => `Each level makes a bus trip ×${t.hotel.upgrades.busWaitMult} as long.`,
    read: (s, t) => ({ label: 'Full bus trip', value: f.duration(tripSeconds(s, t).bus) }),
  },
  {
    id: 'shiftCrews', name: 'Shift Crews', formerly: 'Builders',
    does: (t) => `Each level makes onboarding ×${t.hotel.upgrades.onboardingMult} as long.`,
    read: (s, t) => ({ label: 'Full onboarding', value: f.duration(tripSeconds(s, t).onboarding) }),
  },
];

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const rows = LINES.map((line) => {
    const row = buyRow({ verb: 'Buy', onBuy: () => ctx.act((s, tt, k) => buyHotelUpgrade(s, tt, k, line.id)) });
    const title = h('h4', { class: 'st-title' }, line.name, line.formerly ? h('span', { class: 'st-formerly' }, ` formerly: ${line.formerly}`) : '');
    const does = h('p', { class: 'why' }, line.does(t));
    const level = h('p', { class: 'st-level' });
    const el = h('section', { class: 'st-line', 'aria-label': line.name }, title, level, does, row.el);
    return { line, row, el, level };
  });
  const bottleneck = h('p', { class: 'note' });
  const fund = h('p', { class: 'note' });
  const status = formbox('Ref. 5-D / Staff on duty', bottleneck, fund);
  root.append(stack(status, ...rows.map((r) => r.el)));

  return () => {
    const s = ctx.state();
    const hot = s.hotel;
    if (!hot) return;
    const bananas = N.toNumber(s.bananas);
    const moving = Object.values(hot.markets).filter((m) => m.status === 'inTransit' || m.status === 'onboarding').length;
    text(bottleneck, 'Bottleneck: Editors. Their capacity limits income and how fast a Commission finishes.');
    const sh = s.shares;
    text(fund, `Funding is automatic: Editors ${f.pct(sh.editing)} · Bus Wranglers ${f.pct(sh.recruiting)} · Shift Crews ${f.pct(sh.construction)}. ${moving ? 'It shifts to the crew whose work is under way.' : `Nothing is in transit, so the Editors get nearly all of it. ${onlineMarkets(s).length} market${onlineMarkets(s).length === 1 ? '' : 's'} online.`}`);
    for (const r of rows) {
      const id = r.line.id;
      const cost = hotelUpgradeCost(s, t, id);
      if (cost === null) continue;
      const price = N.toNumber(cost);
      const can = ctx.can(`buyHotelUpgrade:${id}`, (cs, tt, k) => buyHotelUpgrade(cs, tt, k, id));
      const after = ctx.preview((c) => { afford(c, price); buyHotelUpgrade(c, t, nullSink, id); });
      const a = r.line.read(s, t);
      const b = r.line.read(after, t);
      text(r.level, `Level ${hot.upgradeLevels[id]}`);
      r.row.update({
        label: `Level ${hot.upgradeLevels[id] + 1}`,
        effect: { label: a.label, from: a.value, to: b.value },
        price,
        have: bananas,
        progress: bananas / price,
        enabled: can,
        reason: can ? null : f.shortBy(price, bananas),
      });
    }
    show(status, true);
  };
}

export const staff: Screen = { id: 'staff', label: 'Staff', mount };
