import { registerSW } from 'virtual:pwa-register';
import { DEPTS, N, activeBudget, catchUp, certifyTiers, createState, deptLevelCost, editingPool, quarterSecondsLeft, type DeptId, type EventSink, type GameEvent, type GameState, upgradeSave } from '../core/index.js';
import { prototypeTuning } from '../content/prototype.js';
import { createCtx } from './ctx.js';
import { startLoop } from './loop.js';
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
import { accounting, facilities, training } from './screens/admin.js';
import { Payoffs } from './world/payoff.js';
import { OFFICE_IDS } from './world/projects.js';
import { text } from './ui/dom.js';
import * as f from './ui/format.js';
import { cueCandidates } from './world/advisor.js';
import { CueView } from './world/cue.js';
import { Ernest } from './world/ernest.js';
import { progress } from './world/progress.js';
import { RoomView, type Room } from './world/room.js';
import { Tower, directorFloor, floorProps, type BudgetView } from './world/tower.js';
import { floorHint, officeHint } from './world/tower-art.js';

// The place is the interface: each floor of the building opens its room, full screen.
const ROOMS: Room[] = [
  { id: 'personnel', name: 'Personnel', form: 'Form 3-H', disc: 1, screen: office },
  { id: 'pool', name: 'Typing Pool', form: 'Form 7-T', disc: 2, screen: pool },
  { id: 'departments', name: 'Departments', form: 'Form 5-D', disc: 3, screen: departments },
  { id: 'research', name: 'Records Library', form: 'Form 4-R', disc: 4, screen: research },
  // The Administration floor appears with the budget; its three offices are all on floor 5.
  { id: 'facilities', name: 'Facilities Office', form: 'Form 2-F', disc: 5, screen: facilities },
  { id: 'accounting', name: 'Accounting Office', form: 'Form 1-A', disc: 5, screen: accounting },
  { id: 'training', name: 'Training Office', form: 'Form 6-T', disc: 5, screen: training },
  // The Director's Office moves up a floor when the Administration floor is built beneath it.
  { id: 'director', name: "Director's Office", form: 'Form 9-R', get disc() { return directorFloor(!!state.office); }, screen: readiness },
];
const isOffice = (id: string): boolean => (OFFICE_IDS as readonly string[]).includes(id);

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
const ctx = createCtx(() => state, t, sink, onEvent, () => (dirty = true));

// The feed subscribes before offline catch-up runs, so time away reaches the ticker.
const renderFeed = feed.mount($('feed'), ctx);
if (rec) catchUp(state, t, sink, (Date.now() - rec.savedAt) / 1000);

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

let props = floorProps(state, t);
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
  const secondsLeft = quarterSecondsLeft(state, t);
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
const payoffs = new Payoffs(stage, ctx, {
  room: () => (rooms.current ? { id: rooms.current.id, el: rooms.el } : null),
  busy: () => ceremony.isOpen,
});
const cooler = new Cooler(stage, ctx);
addEventListener('pointerdown', () => cooler.poke(), { capture: true });
addEventListener('keydown', () => cooler.poke(), { capture: true });
/** The Departments wing that opened the room, so focus can return to it. */
let lastDept: string | undefined;

function openRoom(id: string, dept?: string): void {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return;
  closeDir();
  lastDept = dept;
  props = floorProps(state, t);
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
  // An Administration wing opens that office's room.
  if (id === 'admin') return openRoom(dept ?? 'facilities', dept);
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
  if (e.type === 'hire' && e.manual) tower.hire(Math.floor(N.toNumber(state.monkeys)) - 1, floorProps(state, t), !!rooms.current);
});

// ---------- header controls ----------

const dir = $('dir');
const dirbtn = $('dirbtn');
function closeDir(): void {
  dir.hidden = true;
  dirbtn.setAttribute('aria-expanded', 'false');
  $('reset-confirm').hidden = true;
}
const roomHint = (id: string): string => (isOffice(id) ? officeHint(id as (typeof OFFICE_IDS)[number], floorProps(state, t)) : floorHint(id, floorProps(state, t)));
/** The Directory lists the Administration offices only once the budget has opened. */
let dirAdmin: boolean | null = null;
function buildDir(): void {
  const admin = !!state.office;
  if (admin === dirAdmin) return;
  dirAdmin = admin;
  $('dirlist').innerHTML = ROOMS.filter((r) => admin || !isOffice(r.id)).map((r) => `<li><button data-room="${r.id}" aria-current="false"><span class="disc" aria-hidden="true">${r.disc}</span><span class="nm">${r.name}<span class="hn"></span></span></button></li>`).join('');
  $('dir-range').textContent = `The Bureau · Floors 1–${admin ? 6 : 5}`;
  $('dir-more').textContent = String(admin ? 7 : 6);
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
$('dirlist').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-room]');
  if (b) openRoom(b.dataset.room!);
});
document.addEventListener('pointerdown', (e) => {
  if (!dir.hidden && !(e.target as HTMLElement).closest('#dir, #dirbtn')) closeDir();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (ceremony.isOpen) return; // the ceremony handles its own Escape
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
  props = floorProps(state, t);
  tower.apply(props);
  tower.setBudget(budgetView());
  rooms.render();
  if (ceremony.isOpen) ceremony.render();
  memo.render();
  buildDir();
  payoffs.render();
  cooler.suppressed = !!rooms.current || ceremony.isOpen || payoffs.active;
  cooler.render();
  ernest.update(rooms.current?.id ?? null);
  updateCue();
});

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

$('reload').addEventListener('click', async () => {
  await save();
  await updateSW(true);
});
