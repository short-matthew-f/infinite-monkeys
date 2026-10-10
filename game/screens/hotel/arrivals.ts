// Front Desk (Personnel, hotel): arrivals. Each market is locked, on a bus in transit, onboarding with the
// Shift Crews, or online, with the time left (core's readySeconds) and the alphabet it brings.
// Bars show remaining work against a full trip (a drawing ratio); times come from core.
import { hotelPool, marketDef, onlineMarkets, readySeconds } from '../../../core/index.js';
import type { Ctx, Screen } from '../../ctx.js';
import { h, show, text } from '../../ui/dom.js';
import * as f from '../../ui/format.js';
import { formbox, ledger, stack } from '../../ui/forms.js';
import { MARKET_ALPHABET, marketName, tripSeconds } from './names.js';
import './hotel.css';

const STATUS_WORD = { locked: 'Locked', inTransit: 'Bus in transit', onboarding: 'Onboarding', online: 'Online' } as const;

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const summary = h('p', { class: 'note' });
  const trip = h('p', { class: 'why' });
  const head = formbox('Ref. 3-H / Arrivals', summary, trip);
  const cards = t.hotel.markets.map((m) => {
    const status = h('span', { class: 'cm-stamp' });
    const alpha = h('p', { class: 'ar-alpha' }, MARKET_ALPHABET[m.id] ?? '');
    const bar = ledger(`${marketName(m.id)} arrival progress`, 'gold');
    const line = h('p', { class: 'delta' });
    const pays = h('p', { class: 'why' });
    const el = h('section', { class: 'arrival', 'aria-label': marketName(m.id) },
      h('div', { class: 'pb-head' }, h('h4', { class: 'st-title' }, marketName(m.id)), status), alpha, bar.el, line, pays);
    return { def: m, el, status, bar, line, pays };
  });
  root.append(stack(head, ...cards.map((c) => c.el)));

  return () => {
    const s = ctx.state();
    const hot = s.hotel;
    if (!hot) return;
    const on = onlineMarkets(s).length;
    const total = t.hotel.markets.length;
    text(summary, `${on} of ${total} markets online. Editors review ${f.amount(hotelPool(s, t))} reviews/s, split across the markets that are online.`);
    const trips = tripSeconds(s, t);
    text(trip, `At current crew speed a full bus trip takes about ${f.duration(trips.bus)}, then onboarding about ${f.duration(trips.onboarding)}.`);
    for (const c of cards) {
      const m = hot.markets[c.def.id];
      const st = m?.status ?? 'locked';
      text(c.status, STATUS_WORD[st]);
      c.status.className = `cm-stamp ${st === 'online' ? 'ok' : st === 'locked' ? 'plain' : 'warn'}`;
      c.pays.hidden = false;
      text(c.pays, `Pays ${f.count(marketDef(t, c.def.id).value)} per review.`);
      show(c.bar.el, st === 'inTransit' || st === 'onboarding');
      if (st === 'online') {
        text(c.line, c.def.id === t.hotel.homeMarket ? 'Online since the Bureau opened.' : 'Online. Editors can be assigned work here.');
      } else if (st === 'locked') {
        text(c.line, 'Locked. A Commission reward sends the bus that opens this market.');
      } else if (m) {
        const full = st === 'inTransit' ? t.hotel.busWaitSeconds : t.hotel.onboardingSeconds;
        const frac = full > 0 ? Math.min(1, Math.max(0, 1 - m.workLeft / full)) : 1;
        const left = readySeconds(s, t, c.def.id);
        text(c.line, st === 'inTransit'
          ? `The bus is on its way. The market is online in about ${f.duration(left)}.`
          : `The bus has arrived and the Shift Crews are onboarding its staff. Online in about ${f.duration(left)}.`);
        c.bar.set(Math.min(frac, 0.99), `${marketName(c.def.id)}: ${STATUS_WORD[st]}, online in about ${f.duration(left)}`);
      }
    }
  };
}

export const arrivals: Screen = { id: 'arrivals', label: 'Front Desk', mount };
