// Readiness: the three meters, scale requirement, Stability Window, Infinity Permit,
// objective pinning and the Declare button. The ceremony itself is M4.
import { N, declareInfinity, meters, metersFull, pinObjective, readinessScale, type DeptId } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text, enable, fill } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './readiness.css';

const METERS: { id: DeptId; name: string; paces: string }[] = [
  { id: 'recruiting', name: 'Recruiting', paces: 'Paced against Construction. Hiring must not outrun, or lag behind, building.' },
  { id: 'construction', name: 'Construction', paces: 'Paced against Recruiting. Desks must keep up with hires.' },
  { id: 'editing', name: 'Editing', paces: 'Paced against review demand: Editors must be able to certify what the monkeys find.' },
];

function meterWord(v: number): string {
  return v >= 1 - 1e-9 ? 'Full' : v > 0 ? 'Building' : 'Not started';
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;

  // ----- meters -----
  const meterRows = METERS.map((m) => {
    const fillEl = h('span', { class: 'ready-bar-fill' });
    const bar = h('div', { class: 'ready-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': m.name }, fillEl);
    const word = h('span', { class: 'ready-word' });
    const pctEl = h('span', { class: 'value' });
    const el = h('div', { class: 'ready-meter' },
      h('div', { class: 'ready-meter-head' }, h('h3', {}, m.name), h('span', { class: 'ready-reading' }, pctEl, word)),
      bar,
      h('p', { class: 'label ready-paces' }, m.paces),
    );
    return { id: m.id, el, bar, fillEl, word, pctEl };
  });

  const monkeysEl = h('span', { class: 'value' });
  const monkeyBar = h('div', { class: 'ready-bar' }, h('span', { class: 'ready-bar-fill' }));
  const monkeyWord = h('span', { class: 'ready-word' });

  // ----- stability window -----
  const holdState = h('span', { class: 'ready-word' });
  const holdText = h('span', { class: 'value' });
  const holdBar = h('div', { class: 'ready-bar' }, h('span', { class: 'ready-bar-fill' }));
  const holdNote = h('p', { class: 'label' });

  // ----- permit -----
  const stamp = h('span', { class: 'permit-stamp', 'aria-hidden': 'true' }, h('span', {}, 'Approved'), h('small', {}, 'Bureau of Infinite Typing'));
  const permitStatus = h('p', { class: 'label' });
  const permit = h('div', { class: 'permit', role: 'img', 'aria-label': 'Infinity Permit' },
    h('p', { class: 'permit-form' }, 'Form 1-ℵ · Infinity Permit'),
    h('p', { class: 'permit-line' }, 'Applicant: the Editor-in-Chief'),
    h('p', { class: 'permit-line' }, 'Recruiting, Construction and Editing certified self-sustaining.'),
    stamp,
  );
  ctx.onEvent((e) => {
    if (e.type !== 'permitStamped') return;
    permit.classList.remove('permit-fresh');
    void permit.offsetWidth; // restart the animation
    permit.classList.add('permit-fresh');
  });

  // ----- pin -----
  const pinReady = h('button', { onclick: () => ctx.act((s, tu, k) => pinObjective(s, tu, k, { kind: 'readiness' })) }, 'Pin Readiness');
  const pinBananas = h('button', { onclick: () => ctx.act((s, tu, k) => pinObjective(s, tu, k, { kind: 'bananas' })) }, 'Pin bananas');
  const pinNow = h('span', { class: 'value' });

  // ----- declare -----
  const declareBtn = h('button', { class: 'primary ready-declare', onclick: () => ctx.act(declareInfinity) }, 'Declare Infinity');
  const declareNote = h('p', { class: 'label' });

  const readyView = h('div', { class: 'screen' },
    h('section', { class: 'panel' },
      h('h2', {}, 'Readiness meters'),
      ...meterRows.map((r) => r.el),
      h('div', { class: 'ready-meter' },
        h('div', { class: 'ready-meter-head' }, h('h3', {}, 'Scale'), h('span', { class: 'ready-reading' }, monkeysEl, monkeyWord)),
        monkeyBar,
        h('p', { class: 'label ready-paces' }, `Every meter is also capped by scale: it needs ${f.count(t.readiness.minMonkeys)} monkeys.`),
      ),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Stability Window'),
      h('div', { class: 'ready-meter-head' }, holdText, holdState),
      holdBar,
      holdNote,
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Infinity Permit'),
      permit,
      permitStatus,
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Pinned objective'),
      h('div', {}, h('span', { class: 'label' }, 'Currently pinned '), pinNow),
      h('div', { class: 'ready-pins' }, pinReady, pinBananas),
      h('p', { class: 'label' }, 'Pinning records what you are working toward. In the finite phase it does not change suggested funding, which already balances for the meters.'),
    ),
    h('section', { class: 'panel' },
      declareBtn,
      declareNote,
    ),
  );

  const doneView = h('section', { class: 'panel ready-done' },
    h('h2', {}, 'Infinity declared'),
    h('p', {}, 'Infinity declared — the Hotel arrives in M4.'),
  );
  doneView.hidden = true;
  root.append(readyView, doneView);

  return () => {
    const s = ctx.state();
    const declared = s.phase !== 'finite';
    readyView.hidden = declared;
    doneView.hidden = !declared;
    if (declared) return;

    const m = meters(s, t);
    const full = metersFull(m);
    for (const r of meterRows) {
      const v = m[r.id];
      const isFull = v >= 1 - 1e-9;
      // Never round up to 100% while the word says "Building".
      const shown = isFull ? 1 : Math.min(v, 0.99);
      fill(r.fillEl, shown);
      r.el.dataset.state = isFull ? 'full' : 'building';
      r.bar.setAttribute('aria-valuenow', String(Math.floor(shown * 100)));
      text(r.pctEl, f.pct(isFull ? 1 : Math.floor(v * 100) / 100));
      text(r.word, meterWord(v));
    }

    const scale = readinessScale(s, t);
    fill(monkeyBar.firstElementChild as HTMLElement, scale);
    text(monkeysEl, `${f.count(s.monkeys)} / ${f.count(t.readiness.minMonkeys)}`);
    text(monkeyWord, scale >= 1 ? 'Full' : 'Building');
    monkeyBar.parentElement!.dataset.state = scale >= 1 ? 'full' : 'building';

    // Stability Window.
    const held = s.stability.heldTicks * t.tickSeconds;
    const total = t.readiness.stabilitySeconds;
    const done = s.stability.permit;
    fill(holdBar.firstElementChild as HTMLElement, done ? 1 : held / total);
    text(holdText, done ? `${f.duration(total)} / ${f.duration(total)}` : `${f.duration(held)} / ${f.duration(total)}`);
    text(holdState, done ? 'Complete' : full ? 'Holding' : 'Not holding');
    text(holdNote, done ? 'The window is complete. Permit issued.' : full ? `All three meters are full. Keep them full for ${f.duration(total - held)} more.` : 'All three meters must be full at once. The count restarts from zero when any meter drops.');

    // Permit.
    permit.dataset.stamped = done ? 'true' : 'false';
    text(permitStatus, done ? 'Infinity Permit issued. You may now declare.' : 'Awaiting stamp. The Permit is stamped when the Stability Window completes.');

    // Pin.
    const kind = s.objective.kind;
    text(pinNow, kind === 'readiness' ? 'Readiness' : kind === 'bananas' ? 'Bananas' : 'Commission');
    pinReady.setAttribute('aria-pressed', String(kind === 'readiness'));
    pinBananas.setAttribute('aria-pressed', String(kind === 'bananas'));
    enable(pinReady, kind !== 'readiness' && ctx.can('pin:readiness', (st, tu, k) => pinObjective(st, tu, k, { kind: 'readiness' })));
    enable(pinBananas, kind !== 'bananas' && ctx.can('pin:bananas', (st, tu, k) => pinObjective(st, tu, k, { kind: 'bananas' })));

    // Declare.
    enable(declareBtn, ctx.can('declareInfinity', declareInfinity));
    text(declareNote, done ? 'The Permit is stamped. Declaring cannot be undone.' : 'Available once the Infinity Permit is stamped.');
  };
}

export const readiness: Screen = { id: 'readiness', label: 'Readiness', mount };
