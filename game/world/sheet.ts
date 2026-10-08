// Room sheets: a paper form that unfolds over the bottom of the screen and
// hosts one existing Screen. Caps at 40% of the viewport so the room stays in
// view above it. Moves focus in, traps Tab, Escape closes, focus returns.
import type { Ctx, Screen } from '../ctx.js';
import { h } from '../ui/dom.js';

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
  onClose: (room: Room) => void = () => {};

  constructor(parent: HTMLElement, private ctx: Ctx) {
    this.title = h('h2', { id: 'sheet-title', tabindex: '-1' });
    this.code = h('p', { class: 'form' });
    this.tab = h('div', { class: 'fold-tab' });
    const close = h('button', { class: 'close', onclick: () => this.close() },
      svgIcon('<path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'), 'Fold down');
    this.body = h('div', { class: 'sbody' });
    this.el = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
      h('div', { class: 'sheetgrain' }),
      h('div', { class: 'tabw' }, this.tab),
      h('header', { class: 'shead' }, h('div', {}, this.title, this.code), close),
      this.body,
    );
    parent.append(h('div', { class: 'sheetwrap' }, this.el));
    this.el.addEventListener('keydown', (e) => this.onKey(e));
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
    document.body.classList.remove('sheet-open');
    this.returnTo?.focus({ preventScroll: true });
    this.onClose(room);
  }

  /** Height the sheet covers, for framing the room above it. */
  cover(): number {
    return Math.round(window.innerHeight * 0.4) + 12;
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
    const focusable = [...document.querySelectorAll<HTMLElement>('.sheet button:not([disabled]), .sheet input:not([disabled]), .sheet [tabindex="0"], .ewrap.docked .ok')]
      .filter((x) => !x.closest('[hidden]'));
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
