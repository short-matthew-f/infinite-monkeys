// Shows the current next-thing cue: a lit tag on the cued floor (tower.ts), a
// stamp on its Directory row, and one feed memo when it changes.
import type { Cue } from './advisor.js';
import type { Tower } from './tower.js';
import './cue.css';

export class CueView {
  private current: Cue | null = null;

  constructor(private tower: Tower, private dir: HTMLElement) {}

  get cue(): Cue | null {
    return this.current;
  }

  show(cue: Cue | null): void {
    const same = cue?.key === this.current?.key;
    this.current = cue;
    this.tower.setCue(cue);
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
    if (cue && !same) window.dispatchEvent(new CustomEvent('im:memo', { detail: cue.memo }));
  }
}
