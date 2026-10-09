import { registerSW } from 'virtual:pwa-register';
import { DEPTS, N, activeBudget, catchUp, certifyTiers, createState, deptLevelCost, editingPool, quarterSecondsLeft, type DeptId, type EventSink, type GameEvent, type GameState, upgradeSave } from '../core/index.js';
import { prototypeTuning } from '../content/prototype.js';
import { createCtx } from './ctx.js';
import { startLoop } from './loop.js';
import { AwayCard, awaySnap } from './away.js';
import { Ceremony } from './world/ceremony.js';
import { Cooler } from './world/cooler.js';
import { MemoView } from './world/memo.js';
import * as persist from './persist.js';
import { departments } from './screens/departments.js';
import { feed } from './screens/feed.js';
import { office } from './screens/office.js';
import { pool } from './screens/pool.js';
import { readiness } from './screens/readiness.js';
import { research } from './screens/research.js';
import { Payoffs } from './world/payoff.js';
import { HEAD_NAMES, projectTitle } from './world/projects.js';
import { text } from './ui/dom.js';
import * as f from './ui/format.js';
import { cueCandidates } from './world/advisor.js';
import { CueView } from './world/cue.js';
import { Ernest } from './world/ernest.js';
import { progress } from './world/progress.js';
import { RoomView, type Room } from './world/room.js';
import { Tower, floorProps, type BudgetView } from './world/tower.js';
import { Presenter } from './world/present.js';
import { floorHint } from './world/tower-art.js';

// The place is the interface: each floor of the building opens its room, full screen.
const ROOMS: Room[] = [
  { id: 'personnel', name: 'Personnel', form: 'Form 3-H', disc: 1, screen: office },
  { id: 'pool', name: 'Typing Pool', form: 'Form 7-T', disc: 2, screen: pool },
  { id: 'departments', name: 'Departments', form: 'Form 5-D', disc: 3, screen: departments },
  { id: 'research', name: 'Records Library', form: 'Form 4-R', disc: 4, screen: research },
  { id: 'director', name: "Director's Office", form: 'Form 9-R', disc: 5, screen: readiness },
];

const t = prototypeTuning;

const SAVE_EVERY_MS = 5000;
const FEED_H = 40;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- events ----------

// Kept for the M6 export, and fanned out to screens (feed, celebrations) and the floor.
const events: GameEvent[] = [];
const listeners = new Set<EventSink>();
const sink: EventSink = (e) => {
  events.push(e);
  for (const fn of listeners) fn(e);
};
const onEvent = (fn: EventSink) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ---------- state ----------

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

await persist.migrate();
const rec = await persist.load();
let state: GameState = rec ? rec.state : createState(t, newSeed());
// Saves from older builds lack fields added since; bring them up to date before anything reads them.
upgradeSave(state);
const returning = !!rec;

let dirty = true;
// What the building displays from jittery quantities (free desks, the bottleneck, full meters): steadied here, never rebuilt per flip.
const presenter = new Presenter();
const view = (snap = false) => presenter.view(floorProps(state, t), state.tick, snap);
const ctx = createCtx(() => state, t, sink, onEvent, () => {
  dirty = true;
  presenter.snap(); // the player acted: show the true values at once
});

// The feed subscribes before offline catch-up runs, so time away reaches the ticker.
const renderFeed = feed.mount($('feed'), ctx);
// Long gaps (a reload, a backgrounded tab) are summarised on a card: snapshot, catch up, hand the snapshot to the card.
let awayCard: AwayCard | null = null;
const earlyAway: { before: ReturnType<typeof awaySnap>; gone: number; ticks: number }[] = [];
function catchUpAway(s: GameState, tn: typeof t, sk: EventSink, gone: number): number {
  const before = awaySnap(s);
  const ticks = catchUp(s, tn, sk, gone);
  if (awayCard) awayCard.record(before, gone, ticks);
  else earlyAway.push({ before, gone, ticks });
  return ticks;
}
if (rec) catchUpAway(state, t, sink, Math.max(0, (Date.now() - rec.savedAt) / 1000));

