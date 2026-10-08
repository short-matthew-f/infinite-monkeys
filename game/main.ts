import { registerSW } from 'virtual:pwa-register';
import { N, catchUp, certifyTiers, createState, editingPool, type EventSink, type GameEvent, type GameState } from '../core/index.js';
import { prototypeTuning as t } from '../content/prototype.js';
import { createCtx } from './ctx.js';
import { startLoop } from './loop.js';
import * as persist from './persist.js';
import { departments } from './screens/departments.js';
import { feed } from './screens/feed.js';
import { office } from './screens/office.js';
import { pool } from './screens/pool.js';
import { readiness } from './screens/readiness.js';
import { research } from './screens/research.js';
import { text } from './ui/dom.js';
import * as f from './ui/format.js';
import { cueCandidates } from './world/advisor.js';
import { CueView } from './world/cue.js';
import { Ernest } from './world/ernest.js';
import { progress } from './world/progress.js';
import { RoomView, type Room } from './world/room.js';
import { Tower, floorProps } from './world/tower.js';
import { floorHint } from './world/tower-art.js';

// The place is the interface: each floor of the building opens its room, full screen.
const ROOMS: Room[] = [
  { id: 'personnel', name: 'Personnel', form: 'Form 3-H', disc: 1, screen: office },
  { id: 'pool', name: 'Typing Pool', form: 'Form 7-T', disc: 2, screen: pool },
  { id: 'departments', name: 'Departments', form: 'Form 5-D', disc: 3, screen: departments },
  { id: 'research', name: 'Records Library', form: 'Form 4-R', disc: 4, screen: research },
  { id: 'director', name: "Director's Office", form: 'Form 9-R', disc: 5, screen: readiness },
];

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

const rec = await persist.load();
let state: GameState = rec ? rec.state : createState(t, newSeed());
const returning = !!rec;

let dirty = true;
const ctx = createCtx(() => state, t, sink, onEvent, () => (dirty = true));

// The feed subscribes before offline catch-up runs, so time away reaches the ticker.
const renderFeed = feed.mount($('feed'), ctx);
if (rec) catchUp(state, t, sink, (Date.now() - rec.savedAt) / 1000);

// ---------- saving ----------

let saveFailed = false;
async function save(): Promise<void> {
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

const stage = $('stage');
const hdr = $('hdr');
const insetTop = () => hdr.offsetHeight + FEED_H;
const setHdr = () => document.documentElement.style.setProperty('--hdr', `${insetTop()}px`);
setHdr();
addEventListener('resize', setHdr);

let props = floorProps(state, t);
const tower = new Tower($('map'));
tower.apply(props);

// ---------- rooms ----------

const rooms = new RoomView(stage, ctx, () => props);
rooms.register(ROOMS);
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
const roomHint = (id: string): string => floorHint(id, floorProps(state, t));
$('dirlist').innerHTML = ROOMS.map((r) => `<li><button data-room="${r.id}" aria-current="false"><span class="disc" aria-hidden="true">${r.disc}</span><span class="nm">${r.name}<span class="hn"></span></span></button></li>`).join('');
function markDirectory(id: string | null): void {
  for (const b of dir.querySelectorAll<HTMLElement>('[data-room]')) b.setAttribute('aria-current', String(b.dataset.room === id));
}
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
  // Escape leaves an open room even when focus has left it (e.g. a button that just disabled itself).
  if (rooms.current) {
    if (!rooms.el.contains(document.activeElement)) rooms.close();
    return;
  }
  if (!dir.hidden) { closeDir(); dirbtn.focus(); }
});

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
  rooms.render();
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
