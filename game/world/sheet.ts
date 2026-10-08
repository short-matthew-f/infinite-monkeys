// Room sheets: a paper form that unfolds over the bottom of the screen and
// hosts one existing Screen. Caps at 40% of the viewport so the room stays in
// view above it. Moves focus in, traps Tab, Escape closes, focus returns.
import type { Ctx, Screen } from '../ctx.js';
import { h } from '../ui/dom.js';

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
    this.code = h('p', { class: 'sheet-code' });
    this.tab = h('span', { class: 'sheet-tab' });
    const close = h('button', { class: 'sheet-close', onclick: () => this.close() }, 'Fold down');
    this.body = h('div', { class: 'sheet-body' });
    this.el = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', hidden: true },
      this.tab,
      h('header', { class: 'sheet-head' }, h('div', {}, this.title, this.code), close),
      this.body,
    );
    parent.append(this.el);
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
    this.tab.textContent = String(room.disc);
    this.el.hidden = false;
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
    window.setTimeout(() => { if (!this.current) this.el.hidden = true; }, 260);
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
    const focusable = [...this.el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')]
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
