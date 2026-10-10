// Feed: a teletype ticker (one current line) that unrolls into recent history.
// Lines come from core events and from ambient flavor on a game-time schedule.
// Choosing flavor draws from state.rng.presentation only (HANDOFF rule 5).
import { DEPTS, nextFloat, type DeptId, type GameEvent } from '../../core/index.js';
import { HEAD_NAMES, factFor, projectTitle } from '../world/projects.js';
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
import { commissionTitle, marketName, rewardLineData } from './hotel/names.js';
import './feed.css';

const DEPT_NAMES: Record<DeptId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' };
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

  /** One of a few equivalent phrasings, chosen from the presentation stream only. */
  const variant = (lines: string[]): string => lines[Math.min(lines.length - 1, Math.floor(nextFloat(ctx.state().rng.presentation) * lines.length))] as string;

  const onEvent = (e: GameEvent) => {
    switch (e.type) {
      case 'hire':
        if (e.manual) pending.hires++; // automated hires are far too frequent to log
        break;
      case 'purchase':
        if (e.by === 'department') break; // a department spending its own account; the quarter summary covers it
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
      // Quarterly budget (trial): facts only. Heads and reports never say what to buy.
      case 'budgetOpened':
        push(e.tick, variant([
          'Form 8-B filed: the quarterly budget is open. Until it is signed, income goes to the wallet.',
          'Accounts has opened the quarterly budget. Until it is signed, all income goes to the wallet.',
        ]), false, true);
        break;
      case 'quarterEnded': {
        const r = e.report;
        const levels = DEPTS.reduce((a, d) => a + r.autoLevels[d], 0);
        const tail = e.missedReview ? ' The review closed unsigned; the previous lines continue.' : '';
        push(e.tick, `Q${r.quarter} closed. Income ${f.amount(r.income)}; ${plural(levels, 'department level', 'department levels')} bought by the departments; ${f.amount(r.swept)} swept to the pot.${tail}`, false, true);
        break;
      }
      case 'budgetSigned': {
        const l = e.next;
        push(e.tick, `Q${e.quarter} budget signed: ${DEPTS.map((d) => `${DEPT_NAMES[d]} ${f.pct(l[d])}`).join(', ')}, wallet ${f.pct(l.discretionary)}.`, false, true);
        break;
      }
      case 'requisitionOpened':
        if (e.kind === 'levels' && e.dept) push(e.tick, `Head of ${DEPT_NAMES[e.dept]} has filed a requisition: ${plural(e.levels, 'level', 'levels')} for ${f.bananaText(e.price)}.`);
        else push(e.tick, `The ${HEAD_NAMES[e.from]} has filed a request: ${projectTitle(e.kind)}, ${f.bananaText(e.price)}. ${factFor(t, e.kind)}.`);
        break;
      case 'requisitionClosed': {
        const word = e.outcome === 'granted' ? 'granted' : e.outcome === 'declined' ? 'declined' : 'expired unanswered';
        if (e.kind === 'levels' && e.dept) push(e.tick, `Head of ${DEPT_NAMES[e.dept]} requisition ${word}.`);
        else push(e.tick, `${projectTitle(e.kind)} (${HEAD_NAMES[e.from]}): ${e.outcome === 'granted' ? 'accepted' : word}.`);
        break;
      }
      case 'projectDone': {
        const owned = ctx.state().office?.owned[e.project] ?? 0;
        push(e.tick, `${projectTitle(e.project)} is done. ${factFor(t, e.project, { n: owned })}.`);
        break;
      }
      case 'auditFound':
        push(e.tick, `The audit is back: ${f.bananaText(e.amount)} found, and they go to the pot.`, false, true);
        break;
      // The hotel: facts, so offline events reach the ticker too.
      case 'busArrived':
        push(e.tick, `The ${marketName(e.market)} bus has arrived. The Shift Crews are onboarding its staff.`, false, true);
        break;
      case 'marketOnline':
        push(e.tick, `The ${marketName(e.market)} market is online. Editors can be assigned work there.`, false, true);
        break;
      case 'commissionOffered':
        push(e.tick, `Commission offered: ${commissionTitle(e.id)}. It pays ${rewardLineData(e.reward)}.`, false, true);
        break;
      case 'commissionCompleted':
        push(e.tick, `Commission complete: ${commissionTitle(e.id)}. Paid: ${rewardLineData(e.reward)}.`, false, true);
        break;
      case 'commissionFailed':
        push(e.tick, `Commission lapsed: ${commissionTitle(e.id)}. The deadline passed first.`, false, true);
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
  const clip = h('span', { class: 'fl feed-clip' });
  const lineEl = h('span', { class: 'feed-text' });
  clip.append(lineEl);
  const count = h('span', { class: 'feed-count' });
  const live = h('span', { class: 'sr', role: 'status', 'aria-live': 'polite' });
  const list = h('ol', { id: 'feed-history', 'aria-label': 'Recent feed lines, newest first' });
  const hist = h('div', { class: 'feedhist', hidden: true, role: 'region', 'aria-label': 'Feed history' },
    h('p', { class: 'typed' }, 'Feed · latest entries ', count), list);
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('class', 'fc');
  chevron.setAttribute('width', '14');
  chevron.setAttribute('height', '14');
  chevron.setAttribute('viewBox', '0 0 14 14');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  const tick = h('button', { class: 'feedbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'feed-history', 'aria-label': 'Feed. Tap to show recent lines.', onclick: () => setOpen(!open) },
    h('span', { class: 'ft', 'aria-hidden': 'true' }, 'Feed'),
    clip,
    chevron,
  );
  const wrap = h('div', { class: 'feed-inner' }, tick, live, hist);
  root.append(wrap);

  const setOpen = (v: boolean) => {
    open = v;
    tick.setAttribute('aria-expanded', String(v));
    hist.hidden = !v;
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
  let fullText = '';
  /**
   * The collapsed line shows whole words and an ellipsis, never a word cut in half. The full line is one tap
   * away (the history), and stays in the accessible name. No marquee: nothing moves, so reduced motion keeps the meaning.
   */
  const fit = () => {
    if (!fullText) return;
    lineEl.textContent = fullText;
    const room = clip.clientWidth;
    if (room <= 0 || lineEl.offsetWidth <= room) {
      lineEl.removeAttribute('title');
      return;
    }
    const words = fullText.split(' ');
    while (words.length > 1) {
      words.pop();
      lineEl.textContent = `${words.join(' ').replace(/[\s,;:.\-]+$/, '')}…`;
      if (lineEl.offsetWidth <= room) break;
    }
    lineEl.title = fullText;
  };
  new ResizeObserver(fit).observe(clip);
  const showTop = (e: Entry) => {
    printedTop = e;
    fullText = e.text;
    fit();
    tick.classList.toggle('is-human', e.human);
    clip.classList.remove('is-printing');
    if (reduced.matches) return;
    void clip.offsetWidth; // restart the print-in animation
    clip.classList.add('is-printing');
  };

  push(lastTick, OPENING_LINE);
  // Memos from the floor's next-thing cue (game/world/cue.ts).
  addEventListener('im:memo', (e) => {
    const text = (e as CustomEvent<string>).detail;
    if (text) push(lastTick, text);
  });

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