// ---------- saving ----------

let saveFailed = false;
let resetting = false;
async function save(): Promise<void> {
  if (resetting) return;
  try {
    await persist.save(state);
    if (saveFailed) $('save-fail').hidden = true;
    saveFailed = false;
    text($('save-status'), `Saved ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
  } catch {
    saveFailed = true;
    $('save-fail').hidden = false;
    text($('save-status'), 'Save failed');
  }
}
setInterval(() => void save(), SAVE_EVERY_MS);
addEventListener('pagehide', () => void save());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void save();
});
$('save-retry').addEventListener('click', () => void save());

// ---------- the building ----------

// Budget header (before it is measured): Wallet label, and a reserved line for the pot.
{
  document.querySelector('.readout')!.classList.add('budget');
  $('r-ban-lb').textContent = 'Wallet';
  $('r-ban').parentElement!.setAttribute('aria-label', 'Wallet: bananas to spend on manual purchases');
}

const stage = $('stage');
const hdr = $('hdr');
const insetTop = () => hdr.offsetHeight + FEED_H;
const setHdr = () => document.documentElement.style.setProperty('--hdr', `${insetTop()}px`);
setHdr();
addEventListener('resize', setHdr);

let props = view(true);
const tower = new Tower($('map'));
tower.apply(props);

/** Opens the quarter-end ceremony : the roof quarter-clock calls this. */
function openReview(): void {
  const b = state.budget;
  if (!b?.reviewDue) {
    say(`Q${b?.quarter ?? 1} is still running.`);
    return;
  }
  closeDir();
  if (rooms.current) rooms.close();
  ceremony.open();
  dirty = true;
}
tower.onReview = openReview;

/** What the building shows of the budget; null before the budget opens. */
function budgetView(): BudgetView | null {
  const b = activeBudget(state, t);
  if (!t.budget || !b) return null;
  const accounts = {} as BudgetView['accounts'];
  for (const d of DEPTS) {
    const price = deptLevelCost(state, t, d);
    accounts[d] = { frac: N.ratio(b.accounts[d], price), balance: f.count(b.accounts[d]), price: f.count(price) };
  }
  // A waiting review stops the quarter clock: show the full quarter, never a countdown.
  const secondsLeft = b.reviewDue ? t.budget.quarterSeconds : quarterSecondsLeft(state, t);
  return { quarter: b.quarter, secondsLeft, frac: secondsLeft / t.budget.quarterSeconds, reviewDue: b.reviewDue, accounts };
}
tower.setBudget(budgetView());

// ---------- rooms ----------

const rooms = new RoomView(stage, ctx, () => props);
rooms.register(ROOMS);

// The quarter-end ceremony and the heads' memos. The water cooler runs in both modes.
const ceremony = new Ceremony(stage, ctx);
ceremony.onClose = () => (dirty = true);
const memo = new MemoView(stage, ctx);
awayCard = new AwayCard(stage, t, () => state);
awayCard.bind({ busy: () => ceremony.isOpen, openReview });
awayCard.onClose = () => (dirty = true);
for (const a of earlyAway.splice(0)) awayCard.record(a.before, a.gone, a.ticks);
const payoffs = new Payoffs(stage, ctx, {
  room: () => (rooms.current ? { id: rooms.current.id, el: rooms.el } : null),
  busy: () => ceremony.isOpen,
});
const cooler = new Cooler(tower.roof, ctx);
addEventListener('pointerdown', () => cooler.poke(), { capture: true });
addEventListener('keydown', () => cooler.poke(), { capture: true });
/** The Departments wing that opened the room, so focus can return to it. */
let lastDept: string | undefined;

function openRoom(id: string, dept?: string): void {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return;
  closeDir();
  lastDept = dept;
  props = view();
  rooms.open(room);
  progress.markOpened(id);
  if (cues.cue?.room === id) progress.ackCue(cues.cue.key);
  markDirectory(id);
  say(`${room.name} opened.`);
  dirty = true;
}
rooms.onClose = (room) => {
  tower.focusFloor(room.id, lastDept);
  markDirectory(null);
  say('Back in the building.');
  dirty = true;
};

tower.onOpen = (id, _from, dept) => {
  // A wing opens its own department's view; the cued department's view is used otherwise.
  if (id === 'departments') dispatchEvent(new CustomEvent('im:dept-view', { detail: dept ?? (cues.cue?.room === 'departments' ? cues.cue.view : undefined) ?? 'summary' }));
  openRoom(id, dept);
};
// Forms can send the player to another room ("Go to Departments").
addEventListener('im:goto', (e) => {
  const room = (e as CustomEvent<string>).detail;
  if (room === 'departments') dispatchEvent(new CustomEvent('im:dept-view', { detail: 'summary' }));
  openRoom(room);
});

// A department bought a level from its own account: flash it on its wing.
onEvent((e) => {
  if (e.type === 'purchase' && e.by === 'department') tower.flashAuto(e.item.split(':')[0] as DeptId);
});

// A manual hire: the candidate walks from the street into the lobby.
onEvent((e) => {
  if (e.type === 'hire' && e.manual) tower.hire(Math.floor(N.toNumber(state.monkeys)) - 1, view(true), !!rooms.current);
});

// ---------- header controls ----------

const dir = $('dir');
const dirbtn = $('dirbtn');
function closeDir(): void {
  dir.hidden = true;
  dirbtn.setAttribute('aria-expanded', 'false');
  $('reset-confirm').hidden = true;
}
const roomHint = (id: string): string => floorHint(id, props);
/** The Directory lists every floor; the list never changes, so it is built once. */
function buildDir(): void {
  $('dirlist').innerHTML = ROOMS.map((r) => `<li><button data-room="${r.id}" aria-current="false"><span class="disc" aria-hidden="true">${r.disc}</span><span class="nm">${r.name}<span class="hn"></span></span></button></li>`).join('');
  $('dir-range').textContent = `The Bureau · Floors 1–${ROOMS.length}`;
  $('dir-more').textContent = String(ROOMS.length + 1);
  markDirectory(rooms.current?.id ?? null);
}
function markDirectory(id: string | null): void {
  for (const b of dir.querySelectorAll<HTMLElement>('[data-room]')) b.setAttribute('aria-current', String(b.dataset.room === id));
}
buildDir();
dirbtn.addEventListener('click', () => {
  const opening = dir.hidden;
  dir.hidden = !opening;
  dirbtn.setAttribute('aria-expanded', String(opening));
  if (opening) for (const b of dir.querySelectorAll<HTMLElement>('[data-room]')) b.querySelector('.hn')!.textContent = roomHint(b.dataset.room!);
});
/** The Directory's "Needs you" rows: whatever is waiting on the Director, each with a route to it. */
const dirTasks = $('dirtasks');
let tasksKey = '';
function renderTasks(): void {
  const b = state.budget;
  const items: { task: string; mark: string; name: string; hint: string }[] = [];
  if (b?.reviewDue) items.push({ task: 'review', mark: '!', name: 'Quarterly review', hint: `Q${b.quarter} is ready to sign.` });
  const q = b?.requisition;
  if (q && document.querySelector('.memo-dock:not([hidden])')) items.push({ task: 'memo', mark: '!', name: 'Open request', hint: `${HEAD_NAMES[q.from]}: ${q.kind === 'levels' ? 'department levels' : projectTitle(q.kind)}.` });
  if (b?.lastReport) items.push({ task: 'report', mark: '§', name: "Last quarter's report", hint: `Q${b.lastReport.quarter}, filed in the Director's Office.` });
  const key = JSON.stringify(items);
  if (key === tasksKey) return;
  tasksKey = key;
  $('dirtasks-box').hidden = !items.length;
  dirTasks.innerHTML = items.map((i) => `<li><button data-task="${i.task}"><span class="disc" aria-hidden="true">${i.mark}</span><span class="nm">${i.name}<span class="hn">${i.hint}</span></span></button></li>`).join('');
}
dirTasks.addEventListener('click', (e) => {
  const task = (e.target as HTMLElement).closest<HTMLElement>('[data-task]')?.dataset.task;
  if (task === 'review') openReview();
  else if (task === 'report') {
    openRoom('director');
    requestAnimationFrame(() => dispatchEvent(new CustomEvent('im:director-report')));
  }
  else if (task === 'memo') {
    // The memo is a docked paper tab (memo.ts); open it unless it already is.
    closeDir();
    const tab = document.querySelector<HTMLButtonElement>('.memo-dock:not([hidden]) .memo-tab');
    if (tab) {
      if (tab.getAttribute('aria-expanded') !== 'true') tab.click();
      tab.focus({ preventScroll: true });
    }
  }
});
$('dirlist').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-room]');
  if (b) openRoom(b.dataset.room!);
});
document.addEventListener('pointerdown', (e) => {
  if (!dir.hidden && !(e.target as HTMLElement).closest('#dir, #dirbtn')) closeDir();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (ceremony.isOpen || awayCard?.isOpen) return; // the ceremony and the away card handle their own Escape
  // Escape leaves an open room even when focus has left it (e.g. a button that just disabled itself).
  if (rooms.current) {
    if (!rooms.el.contains(document.activeElement)) rooms.close();
    return;
  }
  if (!dir.hidden) { closeDir(); dirbtn.focus(); }
});

