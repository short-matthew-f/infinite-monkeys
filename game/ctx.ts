// The one object screens get. All game access goes through it, so the rules
// from HANDOFF-M3-M4.md live here once: actions go through core, "allowed?"
// comes from core, and previews are clone → apply → read.
import { nullSink, type EventSink, type GameState, type Tuning } from '../core/index.js';

/** A core action with its trailing arguments already bound. */
export type Action = (s: GameState, t: Tuning, sink: EventSink) => boolean;

export interface Ctx {
  readonly t: Tuning;
  /** Live state. Read freely; never mutate directly. Use act(). */
  state(): GameState;
  /** Runs a core action on the live state. Returns core's verdict. */
  act(action: Action): boolean;
  /**
   * Would this action be allowed right now? Dry-runs it on a clone.
   * Cached per tick under `key`, so use a stable key per button
   * (e.g. 'buyDeptLevel:editing').
   */
  can(key: string, action: Action): boolean;
  /** Clone the state, apply `mutate` (core actions with nullSink), return the clone to read from. */
  preview(mutate: (s: GameState) => void): GameState;
  /** Event sink for calls that need one directly (e.g. recordPreview). */
  readonly sink: EventSink;
  /** Subscribe to core events (feed, celebrations). Returns an unsubscribe. */
  onEvent(fn: EventSink): () => void;
}

export function createCtx(getState: () => GameState, t: Tuning, sink: EventSink, onEvent: Ctx['onEvent'], onAct: () => void): Ctx {
  let cacheTick = -1;
  let cacheState: GameState | null = null;
  const cache = new Map<string, boolean>();
  const invalidate = () => {
    cache.clear();
    cacheTick = -1;
  };
  return {
    t,
    sink,
    onEvent,
    state: getState,
    act(action) {
      const ok = action(getState(), t, sink);
      if (ok) {
        invalidate();
        onAct();
      }
      return ok;
    },
    can(key, action) {
      const s = getState();
      if (s.tick !== cacheTick || s !== cacheState) {
        cache.clear();
        cacheTick = s.tick;
        cacheState = s;
      }
      let v = cache.get(key);
      if (v === undefined) {
        v = action(structuredClone(s), t, nullSink);
        cache.set(key, v);
      }
      return v;
    },
    preview(mutate) {
      const clone = structuredClone(getState());
      mutate(clone);
      return clone;
    },
  };
}

/** A screen mounts into its root once and returns a render function, called at most once per tick. */
export type Screen = {
  id: string;
  label: string;
  mount(root: HTMLElement, ctx: Ctx): () => void;
};
