// Room sheets: a paper form that unfolds over the bottom of the screen and
// hosts one existing Screen. Caps at 40% of the viewport so the room stays in
// view above it. Moves focus in, traps Tab, Escape closes, focus returns.
import type { Ctx, Screen } from '../ctx.js';
import { h } from '../ui/dom.js';
import './sheet.css';

/** Pull-up detents as fractions of the stage height. Peek keeps the room in view; full is for the whole form. */
const PEEK = 0.42, FULL = 0.86;
export type Detent = 'peek' | 'full';

const svgIcon = (inner: string) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', '14');
  el.setAttribute('height', '14');
  el.setAttribute('viewBox', '0 0 14 14');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = inner;
  return el;
};

export interface Room {
  id: string;
  /** Name on the sheet and the directory. */
  name: string;
  /** Form code in the sheet header, e.g. "Form 3-H". */
  form: string;
  /** Number disc in the plan view and directory. */
  disc: number;
  screen: Screen;
}

export class SheetHost {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private title: HTMLElement;
  private code: HTMLElement;
  private tab: HTMLElement;
  private renders = new Map<string, () => void>();
  private panes = new Map<string, HTMLElement>();
  private returnTo: HTMLElement | null = null;
  current: Room | null = null;
  detent: Detent = 'peek';
  onClose: (room: Room) => void = () => {};
  /** Called when the sheet settles at a new height, so the camera can re-frame the room. */
  onDetent: (d: Detent) => void = () => {};
  private grab: HTMLButtonElement;

  constructor(parent: HTMLElement, private ctx: Ctx) {
    this.title = h('h2', { id: 'sheet-title', tabindex: '-1' });
    this.code = h('p', { class: 'form' });
    this.tab = h('div', { class: 'fold-tab' });
    const close = h('button', { class: 'close', onclick: () => this.close() },
      svgIcon('<path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'), 'Fold down');
    this.body = h('div', { class: 'sbody' });
    this.grab = h('button', { class: 'grab', 'aria-label': 'Pull up the form', 'aria-expanded': 'false' }, h('span', { class: 'grab-bar' }));
    this.el = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
      h('div', { class: 'sheetgrain' }),
      this.grab,
      h('div', { class: 'tabw' }, this.tab),
      h('header', { class: 'shead' }, h('div', {}, this.title, this.code), close),
      this.body,
    );
    parent.append(h('div', { class: 'sheetwrap' }, this.el));
    this.el.addEventListener('keydown', (e) => this.onKey(e));
    this.bindDrag(this.el.querySelector('.shead') as HTMLElement);
    addEventListener('resize', () => this.setDetent(this.detent, false));
  }

  private stageH(): number {
    return (this.el.closest('.stage') as HTMLElement | null)?.clientHeight ?? innerHeight;
  }

  private heightFor(d: Detent): number {
    return Math.round(this.stageH() * (d === 'full' ? FULL : PEEK));
  }

  setDetent(d: Detent, notify = true): void {
    this.detent = d;
    this.el.style.setProperty('--sheet-h', `${this.heightFor(d)}px`);
    this.el.classList.toggle('full', d === 'full');
    document.body.classList.toggle('sheet-full', d === 'full' && !!this.current);
    this.grab.setAttribute('aria-expanded', String(d === 'full'));
    this.grab.setAttribute('aria-label', d === 'full' ? 'Lower the form' : 'Pull up the form');
    if (notify && this.current) this.onDetent(d);
  }

  /** Drag the handle or header to resize; release snaps to the nearest detent, or folds down if dragged low. */
  private bindDrag(head: HTMLElement): void {
    let startY = 0, startH = 0, dragH = 0, dragging = false, moved = false, id = -1;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.close')) return;
      dragging = true;
      moved = false;
      id = e.pointerId;
      startY = e.clientY;
      startH = this.el.getBoundingClientRect().height;
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== id) return;
      const dy = startY - e.clientY;
      if (!moved && Math.abs(dy) < 6) return;
      if (!moved) {
        moved = true;
        this.el.classList.add('dragging');
        (e.target as HTMLElement).setPointerCapture?.(id);
      }
      const hgt = Math.max(80, Math.min(this.heightFor('full'), startH + dy));
      dragH = hgt;
      this.el.style.setProperty('--sheet-h', `${hgt}px`);
    };
    const up = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== id) return;
      dragging = false;
      this.el.classList.remove('dragging');
      if (!moved) return;
      // Snap by where the finger took it, not the rendered height (a short form can't stretch to full).
      const hgt = dragH, stage = this.stageH();
      if (hgt < stage * 0.24) {
        this.close();
        return;
      }
      this.setDetent(hgt > stage * ((PEEK + FULL) / 2) ? 'full' : 'peek');
      this.grab.dataset.dragged = '1';
      window.setTimeout(() => delete this.grab.dataset.dragged, 50);
    };
    for (const el of [this.grab, head]) el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    this.grab.addEventListener('click', () => {
      if (this.grab.dataset.dragged) return;
      this.setDetent(this.detent === 'full' ? 'peek' : 'full');
    });
  }

  /** Mounts each room's screen once, hidden, so state like drafts survives closing. */
  register(rooms: Room[]): void {
    for (const room of rooms) {
      const pane = h('div', { class: 'sheet-pane screen', hidden: true });
      this.body.append(pane);
      this.panes.set(room.id, pane);
      this.renders.set(room.id, room.screen.mount(pane, this.ctx));
    }
  }

  open(room: Room, from?: HTMLElement | null): void {
    this.returnTo = from ?? (document.activeElement as HTMLElement | null);
    this.current = room;
    for (const [id, pane] of this.panes) pane.hidden = id !== room.id;
    this.title.textContent = room.name;
    this.code.textContent = `${room.form} · Room ${room.disc}`;
    this.tab.replaceChildren(h('span', { class: 'disc sm' }, String(room.disc)), h('span', {}, room.name));
    this.body.scrollTop = 0;
    this.setDetent('peek', false);
    document.body.classList.add('sheet-open');
    this.render();
    requestAnimationFrame(() => {
      this.el.classList.add('open');
      this.title.focus({ preventScroll: true });
    });
  }

  close(): void {
    const room = this.current;
    if (!room) return;
    this.current = null;
    this.el.classList.remove('open');
    document.body.classList.remove('sheet-open', 'sheet-full');
    this.returnTo?.focus({ preventScroll: true });
    this.onClose(room);
  }

  /** Height the sheet covers, for framing the room above it. */
  cover(): number {
    return this.heightFor(this.detent) + 12;
  }

  render(): void {
    if (this.current) this.renders.get(this.current.id)?.();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    // The sheet's own controls first, then a docked Ernest's buttons (his card sits outside the sheet in the DOM).
    const focusable = [
      ...this.el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'),
      ...document.querySelectorAll<HTMLElement>('.ewrap.docked.in button'),
    ].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0]!, last = focusable[focusable.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === this.title)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