$('reset-why').textContent = "This erases every monkey, desk, banana and discovery in the save on this device. It can't be undone.";

// Reset is destructive: it asks first (MOBILE-UX rule 1). 
$('reset').addEventListener('click', () => {
  $('reset-confirm').hidden = false;
  $('reset-no').focus();
});
$('reset-no').addEventListener('click', () => {
  $('reset-confirm').hidden = true;
  $('reset').focus();
});
$('reset-yes').addEventListener('click', async () => {
  resetting = true;
  await persist.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('im:')) localStorage.removeItem(k);
  } catch {}
  location.reload();
});

// ---------- Ernest ----------

const ernest = new Ernest($('ewrap'), ctx, t);

// ---------- the next-thing cue ----------

const cues = new CueView(tower, $('dir'));
const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;
function updateCue(): void {
  const open = rooms.current?.id;
  // The first cue the player hasn't already acted on; a cue for the open room is acted on.
  let cue = null;
  for (const c of cueCandidates(ctx)) {
    if (progress.ackedCue(c.key)) continue;
    if (c.room === open) {
      progress.ackCue(c.key);
      continue;
    }
    cue = c;
    break;
  }
  const changed = cue?.key !== cues.cue?.key;
  cues.show(cue);
  if (changed && cue) say(`${cue.tag}: ${roomName(cue.room)}.`);
}
// Reels about Editors open the Editing view; other Departments reels open the summary.
ernest.onOpenRoom = (room, reel) => {
  if (room === 'departments') dispatchEvent(new CustomEvent('im:dept-view', { detail: reel === 'finds-need-editors' ? 'editing' : 'summary' }));
  openRoom(room);
};

