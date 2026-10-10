// Director's Office, hotel: the Commissions desk. The most important screen of the prototype (PROTOTYPE §6):
// it is where the player sees what a choice delays before making it.
//   top      "Reward waiting" pointer, then "Right now": the pinned objective (or maximizing bananas)
//   below    one playbill per Commission, all with the same anatomy so offers compare by scrolling;
//            they sit side by side wherever the sheet is wide enough, and stack on a phone
// Every number comes from core: previewCommission (ready in, production, ETA, income given up), the
// frozen requirements and rewards on the Commission, deadlineTick, certifyMarkets for the live income.
import {
  N, bestMarket, certifyMarkets, hotelPool, marketAutoOn, pinObjective, previewCommission, previewMarketAllocation,
  type CommissionState, type GameState,
} from '../../../core/index.js';
import type { Ctx, Screen } from '../../ctx.js';
import { h, show, text } from '../../ui/dom.js';
import * as f from '../../ui/format.js';
import { field, figure, formbox, ledger, nextCard, sealed, setWhy, stack, stamp, why, type Ledger } from '../../ui/forms.js';
import { commissionAbout, commissionTitle, marketName, rewardLine } from './names.js';
import './hotel.css';

const KIND_LABEL = { immediate: 'Immediate', permanent: 'Permanent', expansion: 'Expansion' } as const;
const BANANAS = { kind: 'bananas' } as const;

interface Progress {
  market: string;
  bar: Ledger;
  line: HTMLElement;
  row: HTMLElement;
}

/** Delivered vs required, one bar per market. Built once for the markets a Commission needs. */
function progressBlock(markets: string[], label: string): { el: HTMLElement; rows: Progress[] } {
  const rows: Progress[] = markets.map((m) => {
    const bar = ledger(`${label}: ${marketName(m)} delivered`, 'gold');
    const line = h('p', { class: 'delta' });
    return { market: m, bar, line, row: h('div', { class: 'cm-prog' }, line, bar.el) };
  });
  return { el: h('div', { class: 'form-stack tight' }, ...rows.map((r) => r.row)), rows };
}

