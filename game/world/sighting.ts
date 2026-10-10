// Sightings: now and then a monkey types a real line from a public-domain work (core/pages.ts). A page rises from
// a typewriter on the Typing Pool floor and pins itself to the roof band, typing its line; the player has a few
// seconds to tap it. Rooms get a compact tappable strip over their scene instead, so a sighting never covers a
// control. A catch flies the page up to the Records Library floor with a "+N bananas" chip; a miss crumples it
// into a bin, quietly.
//
// The view is driven by state (`s.pages.open`), not by events, so a sighting that opened and expired during an
// offline catch-up was never drawn and is never mentioned. Events only choose how the page leaves. Every number on
// screen (the reward, the countdown) comes from core; the countdown edge is read from ticks, so it stays honest
// after the tab was backgrounded. Presentation-only randomness (which monkey) uses state.rng.presentation.
import { catchSighting, nextFloat, type GameEvent, type GameState } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { h } from '../ui/dom.js';
import * as f from '../ui/format.js';
import { typingFrames, type TypeFrame } from './works.js';
import './sighting.css';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const CHIP_MS = 1500;

export interface SightingHost {
  /** The open room, if any (its element holds the strip). */
  room(): { id: string; el: HTMLElement } | null;
}

type OpenSighting = NonNullable<NonNullable<GameState['pages']>['open']>;

interface Face {
  btn: HTMLButtonElement;
  ghost: HTMLElement;
  typed: HTMLElement;
  bar: HTMLElement;
  last: string;
}

interface Current {
  key: string;
  work: string;
  line: number;
  title: string;
  text: string;
  total: number;
  expires: number;
  frames: TypeFrame[];
  t0: number;
  shown: number;
  raf: number;
  /** Which monkey (0..1 across the floor); the spot itself is measured when needed, since the building can resize. */
  jitter: number;
}

function face(cls: string, onTap: () => void): Face {
  const ghost = h('span', { class: 'sp-ghost', 'aria-hidden': 'true' });
  const typed = h('span', { class: 'sp-typed', 'aria-hidden': 'true' });
  const bar = h('i');
  const btn = h('button', { class: `sight-page ${cls}`, type: 'button', hidden: true, onclick: onTap },
    h('span', { class: 'sp-text' }, ghost, typed),
    h('span', { class: 'sp-edge', 'aria-hidden': 'true' }, bar));
  return { btn, ghost, typed, bar, last: '' };
}

export class Sightings {
  private page: Face;
  private strip: Face;
  private live: HTMLElement;
  private cur: Current | null = null;
  private key = '';
  private stripRoom: string | null = null;
  private stripTimer = 0;

