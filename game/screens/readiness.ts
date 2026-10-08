// Director's Office: the finish line. A next card says what to do now (grow, raise the lowest meter,
// hold steady, or declare); the three readiness meters and the stability window sit under it, and the
// guarded Declare is last, moving to the top once the Permit is stamped. Contents of a paper sheet.
import { DEPTS, declareInfinity, meters, metersFull, readinessScale, type DeptId } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, show, text, enable } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { field, figure, formbox, ledger, nextCard, setWhy, stack, stamp, why } from '../ui/forms.js';
import './readiness.css';

const METERS: { id: DeptId; name: string; raises: string }[] = [
  { id: 'recruiting', name: 'Recruiting', raises: 'Hire faster in Departments.' },
  { id: 'construction', name: 'Construction', raises: 'Build faster in Departments.' },
  { id: 'editing', name: 'Editing', raises: 'Add Editing capacity in Departments, so finds get certified.' },
];

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;

  // ----- permit + guarded declare -----
  const stampIssued = stamp('Issued', 'ok');
  const stampNot = stamp('Not issued', 'warn');
  const stampBox = h('span', { class: 'permit-stamp' }, stampIssued, stampNot);
  const permitStatus = h('p', { class: 'why' });
  const permit = h('div', { class: 'permit' },
    h('p', { class: 'lab' }, 'Form 1-ℵ · Infinity Permit'),
    h('p', { class: 'note' }, 'Applicant: the Editor-in-Chief.'),
    h('p', { class: 'note' }, 'Recruiting, Construction and Editing certified self-sustaining.'),
    h('p', { class: 'permit-line' }, 'Permit: ', stampBox),
    permitStatus,
  );
  ctx.onEvent((e) => {
    if (e.type !== 'permitStamped') return;
    permit.classList.remove('permit-fresh');
    void permit.offsetWidth; // restart the animation
    permit.classList.add('permit-fresh');
  });

  // Step 1 lifts the cover; step 2 throws the switch. Cancel puts the cover back.
  let armed = false;
  const liftBtn = h('button', { class: 'lift wide', type: 'button', 'aria-expanded': 'false', onclick: () => arm(true) }, 'Lift the cover to declare');
  const liftWhy = why();
  const switchBtn = h('button', { class: 'switch', type: 'button', onclick: () => { if (ctx.act(declareInfinity)) arm(false); } }, 'Throw the switch: Declare Infinity');
  const cancelBtn = h('button', { class: 'quiet wide', type: 'button', onclick: () => arm(false, true) }, 'Cancel. Keep the cover down');
  const cover = h('div', { class: 'guard-cover', role: 'group', 'aria-label': 'Declare Infinity confirmation', hidden: true },
    h('h4', {}, 'This cannot be undone'),
    h('p', { class: 'lab' }, 'What changes'),
    h('ul', {},
      h('li', {}, 'The finite operation closes. Desks, department levels and stages, research and Zeno can no longer be bought.'),
      h('li', {}, 'Recruiters become Bus Wranglers and Builders become Shift Crews.'),
      h('li', {}, 'The Hotel phase begins, and the pinned objective resets to bananas.'),
    ),
    h('p', { class: 'lab' }, 'What stays'),
    h('ul', {},
      h('li', {}, 'Your monkeys, desks, bananas, discovered tiers and department levels carry over.'),
      h('li', {}, 'Golden Bananas, epic research and earlier discovery rewards are kept.'),
    ),
    switchBtn,
    cancelBtn,
  );
  function arm(on: boolean, refocus = false): void {
    armed = on;
    cover.hidden = !on;
    liftBtn.hidden = on;
    liftBtn.setAttribute('aria-expanded', String(on));
    if (on) switchBtn.focus();
    else if (refocus) liftBtn.focus();
  }
  // Closing the sheet puts the cover back down.
  new MutationObserver(() => { if (root.hidden && armed) arm(false); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

  const declareBox = formbox('Ref. 9-R / Infinity Permit', permit, h('div', { class: 'guard' }, liftBtn, liftWhy, cover));
  declareBox.classList.add('declare-box');

  // ----- next step -----
  const next = nextCard({ heading: 'Next step', onAct: () => dispatchEvent(new CustomEvent('im:goto', { detail: 'departments' })) });

  // A calm, button-less card for the phases with nothing to press (explainer, hold steady, permit stamped).
  const infoText = h('p', { class: 'next-calm' });
  const holdBar = ledger('Stability window', 'gold');
  const info = h('section', { class: 'next calm', 'aria-label': 'The finish line' }, h('h3', { class: 'typed' }, 'The finish line'), infoText, holdBar.el);

  // ----- meters -----
  const meterRows = METERS.map((m) => {
    const reading = figure();
    const bar = ledger(`${m.name} readiness`);
    const el = h('div', { class: 'ready-meter' }, field(m.name, reading), bar.el, h('p', { class: 'why' }, m.raises));
    return { id: m.id, name: m.name, reading, bar, el };
  });
  const scaleNote = h('p', { class: 'note' });
  const metersBox = formbox('Readiness meters', ...meterRows.map((r) => r.el), scaleNote);

  // The declare box sits last, and moves to the top once the Permit is stamped.
  const slotEnd = h('div', { class: 'declare-slot' });
  const slotTop = h('div', { class: 'declare-slot' });
  const readyView = h('div', { class: 'form-stack' }, slotTop, next.el, info, metersBox, slotEnd);
  const doneView = formbox('Infinity declared',
    h('p', {}, stamp('Declared', 'ok')),
    h('p', { class: 'note' }, 'The Hotel opens in the next build. Everything you earned carries over.'),
    h('p', { class: 'why' }, 'Department levels, research, desks and Zeno can no longer be bought.'),
  );
  doneView.hidden = true;
  root.append(stack(readyView, doneView));

  return () => {
    const s = ctx.state();
    const declared = s.phase !== 'finite';
    readyView.hidden = declared;
    doneView.hidden = !declared;
    if (declared) {
      if (armed) arm(false);
      return;
    }

    const m = meters(s, t);
    const full = metersFull(m);
    const scale = readinessScale(s, t);
    const held = s.stability.heldTicks * t.tickSeconds;
    const total = t.readiness.stabilitySeconds;
    const done = s.stability.permit;
    const tall = s.milestonesReached.includes('tall');

    for (const r of meterRows) {
      const v = m[r.id];
      r.bar.set(v >= 1 - 1e-9 ? 1 : Math.min(v, 0.99), `${r.name} readiness ${f.meterPct(v)}, ${f.meterWord(v)}`);
      text(r.reading, `${f.meterPct(v)} ${f.meterWord(v)}`);
    }
    const capped = scale < 1 - 1e-9;
    show(scaleNote, capped);
    if (capped) text(scaleNote, `Scale caps every meter at ${f.meterPct(scale)}: the Bureau has ${f.count(s.monkeys)} of ${f.count(t.readiness.minMonkeys)} monkeys.`);

    // Next card, by phase: a button when there is something to press, else a calm info card.
    const heldS = `${f.count(Math.floor(held))} s of ${f.count(total)} s`;
    const showHold = !done && full;
    let line: string | null = null;
    if (done) {
      line = ''; // the Declare form itself is the next step, shown on top
    } else if (!tall) {
      line = `The finish line needs ${f.count(t.readiness.minMonkeys)} monkeys. You have ${f.count(s.monkeys)}. Grow the Bureau. The Permit is for later.`;
    } else if (!full && capped && DEPTS.every((d) => m[d] >= scale - 1e-9)) {
      line = `Scale caps every meter at ${f.meterPct(scale)} until the Bureau has ${f.count(t.readiness.minMonkeys)} monkeys. You have ${f.count(s.monkeys)}. Grow the Bureau.`;
    } else if (full) {
      line = `Hold steady: ${heldS}. All three meters are Full. The count restarts if any meter drops.`;
    }
    show(next.el, line === null);
    show(info, !!line);
    if (line) text(infoText, line);
    show(holdBar.el, showHold);
    if (showHold) holdBar.set(Math.min(held / total, 0.99), `Stability window ${f.duration(held)} of ${f.duration(total)} held`);
    if (line === null) {
      const lo = DEPTS.reduce((a, d) => (m[d] < m[a] - 1e-9 ? d : a), DEPTS[0] as DeptId);
      const inf = METERS.find((x) => x.id === lo)!;
      next.update({
        label: 'Open Departments',
        why: `${inf.name} is the lowest meter, at ${f.meterPct(m[lo])} (${f.meterWord(m[lo])}). ${inf.raises} All three must be Full at once.`,
      });
    }

    // Permit + guarded declare.
    permit.dataset.stamped = done ? 'true' : 'false';
    stampIssued.hidden = !done;
    stampNot.hidden = done;
    text(permitStatus, done ? 'Infinity Permit issued. You may now declare.' : 'Awaiting stamp. The Permit is stamped when the Stability Window completes.');
    const slot = done ? slotTop : slotEnd;
    if (declareBox.parentElement !== slot) slot.append(declareBox);
    const can = ctx.can('declareInfinity', declareInfinity);
    enable(liftBtn, can);
    enable(switchBtn, can);
    setWhy(liftWhy, can ? null : full ? `Permit not issued. Keep all three meters full for ${f.duration(total - held)} more.` : `Permit not issued. Fill all three meters, then hold them full for ${f.duration(total)}.`);
    if (!can && armed) arm(false);
  };
}

export const readiness: Screen = { id: 'readiness', label: 'Readiness', mount };
