// The bottom docks: Ernest's card and the requisition memo's tab both sit on the bottom edge. Neither floats over
// the building or an open room. Each one tells the page how much room it takes, and the building and the room
// end above the highest of them (--dock-h). Presentation only; no game state.
const root = document.documentElement;

/** Measures every dock that is showing and publishes the space they take, from the bottom edge up. */
export function reserveDock(): void {
  let h = 0;
  for (const el of document.querySelectorAll<HTMLElement>('.ewrap.in, .memo-dock:not([hidden])')) {
    const tab = el.classList.contains('memo-dock') ? el.querySelector<HTMLElement>('.memo-tab') : el;
    const gap = parseFloat(getComputedStyle(el).bottom) || 0;
    h = Math.max(h, gap + (tab?.offsetHeight ?? 0) + 6);
  }
  const v = h ? `${Math.round(h)}px` : '0px';
  if (root.style.getPropertyValue('--dock-h') !== v) root.style.setProperty('--dock-h', v);
  document.body.classList.toggle('docked-ui', h > 0);
}

addEventListener('resize', reserveDock);