function paintProgress(rows: Progress[], c: CommissionState): void {
  for (const r of rows) {
    const req = c.required[r.market] ?? N.zero;
    const have = c.delivered[r.market] ?? N.zero;
    const frac = N.gt(req, N.zero) ? Math.min(1, N.ratio(have, req)) : 1;
    text(r.line, `${marketName(r.market)}: ${f.count(have)} of ${f.count(req)} reviews delivered`);
    r.bar.set(frac, `${marketName(r.market)}: ${f.count(have)} of ${f.count(req)} reviews delivered`);
  }
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const defs = t.hotel.commissions;
  const pin = (id: string) => ctx.act((s, tt, k) => pinObjective(s, tt, k, { kind: 'commission', id }));
  const unpin = () => ctx.act((s, tt, k) => pinObjective(s, tt, k, BANANAS));
  const canPin = (id: string) => ctx.can(`pin:${id}`, (s, tt, k) => pinObjective(s, tt, k, { kind: 'commission', id }));

  // ----- reward waiting: a pointer to where the payout can be used -----
  const reward = nextCard({ heading: 'Reward waiting' });
  let rewardRoom = 'departments';
  reward.button.addEventListener('click', () => dispatchEvent(new CustomEvent('im:goto', { detail: rewardRoom })));

  // ----- right now -----
  const nowKind = h('p', { class: 'cm-kicker' });
  const nowTitle = h('h4', { class: 'cm-now-title' });
  const nowLine = h('p', { class: 'note' });
  const nowProg = progressBlock([...new Set(defs.flatMap((d) => d.requirements.map((r) => r.market)))], 'Pinned');
  const nowClock = ledger('Time used toward the deadline', 'gold');
  const nowClockLine = h('p', { class: 'delta' });
  const nowEta = h('p', { class: 'delta' });
  const nowEtaHand = h('p', { class: 'delta' });
  const nowForgone = h('p', { class: 'delta' });
  const unpinBtn = h('button', { class: 'quiet wide', type: 'button', onclick: () => unpin() }, 'Unpin: back to maximizing bananas');
  const unpinNote = h('p', { class: 'why' }, 'Unpinning does not stop the deadline. The Editors just stop working on it.');
  const nowBox = formbox('Ref. 12-C / Right now', nowKind, nowTitle, nowLine, nowProg.el, nowClockLine, nowClock.el, nowEta, nowEtaHand, nowForgone, unpinBtn, unpinNote);
  const income = figure();
  const incomeField = field('Income now', income);

  // ----- the playbills -----
  const cards = defs.map((def, i) => {
    const need = h('span', { class: 'big' });
    const ready = h('span', { class: 'big' });
    const prod = h('span', { class: 'big' });
    const dl = h('span', { class: 'big' });
    const pays = h('span', { class: 'big cm-pays' });
    const gone = h('span', { class: 'big' });
    const etaV = h('span', { class: 'cm-eta-v' });
    const etaCap = h('span', { class: 'cm-eta-k' }, 'to finish');
    const etaNote = h('p', { class: 'cm-eta-note' }, 'assuming suggested split and funding');
    const etaWarn = h('p', { class: 'why alert' });
    const eta = h('div', { class: 'cm-eta' }, h('p', { class: 'cm-eta-row' }, etaV, etaCap), etaNote, etaWarn);
    const facts = h('div', { class: 'form-stack tight' },
      field('Needs', need), field('Ready in', ready), field('Production time', prod), field('Deadline', dl), field('Pays', pays), field('Income given up', gone));
    const prog = progressBlock(def.requirements.map((r) => r.market), commissionTitle(def.id));
    const clock = ledger(`${commissionTitle(def.id)}: time used`, 'gold');
    const clockLine = h('p', { class: 'delta' });
    const running = h('div', { class: 'form-stack tight' }, prog.el, clockLine, clock.el);
    const note = why();
    const pinBtn = h('button', { class: 'strong wide', type: 'button', onclick: () => pin(def.id) }, 'Pin this Commission');
    const stateStamp = h('span', { class: 'cm-stamp' });
    const lock = sealed(def.offerWhen ? `Offered when ${marketName(def.offerWhen.marketOnline)} comes online` : 'Arrives with the first bus');
    const el = h('article', { class: 'playbill', 'aria-label': commissionTitle(def.id) },
      h('p', { class: 'typed' }, `Bill ${i + 1} · ${KIND_LABEL[def.kind]}`),
      h('div', { class: 'pb-head' }, h('h4', { class: 'pb-title' }, commissionTitle(def.id)), stateStamp),
      h('p', { class: 'pb-about' }, commissionAbout(def.id)),
      eta, facts, running, note, pinBtn);
    const wrap = h('div', { class: 'pb-wrap' }, el, lock.el);
    return { def, wrap, el, lock, need, ready, prod, dl, pays, gone, etaV, etaWarn, eta, facts, prog, clock, clockLine, running, note, pinBtn, stateStamp };
  });
  const bills = h('div', { class: 'playbills' }, ...cards.map((c) => c.wrap));
  const hint = h('p', { class: 'note' }, 'Pin one Commission and the Editors work on it. The deadline starts when you first pin it, and keeps running if you unpin. Deliveries count only while it is pinned.');
  const offersBox = formbox('Ref. 12-C / Commissions on offer', hint, bills);

  root.append(stack(reward.el, nowBox, incomeField, offersBox));

  return () => {
    const s = ctx.state();
    const hot = s.hotel;
    if (!hot) return;
    const pinned = s.objective.kind === 'commission' ? s.objective.id : null;
    const pc = pinned ? hot.commissions[pinned] : undefined;
    const incomeNow = certifyMarkets(s, t, hotelPool(s, t), hot.allocation).income;
    text(income, f.rate(incomeNow));

    // ----- reward waiting -----
    const pr = hot.pendingReward;
    show(reward.el, !!pr);
    if (pr) {
      const title = commissionTitle(pr.commission);
      if (pr.kind === 'immediate') {
        rewardRoom = 'departments';
        reward.update({ label: 'Open Staff', why: `${title} paid out. Staff can turn the bananas into an upgrade.` });
      } else if (pr.kind === 'permanent') {
        rewardRoom = 'research';
        reward.update({ label: 'Open the Records Library', why: `${title} paid Golden Bananas. The Records Library vault turns them into epic research that lasts.` });
      } else {
        rewardRoom = 'personnel';
        reward.update({ label: 'Open the Front Desk', why: `${title} opened a route. The Front Desk shows the bus on its way and the market coming online.` });
      }
    }

    // ----- right now -----
    const best = bestMarket(s, t);
    if (pinned && pc && pc.status === 'active') {
      const def = defs.find((d) => d.id === pinned);
      const p = previewCommission(s, t, pinned);
      text(nowKind, 'Pinned Commission');
      text(nowTitle, commissionTitle(pinned));
      text(nowLine, `Delivered versus required, per market. Reward: ${rewardLine(pc.reward)}.`);
      show(nowProg.el, true);
      for (const r of nowProg.rows) show(r.row, r.market in pc.required);
      paintProgress(nowProg.rows, pc);
      const total = def ? def.deadlineSeconds : 0;
      const left = pc.deadlineTick === null ? total : Math.max(0, (pc.deadlineTick - s.tick) * t.tickSeconds);
      show(nowClock.el, total > 0);
      show(nowClockLine, total > 0);
      text(nowClockLine, `${f.duration(left)} left of ${f.duration(total)}`);
      nowClock.set(total > 0 ? Math.min(1, 1 - left / total) : 0, `Deadline: ${f.duration(left)} left of ${f.duration(total)}`);
      show(nowEta, !!p);
      if (p) text(nowEta, `ETA ${f.duration(p.etaSeconds)} (assuming suggested split and funding)`);
      const hand = !marketAutoOn(s, t);
      show(nowEtaHand, hand);
      if (hand) {
        const a = previewMarketAllocation(s, t, hot.allocation);
        text(nowEtaHand, `ETA ${a.objectiveEtaSeconds === null ? '—' : f.duration(a.objectiveEtaSeconds)} (keeping your split and current funding)`);
      }
      show(nowForgone, !!p);
      if (p) text(nowForgone, `Production income given up so far versus publishing in ${best ? marketName(best) : 'the best market'}: ${f.bananaText(pc.productionIncomeForgone)}`);
      show(unpinBtn, true);
      show(unpinNote, true);
    } else {
      text(nowKind, 'Objective');
      text(nowTitle, 'Maximizing bananas');
      text(nowLine, `The Editors put everything into ${best ? `the ${marketName(best)} market` : 'the best market'}, which pays the most per review. Pin a Commission below to send them somewhere else.`);
      show(nowProg.el, false);
      show(nowClock.el, false);
      for (const el of [nowClockLine, nowEta, nowEtaHand, nowForgone, unpinBtn, unpinNote]) show(el, false);
    }

    // ----- playbills -----
    const anyOffer = defs.some((d) => hot.commissions[d.id]);
    for (const c of cards) {
      const cm = hot.commissions[c.def.id];
      show(c.el, !!cm);
      show(c.lock.el, !cm);
      if (!cm) continue;
      const isPinned = pinned === cm.id;
      const open = cm.status === 'offered' || cm.status === 'active';
      const p = open ? previewCommission(s, t, cm.id) : null;
      c.el.dataset.status = isPinned ? 'pinned' : cm.status;
      show(c.eta, !!p);
      show(c.facts, open);
      show(c.running, cm.status === 'active' && !isPinned);
      // Stamp: a word, never colour alone.
      const label = cm.status === 'completed' ? 'Completed' : cm.status === 'failed' ? 'Lapsed' : isPinned ? 'Pinned' : cm.status === 'active' ? 'Deadline running' : '';
      text(c.stateStamp, label);
      show(c.stateStamp, label !== '');
      c.stateStamp.className = `cm-stamp ${cm.status === 'failed' || (cm.status === 'active' && !isPinned) ? 'warn' : 'ok'}`;

      const needs = Object.entries(cm.required).map(([m, n]) => `${f.count(n)} ${marketName(m)}`).join(' + ');
      text(c.need, `${needs} reviews`);
      text(c.pays, rewardLine(cm.reward));
      if (open) {
        text(c.dl, cm.status === 'active' && cm.deadlineTick !== null ? `${f.duration(Math.max(0, (cm.deadlineTick - s.tick) * t.tickSeconds))} left` : `${f.duration(c.def.deadlineSeconds)} from your first pin`);
        text(c.gone, f.bananaText(p ? p.productionIncomeForgone : 0));
      }
      if (p) {
        text(c.ready, p.readySeconds <= 0 ? 'Ready now' : f.duration(p.readySeconds));
        text(c.prod, f.duration(p.productionSeconds));
        text(c.etaV, f.duration(p.etaSeconds));
        const tooLong = cm.status === 'offered' && p.etaSeconds > c.def.deadlineSeconds;
        setWhy(c.etaWarn, tooLong ? 'Longer than its deadline: at this pace it would lapse.' : null);
      }
      if (cm.status === 'active' && !isPinned) {
        paintProgress(c.prog.rows, cm);
        const total = c.def.deadlineSeconds;
        const left = cm.deadlineTick === null ? total : Math.max(0, (cm.deadlineTick - s.tick) * t.tickSeconds);
        text(c.clockLine, `${f.duration(left)} left of ${f.duration(total)}`);
        c.clock.set(Math.min(1, 1 - left / total), `Deadline: ${f.duration(left)} left of ${f.duration(total)}`);
      }

      // Pin button and the line that explains it.
      const showPin = open && !isPinned;
      show(c.pinBtn, showPin);
      if (showPin) {
        const can = canPin(cm.id);
        text(c.pinBtn, cm.status === 'active' ? 'Pin to resume' : pinned ? 'Pin this instead' : 'Pin this Commission');
        c.pinBtn.disabled = !can;
        setWhy(c.note,
          !can ? 'This Commission can no longer be pinned.'
            : cm.status === 'active' ? 'Not receiving deliveries while something else is pinned. Its deadline is still running.'
              : pinned ? 'Your current pin keeps its own deadline running if you switch.'
                : null);
      } else if (isPinned) {
        setWhy(c.note, 'This is the pinned objective. Its progress is under Right now.');
      } else if (cm.status === 'completed') {
        setWhy(c.note, `Delivered. Reward: ${rewardLine(cm.reward)}.`);
      } else if (cm.status === 'failed') {
        setWhy(c.note, 'The deadline passed before delivery. The reward is forfeited.');
      } else setWhy(c.note, null);
    }
    show(offersBox, true);
    show(hint, anyOffer && !pinned);
  };
}

export const commissions: Screen = { id: 'commissions', label: 'Commissions', mount };
