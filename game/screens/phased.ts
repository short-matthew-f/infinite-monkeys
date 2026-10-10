// A room whose screen changes with the phase: the finite screen before Infinity, the hotel screen after.
// Both live in the room's pane; the wrapper shows one and renders only that one. The hotel screen
// mounts the first time the hotel phase renders, so it never reads hotel state that does not exist yet.
import type { Ctx, Screen } from '../ctx.js';
import { h, show } from '../ui/dom.js';

export function phased(finite: Screen, hotel: Screen): Screen {
  return {
    id: finite.id,
    label: finite.label,
    mount(root: HTMLElement, ctx: Ctx): () => void {
      // The finite screen mounts straight into the pane (some watch it), then its content moves under a wrapper.
      const renderFinite = finite.mount(root, ctx);
      const fin = h('div', { class: 'phase-pane phase-finite' });
      fin.append(...Array.from(root.childNodes));
      const hot = h('div', { class: 'phase-pane phase-hotel' });
      root.append(fin, hot);
      let renderHotel: (() => void) | null = null;
      return () => {
        const inHotel = ctx.state().phase === 'hotel';
        show(fin, !inHotel);
        show(hot, inHotel);
        if (inHotel) {
          renderHotel ??= hotel.mount(hot, ctx);
          renderHotel();
        } else renderFinite();
      };
    },
  };
}
