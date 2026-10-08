// Readiness: Infinity Permit and the guarded Declare control, the three meters and their
// bottleneck, scale and the Stability Window as dials, and objective pinning.
// The ceremony itself is M4. Contents of a paper sheet.
import { declareInfinity, meters, metersFull, pinObjective, readinessScale, type DeptId } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { dial, field, figure, formbox, ledger, readinessBottleneck, setWhy, stack, stamp, why } from '../ui/forms.js';
import './readiness.css';

const METERS: { id: DeptId; name: string; paces: string }[] = [
  { id: 'recruiting', name: 'Recruiting', paces: 'Paced against Construction. Hiring must not outrun, or lag behind, building.' },
  { id: 'construction', name: 'Construction', paces: 'Paced against Recruiting. Desks must keep up with hires.' },
  { id: 'editing', name: 'Editing', paces: 'Paced against review demand: Editors must be able to certify what the monkeys find.' },
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
  const liftBtn = h('button', { class: 'lift wide', type: 'button', 'aria-expanded': 'false', onclick: () => arm(true) }, 'Lift the cover');
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

  const permitBox = formbox('Ref. 9-R / Infinity Permit', permit, h('div', { class: 'guard' }, liftBtn, liftWhy, cover));

  // ----- meters -----
  const bottleneck = h('p', { class: 'note' });
  const meterRows = METERS.map((m) => {
    const reading = figure();
    const bar = ledger(`${m.name} readiness`);
    const el = h('div', { class: 'ready-meter' }, field(m.name, reading), bar.el, h('p', { class: 'why' }, m.paces));
    return { id: m.id, name: m.name, reading, bar, el };
  });
  const metersBox = formbox('Ref. 9-R/1 / Readiness meters', bottleneck, ...meterRows.map((r) => r.el));

  // ----- scale and stability -----
  const scaleDial = dial('Scale');
  const holdDial = dial('Stability');
  const monkeysEl = figure();
  const holdText = figure();
  const holdNote = h('p', { class: 'note' });
  const gaugeBox = formbox('Ref. 9-R/2 / Scale and Stability',
    h('div', { class: 'gauges' }, scaleDial.el, holdDial.el),
    field('Monkeys', monkeysEl),
    field('Window held', holdText),
    h('p', { class: 'why' }, `Every meter is also capped by scale: it needs ${f.count(t.readiness.minMonkeys)} monkeys.`),
    holdNote,
  );

  // ----- pin -----
  const pinReady = h('button', { type: 'button', onclick: () => ctx.act((s, tu, k) => pinObjective(s, tu, k, { kind: 'readiness' })) }, 'Pin Readiness');
  const pinBananas = h('button', { type: 'button', onclick: () => ctx.act((s, tu, k) => pinObjective(s, tu, k, { kind: 'bananas' })) }, 'Pin bananas');
  const pinNow = figure();
  const pinWhy = why();
  const pinBox = formbox('Req. 9-R/3 / Pinned objective',
    field('Currently pinned', pinNow),
    h('div', { class: 'btn-row' }, pinReady, pinBananas),
    pinWhy,
    h('p', { class: 'why' }, 'Pinning records what you are working toward. In the finite phase it does not change suggested funding, which already balances for the meters.'),
  );

  const readyView = h('div', { class: 'form-stack' }, permitBox, metersBox, gaugeBox, pinBox);
  const doneView = formbox('Ref. 9-R / Infinity declared',
    h('p', {}, stamp('Declared', 'ok')),
    h('p', { class: 'note' }, 'Infinity is declared. The finite operation is closed, and everything you earned carries over.'),
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
    text(bottleneck, readinessBottleneck(s, t));
    for (const r of meterRows) {
      const v = m[r.id];
      r.bar.set(v >= 1 - 1e-9 ? 1 : Math.min(v, 0.99), `${r.name} readiness ${f.meterPct(v)}, ${f.meterWord(v)}`);
      text(r.reading, `${f.meterPct(v)} ${f.meterWord(v)}`);
    }

    const scale = readinessScale(s, t);
    scaleDial.set(scale, f.meterWord(scale), `Scale ${f.meterPct(scale)}, ${f.meterWord(scale)}`);
    text(monkeysEl, `${f.count(s.monkeys)} / ${f.count(t.readiness.minMonkeys)}`);

    // Stability Window.
    const held = s.stability.heldTicks * t.tickSeconds;
    const total = t.readiness.stabilitySeconds;
    const done = s.stability.permit;
    const holdFrac = done ? 1 : Math.min(1, held / total);
    holdDial.set(holdFrac, f.meterWord(holdFrac), `Stability window ${done ? 'complete' : `${f.duration(held)} of ${f.duration(total)} held`}, ${f.meterWord(holdFrac)}`);
    text(holdText, `${f.duration(done ? total : held)} / ${f.duration(total)}`);
    text(holdNote, done ? 'The window is complete. Permit issued.' : full ? `Holding. All three meters are full. Keep them full for ${f.duration(total - held)} more.` : 'Not holding. All three meters must be full at once. The count restarts from zero when any meter drops.');

    // Permit.
    permit.dataset.stamped = done ? 'true' : 'false';
    stampIssued.hidden = !done;
    stampNot.hidden = done;
    text(permitStatus, done ? 'Infinity Permit issued. You may now declare.' : 'Awaiting stamp. The Permit is stamped when the Stability Window completes.');

    // Declare (two steps): the lift button explains itself when it can't be used.
    const can = ctx.can('declareInfinity', declareInfinity);
    enable(liftBtn, can);
    enable(switchBtn, can);
    setWhy(liftWhy, can ? null : done ? 'Closed after Infinity.' : full ? `Permit not issued. Keep all three meters full for ${f.duration(total - held)} more.` : `Permit not issued. Fill all three meters, then hold them full for ${f.duration(total)}.`);
    if (!can && armed) arm(false);

    // Pin.
    const kind = s.objective.kind;
    text(pinNow, kind === 'readiness' ? 'Readiness' : kind === 'bananas' ? 'Bananas' : 'Commission');
    pinReady.setAttribute('aria-pressed', String(kind === 'readiness'));
    pinBananas.setAttribute('aria-pressed', String(kind === 'bananas'));
    enable(pinReady, kind !== 'readiness' && ctx.can('pin:readiness', (st, tu, k) => pinObjective(st, tu, k, { kind: 'readiness' })));
    enable(pinBananas, kind !== 'bananas' && ctx.can('pin:bananas', (st, tu, k) => pinObjective(st, tu, k, { kind: 'bananas' })));
    setWhy(pinWhy, kind === 'readiness' || kind === 'bananas' ? `${kind === 'readiness' ? 'Readiness' : 'Bananas'} is already pinned.` : null);
  };
}

export const readiness: Screen = { id: 'readiness', label: 'Readiness', mount };
