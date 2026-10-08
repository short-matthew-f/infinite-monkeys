import { registerSW } from 'virtual:pwa-register';
import { N, catchUp, certifyTiers, createState, deskCost, editingPool, type EventSink, type GameEvent, type GameState } from '../core/index.js';
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
import { Camera, type Pose } from './world/camera.js';
import { Ernest } from './world/ernest.js';
import { FLOOR_H, FLOOR_W } from './world/floor-art.js';
import { FloorView, floorProps } from './world/floor.js';
import { SheetHost, type Room } from './world/sheet.js';

// The place is the interface: each room on the floor opens its screen in a paper sheet.
const ROOMS: Room[] = [
  { id: 'personnel', name: 'Personnel', form: 'Form 3-H', disc: 1, screen: office },
  { id: 'pool', name: 'Typing Pool', form: 'Form 7-T', disc: 2, screen: pool },
  { id: 'departments', name: 'Departments', form: 'Form 5-D', disc: 3, screen: departments },
  { id: 'research', name: 'Records Library', form: 'Form 4-R', disc: 4, screen: research },
  { id: 'director', name: "Director's Office", form: 'Form 9-R', disc: 5, screen: readiness },
];
const CHIPS: Record<string, string> = { personnel: 'Personnel', pool: 'Typing<br>Pool', departments: 'Departments', research: 'Records<br>Library', director: 'Director' };

const SAVE_EVERY_MS = 5000;
const PLAY_SCALE = 1.04;
const FEED_H = 40;
const CAM_KEY = 'im:camera';
const INTRO_MS = 1200;

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

// ---------- the world ----------

const stage = $('stage');
const hdr = $('hdr');
const insetTop = () => hdr.offsetHeight + FEED_H;
const setHdr = () => document.documentElement.style.setProperty('--hdr', `${insetTop()}px`);
setHdr();
addEventListener('resize', setHdr);

const floor = new FloorView(
  document.getElementById('world') as unknown as SVGGElement,
  document.getElementById('fx') as unknown as SVGGElement,
  $('cam'),
  $('chips'),
  Object.fromEntries(ROOMS.map((r) => [r.id, { name: r.name, disc: r.disc, chip: CHIPS[r.id] ?? r.name }])),
);
floor.apply(floorProps(state, t));

let planMode = false;
const camera: Camera = new Camera({
  stage,
  world: $('cam'),
  size: [FLOOR_W, FLOOR_H],
  playScale: PLAY_SCALE,
  insets: () => ({ top: insetTop(), bottom: planMode ? 58 : 0 }),
  onSettle: ([x, y, s], mode) => {
    floor.placeChips(x, y, s, mode === 'plan');
    if (mode === 'play' && !sheets.current) {
      try {
        localStorage.setItem(CAM_KEY, JSON.stringify([x, y, s]));
      } catch {}
    }
  },
  onMode: (m) => {
    planMode = m === 'plan';
    $('planbtn').setAttribute('aria-label', m === 'plan' ? 'Back: return to the close-up view' : 'Floor plan: see the whole floor');
    say(m === 'plan' ? 'Floor plan. All five rooms are in view. Tap a room to go there.' : 'Back to the close-up view.');
  },
});
camera.measure('.area');

/** Play-view pose for a room, from the zone's camera anchor. */
function playPose(id: string): Pose {
  const z = floor.zone(id);
  if (!z) return [camera.x, camera.y, PLAY_SCALE];
  const [wx, wy, at] = z.cam;
  const sy = at === 'top' ? insetTop() : (insetTop() + camera.vh) / 2;
  const [x, y] = camera.clampPose(camera.vw / 2 - wx * PLAY_SCALE, sy - wy * PLAY_SCALE, PLAY_SCALE);
  return [x, y, PLAY_SCALE];
}
camera.pinchIn = (wx: number, wy: number): Pose => {
  let best = 'personnel', bd = Infinity;
  for (const z of floor.zones) {
    const d = Math.hypot(z.centre[0] - wx, z.centre[1] - wy);
    if (d < bd) { bd = d; best = z.id; }
  }
  return playPose(best);
};

// ---------- sheets ----------

const sheets = new SheetHost(stage, ctx);
sheets.register(ROOMS);
let beforeSheet: Pose | null = null;

function frameOpenRoom(): void {
  const room = sheets.current;
  const z = room && floor.zone(room.id);
  if (z) void camera.fly(camera.frame(z.frame, sheets.cover()));
}

function openRoom(id: string, from?: HTMLElement | null): void {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return;
  closeDir();
  if (!sheets.current) beforeSheet = camera.mode === 'plan' ? playPose(id) : [camera.x, camera.y, camera.s];
  if (camera.mode === 'plan') camera.setMode('play');
  if (sheets.current) document.getElementById(`z-${sheets.current.id}`)?.classList.remove('pop', 'active');
  document.getElementById(`z-${id}`)?.classList.add('pop', 'active');
  sheets.open(room, from);
  frameOpenRoom();
  markDirectory(id);
  say(`${room.name} opened.`);
  dirty = true;
}
sheets.onClose = (room) => {
  document.getElementById(`z-${room.id}`)?.classList.remove('pop', 'active');
  if (beforeSheet) void camera.fly(beforeSheet);
  beforeSheet = null;
  markDirectory(null);
  dirty = true;
};

