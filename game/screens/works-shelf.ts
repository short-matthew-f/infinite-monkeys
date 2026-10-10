// The Complete Works shelf, in the Records Library (the finite room and the hotel's vault): every work is a book
// spine. A spine opens its passage below the shelf: lines the monkeys have typed in typewriter type, lines still
// missing as greyed blanks (with the monkey's near-miss on the last letter). Works whose market is not online yet
// are locked, and hint at their alphabet. The editor bonus is core's worksReviewMult; progress is save.works.
import { availableWorks, foundLines, workComplete, worksReviewMult, type GameState, type WorkDef } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h, show, uid } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { formbox } from '../ui/forms.js';
import { MARKET_ALPHABET, marketName } from './hotel/names.js';
import { blanks, nearMiss } from '../world/works.js';
import './works-shelf.css';

/** Spine colours cycle through the paper palette. */
const TONES = ['walnut', 'olive', 'alert', 'mustard', 'concrete', 'tangerine'];

export interface Shelf {
  el: HTMLElement;
  render(): void;
}

/** Is the shelf worth showing yet? Once Words are found (or any line has ever been filed). */
function started(s: GameState, ctx: Ctx): boolean {
  const p = ctx.t.pages;
  if (!p) return false;
  if (s.phase === 'hotel') return true;
  return !!s.tiers[p.unlockTier]?.discovered || Object.values(s.save.works ?? {}).some((l) => l.length > 0);
}

export function mountShelf(ctx: Ctx, code = 'Ref. 4-R / The Complete Works'): Shelf {
  const { t } = ctx;
  const works = t.pages?.works ?? [];
  let selected: string | null = null;
  let shownKey = '';
  const readingId = uid('ws-reading');

  const bonus = h('p', { class: 'ws-bonus' });
  const note = h('p', { class: 'note' }, 'Now and then a monkey types a real line. Catch the page before it goes and the line is filed here. Finish a work and the Editors know it by heart.');
  const row = h('ul', { class: 'ws-row' });
  const reading = h('section', { class: 'ws-reading', id: readingId, hidden: true, 'aria-label': 'Passage' });
  const box = formbox(code, bonus, note, row, reading);
  box.classList.add('shelf');

  const spine = (w: WorkDef, i: number) => {
    const b = h('button', { class: 'ws-spine', type: 'button', 'aria-controls': readingId, 'aria-expanded': 'false', onclick: () => {
      selected = selected === w.id ? null : w.id;
      shownKey = '';
      render();
    } });
    b.dataset.tone = TONES[i % TONES.length]!;
    return h('li', {}, b);
  };
  const spines = new Map(works.map((w, i) => [w.id, spine(w, i)]));
  row.append(...spines.values());

  function render(): void {
    const s = ctx.state();
    const on = started(s, ctx);
    show(box, on);
    if (!on) return;
    const open = new Set(availableWorks(s, t).map((w) => w.id));
    const key = JSON.stringify([selected, works.map((w) => [open.has(w.id), foundLines(s, w.id).length, foundLines(s, w.id).join(',')]), worksReviewMult(s, t)]);
    if (key === shownKey) return;
    shownKey = key;

    const done = works.filter((w) => workComplete(s, w)).length;
    const pct = Math.round((worksReviewMult(s, t) - 1) * 100);
    bonus.textContent = `Editors +${f.count(pct)}% from ${done} ${done === 1 ? 'work' : 'works'}`;

    for (const w of works) {
      const li = spines.get(w.id)!;
      const b = li.querySelector('button') as HTMLButtonElement;
      const have = foundLines(s, w.id).length;
      const locked = !open.has(w.id) && have === 0;
      const complete = workComplete(s, w);
      b.dataset.state = locked ? 'locked' : complete ? 'done' : have ? 'part' : 'new';
      b.setAttribute('aria-expanded', String(selected === w.id));
      b.classList.toggle('on', selected === w.id);
      const label = locked
        ? `Locked: a ${marketName(w.market)} work. Opens with the ${marketName(w.market)} market.`
        : `${w.title}, ${w.author}: ${have} of ${w.lines.length} lines found${complete ? ', complete' : ''}`;
      b.setAttribute('aria-label', label);
      b.replaceChildren(
        h('span', { class: 'ws-title', 'aria-hidden': 'true' }, locked ? MARKET_ALPHABET[w.market]?.split('· ')[1]?.replace(/ /g, '') ?? '?' : w.title),
        h('span', { class: 'ws-count', 'aria-hidden': 'true' }, locked ? 'Locked' : complete ? 'Filed' : `${have}/${w.lines.length}`),
      );
    }

    const w = works.find((x) => x.id === selected);
    show(reading, !!w);
    if (!w) return;
    const have = new Set(foundLines(s, w.id));
    const locked = !open.has(w.id) && have.size === 0;
    if (locked) {
      reading.replaceChildren(
        h('h4', { class: 'ws-h' }, `A ${marketName(w.market)} work`),
        h('p', { class: 'ws-alpha', 'aria-hidden': 'true' }, MARKET_ALPHABET[w.market] ?? ''),
        h('p', { class: 'note' }, `Locked. Monkeys can only type it once the ${marketName(w.market)} market is online.`),
      );
      return;
    }
    const complete = workComplete(s, w);
    reading.replaceChildren(
      h('h4', { class: 'ws-h' }, w.title),
      h('p', { class: 'ws-by' }, `${w.author} · ${have.size} of ${w.lines.length} lines found`),
      h('ol', { class: 'ws-lines' }, ...w.lines.map((line, i) => {
        if (have.has(i)) return h('li', { class: 'got' }, line);
        // A missing line: blanks, with the monkey's near-miss on the last letter, crossed out.
        const m = nearMiss(line);
        const b = blanks(line);
        const cut = b.lastIndexOf('_');
        const li = h('li', { class: 'gap' },
          h('span', { class: 'sr' }, `Line ${i + 1}, not found yet`),
          h('span', { 'aria-hidden': 'true' }, b.slice(0, cut), h('s', {}, m.wrong), b.slice(cut + 1)));
        return li;
      })),
      complete ? h('p', { class: 'ws-filed' }, 'Filed: The Complete Works') : h('p', { class: 'note' }, 'Missing lines turn up one sighting at a time.'),
    );
  }
  return { el: box, render };
}
