// The quarter-end ceremony: the three department heads give their awkward slideshows about the
// quarter that just ended, then the player sets and signs next quarter's four budget lines.
//
// Self-contained: main.ts creates one Ceremony, calls open() when a review is due, and calls
// render() each frame while it is open. Core keeps ticking underneath (nothing waits for the
// player), so the ceremony watches for the review closing under it and says so.
//
// Every number on screen comes from core:
//   presentations  <- budget.lastReport (QuarterReport), snapshotted at open()
//   pot, quarter   <- budget.pot, budget.quarter
//   suggestion     <- suggestBudget(); presets are transforms of it (see budgetPresets)
//   forecast       <- previewQuarter(); it runs a whole quarter on a clone, so it is debounced
//   signing        <- signBudget() through ctx.act
// Slides state facts only. They never say what to buy or which lines to sign.
import { DEPTS, N, certifyTiers, editingPool, previewQuarter, projectDef, signBudget, suggestBudget, validLines, type BudgetLines, type DeptId, type GameEvent, type QuarterReport, type Tuning, type GameState, type QuarterPreview } from '../../core/index.js';
import type { Ctx } from '../ctx.js';
import { attr, text } from '../ui/dom.js';
import { bananas, count, rate } from '../ui/format.js';
import { DEPT_LABEL, projectFact, projectTitle } from './projects.js';
import { CLIP, SIGNATURE, arrivalSVG, barChart, creamPie, lineChart, potBandSVG, stripSVG } from './ceremony-art.js';
import './ceremony.css';

type LineId = DeptId | 'discretionary';
type Step = 'arrive' | 'pres' | 'budget' | 'signed';
type Stamp = ['ok' | 'bad' | 'neutral', string];

interface Slide {
  /** Entrance effect. */
  t: 'wipe' | 'spin' | 'zoom' | 'blinds';
  /** The head's line, shown under the screen (and announced). */
  say: string;
  /** Slide markup (numbers already formatted). */
  html: string;
  stamp?: Stamp;
  /** The head hurries past this one. */
  fast?: boolean;
  /** Reading time for a slide of lists (ms), instead of the usual. */
  dwell?: number;
}
interface Head {
  who: string;
  /** Index into the cast (art) and the presenter groups. */
  h: number;
  slides: Slide[];
}
interface Swap {
  timers: number[];
  anims: Animation[];
  /** Presenter index to leave standing, or -1 when everyone has left. */
  to: number;
  done: () => void;
}
interface Snapshot {
  quarter: number;
  report: QuarterReport | null;
}

const LINES: readonly LineId[] = [...DEPTS, 'discretionary'];
const NAMES: Record<LineId, string> = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing', discretionary: 'Discretionary' };
const BLURB: Record<LineId, string> = { recruiting: 'hires monkeys', construction: 'builds desks', editing: 'reads the finds', discretionary: 'your wallet' };
const HEAD_NAMES = ['Head Recruiter', 'Foreman', 'Chief Editor', 'Chief Accountant'];

