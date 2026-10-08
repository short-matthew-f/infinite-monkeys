// Personnel (id 'office'): hire by hand, buy desks, shorten the hire cooldown (Zeno).
// Renders the contents of a paper sheet: the sheet supplies the title and Fold down.
// Every before → after below is a core preview on a clone; every "why not" compares a cost to the balance.
import { N, buyDesk, buyZeno, certifyTiers, deskCost, editingPool, hireCooldownSeconds, keystrokeRate, nullSink, tapHire, zenoCost, type GameState } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, field, figure, formbox, ledger, setCost, setWhy, stack, why } from '../ui/forms.js';
import './office.css';

/** Up to this many desks are drawn as individual slots; beyond it the row becomes a ledger bar. */
const MAX_SLOTS = 14;

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const income = (s: GameState): string => f.rate(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income);

  // ----- hire (the one primary action) -----
  const hireFill = h('span', { class: 'hire-cooldown', 'aria-hidden': 'true' });
  const hireBtn = h('button', { class: 'hire', type: 'button', onclick: () => ctx.act(tapHire) }, hireFill, h('span', {}, 'Hire monkey'));
  const hireDelta = h('p', { class: 'delta' });
  const hireWhy = why();

  // ----- seated -----
  const seated = figure();
  const keys = figure();
  const slots = h('div', { class: 'slots' });
  const slotBar = ledger('Desks seated');
  const slotHost = h('div', { class: 'office-slots', role: 'progressbar', 'aria-label': 'Desks seated', 'aria-valuemin': 0 }, slots);
  const seatNote = h('p', { class: 'note' });
  let slotKey = '';

  // ----- desk -----
  const deskLab = h('p', { class: 'lab' });
  const deskDelta = h('p', { class: 'delta' });
  const deskCostEl = h('span', { class: 'cost' });
  const deskBtn = h('button', { type: 'button', onclick: () => ctx.act(buyDesk) }, h('span', {}, 'Buy desk'), deskCostEl);
  const deskWhy = why();

  // ----- zeno -----
  const zenoDelta = h('p', { class: 'delta' });
  const zenoCostEl = h('span', { class: 'cost' });
  const zenoBtn = h('button', { type: 'button', onclick: () => ctx.act(buyZeno) }, h('span', {}, 'Hire faster'), zenoCostEl);
  const zenoWhy = why();
  const zenoNote = h('p', { class: 'why' });

  root.append(
    stack(
      h('div', { class: 'hirebox' }, hireBtn, hireDelta, hireWhy),
      formbox('Ref. 3-H / Seated',
        field('Seated', seated),
        slotHost,
        seatNote,
        field('Keystrokes', keys),
      ),
      formbox('Req. 3-H/2 / Desks',
        h('div', { class: 'row2' }, h('div', {}, deskLab, deskDelta), deskBtn, deskWhy),
      ),
      formbox('Req. 3-H/3 / Hiring procedure',
        h('div', { class: 'row2' }, h('div', {}, h('p', { class: 'lab' }, "Zeno's hiring"), zenoDelta), zenoBtn, zenoWhy),
        zenoNote,
      ),
    ),
  );

  return () => {
    const s = ctx.state();
    const desks = N.toNumber(s.desks);
    const monkeys = N.toNumber(s.monkeys);
    const free = desks - monkeys;

    // Seated
    text(seated, `${f.count(s.monkeys)} / ${f.count(s.desks)}`);
    text(keys, f.rate(keystrokeRate(s, t)));
    const slotted = desks <= MAX_SLOTS;
    const key = slotted ? `s${desks}` : 'bar';
    if (key !== slotKey) {
      slotKey = key;
      slots.replaceChildren(...(slotted ? Array.from({ length: desks }, () => h('i')) : [slotBar.el]));
    }
    if (slotted) slots.childNodes.forEach((n, i) => (n as HTMLElement).classList.toggle('on', i < monkeys));
    else slotBar.set(desks > 0 ? Math.min(1, monkeys / desks) : 0, `${f.count(s.monkeys)} of ${f.count(s.desks)} desks seated`);
    slotHost.setAttribute('aria-valuemax', String(desks));
    slotHost.setAttribute('aria-valuenow', String(Math.min(monkeys, desks)));
    slotHost.setAttribute('aria-valuetext', `${f.count(s.monkeys)} of ${f.count(s.desks)} desks seated`);
    text(seatNote, free >= 1 ? `${f.count(free)} free ${free === 1 ? 'desk' : 'desks'}. A candidate is waiting.` : 'Every desk is taken.');

    // Hire
    const cooldown = hireCooldownSeconds(t, s.zenoLevel);
    const left = Math.max(0, (s.hireReadyTick - s.tick) * t.tickSeconds);
    fill(hireFill, cooldown > 0 ? left / cooldown : 0);
    const canHire = ctx.can('tapHire', tapHire);
    enable(hireBtn, canHire);
    const hired = ctx.preview((c) => { c.hireReadyTick = c.tick; tapHire(c, t, nullSink); });
    const works = N.gt(hired.monkeys, s.monkeys);
    text(hireDelta, works
      ? `Monkeys ${f.change(f.count(s.monkeys), f.count(hired.monkeys))} · Keystrokes ${f.change(f.rate(keystrokeRate(s, t)), f.rate(keystrokeRate(hired, t)))} · Income ${f.change(income(s), income(hired))}`
      : '');
    hireDelta.hidden = !works;
    setWhy(hireWhy, canHire ? null : left > 0 ? `Next hire in ${f.duration(left)}.` : free < 1 ? 'No free desk. Buy one below.' : 'Hiring is closed.');

    // Desk
    const dCost = deskCost(s, t);
    const afterDesk = ctx.preview((c) => { afford(c, N.toNumber(dCost)); buyDesk(c, t, nullSink); });
    text(deskLab, `Desk ${f.count(N.add(s.desks, N.one))}`);
    text(deskDelta, `Desks ${f.change(f.count(s.desks), f.count(afterDesk.desks))} · Free ${f.change(f.count(Math.max(0, free)), f.count(Math.max(0, N.toNumber(afterDesk.desks) - monkeys)))}`);
    setCost(deskBtn, deskCostEl, 'Buy desk', N.toNumber(dCost));
    const canDesk = ctx.can('buyDesk', buyDesk);
    enable(deskBtn, canDesk);
    setWhy(deskWhy, canDesk ? null : f.shortBy(dCost, s.bananas) ?? 'Closed after Infinity.');

    // Zeno
    const zCost = zenoCost(s, t);
    const afterZeno = ctx.preview((c) => { afford(c, N.toNumber(zCost)); buyZeno(c, t, nullSink); });
    const cdAfter = hireCooldownSeconds(t, afterZeno.zenoLevel);
    const sec = (v: number) => `${v.toFixed(v < 1 ? 2 : 1)} s`;
    text(zenoDelta, `Cooldown ${f.change(sec(cooldown), sec(cdAfter))}`);
    text(zenoNote, 'Each level halves the wait. It never reaches zero.');
    setCost(zenoBtn, zenoCostEl, "Zeno's hiring", N.toNumber(zCost));
    const canZeno = ctx.can('buyZeno', buyZeno);
    enable(zenoBtn, canZeno);
    setWhy(zenoWhy, canZeno ? null : f.shortBy(zCost, s.bananas) ?? 'Closed after Infinity.');
  };
}

export const office: Screen = { id: 'office', label: 'Personnel', mount };
