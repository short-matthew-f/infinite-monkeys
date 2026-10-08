// Feed: a teletype ticker (one current line) that unrolls into recent history.
// Lines come from core events and from ambient flavor on a game-time schedule.
// Choosing flavor draws from state.rng.presentation only (HANDOFF rule 5).
import { nextFloat, type GameEvent } from '../../core/index.js';
import type { Ctx, Screen } from '../ctx.js';
import { h, text } from '../ui/dom.js';
import * as f from '../ui/format.js';
import {
  AMBIENT,
  ALLOCATION_LINES,
  DECLARED_LINE,
  FUNDING_LINE,
  OPENING_LINE,
  PERMIT_LINE,
  STAGES,
  STAGE_LINES,
  pinLine,
  tierLine,
  titleLine,
  type FeedStage,
} from '../content/feed-lines.js';
import './feed.css';

const HISTORY_MAX = 50;
const AMBIENT_MIN_S = 20;
const AMBIENT_SPAN_S = 20; // next ambient line is 20..40 s of game time away
const SUMMARY_EVERY_S = 15; // purchases/hires are rolled into one line at most this often
const FORM_THROTTLE_S = 8; // funding/allocation/pin forms: one line per kind per 8 s
const RECENT_AVOID = 8; // don't repeat any of the last N ambient lines while others remain

interface Entry {
  tick: number;
  text: string;
  human: boolean;
  /** Milestones, discoveries, the Permit and Declare. Only these are announced to screen readers. */
  notable: boolean;
}

function currentStage(ctx: Ctx): FeedStage {
  const s = ctx.state();
  if (s.phase === 'hotel') return 'aleph0';
  const r = s.milestonesReached;
  if (r.includes('tall')) return 'tall';
  if (r.includes('building')) return 'building';
  if (r.includes('office')) return 'office';
  return 'start';
}

