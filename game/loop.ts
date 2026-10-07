// Fixed-step loop: core advances in whole ticks; rendering runs per frame.
import { step, type EventSink, type GameState, type Tuning } from '../core/index.js';

/** Longest real time one frame may simulate; longer gaps go through catchUp(). */
const MAX_FRAME_SECONDS = 1;

export function startLoop(getState: () => GameState, t: Tuning, sink: EventSink, render: () => void): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    acc += Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;
    const s = getState();
    while (acc >= t.tickSeconds) {
      step(s, t, sink);
      acc -= t.tickSeconds;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
}
