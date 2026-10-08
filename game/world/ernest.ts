// Ernest, Orientation Officer: Orientation Reel 1 (the first hire). He leans in
// from the corner, points at Personnel, docks to a strip while a sheet is open,
// and steps back for good once the first hire is made or he's dismissed.
// Tutorial progress is presentation state, kept in localStorage, never in GameState.

const KEY = 'im:ernest-reel1';

export interface ErnestCues {
  /** True until the first hire. */
  needed: boolean;
  /** Which sheet is open, if any. */
  open: string | null;
  /** A desk is free, so Hire is possible. */
  freeDesk: boolean;
  /** Banana price of the next desk, as text. */
  deskPrice: string;
}

export class Ernest {
  private shown = false;
  private dismissed: boolean;
  private lastSay = '';

  constructor(private wrap: HTMLElement, private say: HTMLElement, ok: HTMLElement) {
    let d = false;
    try {
      d = localStorage.getItem(KEY) === 'done';
    } catch {}
    this.dismissed = d;
    ok.addEventListener('click', () => this.dismiss());
  }

  dismiss(): void {
    this.dismissed = true;
    try {
      localStorage.setItem(KEY, 'done');
    } catch {}
    this.hide();
  }

  /** Called at most once per tick with the current cues. */
  update(c: ErnestCues): void {
    if (this.dismissed) return;
    if (!c.needed) {
      this.dismiss();
      return;
    }
    if (c.open && c.open !== 'personnel') {
      this.hide();
      return;
    }
    const docked = c.open === 'personnel';
    const text = docked
      ? c.freeDesk ? 'A desk is free. Press Hire to seat a monkey.' : `Buy a desk first (${c.deskPrice}). Then hire.`
      : 'Personnel seats new monkeys, and each needs a desk. Tap Personnel to begin.';
    if (text !== this.lastSay) {
      this.say.textContent = text;
      this.lastSay = text;
    }
    this.wrap.classList.toggle('docked', docked);
    const fig = this.wrap.querySelector('.efig');
    fig?.setAttribute('viewBox', docked ? '50 8 86 76' : '0 0 138 128');
    if (!this.shown) {
      this.shown = true;
      this.wrap.classList.add('in');
    }
  }

  private hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.wrap.classList.remove('in', 'docked');
  }
}
