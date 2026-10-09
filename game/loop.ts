// Fixed-step loop: core advances in whole ticks; rendering runs per frame.
// This is the only live time source. Gaps longer than one frame (background
// tab, sleep, page loaded hidden) go through catchUp(), which applies the
// offline cap.
import { catchUp, step, type EventSink, type GameState, type Tuning } from '../core/index.js';

/** Longest real time one frame may simulate tick by tick. */
const MAX_FRAME_SECONDS = 1;

/** `catchUpFn` lets the caller observe long gaps (the "while you were away" card); it defaults to core's catchUp. */
export function startLoop(getState: () => GameState, t: Tuning, sink: EventSink, render: () => void, catchUpFn: typeof catchUp = catchUp): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const s = getState();
    if (dt > MAX_FRAME_SECONDS) catchUpFn(s, t, sink, dt);
    else acc += Math.max(0, dt);
    while (acc >= t.tickSeconds) {
      step(s, t, sink);
      acc -= t.tickSeconds;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