// ---------- live region ----------

function say(msg: string): void {
  const l = $('live');
  l.textContent = '';
  window.setTimeout(() => (l.textContent = msg), 30);
}

// ---------- the loop ----------

function renderHeader(): void {
  text($('r-ban'), f.count(state.bananas));
  const pot = state.budget?.pot;
  const show = !!pot && N.gt(pot, N.zero);
  $('r-pot').hidden = !show;
  if (show) text($('r-pot-v'), f.count(pot!));
  text($('r-inc'), f.rate(certifyTiers(state, t, editingPool(state, t), state.tierAllocation).income));
  // After 'tall', the finish line needs a headcount: show it as progress toward the Permit's minimum.
  const goal = state.milestonesReached.includes('tall') && state.phase === 'finite';
  text($('r-mon'), f.count(state.monkeys));
  const bar = $('r-goal');
  bar.hidden = !goal;
  if (goal) {
    const frac = Math.min(1, N.toNumber(state.monkeys) / t.readiness.minMonkeys);
    bar.style.setProperty('--fill', `${(frac * 100).toFixed(1)}%`);
    bar.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    bar.setAttribute('aria-valuetext', `${f.count(state.monkeys)} of ${f.count(t.readiness.minMonkeys)} monkeys for the Permit`);
  }
}

