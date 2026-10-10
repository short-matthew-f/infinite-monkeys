// Room view: a room opens full screen. A full-width scene band across the top
// (the same room, drawn larger), the room's existing Screen below it, and a drawn
// exit door that goes back to the building. Screens mount once, hidden, so state
// like drafts survives closing. Focus moves in on open and Tab stays inside;
// Escape or the door exits and focus goes back to the floor.
import type { Ctx, Screen } from '../ctx.js';
import { h } from '../ui/dom.js';
import { buildRoom, type FloorProps, type RoomId } from './floor-art.js';
import { patchLive } from './tower-art.js';
import './room.css';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const NS = 'http://www.w3.org/2000/svg';

export interface Room {
  id: RoomId;
  /** Name in the room bar and the directory. */
  name: string;
  /** Name after Infinity (the hotel phase); the room keeps its id. */
  hotelName?: string;
  /** Form code in the room bar, e.g. "Form 3-H". */
  form: string;
  /** Floor number: the disc in the directory and on the building. */
  disc: number;
  screen: Screen;
}

/** The room's name for the current phase. */
export const phaseName = (room: Room, phase: 'finite' | 'hotel'): string => (phase === 'hotel' && room.hotelName) || room.name;

const DOOR = `<svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true"><rect x="3" y="2" width="20" height="26" fill="var(--glow)" stroke="currentColor" stroke-width="2.2"/><path d="M3 2L15 5v22L3 28z" fill="var(--walnut)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="16" r="1.5" fill="var(--mustard)" stroke="currentColor" stroke-width=".8"/><path d="M17 15h8m-3-3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export class RoomView {
  readonly el: HTMLElement;
  current: Room | null = null;
  /** Called once the room has started to close, with the room that closed. */
  onClose: (room: Room) => void = () => {};
  private title: HTMLElement;
  private code: HTMLElement;
  private scene: HTMLElement;
  private art: SVGSVGElement;
  private body: HTMLElement;
  private renders = new Map<string, () => void>();
  private panes = new Map<string, HTMLElement>();
  private sceneKey = '';
  private hideTimer = 0;

  constructor(parent: HTMLElement, private ctx: Ctx, private getProps: () => FloorProps) {
    this.title = h('h2', { id: 'room-title', tabindex: '-1' });
    this.code = h('p', { class: 'form' });
    const exit = h('button', { class: 'exit', type: 'button', onclick: () => this.close() });
    exit.innerHTML = `${DOOR}<span>Exit to the building</span>`;
    this.art = document.createElementNS(NS, 'svg') as SVGSVGElement;
    this.art.setAttribute('class', 'room-art');
    this.art.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    this.art.setAttribute('aria-hidden', 'true');
    this.scene = h('div', { class: 'room-scene' }, this.art);
    this.body = h('div', { class: 'sbody' });
    this.el = h('section', { class: 'room', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'room-title', hidden: true },
      h('header', { class: 'room-bar' }, exit, h('div', { class: 'room-id' }, this.title, this.code)),
      this.scene,
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

  open(room: Room): void {
    window.clearTimeout(this.hideTimer);
    this.current = room;
    for (const [id, pane] of this.panes) pane.hidden = id !== room.id;
    this.title.textContent = phaseName(room, this.ctx.state().phase);
    this.code.textContent = `${room.form} · Floor ${room.disc}`;
    this.body.scrollTop = 0;
    this.sceneKey = '';
    this.drawScene(true);
    this.el.hidden = false;
    document.body.classList.add('room-open');
    this.render();
    // One frame at the closed pose, then the transition runs.
    void this.el.offsetWidth;
    requestAnimationFrame(() => {
      this.el.classList.add('open');
      this.art.classList.remove('fold');
      this.title.focus({ preventScroll: true });
    });
  }

  close(): void {
    const room = this.current;
    if (!room) return;
    this.current = null;
    this.el.classList.remove('open');
    document.body.classList.remove('room-open');
    this.hideTimer = window.setTimeout(() => (this.el.hidden = true), reduceMotion.matches ? 160 : 260);
    this.onClose(room);
  }

  /** The scene is rebuilt only when its picture changes (a desk bought, a tier discovered). */
  private drawScene(first = false): void {
    if (!this.current) return;
    const props = this.getProps();
    const id = this.current.id;
    const scene = buildRoom(id, props);
    if (scene.key === this.sceneKey) {
      patchLive(this.art as unknown as Element, props); // small live figures change without a redraw
      return;
    }
    this.sceneKey = scene.key;
    const [x, y, w, hh] = scene.viewBox;
    this.art.setAttribute('viewBox', `${x} ${y} ${w} ${hh}`);
    this.scene.style.setProperty('--ar', String(hh / w));
    this.art.innerHTML = scene.svg;
    patchLive(this.art as unknown as Element, props);
    // The first time a room opens its pieces start folded flat and stand up.
    if (first && !reduceMotion.matches) this.art.classList.add('fold');
  }

  render(): void {
    if (!this.current) return;
    const name = phaseName(this.current, this.ctx.state().phase);
    if (this.title.textContent !== name) this.title.textContent = name;
    this.drawScene();
    this.renders.get(this.current.id)?.();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    // The room's own controls first, then a docked Ernest's buttons (his card sits outside the room in the DOM).
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
