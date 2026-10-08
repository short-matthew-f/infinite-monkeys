// Payoff scenes: when a head's project takes effect (projectDone), or an audit comes back
// (auditFound), a short vignette plays. It plays in the relevant room when that room is open,
// otherwise as a full-width inset over the building. It has Close and Escape, honours reduced
// motion (the finished frame, held longer), and never stacks on the quarter-end ceremony: it
// waits for the ceremony to close. The scene is drawn by office-art.js; here we only mount it.
//
// Figures on the scenes come from core: the audit's find is the event's amount, the finding
// number is the owned count, the cost cut is the project's own multiplier.
import { projectDef, type GameEvent } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { PAYOFF_META, payoffSVG, type PayoffId, type PayoffInfo } from './office-art.js';
import { SCENE_OF, projectTitle } from './projects.js';
import './payoff.css';

/** Wait this long after Accept before the scene plays: the memo's APPROVED stamp finishes first. */
const AFTER_STAMP_MS = 1900;
const LINGER_MS = 3400;
const LINGER_REDUCED_MS = 6000;
const MAX_QUEUE = 3;

interface Job {
  scene: PayoffId;
  title: string;
  cap: string;
  info: PayoffInfo;
  at: number;
}

export interface PayoffHost {
  /** The open room's id and element, if a room is open. */
  room(): { id: string; el: HTMLElement } | null;
  /** True while something else owns the screen (the ceremony). */
  busy(): boolean;
}

export class Payoffs {
  private el: HTMLElement | null = null;
  private room: string | null = null;
  private timer = 0;
  private opener: HTMLElement | null = null;
  private readonly queue: Job[] = [];
  private readonly rm = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly stage: HTMLElement, private readonly ctx: Ctx, private readonly host: PayoffHost) {
    ctx.onEvent((e: GameEvent) => this.onEvent(e));
    // Capture phase on the document: Escape closes the scene first, before the room or the Directory see it.
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

  /** True while a scene is on screen (the water cooler stays quiet). */
  get active(): boolean {
    return !!this.el;
  }

  private onEvent(e: GameEvent): void {
    const t = this.ctx.t;
    if (e.type === 'projectDone') {
      const scene = SCENE_OF[e.project] as PayoffId | undefined;
      if (!scene) return;
      const def = projectDef(t, e.project);
      const info: PayoffInfo = {};
      if (scene === 'stamp') {
        info.finding = this.ctx.state().office?.owned[e.project] ?? 1;
        if (def && def.effect.type === 'perm') info.pct = Math.round((1 - def.effect.mult) * 100);
      }
      this.enqueue({ scene, title: projectTitle(e.project), cap: PAYOFF_META[scene].cap, info, at: performance.now() + AFTER_STAMP_MS });
    } else if (e.type === 'auditFound') {
      const amount = f.bananas(e.amount);
      this.enqueue({
        scene: 'audit',
        title: projectTitle('audit'),
        cap: `${PAYOFF_META.audit.cap} ${amount} found; it goes to the pot.`,
        info: { amount },
        at: performance.now() + 300,
      });
    }
  }

  private enqueue(j: Job): void {
    this.queue.push(j);
    while (this.queue.length > MAX_QUEUE) this.queue.shift();
  }

  /** Once per frame-tick: starts the next scene when it's due and nothing else is in the way. */
  render(): void {
    if (this.el) {
      // A scene that lives in a room goes when the room does.
      if (this.room && this.host.room()?.id !== this.room) this.close(true);
      return;
    }
    const j = this.queue[0];
    if (!j || performance.now() < j.at || this.host.busy()) return;
    this.queue.shift();
    this.play(j);
  }

  private play(j: Job): void {
    const meta = PAYOFF_META[j.scene];
    const room = this.host.room();
    const inRoom = !!room && meta.room === room.id;
    const root = inRoom ? room!.el : this.stage;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = h('button', { class: 'po-close', type: 'button', onclick: () => this.close() }, 'Close');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pv');
    svg.setAttribute('viewBox', '0 0 360 220');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = payoffSVG(j.scene, j.info);
    const capId = `po-cap-${j.scene}`;
    const el = h('div', { class: `payoff ${inRoom ? 'inzone' : 'vig'}`, role: 'dialog', 'aria-label': j.title, 'aria-describedby': capId },
      h('div', { class: 'po-card' }, svg, h('div', { class: 'po-cap' }, h('b', {}, j.title), h('span', { id: capId }, j.cap), close)));
    if (inRoom) {
      const bar = room!.el.querySelector<HTMLElement>('.room-bar');
      el.style.top = `${bar ? bar.offsetHeight : 62}px`;
    }
    root.append(el);
    this.el = el;
    this.room = inRoom ? room!.id : null;
    close.focus({ preventScroll: true });
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.close(), meta.ms + (this.rm.matches ? LINGER_REDUCED_MS : LINGER_MS));
  }

  /** Closes the scene (fading, unless `now` or reduced motion). */
  close(now = false): void {
    window.clearTimeout(this.timer);
    const el = this.el;
    if (!el) return;
    this.el = null;
    this.room = null;
    const back = this.opener;
    this.opener = null;
    // Give focus back only if it was on the scene's own Close button; a tap elsewhere has already moved it.
    if (back && back.isConnected && (el.contains(document.activeElement) || document.activeElement === document.body)) back.focus({ preventScroll: true });
    if (now || this.rm.matches) {
      el.remove();
      return;
    }
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 300);
  }
}