  constructor(private roof: HTMLElement, private stage: HTMLElement, private map: HTMLElement, private ctx: Ctx, private host: SightingHost, roomEl: HTMLElement) {
    this.page = face('pinned', () => this.tap());
    this.strip = face('strip', () => this.tap());
    roof.append(this.page.btn);
    // The strip sits right under the room's bar, over its scene art (never over the form), and is reachable by Tab.
    roomEl.querySelector('.room-bar')?.after(this.strip.btn);
    this.live = h('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
    stage.append(this.live);
    ctx.onEvent((e) => this.onEvent(e));
  }

  /** A page is up (the water cooler waits). */
  get active(): boolean {
    return !!this.cur;
  }

  private say(msg: string): void {
    this.live.textContent = '';
    window.setTimeout(() => (this.live.textContent = msg), 30);
  }

  private tap(): void {
    if (!this.cur) return;
    const inRoom = !!this.host.room();
    if (this.ctx.act(catchSighting) && inRoom) document.getElementById('room-title')?.focus({ preventScroll: true });
  }

  // ---------- per tick ----------

  /** Once per tick: shows a new sighting, keeps the right pose for the screen, and drains the edge. */
  render(): void {
    const s = this.ctx.state();
    const open = s.pages?.open ?? null;
    const key = open ? `${open.work}:${open.line}:${open.openedTick}` : '';
    const room = this.host.room();
    if (key !== this.key) {
      this.key = key;
      if (this.cur) this.vanish();
      if (open) this.spawn(s, key, open, room);
    }
    const c = this.cur;
    if (!c) return;
    this.pose(room);
    const frac = Math.max(0, Math.min(1, (c.expires - s.tick) / c.total));
    const v = `scaleX(${frac.toFixed(3)})`;
    const low = frac < 0.3;
    for (const x of [this.page, this.strip]) {
      if (x.last !== v) {
        x.last = v;
        x.bar.style.transform = v;
        x.btn.classList.toggle('low', low);
      }
    }
  }

  private spawn(s: GameState, key: string, open: OpenSighting, room: ReturnType<SightingHost['room']>): void {
    const work = this.ctx.t.pages?.works.find((w) => w.id === open.work);
    const line = work?.lines[open.line];
    if (!work || line === undefined) return;
    const frames = typingFrames(line);
    const jitter = nextFloat(s.rng.presentation);
    const c: Current = {
      key, work: work.id, line: open.line, title: work.title, text: line,
      total: Math.max(1, open.expiresTick - open.openedTick), expires: open.expiresTick,
      frames, t0: performance.now(), shown: -1, raf: 0,
      jitter,
    };
    this.cur = c;
    const label = `A monkey typed a real line: ${line}. Tap to catch it.`;
    for (const x of [this.page, this.strip]) {
      x.ghost.textContent = line.toUpperCase();
      x.typed.textContent = '';
      x.btn.setAttribute('aria-label', label);
      x.btn.classList.remove('typing-done', 'low');
      x.last = '';
      x.bar.style.transform = 'scaleX(1)';
    }
    this.say(`A monkey typed a line from ${work.title}. Tap to catch it.`);
    this.pose(room, true);
    if (reduce.matches) {
      this.setTyped(c, frames.length - 1);
    } else {
      const step = (now: number): void => {
        if (this.cur !== c) return;
        const el = now - c.t0;
        let i = c.shown < 0 ? 0 : c.shown;
        while (i + 1 < frames.length && frames[i + 1]!.at <= el) i++;
        if (i !== c.shown) this.setTyped(c, i);
        if (i < frames.length - 1) c.raf = requestAnimationFrame(step);
      };
      c.raf = requestAnimationFrame(step);
    }
    // Entrance. The page rises from its typewriter; a strip just drops in; reduced motion only fades.
    if (room) {
      if (!reduce.matches) this.strip.btn.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    } else if (reduce.matches) {
      this.page.btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    } else {
      this.rise(c);
    }
  }

  private setTyped(c: Current, i: number): void {
    c.shown = i;
    const text = c.frames[i]!.text;
    this.page.typed.textContent = text;
    this.strip.typed.textContent = text;
    if (i === c.frames.length - 1) {
      this.page.btn.classList.add('typing-done');
      this.strip.btn.classList.add('typing-done');
    }
  }

  /** Which pose is on screen: the pinned page above the building, or the strip inside the open room. */
  private pose(room: ReturnType<SightingHost['room']>, force = false): void {
    const id = room?.id ?? null;
    if (!force && id === this.stripRoom) return;
    this.stripRoom = id;
    window.clearTimeout(this.stripTimer);
    this.strip.btn.removeAttribute('data-state');
    this.page.btn.hidden = !!room;
    this.strip.btn.hidden = !room;
    if (room) {
      const bar = room.el.querySelector<HTMLElement>('.room-bar');
      this.strip.btn.style.top = `${bar ? bar.offsetHeight : 62}px`;
    }
  }

  private vanish(): void {
    const c = this.cur;
    if (c) cancelAnimationFrame(c.raf);
    this.cur = null;
    this.page.btn.hidden = true;
    this.strip.btn.hidden = true;
  }

  // ---------- where things are on screen ----------

  /** A point on a floor's scene (viewport coordinates), kept inside the visible part of the building. */
  private spot(floor: string, fx: number, fy: number): { x: number; y: number; seen: boolean } {
    const view = this.map.querySelector<HTMLElement>(`${floor} .flr-view`);
    const bldg = this.map.querySelector<HTMLElement>('.bldg');
    if (!view || !bldg) return { x: innerWidth / 2, y: innerHeight / 2, seen: false };
    const v = view.getBoundingClientRect();
    const b = bldg.getBoundingClientRect();
    const x = v.left + v.width * (0.15 + 0.7 * fx);
    const y = v.top + v.height * fy;
    const seen = y > b.top + 6 && y < b.bottom - 6;
    return { x, y: Math.max(b.top + 10, Math.min(b.bottom - 10, y)), seen };
  }

  private rel(x: number, y: number): { x: number; y: number } {
    const r = this.stage.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  }

  private rise(c: Current): void {
    const el = this.page.btn;
    const r = el.getBoundingClientRect();
    const origin = this.spot('.flr-pool', c.jitter, 0.62);
    const dx = origin.x - (r.left + r.width / 2);
    const dy = origin.y - (r.top + r.height / 2);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.16) rotate(-16deg)`, opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.22 },
        { transform: 'translate(0, 0) scale(1.05) rotate(1.5deg)', opacity: 1, offset: 0.86 },
        { transform: 'none', opacity: 1, offset: 1 },
      ],
      { duration: 640, easing: 'cubic-bezier(.22,.8,.3,1)' },
    );
    if (origin.seen) {
      // A little page pops up out of the typewriter as it leaves.
      const o = this.rel(origin.x, origin.y);
      const sp = h('div', { class: 'sight-sprout', 'aria-hidden': 'true' });
      sp.style.left = `${o.x}px`;
      sp.style.top = `${o.y}px`;
      this.stage.append(sp);
      sp.animate([{ transform: 'translate(-50%, 0) scale(.3)', opacity: 0 }, { transform: 'translate(-50%, -16px) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%, -30px) scale(.9)', opacity: 0 }], { duration: 560, easing: 'ease-out' }).onfinish = () => sp.remove();
    }
  }

  // ---------- the page leaves ----------

  private onEvent(e: GameEvent): void {
    const c = this.cur;
    if (!c) return;
    if (e.type === 'sightingCaught' && e.work === c.work && e.line === c.line) this.caught(c, e);
    else if (e.type === 'sightingMissed' && e.work === c.work && e.line === c.line) this.missed(c);
  }

  /** Takes the live page off screen and returns a flying copy of it (null in a room or with reduced motion). */
  private lift(c: Current): HTMLElement | null {
    cancelAnimationFrame(c.raf);
    this.cur = null;
    const room = this.host.room();
    if (room || reduce.matches || this.page.btn.hidden) return null;
    const r = this.page.btn.getBoundingClientRect();
    const fly = this.page.btn.cloneNode(true) as HTMLElement;
    fly.classList.add('sight-fly');
    fly.removeAttribute('aria-label');
    fly.setAttribute('aria-hidden', 'true');
    fly.setAttribute('tabindex', '-1');
    fly.hidden = false;
    const p = this.rel(r.left, r.top);
    Object.assign(fly.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.page.btn.hidden = true;
    this.stage.append(fly);
    return fly;
  }

  private caught(c: Current, e: Extract<GameEvent, { type: 'sightingCaught' }>): void {
    const reward = e.reward < 1 ? f.amount(e.reward) : f.count(e.reward);
    const chip = `+${reward} bananas`;
    const found = this.ctx.state().save.works?.[c.work]?.length ?? 0;
    const total = this.ctx.t.pages?.works.find((w) => w.id === c.work)?.lines.length ?? 0;
    const sub = e.completed ? `${c.title} is complete` : e.isNew ? `${c.title} · ${found} of ${total}` : `${c.title} · again`;
    this.say(`Caught. ${chip}. ${e.isNew ? `${found} of ${total} lines of ${c.title} filed.` : 'A line you already had; it still pays.'}`);
    const room = this.host.room();
    const fly = this.lift(c);
    if (room) {
      this.settleStrip(`${chip}`, sub, 'caught');
      return;
    }
    if (!fly) {
      // Reduced motion: no flight. The page fades where it stands and the chip appears at the roof.
      const r = this.page.btn.getBoundingClientRect();
      this.page.btn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => (this.page.btn.hidden = true);
      this.chip(this.rel(r.left + r.width / 2, r.bottom), chip, sub, false);
      return;
    }
    const dest = this.spot('.flr-research', 0.5, 0.5);
    const r = fly.getBoundingClientRect();
    const dx = dest.x - (r.left + r.width / 2);
    const dy = dest.y - (r.top + r.height / 2);
    fly.animate(
      [
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.1}px, -8px) scale(1.07) rotate(-2deg)`, opacity: 1, offset: 0.16 },
        { transform: `translate(${dx}px, ${dy}px) scale(.1) rotate(16deg)`, opacity: 0.95, offset: 0.92 },
        { transform: `translate(${dx}px, ${dy}px) scale(.05) rotate(20deg)`, opacity: 0, offset: 1 },
      ],
      { duration: 760, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'forwards' },
    ).onfinish = () => {
      fly.remove();
      this.chip(this.rel(dest.x, dest.y), chip, sub, true);
    };
  }

  private missed(c: Current): void {
    const room = this.host.room();
    const origin = this.spot('.flr-pool', c.jitter, 0.62);
    const fly = this.lift(c);
    this.say('The page got away.');
    window.dispatchEvent(new CustomEvent('im:sighting-miss', { detail: { work: c.work, line: c.line } }));
    if (room) {
      this.settleStrip('', '', 'missed');
      return;
    }
    if (!fly) {
      this.page.btn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240 }).onfinish = () => (this.page.btn.hidden = true);
      return;
    }
    const r = fly.getBoundingClientRect();
    if (!origin.seen) {
      // The pool is off screen: the page just crumples and drops out of sight.
      fly.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.5, .35) rotate(8deg)', opacity: 1, offset: 0.4 }, { transform: 'translateY(60px) scale(.2) rotate(40deg)', opacity: 0 }], { duration: 700, easing: 'ease-in', fill: 'forwards' }).onfinish = () => fly.remove();
      return;
    }
    const o = this.rel(origin.x, origin.y);
    const bin = h('div', { class: 'sight-bin', 'aria-hidden': 'true' });
    bin.innerHTML = '<svg viewBox="0 0 30 34" width="40" height="45"><path d="M5 9h20l-2.2 21a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" fill="var(--concrete)" stroke="var(--edge)" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 9h24" stroke="var(--edge)" stroke-width="2.4" stroke-linecap="round"/><path d="M11 13v14M15 13v14M19 13v14" stroke="var(--edge)" stroke-width="1.2" opacity=".6"/></svg>';
    bin.style.left = `${o.x}px`;
    bin.style.top = `${o.y}px`;
    this.stage.append(bin);
    bin.animate([{ transform: 'translate(-50%, -50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.78 }, { transform: 'translate(-50%, -50%) scale(.8)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).onfinish = () => bin.remove();
    const dx = origin.x - (r.left + r.width / 2);
    const dy = origin.y - (r.top + r.height / 2);
    fly.animate(
      [
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: 'scale(.55, .5) rotate(10deg)', opacity: 1, offset: 0.22 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.35 - 18}px) scale(.22) rotate(120deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(.16) rotate(200deg)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(210deg)`, opacity: 0, offset: 1 },
      ],
      { duration: 820, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
    ).onfinish = () => fly.remove();
  }

  /** Strip pose: the strip holds its place a moment with the outcome, then goes. */
  private settleStrip(chip: string, sub: string, state: 'caught' | 'missed'): void {
    const b = this.strip.btn;
    b.dataset.state = state;
    b.disabled = true;
    b.querySelector('.sp-chip')?.remove();
    if (state === 'caught') b.append(h('span', { class: 'sp-chip', 'aria-hidden': 'true' }, h('b', {}, chip), h('small', {}, sub)));
    window.clearTimeout(this.stripTimer);
    this.stripTimer = window.setTimeout(() => {
      b.hidden = true;
      b.disabled = false;
      b.removeAttribute('data-state');
      b.querySelector('.sp-chip')?.remove();
    }, state === 'caught' ? 1400 : 700);
  }

  /** The "+N bananas" chip, floating up from a point (stage coordinates) and fading. */
  private chip(at: { x: number; y: number }, text: string, sub: string, move: boolean): void {
    const el = h('div', { class: 'sight-chip', 'aria-hidden': 'true' }, h('b', {}, text), h('small', {}, sub));
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    this.stage.append(el);
    const rise = move && !reduce.matches ? -34 : -4;
    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%, -62%) scale(1.08)', opacity: 1, offset: 0.14 },
        { transform: `translate(-50%, calc(-50% + ${rise}px)) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(-50%, calc(-50% + ${rise * 1.4}px)) scale(1)`, opacity: 0, offset: 1 },
      ],
      { duration: reduce.matches ? 1800 : CHIP_MS, easing: 'ease-out' },
    ).onfinish = () => el.remove();
  }
}