let lastTick = -1;
startLoop(() => state, t, sink, () => {
  if (!dirty && state.tick === lastTick) return;
  dirty = false;
  lastTick = state.tick;
  renderHeader();
  renderFeed();
  props = view();
  tower.apply(props);
  tower.setBudget(budgetView());
  rooms.render();
  if (ceremony.isOpen) ceremony.render();
  awayCard?.render();
  memo.render();
  renderTasks();
  document.body.classList.toggle('has-memo', !!document.querySelector('.memo-dock:not([hidden])'));
  payoffs.render();
  // The cooler waits for rooms, the ceremony, a payoff, Ernest's card, and the clock's own "Review ready" tag (it shares the roof).
  cooler.suppressed = awayCard?.isOpen || !!rooms.current || ceremony.isOpen || payoffs.active || ernest.showing || !!state.budget?.reviewDue;
  cooler.render();
  ernest.update(rooms.current?.id ?? null);
  updateCue();
}, catchUpAway);

// Dev-only console hook for testing at later game states. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    im: {
      state: () => state,
      setState: (next: GameState) => {
        state = next;
        dirty = true;
      },
      run: (seconds: number) => catchUp(state, t, sink, seconds),
      away: (seconds: number) => catchUpAway(state, t, sink, seconds),
      emit: (e: GameEvent) => sink(e),
      open: openRoom,
      openReview,
      t,
    },
  });
}

// ---------- builds and updates ----------

const UPDATE_CHECK_MS = 10 * 60 * 1000;
const built = new Date(__BUILD_TIME__);
$('build').textContent = `${__BUILD_SHA__} · ${built.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

// The browser only checks for a new service worker on navigation, so an
// installed app left open would never notice a deploy. Check on return to
// the app, on a timer, and on demand.
let registration: ServiceWorkerRegistration | undefined;
const checkForUpdate = () => registration?.update().catch(() => {});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void checkForUpdate();
});
setInterval(checkForUpdate, UPDATE_CHECK_MS);

const updateSW = registerSW({
  onRegisteredSW(_url, r) {
    registration = r;
  },
  onNeedRefresh() {
    $('update').hidden = false;
    $('update-status').textContent = '';
  },
});

$('check-update').addEventListener('click', async () => {
  const status = $('update-status');
  if (!registration) {
    status.textContent = 'Updates unavailable here';
    return;
  }
  status.textContent = 'Checking…';
  await checkForUpdate();
  if (registration.installing || registration.waiting) status.textContent = 'Downloading update…';
  else if ($('update').hidden) status.textContent = 'Up to date';
});

// Export: the whole save as JSON, for sending to the developer. Share sheet on phones, else clipboard, else a download.
$('export-save').addEventListener('click', async () => {
  const status = $('export-status');
  await save();
  const json = JSON.stringify({ schemaVersion: persist.SCHEMA_VERSION, build: __BUILD_SHA__, exportedAt: new Date().toISOString(), state });
  const name = `infinite-monkeys-save-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Infinite Monkeys save' });
      status.textContent = 'Save shared.';
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') { status.textContent = ''; return; }
  }
  try {
    await navigator.clipboard.writeText(json);
    status.textContent = `Save copied to the clipboard (${Math.round(json.length / 1024)} KB).`;
    return;
  } catch { /* fall through to a download */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  status.textContent = 'Save downloaded.';
});

$('reload').addEventListener('click', async () => {
  await save();
  await updateSW(true);
});