floor.onZone = (id, from) => {
  if (camera.dragged) return;
  if (camera.mode === 'plan') void camera.toPlay(playPose(id));
  else openRoom(id, from);
};
floor.onWalk = (box) => {
  if (sheets.current?.id !== 'personnel') return;
  // Pull back enough to see the walker, but never so far the monkeys turn to specks.
  if (box) void camera.fly(camera.frame(box, sheets.cover(), PLAY_SCALE, 0.62));
  else window.setTimeout(() => { if (sheets.current?.id === 'personnel') frameOpenRoom(); }, 500);
};

// A manual hire: the candidate walks from the entrance to the new desk.
onEvent((e) => {
  if (e.type === 'hire' && e.manual) floor.hire(Math.floor(N.toNumber(state.monkeys)) - 1, floorProps(state, t));
});

// ---------- header controls ----------

$('planbtn').addEventListener('click', () => {
  endIntro();
  closeDir();
  void (camera.mode === 'plan' ? camera.toPlay() : camera.toPlan());
});

const dir = $('dir');
const dirbtn = $('dirbtn');
function closeDir(): void {
  dir.hidden = true;
  dirbtn.setAttribute('aria-expanded', 'false');
  $('reset-confirm').hidden = true;
}
function roomHint(id: string): string {
  const s = state;
  const seated = Math.floor(N.toNumber(s.monkeys)), desks = Math.floor(N.toNumber(s.desks));
  switch (id) {
    case 'personnel': return desks > seated ? `${f.count(desks - seated)} desk${desks - seated === 1 ? '' : 's'} free` : 'Every desk is taken';
    case 'pool': return `${f.count(seated)} seated`;
    case 'departments': return 'Recruiting, Construction, Editing';
    case 'research': return `${Object.values(s.tiers).filter((x) => x.discovered).length} of ${t.tiers.length} tiers discovered`;
    case 'director': return s.stability.permit ? 'Permit stamped' : 'Readiness and the Permit';
    default: return '';
  }
}
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
  if (b) openRoom(b.dataset.room!, dirbtn);
});
document.addEventListener('pointerdown', (e) => {
  if (!dir.hidden && !(e.target as HTMLElement).closest('#dir, #dirbtn')) closeDir();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || sheets.current) return;
  if (!dir.hidden) { closeDir(); dirbtn.focus(); }
  else if (camera.mode === 'plan') void camera.toPlay();
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
    localStorage.removeItem(CAM_KEY);
    localStorage.removeItem('im:ernest-reel1');
  } catch {}
  location.reload();
});

// ---------- Ernest ----------

const ernest = new Ernest($('ewrap'), $('esay'), $('ernest-ok'));

// ---------- live region ----------

function say(msg: string): void {
  const l = $('live');
  l.textContent = '';
  window.setTimeout(() => (l.textContent = msg), 30);
}

// ---------- first load ----------

let intro = 0;
function endIntro(): void {
  window.clearTimeout(intro);
  intro = 0;
}
let saved: Pose | null = null;
try {
  const v = JSON.parse(localStorage.getItem(CAM_KEY) ?? 'null') as unknown;
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) saved = v as unknown as Pose;
} catch {}
if (returning && saved) {
  camera.jump(saved);
} else {
  // A new Bureau: the floor plan for a beat, so the player sees there are five rooms, then down to Personnel.
  camera.setMode('plan');
  camera.jump(camera.planPose());
  intro = window.setTimeout(() => {
    intro = 0;
    void camera.toPlay(playPose('personnel'));
  }, INTRO_MS);
}

// ---------- the loop ----------

function renderHeader(): void {
  text($('r-ban'), f.count(state.bananas));
  text($('r-inc'), f.rate(certifyTiers(state, t, editingPool(state, t), state.tierAllocation).income));
  text($('r-mon'), f.count(state.monkeys));
}

let lastTick = -1;
startLoop(() => state, t, sink, () => {
  if (!dirty && state.tick === lastTick) return;
  dirty = false;
  lastTick = state.tick;
  renderHeader();
  renderFeed();
  if (floor.apply(floorProps(state, t))) camera.measure('.area');
  sheets.render();
  const seated = Math.floor(N.toNumber(state.monkeys)), desks = Math.floor(N.toNumber(state.desks));
  ernest.update({
    needed: floorProps(state, t).tutorial,
    open: sheets.current?.id ?? null,
    freeDesk: desks > seated,
    deskPrice: f.bananaText(deskCost(state, t)),
  });
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
      camera,
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