/** How long a slide stays up (ms). Reading time carries meaning, so reduced motion lengthens it. */
const DWELL = { normal: 3200, stamp: 3600, fast: 1300 };
const FORECAST_IDLE_MS = 250;
const FORECAST_REFRESH_TICKS = 100;

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const levels = (n: number) => `${count(n)} ${plural(n, 'level')}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

// ---------- budget lines ----------

/** Renormalises lines: no negatives, Discretionary at least the minimum, and the total exactly 1. */
function fixLines(t: Tuning, l: BudgetLines): BudgetLines {
  const min = t.budget?.minDiscretionary ?? 0;
  let r = Math.max(0, l.recruiting), c = Math.max(0, l.construction), e = Math.max(0, l.editing);
  if (1 - (r + c + e) < min) {
    const sum = r + c + e;
    const k = sum > 0 ? (1 - min) / sum : 0;
    r *= k; c *= k; e *= k;
  }
  return { recruiting: r, construction: c, editing: e, discretionary: 1 - (r + c + e) };
}

/**
 * The preset lines. Each one is a plain transform of suggestBudget(), so they stay on the same plan
 * and always pass validLines (fixLines runs last):
 *   suggested  suggestBudget() as is.
 *   growth     Discretionary gives up 15 points (not below the minimum); the freed points are split
 *              equally between Recruiting and Construction.
 *   editing    The same 15 points go to Editing.
 *   save       Discretionary rises to at least 85% for a stage purchase; the department lines are
 *              scaled down in proportion.
 *   last       The lines signed last quarter (null until a budget has been signed).
 */
export interface Presets { suggested: BudgetLines; growth: BudgetLines; editing: BudgetLines; save: BudgetLines; last: BudgetLines | null }
export function budgetPresets(s: GameState, t: Tuning): Presets {
  const min = t.budget?.minDiscretionary ?? 0;
  const S = fixLines(t, suggestBudget(s, t));
  const dd = Math.max(min, S.discretionary - 0.15);
  const freed = S.discretionary - dd;
  const saveD = Math.max(S.discretionary, 0.85);
  const k = S.discretionary < 1 ? (1 - saveD) / (1 - S.discretionary) : 0;
  const b = s.budget;
  const signed = !!b && b.lines.discretionary < 1;
  return {
    suggested: S,
    growth: fixLines(t, { ...S, recruiting: S.recruiting + freed / 2, construction: S.construction + freed / 2 }),
    editing: fixLines(t, { ...S, editing: S.editing + freed }),
    save: fixLines(t, { ...S, recruiting: S.recruiting * k, construction: S.construction * k, editing: S.editing * k }),
    last: b && signed ? fixLines(t, b.lines) : null,
  };
}

/** Moves one line; the other three rebalance in proportion, Discretionary never below its minimum. */
function moveLine(t: Tuning, cur: BudgetLines, k: LineId, v0: number): BudgetLines {
  const min = t.budget?.minDiscretionary ?? 0;
  const v = k === 'discretionary' ? clamp(v0, min, 1) : clamp(v0, 0, 1 - min);
  const others = LINES.filter((x) => x !== k);
  const rest = 1 - v;
  const sum = others.reduce((a, x) => a + cur[x], 0);
  const out: BudgetLines = { ...cur, [k]: v };
  for (const x of others) out[x] = sum > 0 ? (cur[x] * rest) / sum : rest / others.length;
  if (k !== 'discretionary' && out.discretionary < min) {
    out.discretionary = min;
    const deps = others.filter((x) => x !== 'discretionary');
    const ds = deps.reduce((a, x) => a + cur[x], 0);
    const room = rest - min;
    for (const x of deps) out[x] = ds > 0 ? (cur[x] * room) / ds : room / deps.length;
  }
  return fixLines(t, out);
}

/** Whole percents that total exactly 100 (largest remainder), for display and slider positions. */
function percents(l: BudgetLines): Record<LineId, number> {
  const raw = LINES.map((k) => ({ k, v: l[k] * 100 }));
  const out = {} as Record<LineId, number>;
  let used = 0;
  for (const r of raw) { out[r.k] = Math.floor(r.v + 1e-9); used += out[r.k]; }
  const order = [...raw].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  for (let i = 0; used < 100 && i < order.length; i++, used++) out[order[i]!.k]++;
  return out;
}
const samePct = (a: BudgetLines, b: BudgetLines) => {
  const x = percents(a), y = percents(b);
  return LINES.every((k) => x[k] === y[k]);
};

// ---------- the presentations ----------

/** Builds the three heads' slides from the quarter's report. Facts only. */
function buildHeads(r: QuarterReport, t: Tuning): Head[] {
  const q = `Q${r.quarter}`;
  const reqs = r.requisitions;
  const title = (clip: string, name: string, sub: string) => `<div class="sl title"><div class="clip">${clip}</div><b>${esc(name)}</b><span>${esc(sub)}</span></div>`;
  const levelLine = (d: DeptId) => `${esc(NAMES[d])} bought ${levels(r.autoLevels[d])} from its own account.`;
  const levelStamp = (d: DeptId): Stamp => (r.autoLevels[d] > 0 ? ['ok', `${levels(r.autoLevels[d])} bought`] : ['neutral', 'No level bought']);

  const recruiting: Head = { who: HEAD_NAMES[0]!, h: 0, slides: [
    { t: 'wipe', say: '“Good afternoon. I have prepared some slides.”', html: title(CLIP.phone + CLIP.people, `${q} Recruiting Review`, 'presented by the Head Recruiter') },
    { t: 'spin', say: `“We seated ${count(r.hires)}. You seated ${count(r.manualHires)} by hand.”`, html: `<div class="sl"><b>Monkeys seated</b>${barChart([{ v: r.hires, label: 'RECRUITING', text: count(r.hires) }, { v: r.manualHires, label: 'BY HAND', text: count(r.manualHires) }], 'MONKEYS')}</div>` },
    { t: 'zoom', say: `“Our account bought ${levels(r.autoLevels.recruiting)} on its own. Synergy.”`, html: `<div class="sl take"><span class="wordart">SYNERGY</span><p>${levelLine('recruiting')}</p></div>`, stamp: levelStamp('recruiting') },
  ] };

  const built = r.desksBuilt, bought = r.desksBought;
  const flat = built + bought === 0;
  const construction: Head = { who: HEAD_NAMES[1]!, h: 1, slides: [
    { t: 'blinds', say: '“Building tomorrow, today. That is the title.”', html: title(CLIP.hat, 'Building Tomorrow, Today', `${q} · Construction`) },
    { t: 'wipe', say: flat ? '“No desks this quarter. The line is flat. It is still a line.”' : `“Desks built: ${count(built)}. Bought by hand: ${count(bought)}. The line goes up.”`, html: `<div class="sl"><b>Desks added</b>${lineChart([{ v: 0, label: 'START', text: '0' }, { v: built, label: 'BUILT', text: count(built) }, { v: built + bought, label: '+ BY HAND', text: count(built + bought) }])}</div>` },
    { t: 'spin', fast: true, say: '“Some housekeeping items. We can come back to this one.”', html: `<div class="sl bullets"><b>Housekeeping</b><ul><li>Hard hat audit (ongoing)</li><li>Desks built: ${count(built)}</li><li>Sawhorse count: 3, possibly 4</li><li>Desks bought by hand: ${count(bought)}</li><li>Plank inventory reconciled</li><li>Requisitions filed: ${count(reqs.offered)} (${count(reqs.granted)} granted, ${count(reqs.declined)} declined, ${count(reqs.expired)} expired)</li><li>Nail policy revised (see memo 7-N)</li><li>Wallet spent: ${count(r.walletSpent)}</li><li>Glue: do not</li><li>Ladder etiquette refresher</li><li>Misc.</li></ul></div>` },
    { t: 'zoom', say: `“Our account bought ${levels(r.autoLevels.construction)} on its own.”`, html: `<div class="sl take">${CLIP.star}<p>${levelLine('construction')}</p></div>`, stamp: levelStamp('construction') },
  ] };

  const total = r.certifiedFinds + r.discardedFinds;
  const dFrac = total > 0 ? r.discardedFinds / total : 0;
  const pctOf = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');
  const editing: Head = { who: HEAD_NAMES[2]!, h: 2, slides: [
    { t: 'blinds', say: '“I will keep this brief. We read things.”', html: title(CLIP.pencil, 'Reading the Room', `${q} · Editorial`) },
    { t: 'spin', say: total > 0 ? '“Here is our quarter as a pie. It is a banana cream pie.”' : '“Nothing came in to read. The pie is untouched.”', html: `<div class="sl"><b>Finds: certified vs discarded</b>${creamPie(dFrac, [`CERTIFIED ${count(r.certifiedFinds)} · ${pctOf(r.certifiedFinds)}`, `DISCARDED ${count(r.discardedFinds)} · ${pctOf(r.discardedFinds)}`])}</div>` },
    { t: 'wipe', say: `“${count(r.discardedFinds)} ${plural(r.discardedFinds, 'find was', 'finds were')} discarded. Our account bought ${levels(r.autoLevels.editing)}.”`, html: `<div class="sl take"><span class="big">${count(r.discardedFinds)} discarded</span><p>${count(r.certifiedFinds)} certified. ${levelLine('editing')}</p></div>`, stamp: r.discardedFinds > 0 ? ['bad', 'Finds discarded'] : ['ok', 'None discarded'] },
  ] };
  const heads = [recruiting, construction, editing];
  if (hasAccountantDeck(r)) heads.push(accountantDeck(r, t));
  return heads;
}

// ---------- the Chief Accountant's deck: what the quarter's requests cost, what they did, what went unanswered ----------

/** The deck is for quarters with requests to account for (or an audit that came back). */
export const hasAccountantDeck = (r: QuarterReport | null): boolean => !!r && (r.requests.length > 0 || r.auditFound > 0);

type Req = QuarterReport['requests'][number];
const SLIDE_ROWS = 3;

/** What a request is called and what it offered, from its project definition (or the level block). */
function describeRequest(t: Tuning, q: Req): { title: string; fact: string } {
  if (q.kind === 'levels' && q.dept) {
    const n = t.budget?.requisitions?.levels ?? 0;
    return { title: `${n} levels of ${DEPT_LABEL[q.dept]}`, fact: `${DEPT_LABEL[q.dept]} +${n} levels at a bulk price` };
  }
  const p = projectDef(t, q.kind);
  return { title: projectTitle(q.kind), fact: p ? projectFact(t, p) : '' };
}

function accountantDeck(r: QuarterReport, t: Tuning): Head {
  const q = `Q${r.quarter}`;
  const yes = r.requests.filter((x) => x.outcome === 'granted');
  const missed = r.requests.filter((x) => x.outcome !== 'granted');
  const spent = yes.reduce((a, x) => a + x.price, 0);
  /** A list slide: at most SLIDE_ROWS rows, then a line for the rest. */
  const rows = (items: string[], total: number) => {
    const shown = items.slice(0, SLIDE_ROWS);
    const rest = total - shown.length;
    return `<ul>${shown.join('')}${rest > 0 ? `<li class="more"><b>and ${count(rest)} more</b></li>` : ''}</ul>`;
  };
  const li = (title: string, right: string, fx = '') => `<li><b>${esc(title)}</b><span class="pr">${esc(right)}</span>${fx ? `<span class="fx">${esc(fx)}</span>` : ''}</li>`;

  const slides: Slide[] = [
    { t: 'zoom', say: '“I have audited the requests. All of them. Twice.”', html: `<div class="sl title"><div class="clip">${CLIP.ledger}${CLIP.lens}</div><b>${q} Requests &amp; Audit</b><span>presented by the Chief Accountant</span></div>` },
    {
      t: 'spin', dwell: 4600,
      say: yes.length ? `“${count(r.requests.length)} ${plural(r.requests.length, 'request')} came in. We said yes to ${count(yes.length)}. It cost ${bananas(spent)}.”` : `“${count(r.requests.length)} ${plural(r.requests.length, 'request')} came in. We said yes to none. It cost nothing.”`,
      html: `<div class="sl ledger"><b>Here’s what we spent</b>${yes.length ? rows(yes.map((x) => li(describeRequest(t, x).title, bananas(x.price))), yes.length) : '<p class="none">Nothing accepted.</p>'}<p class="sum"><b>Total</b> <span class="pr">${bananas(spent)}</span></p></div>`,
    },
    {
      t: 'wipe', dwell: 5200,
      say: r.auditFound > 0 ? `“Here is what it did. The audit found ${bananas(r.auditFound)}.”` : '“Here is what it did. I have the receipts.”',
      html: `<div class="sl ledger"><b>Here’s what it did</b>${yes.length || r.auditFound > 0 ? rows([...yes.map((x) => { const d = describeRequest(t, x); return li(d.title, '', d.fact); }), ...(r.auditFound > 0 ? [li('Audit', bananas(r.auditFound), 'Funds found, paid into the pot.')] : [])], yes.length + (r.auditFound > 0 ? 1 : 0)) : '<p class="none">Nothing to report.</p>'}</div>`,
    },
  ];
  if (missed.length) {
    slides.push({
      t: 'blinds', dwell: 5200,
      say: '“These were filed and not accepted. I have noted them.”',
      html: `<div class="sl ledger"><b>A missed opportunity</b>${rows(missed.map((x) => { const d = describeRequest(t, x); return li(d.title, bananas(x.price), `${d.fact}. ${x.outcome === 'declined' ? 'Declined' : 'Expired unanswered'}.`); }), missed.length)}</div>`,
    });
  }
  slides.push({
    t: 'blinds',
    say: `“Per the audit, lifetime earnings are minus one twelfth of a banana. Spent on requests: ${bananas(spent)}.”`,
    html: `<div class="sl take"><span class="big">−1/12 🍌</span><p>lifetime earnings, per the audit · spent on requests ${bananas(spent)}${r.auditFound > 0 ? ` · audits found ${bananas(r.auditFound)}` : ''}</p></div>`,
    stamp: ['ok', 'Noted'],
  });
  return { who: HEAD_NAMES[3]!, h: 3, slides };
}

// ---------- the ceremony ----------

export class Ceremony {
  /** Called once when the ceremony closes (signed, skipped or closed by the system). */
  onClose: () => void = () => {};

  private readonly root: HTMLElement;
  private readonly rm = matchMedia('(prefers-reduced-motion: reduce)');
  private opened = false;
  private opener: HTMLElement | null = null;
  private step: Step = 'arrive';
  private snap: Snapshot = { quarter: 0, report: null };
  private signing = false;
  private timers: number[] = [];
  /** The last quarterEnded we saw, for "that review closed unsigned" (core keeps only a running count). */
  private lastEnd: { quarter: number; missed: boolean } | null = null;

  // presentations
  private heads: Head[] = [];
  private pi = 0;
  private si = 0;
  private presT = 0;
  private paused = false;
  private swap: Swap | null = null;

  // budget
  private lines: BudgetLines = { recruiting: 0, construction: 0, editing: 0, discretionary: 1 };
  private draftQuarter = -1;
  private presets!: Presets;
  private forecastT = 0;
  private forecastTick = -1;
  private income = 0;
  private potShown = -1;
  private clockShown = -1;
  /** Milliseconds the last previewQuarter() took (the dev harness reads it). */
  lastPreviewMs = 0;

  constructor(parent: HTMLElement, private readonly ctx: Ctx) {
    this.root = document.createElement('div');
    this.root.className = 'cer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'cer-title');
    this.root.tabIndex = -1;
    this.root.hidden = true;
    this.root.addEventListener('keydown', this.onKey);
    parent.append(this.root);
    ctx.onEvent((e: GameEvent) => {
      if (e.type === 'quarterEnded') this.lastEnd = { quarter: e.report.quarter, missed: e.missedReview };
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Opens the ceremony for the current open review. No-op if no review is open. */
  open(opts: { skipPresentations?: boolean } = {}): void {
    if (this.opened) return;
    const s = this.ctx.state();
    const b = s.budget;
    if (!this.ctx.t.budget || !b || !b.reviewDue) return;
    this.opened = true;
    this.signing = false;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.snap = { quarter: b.quarter, report: b.lastReport ? structuredClone(b.lastReport) : null };
    this.build();
    this.root.hidden = false;
    document.addEventListener('focusin', this.onFocusIn);
    void this.root.offsetWidth;
    this.root.classList.add('on');
    this.root.focus({ preventScroll: true });
    if (!this.snap.report || opts.skipPresentations) {
      this.toBudget();
    } else {
      this.go('arrive');
      this.later(() => this.root.classList.add('go'), 320);
    }
  }

  /** Closes without signing (Escape), or after signing. Safe to call twice. */
  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.clearAll();
    document.removeEventListener('focusin', this.onFocusIn);
    this.root.classList.remove('on', 'go', 'swept', 'signed', 'qon');
    this.root.hidden = true;
    const back = this.opener;
    this.opener = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
    this.onClose();
  }

  /** Once per frame-tick while open. Cheap: watches for the review changing underneath, then paints two values. */
  render(): void {
    if (!this.opened || this.signing) return;
    const s = this.ctx.state();
    const b = s.budget;
    if (!b || !this.ctx.t.budget) return this.ended('The budget is no longer open.');
    if (b.quarter !== this.snap.quarter) return this.quarterChanged();
    if (!b.reviewDue) return this.ended('This review has already been signed.');
    if (this.step !== 'budget') return;
    this.paintPot(s);
    if (this.clockShown !== 0) {
      this.clockShown = 0;
      text(this.ref('clock'), 'The next quarter starts when you sign. Until then the Bureau runs on the current lines.');
    }
    if (this.forecastT === 0 && s.tick - this.forecastTick >= FORECAST_REFRESH_TICKS) this.queueForecast(0);
  }

  // ---------- structure ----------

  private ref<T extends HTMLElement = HTMLElement>(name: string): T {
    return this.root.querySelector(`[data-ref="${name}"]`) as T;
  }
  private all<T extends HTMLElement = HTMLElement>(sel: string): T[] {
    return [...this.root.querySelectorAll<T>(sel)];
  }
  private later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }
  private clearAll(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    clearTimeout(this.presT);
    clearTimeout(this.forecastT);
    this.forecastT = 0;
    this.killSwap();
    this.heads = [];
  }
  private say(msg: string): void {
    const el = this.ref('live');
    el.textContent = '';
    window.setTimeout(() => { el.textContent = msg; }, 30);
  }

  private build(): void {
    const first = !this.snap.report;
    this.root.className = 'cer';
    this.root.innerHTML = `
      <div class="cer-top"><p class="cer-typed" id="cer-title" data-ref="title"></p><button type="button" class="cer-btn" data-ref="close" aria-label="Close the review without signing"><span>Close</span></button></div>
      <div class="cer-body" data-ref="body">
        <section class="cer-sec" data-pane="arrive" aria-label="Arrival">
          <div class="cer-stage"><svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${arrivalSVG('QUARTERLY REVIEW', true, hasAccountantDeck(this.snap.report))}</svg></div>
          <div class="cer-pane">
            <p class="cer-say" data-ref="arriveSay"></p>
            <p class="cer-fact" data-ref="arriveMissed" hidden></p>
            <button type="button" class="cer-btn strong wide" data-ref="start"><span>Start the presentations</span></button>
            <button type="button" class="cer-btn wide" data-ref="skipA"><span>Skip to budget</span></button>
          </div>
        </section>
        <section class="cer-sec" data-pane="pres" aria-label="Presentations">
          <div class="cer-screenwrap"><div class="cer-roller" aria-hidden="true"></div><div class="cer-pull"><div class="cer-screen" data-ref="screen" role="button" tabindex="0" aria-label="Next slide"></div><i class="cer-cord" aria-hidden="true"></i></div></div>
          <div class="cer-stage strip"><svg viewBox="0 0 360 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${stripSVG()}</svg></div>
          <div class="cer-pane">
            <div class="cer-ph"><b data-ref="who"></b><span class="cer-typed" data-ref="slideN"></span></div>
            <p class="cer-sayline" data-ref="sayLine" aria-live="polite"></p>
            <div class="cer-dots" data-ref="dots" aria-hidden="true"></div>
          </div>
        </section>
        <section class="cer-sec" data-pane="budget" aria-label="Budget review">
          <div class="cer-stage band"><svg viewBox="0 0 360 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${potBandSVG(true)}</svg></div>
          <div class="cer-pane cer-form">
            <p class="cer-typed" data-ref="bq"></p>
            <div class="cer-fact intro" data-ref="intro" ${first ? '' : 'hidden'}><b>First budget.</b> Until now every banana went straight to your wallet. From now on income is split by four lines, and you set them once a quarter. Recruiting, Construction and Editing each keep an account and buy their own levels from it. Discretionary stays in your wallet for everything you buy by hand.</div>
            <p class="cer-fact away" data-ref="missed" hidden></p>
            <p class="cer-fact note" data-ref="under" role="status" hidden></p>
            <p class="cer-pot" data-ref="pot"></p>
            <div class="cer-presets" role="group" aria-label="Budget presets" data-ref="presets"></div>
            ${LINES.map((k) => `<div class="cer-line" data-line="${k}"><label class="ln" for="cer-r-${k}">${NAMES[k]}<small>${BLURB[k]}</small></label><output class="pc" for="cer-r-${k}" data-ref="pc-${k}"></output><input type="range" id="cer-r-${k}" min="0" max="100" step="1" data-k="${k}" /><span class="lr" data-ref="lr-${k}"></span></div>`).join('')}
            <div class="cer-split" data-ref="split" role="img"></div>
            <h3 class="cer-h">Forecast at these lines</h3>
            <ul class="cer-proj" data-ref="proj" aria-label="Forecast at these lines" aria-busy="false">
              ${['recruiting', 'construction', 'editing', 'pool', 'wallet', 'income'].map((k) => `<li data-ref="f-${k}"></li>`).join('')}
            </ul>
            <h3 class="cer-h" data-ref="lastH" ${first ? 'hidden' : ''}>Last quarter</h3>
            <dl class="cer-last" data-ref="last" ${first ? 'hidden' : ''}></dl>
            <p class="cer-why" data-ref="clock"></p>
            <div class="cer-sigline">${SIGNATURE}<span class="cer-typed">Signed: the Director</span></div>
          </div>
        </section>
      </div>
      <div class="cer-foot" data-foot="pres"><button type="button" class="cer-btn strong" data-ref="next"><span>Next slide ▸</span></button><button type="button" class="cer-btn" data-ref="pause"><span>Pause</span></button><button type="button" class="cer-btn" data-ref="skipP"><span>Skip to budget</span></button></div>
      <div class="cer-foot" data-foot="budget"><button type="button" class="cer-btn strong wide" data-ref="sign"><span>Sign budget</span></button><p class="cer-why" data-ref="signWhy" hidden></p></div>
      <div class="cer-stamp" aria-hidden="true"><span data-ref="stampText"></span></div>
      <div class="cer-ended" data-ref="ended" hidden><div class="cer-card"><p class="cer-say" data-ref="endedText"></p><button type="button" class="cer-btn strong wide" data-ref="endedClose"><span>Close</span></button></div></div>
      <div class="sr" aria-live="polite" data-ref="live"></div>`;

    text(this.ref('title'), `End of Q${this.snap.report ? this.snap.report.quarter : Math.max(0, this.snap.quarter - 1)} · Executive Suite`);
    if (first) text(this.ref('title'), 'First budget · Executive Suite');
    this.ref('close').addEventListener('click', () => this.close());
    this.ref('start').addEventListener('click', () => this.presStart());
    this.ref('skipA').addEventListener('click', () => this.toBudget());
    this.ref('skipP').addEventListener('click', () => this.toBudget());
    this.ref('next').addEventListener('click', () => this.presNext());
    this.ref('pause').addEventListener('click', () => this.togglePause());
    this.ref('sign').addEventListener('click', () => this.sign());
    this.ref('endedClose').addEventListener('click', () => this.close());
    const screen = this.ref('screen');
    screen.addEventListener('click', () => this.presNext());
    screen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.presNext(); }
    });
    for (const input of this.all<HTMLInputElement>('input[data-k]')) {
      input.addEventListener('input', () => this.onSlider(input, false));
      input.addEventListener('change', () => this.onSlider(input, true));
    }
    const missed = this.missedText();
    const am = this.ref('arriveMissed');
    am.hidden = !missed;
    am.textContent = missed;
    text(this.ref('arriveSay'), 'The bell rings. The heads ride up with their slides.');
  }

  private go(step: Step): void {
    this.step = step;
    this.root.dataset.step = step;
    const primary = { arrive: 'start', pres: 'next', budget: 'sign', signed: 'sign' }[step];
    this.later(() => {
      if (this.step === step && this.opened) this.ref(primary).focus({ preventScroll: true });
    }, 360);
    if (step === 'arrive') this.say('Quarterly review. The heads have arrived.');
  }

  // ---------- keyboard and focus ----------

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = this.focusable();
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0]!, last = f[f.length - 1]!;
    const a = document.activeElement;
    if (e.shiftKey && (a === first || !this.root.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !this.root.contains(a))) { e.preventDefault(); first.focus(); }
  };
  private readonly onFocusIn = (e: FocusEvent): void => {
    if (this.opened && !this.root.contains(e.target as Node)) (this.focusable()[0] ?? this.root).focus({ preventScroll: true });
  };
  private focusable(): HTMLElement[] {
    return this.all('button, input, [tabindex="0"]').filter((el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0);
  }

  // ---------- notes ----------

  /** Plain statement about reviews that closed unsigned, or ''. */
  private missedText(): string {
    const b = this.ctx.state().budget;
    if (!b) return '';
    const r = this.snap.report;
    if (r && (r.ranOnOldLines || (this.lastEnd && this.lastEnd.quarter === r.quarter && this.lastEnd.missed))) {
      return `Q${r.quarter} ran on the previous lines: its review was left unsigned and closed at quarter end.`;
    }
    return '';
  }

  /** The review closed under us because the quarter ended while it was open: refresh onto the new one. */
  private quarterChanged(): void {
    const s = this.ctx.state();
    const b = s.budget;
    if (!b) return;
    this.snap = { quarter: b.quarter, report: b.lastReport ? structuredClone(b.lastReport) : null };
    clearTimeout(this.presT);
    this.killSwap();
    this.heads = [];
    const note = `Time kept running. Q${b.quarter - 1} ended before this review was signed, so it ran on the previous lines. This review is now for Q${b.quarter}, and the pot is ${count(N.toNumber(b.pot))} bananas.`;
    if (this.step !== 'budget') {
      this.draftQuarter = -1;
      this.toBudget();
    } else {
      // Keep the player's draft lines; refresh what depends on the new quarter.
      this.draftQuarter = b.quarter;
      this.presets = budgetPresets(s, this.ctx.t);
      this.buildPresets();
      this.paintLast();
      this.paintLines(true);
    }
    this.refreshBudgetHeader();
    const under = this.ref('under');
    under.hidden = false;
    under.textContent = note;
    this.say(note);
    this.potShown = -1;
    this.paintPot(s);
    this.queueForecast(0);
  }

  /** The review is gone (signed elsewhere, budget closed): say so, then close. */
  private ended(msg: string): void {
    if (this.step === 'signed' || !this.opened) return;
    clearTimeout(this.presT);
    this.killSwap();
    this.ref('endedText').textContent = msg;
    this.ref('ended').hidden = false;
    this.say(msg);
    this.ref('endedClose').focus({ preventScroll: true });
    this.signing = true;
    this.later(() => this.close(), 4000);
  }

  // ---------- presentations ----------

  private presStart(): void {
    if (!this.snap.report) return this.toBudget();
    this.heads = buildHeads(this.snap.report, this.ctx.t);
    this.pi = 0;
    this.si = 0;
    this.paused = false;
    this.updatePauseButton();
    const total = this.heads.reduce((a, h) => a + h.slides.length, 0);
    this.ref('dots').innerHTML = '<i></i>'.repeat(total);
    this.go('pres');
    this.startSwap(null, 0, () => this.presShow());
  }

  private presShow(): void {
    clearTimeout(this.presT);
    const head = this.heads[this.pi];
    if (!head) return;
    const sl = head.slides[this.si]!;
    const scr = this.ref('screen');
    this.showOnly(head.h);
    scr.innerHTML = `<div class="slide t-${sl.t}" aria-hidden="true">${sl.html}${sl.stamp ? `<span class="cer-rstamp ${sl.stamp[0]}">${esc(sl.stamp[1])}</span>` : ''}</div>`;
    void scr.offsetWidth;
    scr.firstElementChild?.classList.add('in');
    const total = this.heads.reduce((a, h) => a + h.slides.length, 0);
    const done = this.heads.slice(0, this.pi).reduce((a, h) => a + h.slides.length, 0) + this.si;
    text(this.ref('who'), head.who);
    text(this.ref('slideN'), `Slide ${this.si + 1} of ${head.slides.length}${sl.fast ? ' · hurried past' : ''}`);
    text(this.ref('sayLine'), sl.say);
    this.all('[data-ref="dots"] i').forEach((el, i) => { el.className = i < done ? 'd' : i === done ? 'on' : ''; });
    if (sl.stamp) this.later(() => this.root.querySelector('.cer-rstamp')?.classList.add('down'), this.rm.matches ? 0 : 500);
    this.schedule(sl);
  }

  private schedule(sl: Slide): void {
    clearTimeout(this.presT);
    if (this.paused) return;
    const base = sl.dwell ?? (sl.fast ? DWELL.fast : sl.stamp ? DWELL.stamp : DWELL.normal);
    this.presT = window.setTimeout(() => this.presNext(), this.rm.matches ? base * 1.4 : base);
  }

  private presNext(): void {
    clearTimeout(this.presT);
    if (this.step !== 'pres' || !this.heads.length) return;
    if (this.swap) return this.finishSwap(); // a tap during a hand-over jumps to its end; nothing is queued
    const head = this.heads[this.pi]!;
    if (this.si < head.slides.length - 1) {
      this.si++;
      return this.presShow();
    }
    const from = head.h;
    if (this.pi < this.heads.length - 1) {
      this.pi++;
      this.si = 0;
      this.startSwap(from, this.heads[this.pi]!.h, () => this.presShow());
    } else {
      this.startSwap(from, null, () => this.toBudget()); // the last head shuffles off, then the budget
    }
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.updatePauseButton();
    const head = this.heads[this.pi];
    if (!this.paused && head && !this.swap) this.schedule(head.slides[this.si]!);
    if (this.paused) clearTimeout(this.presT);
  }
  private updatePauseButton(): void {
    const b = this.ref('pause');
    text(b.firstElementChild as HTMLElement, this.paused ? 'Play' : 'Pause');
  }

  // ---------- the hand-over between presenting heads ----------
  // Walk = Web Animations on two wrapper groups per head (.pw slides in x, .pb bobs in y): one transform
  // each, no layout, no filters. Arm and head gestures are CSS classes (.exit / .enter / .ready).
  // Reduced motion: no walking; the swap is instant.

  private presenterEl(k: number): SVGGElement | null {
    return this.root.querySelector<SVGGElement>(`.presenter[data-h="${k}"]`);
  }
  private showOnly(k: number): void {
    for (const el of this.all<HTMLElement>('.presenter')) {
      el.classList.toggle('on', Number(el.dataset.h) === k);
      el.classList.remove('exit', 'enter', 'ready');
      const bub = el.querySelector<SVGGElement>('.pbub');
      if (bub) bub.style.display = 'none';
    }
  }
  private bubble(el: Element, msg: string | null, x0?: number): void {
    const b = el.querySelector<SVGGElement>('.pbub');
    if (!b) return;
    if (!msg) { b.style.display = 'none'; return; }
    const w = Math.round(msg.length * 5.2 + 12);
    b.querySelector('.bx')!.textContent = msg;
    b.querySelector('.bg')!.setAttribute('width', String(w));
    b.querySelector('.bx')!.setAttribute('x', String(w / 2));
    b.setAttribute('transform', `translate(${x0 ?? -w / 2} 0)`);
    b.querySelector('.bt')!.setAttribute('transform', `translate(${w / 2 - 4} 0)`);
    b.style.display = '';
  }
  /** segs: ['m' walk | 'h' hold, dx, ms]. Returns keyframes for the slide (x) and the little step-bob (y). */
  private walkKF(start: number, segs: ['m' | 'h', number, number][]): { X: Keyframe[]; B: Keyframe[]; T: number } {
    const T = segs.reduce((a, g) => a + g[2], 0);
    let t = 0, x = start;
    const X: Keyframe[] = [{ offset: 0, transform: `translateX(${x}px)` }];
    const B: Keyframe[] = [{ offset: 0, transform: 'translateY(0px)' }];
    for (const [k, dx, ms] of segs) {
      if (k === 'm') {
        const n = Math.max(1, Math.round(ms / 130));
        for (let i = 0; i < n; i++) {
          B.push({ offset: (t + (ms * (i + 0.5)) / n) / T, transform: `translateY(${i % 2 ? -3.2 : -2}px)` }, { offset: (t + (ms * (i + 1)) / n) / T, transform: 'translateY(0px)' });
        }
      }
      t += ms;
      x += dx;
      X.push({ offset: t / T, transform: `translateX(${x}px)` });
    }
    return { X, B, T };
  }
  private killSwap(): Swap | null {
    const s = this.swap;
    if (!s) return null;
    s.timers.forEach(clearTimeout);
    s.anims.forEach((a) => a.cancel());
    this.swap = null;
    for (const el of this.all('.presenter')) {
      el.classList.remove('exit', 'enter', 'ready');
      const bub = el.querySelector<SVGGElement>('.pbub');
      if (bub) bub.style.display = 'none';
    }
    return s;
  }
  private finishSwap(): void {
    const s = this.killSwap();
    if (!s) return;
    this.showOnly(s.to); // end state: outgoing gone, incoming at the lectern, pointing
    s.done();
  }
  private startSwap(from: number | null, to: number | null, done: () => void): void {
    const out = from == null ? null : this.presenterEl(from);
    const inn = to == null ? null : this.presenterEl(to);
    const toIdx = to == null ? -1 : to;
    if (this.rm.matches || (!out && !inn)) {
      this.swap = { timers: [], anims: [], to: toIdx, done };
      return this.finishSwap();
    }
    clearTimeout(this.presT);
    const swap: Swap = { timers: [], anims: [], to: toIdx, done };
    this.swap = swap;
    const first = from == null, last = to == null;
    const at = (ms: number, fn: () => void) => swap.timers.push(window.setTimeout(fn, ms));
    const walk = (el: Element, start: number, segs: ['m' | 'h', number, number][], delay: number) => {
      const k = this.walkKF(start, segs);
      const opts: KeyframeAnimationOptions = { duration: k.T, delay, fill: 'both', easing: 'linear' };
      swap.anims.push(el.querySelector('.pw')!.animate(k.X, opts), el.querySelector('.pb')!.animate(k.B, opts));
    };
    const nameOf = (k: number | null) => (k == null ? '' : HEAD_NAMES[k] ?? '');
    // A neutral card on the screen; the caption names the swap.
    this.ref('screen').innerHTML = `<div class="slide standby" aria-hidden="true"><i></i><b>Please stand by</b><span>${last ? 'End of presentations' : 'Changing presenters…'}</span></div>`;
    text(this.ref('who'), last ? 'Thank you' : nameOf(to));
    text(this.ref('slideN'), 'Changing over…');
    const line = first ? `${nameOf(to)} is setting up.` : last ? `${nameOf(from)} gathers the papers and shuffles off.` : `${nameOf(from)} hands over to ${nameOf(to)}. Awkwardly.`;
    text(this.ref('sayLine'), line);
    let T = 0;
    if (out) {
      // outgoing: tuck the pointer, glance, hesitate, shuffle off left
      out.classList.add('on', 'exit');
      out.classList.remove('enter', 'ready');
      walk(out, 0, [['h', 0, 520], ['m', -14, 220], ['h', 0, 160], ['m', -10, 160], ['m', 6, 90], ['h', 0, 130], ['m', -92, 520]], 0);
      at(500, () => this.bubble(out, 'um… bye', -8));
      at(1250, () => this.bubble(out, null));
      T = 1800;
    }
    if (inn) {
      // incoming: squeeze past with a "sorry" sidestep dance, then ahem and point
      inn.classList.add('on', 'enter');
      inn.classList.remove('exit', 'ready');
      if (out) {
        walk(inn, 270, [['m', -256, 700], ['h', 0, 60], ['m', 11, 80], ['m', -11, 80], ['m', 11, 80], ['m', -11, 80], ['m', -14, 220]], 350);
        at(1150, () => this.bubble(inn, 'sorry!', -26));
        at(1500, () => this.bubble(inn, null));
        T = 2050;
      } else {
        walk(inn, 270, [['m', -270, 700], ['h', 0, 100]], 0);
        T = 1150;
      }
      at(T - 380, () => {
        inn.classList.remove('enter');
        inn.classList.add('ready');
        this.bubble(inn, first ? 'tap tap' : 'ahem', first ? -18 : undefined);
      });
    }
    at(T, () => this.finishSwap());
  }

  // ---------- budget ----------

  private toBudget(): void {
    clearTimeout(this.presT);
    this.killSwap();
    this.heads = [];
    this.go('budget');
    this.root.classList.remove('swept');
    const s = this.ctx.state();
    const b = s.budget;
    if (!b) return;
    this.refreshBudgetHeader();
    // Working lines: keep a draft across closing and reopening within the same review; else the suggestion.
    this.presets = budgetPresets(s, this.ctx.t);
    if (this.draftQuarter !== b.quarter) {
      this.lines = { ...this.presets.suggested };
      this.draftQuarter = b.quarter;
    }
    this.income = N.toNumber(certifyTiers(s, this.ctx.t, editingPool(s, this.ctx.t), s.tierAllocation).income);
    this.buildPresets();
    this.potShown = -1;
    this.paintPot(s);
    this.paintLast();
    this.paintLines(true);
    this.queueForecast(0);
    this.later(() => this.root.classList.add('swept'), 200);
    this.say(N.toNumber(b.pot) > 0 ? `Budget review. The Bursar has ${count(N.toNumber(b.pot))} bananas in the pot to split.` : 'Budget review.');
  }

  private refreshBudgetHeader(): void {
    const b = this.ctx.state().budget;
    if (!b) return;
    text(this.ref('bq'), `Budget lines for Q${b.quarter}`);
    this.ref('intro').hidden = !!this.snap.report;
    this.ref('last').hidden = !this.snap.report;
    this.ref('lastH').hidden = !this.snap.report;
    if (this.snap.report) text(this.ref('title'), `End of Q${this.snap.report.quarter} · Executive Suite`);
    const missed = this.missedText();
    const m = this.ref('missed');
    m.hidden = !missed;
    m.textContent = missed;
  }

  private paintPot(s: GameState): void {
    const b = s.budget;
    if (!b) return;
    const pot = Math.floor(N.toNumber(b.pot));
    if (pot === this.potShown) return;
    this.potShown = pot;
    text(this.ref('pot'), pot > 0
      ? `Pot: ${count(pot)} bananas, the unspent wallet the Bursar swept up. Signing splits it by the lines below.`
      : 'The pot is empty, so there is nothing to split yet. The lines apply to income as it arrives.');
    this.paintLines(false);
  }

  /** Last quarter's report as plain facts. */
  private paintLast(): void {
    const r = this.snap.report;
    const dl = this.ref('last');
    if (!r) return;
    const q = r.requisitions;
    const row = (k: string, v: string) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    dl.innerHTML = row(`Q${r.quarter} income`, `${count(r.income)} bananas`) + row('Spent from the wallet', `${count(r.walletSpent)} bananas`) + row('Swept into the pot', `${count(r.swept)} bananas`) +
      row('Requisitions', q.offered ? `${count(q.offered)} filed: ${count(q.granted)} granted, ${count(q.declined)} declined, ${count(q.expired)} expired` : 'none filed');
  }

  private buildPresets(): void {
    const P = this.presets;
    const opts: { id: string; label: string; l: BudgetLines | null }[] = [
      { id: 'suggested', label: 'Suggested', l: P.suggested },
      { id: 'growth', label: 'Favour growth', l: P.growth },
      { id: 'editing', label: 'Favour editing', l: P.editing },
      { id: 'save', label: 'Save for a stage', l: P.save },
      { id: 'last', label: 'Same as last quarter', l: P.last },
    ];
    const box = this.ref('presets');
    box.innerHTML = '';
    for (const o of opts) {
      if (!o.l) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cer-btn';
      btn.dataset.preset = o.id;
      btn.innerHTML = `<span>${o.label}</span>`;
      const lines = o.l;
      btn.addEventListener('click', () => {
        this.lines = { ...lines };
        this.paintLines(true);
        this.queueForecast(60);
      });
      box.append(btn);
    }
  }

  private onSlider(input: HTMLInputElement, released: boolean): void {
    const k = input.dataset.k as LineId;
    this.lines = moveLine(this.ctx.t, this.lines, k, Number(input.value) / 100);
    this.paintLines(false, k);
    this.queueForecast(released ? 60 : FORECAST_IDLE_MS);
  }

  /** Paints the sliders, per-line figures, split bar and preset state. `skip` is the slider being dragged. */
  private paintLines(setSliders: boolean, skip?: LineId): void {
    const s = this.ctx.state();
    const b = s.budget;
    if (!b) return;
    const pct = percents(this.lines);
    const pot = N.toNumber(b.pot);
    const min = Math.ceil((this.ctx.t.budget?.minDiscretionary ?? 0) * 100 - 1e-9);
    for (const k of LINES) {
      const inp = this.root.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)!;
      if (k === 'discretionary') inp.min = String(min);
      if (setSliders || k !== skip) { if (inp.value !== String(pct[k])) inp.value = String(pct[k]); }
      inp.setAttribute('aria-valuetext', `${pct[k]} percent`);
      text(this.ref(`pc-${k}`), `${pct[k]}%`);
      const lr = k === 'discretionary' ? `wallet +${rate(this.income * this.lines[k])} · pot ${count(pot * this.lines[k])}` : `+${rate(this.income * this.lines[k])} · pot ${count(pot * this.lines[k])}`;
      text(this.ref(`lr-${k}`), lr);
    }
    const split = this.ref('split');
    const label = LINES.map((k) => `${NAMES[k]} ${pct[k]}%`).join(', ');
    attr(split, 'aria-label', `Budget split: ${label}`);
    if (!split.firstChild) {
      split.innerHTML = LINES.map((k) => `<i class="${k}"><span></span></i>`).join('');
    }
    LINES.forEach((k, i) => {
      const seg = split.children[i] as HTMLElement;
      const v = `${this.lines[k] * 100}%`;
      if (seg.style.flexBasis !== v) seg.style.flexBasis = v;
      text(seg.firstElementChild as HTMLElement, pct[k] >= 8 ? `${NAMES[k].slice(0, 1)} ${pct[k]}` : '');
    });
    for (const btn of this.all<HTMLButtonElement>('[data-preset]')) {
      const l = this.presets[btn.dataset.preset as keyof Presets];
      btn.setAttribute('aria-pressed', String(!!l && samePct(l, this.lines)));
    }
    this.paintSign();
  }

  private paintSign(): void {
    const ok = validLines(this.ctx.t, this.lines) && !this.signing;
    const sign = this.ref<HTMLButtonElement>('sign');
    if (sign.disabled === ok) sign.disabled = !ok;
    const why = this.ref('signWhy');
    why.hidden = ok || this.signing;
    if (!ok && !this.signing) why.textContent = `The lines must total 100% with Discretionary at least ${Math.ceil((this.ctx.t.budget?.minDiscretionary ?? 0) * 100)}%.`;
  }

  // ---------- the forecast (debounced: previewQuarter runs a whole quarter on a clone) ----------

  private queueForecast(ms: number): void {
    clearTimeout(this.forecastT);
    if (this.step !== 'budget') { this.forecastT = 0; return; }
    this.ref('proj').setAttribute('aria-busy', 'true');
    this.forecastT = window.setTimeout(() => this.runForecast(), ms) || 1;
  }

  private runForecast(): void {
    this.forecastT = 0;
    if (!this.opened || this.step !== 'budget') return;
    const s = this.ctx.state();
    const t0 = performance.now();
    const p = previewQuarter(s, this.ctx.t, this.lines);
    this.lastPreviewMs = performance.now() - t0;
    this.forecastTick = s.tick;
    this.income = N.toNumber(certifyTiers(s, this.ctx.t, editingPool(s, this.ctx.t), s.tierAllocation).income);
    this.paintForecast(s, p);
    this.ref('proj').setAttribute('aria-busy', 'false');
  }

  private paintForecast(s: GameState, p: QuarterPreview | null): void {
    const set = (k: string, v: string) => text(this.ref(`f-${k}`), v);
    if (!p) {
      for (const k of ['recruiting', 'construction', 'editing', 'pool', 'wallet', 'income']) set(k, '—');
      return;
    }
    for (const d of DEPTS) {
      const now = s.depts[d].level;
      const gain = p.levels[d];
      set(d, `${NAMES[d]}: level ${count(now)} → ${count(now + gain)} by quarter end (${gain >= 0 ? '+' : ''}${count(gain)} from its account)`);
    }
    const gap = p.demand - p.pool;
    set('pool', gap > 1e-9
      ? `Editing pool ${rate(p.pool)} against review demand ${rate(p.demand)} at quarter end: ▲ short by ${rate(gap)}`
      : `Editing pool ${rate(p.pool)} against review demand ${rate(p.demand)} at quarter end: ✓ covers it`);
    set('wallet', `Wallet: ${count(N.toNumber(s.bananas))} now → ${count(p.wallet)} at quarter end, if nothing is bought by hand`);
    set('income', `Income: ${rate(this.income)} now → ${rate(p.income)} at quarter end`);
  }

  // ---------- signing ----------

  private sign(): void {
    if (this.signing || this.step !== 'budget') return;
    const lines = { ...this.lines };
    if (!validLines(this.ctx.t, lines)) return;
    const quarter = this.ctx.state().budget?.quarter ?? this.snap.quarter;
    clearTimeout(this.forecastT);
    this.forecastT = 0;
    const ok = this.ctx.act((st, tu, sink) => signBudget(st, tu, sink, lines));
    if (!ok) {
      const why = this.ref('signWhy');
      why.hidden = false;
      why.textContent = 'Could not sign: this review has already closed.';
      return this.ended('This review has already closed.');
    }
    this.signing = true;
    this.step = 'signed';
    this.root.dataset.step = 'signed';
    text(this.ref('sign').firstElementChild as HTMLElement, 'Signed ✓');
    (this.ref('body') as HTMLElement & { inert: boolean }).inert = true;
    (this.root.querySelector('[data-foot="budget"]') as HTMLElement & { inert: boolean }).inert = true;
    this.root.focus({ preventScroll: true });
    text(this.ref('stampText'), `Q${quarter} begins`);
    this.root.classList.add('signed');
    this.later(() => {
      this.root.classList.add('qon');
      this.say(`Budget signed. Q${quarter} begins.`);
    }, this.rm.matches ? 150 : 650);
    this.later(() => this.close(), this.rm.matches ? 1800 : 2300);
  }
}
