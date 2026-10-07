// Office: the first thing the player touches. Hire by hand, buy desks, and
// shorten the hire cooldown (Zeno). Also the exemplar screen: copy its shape.
import { buyDesk, buyZeno, deskCost, hireCooldownSeconds, keystrokeRate, tapHire, zenoCost } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './office.css';

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;

  const hireFill = h('span', { class: 'office-cooldown' });
  const hireBtn = h('button', { class: 'primary office-hire', onclick: () => ctx.act(tapHire) }, hireFill, h('span', {}, 'Hire'));
  const hireNote = h('p', { class: 'label' });

  const deskCostEl = h('span', { class: 'cost' });
  const deskBtn = h('button', { onclick: () => ctx.act(buyDesk) }, 'Buy desk ', deskCostEl);

  const zenoCostEl = h('span', { class: 'cost' });
  const zenoNote = h('p', { class: 'label' });
  const zenoBtn = h('button', { onclick: () => ctx.act(buyZeno) }, "Zeno's hiring ", zenoCostEl);

  const keys = h('span', { class: 'value' });
  const seated = h('span', { class: 'value' });

  root.append(
    h('section', { class: 'panel' },
      h('h2', {}, 'Personnel'),
      h('div', { class: 'office-stats' },
        h('div', {}, h('span', { class: 'label' }, 'Seated / desks'), seated),
        h('div', {}, h('span', { class: 'label' }, 'Keystrokes'), keys),
      ),
      hireBtn,
      hireNote,
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Facilities'),
      deskBtn,
      h('p', { class: 'label' }, 'Every monkey needs a desk.'),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Procedures'),
      zenoBtn,
      zenoNote,
    ),
  );

  return () => {
    const s = ctx.state();
    text(seated, `${f.count(s.monkeys)} / ${f.count(s.desks)}`);
    text(keys, f.rate(keystrokeRate(s, t)));

    const cooldown = hireCooldownSeconds(t, s.zenoLevel);
    const left = Math.max(0, (s.hireReadyTick - s.tick) * t.tickSeconds);
    fill(hireFill, cooldown > 0 ? left / cooldown : 0);
    const canHire = ctx.can('tapHire', tapHire);
    enable(hireBtn, canHire);
    text(hireNote, left > 0 ? `Next hire in ${f.duration(left)}` : canHire ? 'A desk is free.' : 'No free desk. Buy one.');

    text(deskCostEl, f.bananas(deskCost(s, t)));
    enable(deskBtn, ctx.can('buyDesk', buyDesk));

    text(zenoCostEl, f.bananas(zenoCost(s, t)));
    enable(zenoBtn, ctx.can('buyZeno', buyZeno));
    text(zenoNote, `Cooldown ${cooldown.toFixed(cooldown < 1 ? 2 : 1)} s → ${(cooldown / 2).toFixed(cooldown < 2 ? 2 : 1)} s. Halves forever; never reaches zero.`);
  };
}

export const office: Screen = { id: 'office', label: 'Office', mount };