function mount(root: HTMLElement, ctx: Ctx): () => void {
  const { t } = ctx;
  const history: Entry[] = []; // newest first
  let dirty = true;
  let shownKey = '';
  let open = false;
  let lastTick = ctx.state().tick;

  // Pending roll-up of purchases and manual hires.
  const pending = { desks: 0, upgrades: 0, research: 0, hires: 0 };
  let lastSummaryTick = lastTick;
  const lastFormTick: Record<string, number> = {};
  const recent: string[] = [];

  const secs = (ticks: number) => ticks * t.tickSeconds;
  const nextAmbientAfter = (): number => {
    const r = nextFloat(ctx.state().rng.presentation);
    return ctx.state().tick + Math.round((AMBIENT_MIN_S + r * AMBIENT_SPAN_S) / t.tickSeconds);
  };
  let nextAmbientTick = nextAmbientAfter();

  /** Text waiting for the live region: the latest notable line since the last render. */
  let announce: string | null = null;
  const push = (tick: number, line: string, human = false, notable = false) => {
    history.unshift({ tick, text: line, human, notable });
    if (notable) announce = line;
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    dirty = true;
  };
  /** Form-style lines: player-driven and easy to spam with a slider. */
  const throttled = (kind: string, tick: number, line: string) => {
    const last = lastFormTick[kind];
    if (last !== undefined && secs(tick - last) < FORM_THROTTLE_S) return;
    lastFormTick[kind] = tick;
    push(tick, line);
  };

  const onEvent = (e: GameEvent) => {
    switch (e.type) {
      case 'hire':
        if (e.manual) pending.hires++; // automated hires are far too frequent to log
        break;
      case 'purchase':
        if (e.item === 'desk') pending.desks++;
        else if (e.item.startsWith('research:') || e.item.startsWith('epic:')) pending.research++;
        else pending.upgrades++;
        break;
      case 'tierDiscovered':
        push(e.tick, tierLine(e.tier), false, true);
        break;
      case 'stageReached': {
        const line = STAGE_LINES[e.stage];
        if (line) push(e.tick, line, false, true); // 'aleph0' is covered by infinityDeclared
        break;
      }
      case 'permitStamped':
        push(e.tick, PERMIT_LINE, false, true);
        break;
      case 'infinityDeclared':
        push(e.tick, DECLARED_LINE, false, true);
        break;
      case 'titleFlipped':
        push(e.tick, titleLine(e.from, e.to), false, true);
        break;
      case 'fundingChanged':
        throttled('funding', e.tick, FUNDING_LINE);
        break;
      case 'allocationChanged':
        throttled(`alloc:${e.layer}`, e.tick, ALLOCATION_LINES[e.layer]);
        break;
      case 'objectivePinned':
        throttled('pin', e.tick, pinLine(e.objective.kind, e.objective.kind === 'commission' ? e.objective.id : undefined));
        break;
      default:
        break;
    }
  };
  ctx.onEvent(onEvent);

  const plural = (n: number, one: string, many: string) => `${f.count(n)} ${n === 1 ? one : many}`;
  const flushSummary = (tick: number) => {
    const parts: string[] = [];
    if (pending.desks) parts.push(plural(pending.desks, 'desk', 'desks'));
    if (pending.upgrades) parts.push(plural(pending.upgrades, 'department upgrade', 'department upgrades'));
    if (pending.research) parts.push(plural(pending.research, 'research order', 'research orders'));
    if (pending.hires) parts.push(`${plural(pending.hires, 'staff member', 'staff members')} seated`);
    if (!parts.length) return;
    pending.desks = pending.upgrades = pending.research = pending.hires = 0;
    push(tick, `Requisitions processed: ${parts.join(', ')}.`);
  };

  /** Ambient pick: prefers the current stage's lines, avoids recent repeats. Uses the presentation stream. */
  const pickAmbient = (): { id: string; text: string; human: boolean } | null => {
    const stage = currentStage(ctx);
    const idx = STAGES.indexOf(stage);
    const eligible = AMBIENT.filter((l) => STAGES.indexOf(l.stage) <= idx);
    let pool = eligible.filter((l) => !recent.includes(l.id));
    if (!pool.length) pool = eligible;
    const here = pool.filter((l) => l.stage === stage);
    const rng = ctx.state().rng.presentation;
    // 60% of the time pick from the current stage (when it has fresh lines), else anywhere eligible.
    const useHere = here.length > 0 && nextFloat(rng) < 0.6;
    const from = useHere ? here : pool;
    const line = from[Math.min(from.length - 1, Math.floor(nextFloat(rng) * from.length))];
    if (!line) return null;
    recent.push(line.id);
    if (recent.length > RECENT_AVOID) recent.shift();
    return { id: line.id, text: line.text, human: !!line.human };
  };

  // ---- DOM (built once) ----
  const clip = h('span', { class: 'feed-clip' });
  const lineEl = h('span', { class: 'feed-text' });
  clip.append(lineEl);
  const count = h('span', { class: 'feed-count' });
  const live = h('span', { class: 'feed-sr', role: 'status', 'aria-live': 'polite' });
  const list = h('ol', { class: 'feed-history', id: 'feed-history', hidden: true, 'aria-label': 'Recent feed lines, newest first' });
  const tick = h('button', { class: 'feed-tick', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'feed-history', 'aria-label': 'Feed. Tap to show recent lines.', onclick: () => setOpen(!open) },
    h('span', { class: 'feed-strip' }, clip),
    count,
  );
  const wrap = h('div', { class: 'feed' }, tick, live, list);
  root.append(wrap);

  const setOpen = (v: boolean) => {
    open = v;
    tick.setAttribute('aria-expanded', String(v));
    list.hidden = !v;
    if (v) {
      shownKey = '';
      dirty = true;
      renderHistory();
    }
  };
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && open) setOpen(false);
  });
  document.addEventListener('pointerdown', (ev) => {
    if (open && ev.target instanceof Node && !wrap.contains(ev.target)) setOpen(false);
  });

  const renderHistory = () => {
    if (!open) return;
    const key = `${history.length}:${history[0]?.tick}:${history[0]?.text}`;
    if (key === shownKey) return;
    shownKey = key;
    list.replaceChildren(
      ...(history.length
        ? history.map((e) => h('li', { class: e.human ? 'is-human' : '' }, h('time', {}, f.duration(secs(e.tick))), h('span', {}, e.text)))
        : [h('li', { class: 'feed-empty' }, 'No entries.')]),
    );
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let printedTop: Entry | null = null;
  const showTop = (e: Entry) => {
    printedTop = e;
    text(lineEl, e.text);
    tick.classList.toggle('is-human', e.human);
    // Restart the print-in animation, then pan the line if it overflows the strip.
    lineEl.classList.remove('is-panning');
    clip.classList.remove('is-printing');
    lineEl.style.removeProperty('--pan');
    if (reduced.matches) return;
    void clip.offsetWidth;
    clip.classList.add('is-printing');
    const overflow = lineEl.offsetWidth - clip.clientWidth;
    if (overflow > 2) {
      lineEl.style.setProperty('--pan', `-${overflow + 4}px`);
      lineEl.style.setProperty('--pan-time', `${Math.max(3, overflow / 28)}s`);
      lineEl.classList.add('is-panning');
    }
  };

  push(lastTick, OPENING_LINE);

  return () => {
    const s = ctx.state();
    // A load or reset can move the clock backwards; resync the schedules instead of stalling.
    if (s.tick < lastTick) {
      lastSummaryTick = s.tick;
      nextAmbientTick = nextAmbientAfter();
      for (const k of Object.keys(lastFormTick)) delete lastFormTick[k];
    }
    lastTick = s.tick;

    if (secs(s.tick - lastSummaryTick) >= SUMMARY_EVERY_S) {
      lastSummaryTick = s.tick;
      flushSummary(s.tick);
    }
    if (s.tick >= nextAmbientTick) {
      const line = pickAmbient();
      if (line) push(s.tick, line.text, line.human);
      nextAmbientTick = nextAmbientAfter();
    }

    if (announce !== null) {
      // Events, not ticker text: the strip changes often, the live region only for notable lines.
      text(live, announce);
      announce = null;
    }
    if (dirty) {
      dirty = false;
      const top = history[0];
      if (top && top !== printedTop) showTop(top);
      const n = Math.min(history.length, HISTORY_MAX);
      text(count, `${n} ${n === 1 ? 'line' : 'lines'}`);
      renderHistory();
    }
  };
}

export const feed: Screen = { id: 'feed', label: 'Feed', mount };
