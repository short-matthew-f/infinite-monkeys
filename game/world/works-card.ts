// The Complete Works ceremony: when a catch files the last line of a work, a short celebration plays. The whole
// passage is set on a page with its title and author, a rubber stamp comes down, and the card says what the
// Editors gained. It is dismissable (button, Escape), queues behind the quarterly ceremony, the Infinity
// ceremony, the away card and payoff scenes, and honours reduced motion (the finished frame, no confetti).
// The percentages come from tuning and core (worksReviewMult); nothing is computed here.
import { nextFloat, workComplete, worksReviewMult, type GameEvent } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h } from '../ui/dom.js';
import * as f from '../ui/format.js';
import './works-card.css';

/** Let the catch's flight and chip finish first. */
const AFTER_CATCH_MS = 1300;
const SCRAPS = 16;
const rm = matchMedia('(prefers-reduced-motion: reduce)');

export interface WorksCardHost {
  /** True while something else owns the screen (the ceremonies, the away card, a payoff). */
  busy(): boolean;
}

export class WorksCards {
  private el: HTMLElement | null = null;
  private opener: HTMLElement | null = null;
  private readonly queue: { work: string; at: number }[] = [];

  constructor(private readonly stage: HTMLElement, private readonly ctx: Ctx, private readonly host: WorksCardHost) {
    ctx.onEvent((e: GameEvent) => {
      if (e.type === 'workCompleted') this.queue.push({ work: e.work, at: performance.now() + AFTER_CATCH_MS });
    });
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !this.el) return;
        e.preventDefault();
        e.stopPropagation();
        this.close();
      },
      true,
    );
  }

  get isOpen(): boolean {
    return !!this.el;
  }

  /** Once per tick: opens the next card when it is due and nothing else is in the way. */
  render(): void {
    if (this.el) return;
    const j = this.queue[0];
    if (!j || performance.now() < j.at || this.host.busy()) return;
    this.queue.shift();
    this.play(j.work);
  }

  private play(workId: string): void {
    const { t } = this.ctx;
    const s = this.ctx.state();
    const w = t.pages?.works.find((x) => x.id === workId);
    if (!w || !t.pages) return;
    const done = t.pages.works.filter((x) => workComplete(s, x)).length;
    const each = Math.round((t.pages.workReviewMult - 1) * 100);
    const total = Math.round((worksReviewMult(s, t) - 1) * 100);
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const scraps = rm.matches ? [] : Array.from({ length: SCRAPS }, (_, i) => {
      const r = nextFloat(s.rng.presentation);
      const r2 = nextFloat(s.rng.presentation);
      const sp = h('i', { 'aria-hidden': 'true' });
      sp.style.setProperty('--x', `${((i + r) / SCRAPS) * 100}%`);
      sp.style.setProperty('--dx', `${Math.round((r2 - 0.5) * 90)}px`);
      sp.style.setProperty('--rot', `${Math.round((r - 0.5) * 540)}deg`);
      sp.style.setProperty('--dl', `${Math.round(r2 * 350)}ms`);
      sp.className = `s${i % 4}`;
      return sp;
    });

    const lines = h('ol', { class: 'wc-lines' }, ...w.lines.map((ln, i) => {
      const li = h('li', {}, ln);
      li.style.setProperty('--i', String(i));
      return li;
    }));
    const ok = h('button', { class: 'wc-ok', type: 'button', onclick: () => this.close() }, 'File it away');
    const stamp = h('div', { class: 'wc-stamp', 'aria-hidden': 'true' }, h('span', {}, 'Filed:'), h('b', {}, 'The Complete Works'));
    const card = h('div', { class: 'wc-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wc-title', 'aria-describedby': 'wc-fx' },
      h('div', { class: 'wc-scraps', 'aria-hidden': 'true' }, ...scraps),
      h('p', { class: 'wc-typed' }, 'The Complete Works'),
      h('h2', { id: 'wc-title', class: 'wc-title' }, w.title),
      h('p', { class: 'wc-author' }, w.author),
      h('div', { class: 'wc-pagewrap' }, h('div', { class: 'wc-page' }, lines), stamp),
      h('p', { id: 'wc-fx', class: 'wc-fx' }, `Editors +${each}% review speed (they know it by heart).`),
      h('p', { class: 'wc-total' }, `Editors +${f.count(total)}% from ${done} ${done === 1 ? 'work' : 'works'}.`),
      ok);
    card.style.setProperty('--n', String(w.lines.length));
    const el = h('div', { class: 'wc-overlay' }, card);
    this.stage.append(el);
    this.el = el;
    ok.focus({ preventScroll: true });
  }

  close(): void {
    const el = this.el;
    if (!el) return;
    this.el = null;
    const back = this.opener;
    this.opener = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
    if (rm.matches) {
      el.remove();
      return;
    }
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 260);
  }
}
