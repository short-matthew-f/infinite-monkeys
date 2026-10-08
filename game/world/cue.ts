// Shows the current next-thing cue: a paper tab and a lit ring on the room in
// the world (scales with the camera, no art rebuild), a flag on the room's
// plan tag, a stamp on its Directory row, and one feed memo when it changes.
import type { Cue } from './advisor.js';
import type { FloorZone } from './floor-art.js';
import './cue.css';

export class CueView {
  private el: HTMLElement;
  private edge: HTMLButtonElement;
  private current: Cue | null = null;
  private anchor: [number, number] | null = null;
  /** Called when the player taps the edge arrow for an off-screen cued room. */
  onEdge: (cue: Cue) => void = () => {};

  constructor(private cam: HTMLElement, private chips: HTMLElement, private dir: HTMLElement) {
    // When the cued room is off-screen, a paper arrow at the screen edge names it and takes you there.
    this.edge = document.createElement('button');
    this.edge.className = 'cue-edge';
    this.edge.hidden = true;
    this.edge.innerHTML = '<span class="cue-arrow" aria-hidden="true">↑</span><span class="cue-edge-text"></span>';
    this.edge.addEventListener('click', () => { if (this.current) this.onEdge(this.current); });
    chips.parentElement?.append(this.edge);
    this.el = document.createElement('div');
    this.el.className = 'ncue';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.hidden = true;
    this.el.innerHTML = '<span class="ncue-ring"></span><span class="ncue-tab"><span class="ncue-text"></span></span>';
    cam.append(this.el);
  }

  get cue(): Cue | null {
    return this.current;
  }

  show(cue: Cue | null, zone: FloorZone | undefined, label: (room: string) => string): void {
    const same = cue?.key === this.current?.key;
    this.current = cue;
    for (const c of this.chips.querySelectorAll<HTMLElement>('.chip')) {
      const on = !!cue && c.dataset.chip === cue.room;
      c.classList.toggle('cued', on);
      let flag = c.querySelector<HTMLElement>('.cue-flag');
      if (on) {
        if (!flag) {
          flag = document.createElement('span');
          flag.className = 'cue-flag';
          c.append(flag);
        }
        flag.textContent = cue.tag;
      } else flag?.remove();
    }
    for (const b of this.dir.querySelectorAll<HTMLElement>('[data-room]')) {
      const on = !!cue && b.dataset.room === cue.room;
      let stamp = b.querySelector<HTMLElement>('.cue-stamp');
      if (on) {
        if (!stamp) {
          stamp = document.createElement('span');
          stamp.className = 'cue-stamp';
          b.querySelector('.nm')?.append(stamp);
        }
        stamp.textContent = cue.tag;
      } else stamp?.remove();
    }
    for (const g of this.cam.querySelectorAll('.cued-zone')) g.classList.remove('cued-zone');
    if (!cue || !zone) {
      this.el.hidden = true;
      this.edge.hidden = true;
      this.anchor = null;
      return;
    }
    document.getElementById(`z-${cue.room}`)?.classList.add('cued-zone');
    if (same && !this.el.hidden) return;
    // Hang the tab over the room's own sign (measured from the art), falling back to the zone's top edge.
    const [x, y, w] = zone.box;
    let ax = x + w / 2, ay = y, aw = w;
    const sign = document.querySelector(`#z-${cue.room} .swing`);
    const camRect = this.cam.getBoundingClientRect();
    const k = camRect.width / (this.cam.offsetWidth || 1);
    if (sign && k > 0) {
      const r = sign.getBoundingClientRect();
      ax = (r.left + r.width / 2 - camRect.left) / k;
      ay = (r.top - camRect.top) / k - 14;
      aw = r.width / k;
    }
    Object.assign(this.el.style, { left: `${ax}px`, top: `${ay}px`, width: `${Math.max(aw, 120)}px` });
    this.anchor = [ax, ay + 30];
    (this.edge.querySelector('.cue-edge-text') as HTMLElement).textContent = `${cue.tag} · ${label(cue.room)}`;
    this.edge.setAttribute('aria-label', `${cue.tag}: go to ${label(cue.room)}`);
    (this.el.querySelector('.ncue-text') as HTMLElement).textContent = cue.tag;
    this.el.hidden = false;
    // The hot button carries the cue for screen readers.
    const hot = this.cam.querySelector<HTMLElement>(`button.hot[data-zone="${cue.room}"]`);
    for (const b of this.cam.querySelectorAll<HTMLElement>('button.hot')) b.removeAttribute('aria-description');
    hot?.setAttribute('aria-description', `${cue.tag}. ${label(cue.room)}`);
    if (!same) {
      this.el.classList.remove('ncue-in');
      void this.el.offsetWidth;
      this.el.classList.add('ncue-in');
      window.dispatchEvent(new CustomEvent('im:memo', { detail: cue.memo }));
    }
  }

  /** Shows the edge arrow when the cued room is out of view in play view. Call when the camera settles or the cue changes. */
  placeEdge(x: number, y: number, s: number, show: boolean, top: number, vw: number, vh: number): void {
    if (!show || !this.current || !this.anchor) {
      this.edge.hidden = true;
      return;
    }
    const sx = this.anchor[0] * s + x, sy = this.anchor[1] * s + y;
    const m = 24;
    if (sx > m && sx < vw - m && sy > top + m && sy < vh - m) {
      this.edge.hidden = true;
      return;
    }
    this.edge.hidden = false;
    const w = this.edge.offsetWidth || 200, h = this.edge.offsetHeight || 44;
    const cx = Math.min(vw - w / 2 - 10, Math.max(w / 2 + 10, sx));
    const cy = Math.min(vh - h / 2 - 14, Math.max(top + h / 2 + 10, sy));
    this.edge.style.left = `${cx}px`;
    this.edge.style.top = `${cy}px`;
    const angle = Math.atan2(sy - cy, sx - cx) * 180 / Math.PI + 90;
    (this.edge.querySelector('.cue-arrow') as HTMLElement).style.transform = `rotate(${Math.round(angle)}deg)`;
  }
}
