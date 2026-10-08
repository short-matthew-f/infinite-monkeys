// Personnel (id 'office'): hire by hand, buy desks, shorten the hire wait.
// Renders the contents of a paper sheet: the sheet supplies the title and Fold down.
// Leads with the decision that applies now (nextCard); the rest is quieter and appears later.
// Every before → after below is a core preview on a clone; money progress is balance / price.
import { N, type Num, buyDesk, buyZeno, certifyTiers, deskCost, editingPool, hireCooldownSeconds, keystrokeRate, nullSink, tapHire, zenoCost, type GameState } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, show } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { afford, buyRow, field, figure, formbox, ledger, nextCard, stack } from '../ui/forms.js';
import './office.css';

/** Up to this many desks are drawn as individual slots; beyond it the row becomes a ledger bar. */
const MAX_SLOTS = 14;

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const income = (s: GameState): string => f.rate(certifyTiers(s, t, editingPool(s, t), s.tierAllocation).income);
  const sec = (v: number) => `${Number.isInteger(v) ? f.count(v) : f.amount(v)} s`;
  const progress = (price: Num, s: GameState): number => {
    const p = N.toNumber(price);
    return p > 0 ? Math.min(1, N.toNumber(s.bananas) / p) : 1;
  };

  // The player has hired by hand (or already has 2+ monkeys, e.g. a loaded save).
  let hiredByHand = N.toNumber(ctx.state().monkeys) >= 2;
  ctx.onEvent((e) => {
    if (e.type === 'hire') hiredByHand = true;
  });

  // ----- next -----
  const next = nextCard({ hire: true, heading: 'Next step', onAct: () => undefined });
  /** Which action the card currently drives, so the click handler matches the label. */
  let nextIsDesk = false;
  next.button.addEventListener('click', () => ctx.act(nextIsDesk ? buyDesk : tapHire));
  // Gauge for saving up, shown only while the desk is the Next step and not yet affordable.
  const saveBar = ledger('Bananas saved toward the desk', 'gold');
  const saveNote = h('p', { class: 'note' });
  const saveBox = h('div', { class: 'save', hidden: true }, saveBar.el, saveNote);

  // ----- compact rows -----
  const deskRow = buyRow({ onBuy: () => ctx.act(buyDesk) });
  const hireFaster = buyRow({ onBuy: () => ctx.act(buyZeno) });
  const hireFasterNote = h('p', { class: 'note' }, 'Each level halves the wait. It never reaches zero.');
  const hireFasterBox = h('div', { class: 'form-stack tight', hidden: true }, hireFaster.el, hireFasterNote);

  // ----- desks -----
  const seatLine = h('p', { class: 'seatline' });
  const slots = h('div', { class: 'slots' });
  const slotBar = ledger('Desks seated');
  const slotHost = h('div', { class: 'office-slots', role: 'progressbar', 'aria-label': 'Desks seated', 'aria-valuemin': 0 }, slots);
  const keys = figure();
  const keysField = field('Typing speed', keys);
  keysField.hidden = true;
  const deskBox = formbox('Ref. 3-H / Desks', seatLine, slotHost, keysField);
  let slotKey = '';

  root.append(stack(next.el, saveBox, deskRow.el, hireFasterBox, deskBox));

  return () => {
    const s = ctx.state();
    const desks = N.toNumber(s.desks);
    const monkeys = N.toNumber(s.monkeys);
    const free = desks - monkeys;
    if (monkeys >= 2) hiredByHand = true;
    const noDesk = free < 1;

    // Desk numbers (used by the Next card or the compact row)
    const dCost = deskCost(s, t);
    const afterDesk = ctx.preview((c) => { afford(c, N.toNumber(dCost)); buyDesk(c, t, nullSink); });
    const canDesk = ctx.can('buyDesk', buyDesk);
    const deskFx = { label: 'Desks', from: f.count(s.desks), to: f.count(afterDesk.desks) };

    // ----- Next card -----
    nextIsDesk = noDesk;
    if (noDesk) {
      next.update({
        label: 'Buy desk',
        cost: N.toNumber(dCost),
        enabled: canDesk,
        why: 'Every monkey needs a desk.',
        effect: deskFx,
        secondary: 'Hire opens once a desk is free.',
        reason: canDesk ? null : N.toNumber(dCost) === Infinity ? 'Closed after Infinity.' : null,
        cooldown: 0,
      });
      const saving = !canDesk && Number.isFinite(N.toNumber(dCost));
      show(saveBox, saving);
      if (saving) {
        const p = progress(dCost, s);
        saveBar.set(p, `${f.meterPct(p)} of the desk price saved`);
        text(saveNote, `You have ${f.bananaText(s.bananas)} of ${f.bananaText(dCost)}.`);
      }
    } else {
      show(saveBox, false);
      const cooldown = hireCooldownSeconds(t, s.zenoLevel);
      const left = Math.max(0, (s.hireReadyTick - s.tick) * t.tickSeconds);
      const canHire = ctx.can('tapHire', tapHire);
      const hired = ctx.preview((c) => { c.hireReadyTick = c.tick; tapHire(c, t, nullSink); });
      next.update({
        label: 'Hire a monkey',
        enabled: canHire,
        why: hiredByHand ? 'More monkeys type more, and typing earns bananas.' : 'Monkeys type all day, and typing earns you bananas.',
        effect: { label: 'Monkeys', from: f.count(s.monkeys), to: f.count(hired.monkeys) },
        secondary: hiredByHand ? `Income ${f.change(income(s), income(hired))}` : null,
        reason: canHire ? null : left > 0 ? `Next hire in ${f.duration(left)}.` : 'Hiring is closed.',
        cooldown: cooldown > 0 ? left / cooldown : 0,
      });
    }

    // ----- Buy desk row (only when it is not already the Next step) -----
    show(deskRow.el, !noDesk);
    if (!noDesk) {
      deskRow.update({
        label: 'Buy desk',
        effect: deskFx,
        price: N.toNumber(dCost),
        have: N.toNumber(s.bananas),
        progress: progress(dCost, s),
        enabled: canDesk,
        reason: canDesk || Number.isFinite(N.toNumber(dCost)) ? null : 'Closed after Infinity.',
      });
    }

    // ----- Hire faster (after the first hire by hand) -----
    show(hireFasterBox, hiredByHand);
    if (hiredByHand) {
      const zCost = zenoCost(s, t);
      const afterZeno = ctx.preview((c) => { afford(c, N.toNumber(zCost)); buyZeno(c, t, nullSink); });
      const canZeno = ctx.can('buyZeno', buyZeno);
      hireFaster.update({
        label: 'Hire faster',
        effect: { label: 'Wait between hires', from: sec(hireCooldownSeconds(t, s.zenoLevel)), to: sec(hireCooldownSeconds(t, afterZeno.zenoLevel)) },
        price: N.toNumber(zCost),
        have: N.toNumber(s.bananas),
        progress: progress(zCost, s),
        enabled: canZeno,
        reason: canZeno || Number.isFinite(N.toNumber(zCost)) ? null : 'Closed after Infinity.',
      });
    }

    // ----- Desks and typing speed -----
    text(seatLine, `${f.count(s.monkeys)} of ${f.count(s.desks)} ${desks === 1 ? 'desk' : 'desks'} seated${free >= 1 ? ` · ${f.count(free)} free` : ''}`);
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
    show(keysField, hiredByHand);
    if (hiredByHand) text(keys, f.rate(keystrokeRate(s, t)));
  };
}

export const office: Screen = { id: 'office', label: 'Personnel', mount };
