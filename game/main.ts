import { registerSW } from 'virtual:pwa-register';
import { catchUp, certifyTiers, createState, editingPool, type EventSink, type GameEvent, type GameState } from '../core/index.js';
import { prototypeTuning as t } from '../content/prototype.js';
import { createCtx, type Screen } from './ctx.js';
import { startLoop } from './loop.js';
import * as persist from './persist.js';
import { departments } from './screens/departments.js';
import { diorama } from './screens/diorama.js';
import { feed } from './screens/feed.js';
import { office } from './screens/office.js';
import { pool } from './screens/pool.js';
import { readiness } from './screens/readiness.js';
import { research } from './screens/research.js';
import { h, text } from './ui/dom.js';
import * as f from './ui/format.js';

// Screen registry. Tabs in nav order; chrome screens mount into fixed slots.
const TABS: Screen[] = [office, pool, departments, research, readiness];
const CHROME: Record<string, Screen> = { diorama, feed };

const SAVE_EVERY_MS = 5000;
const TAB_KEY = 'im:tab';

// ---------- events ----------

// Kept for the M6 export, and fanned out to screens (feed, celebrations).
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

// ---------- state and saving ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

let state: GameState;
const rec = await persist.load();
if (rec) {
  state = rec.state;
  catchUp(state, t, sink, (Date.now() - rec.savedAt) / 1000);
} else {
  state = createState(t, newSeed());
}

const save = () => void persist.save(state);
setInterval(save, SAVE_EVERY_MS);
addEventListener('pagehide', save);
// The loop catches up after background time; here we only save on hide.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});

$('reset').addEventListener('click', async () => {
  await persist.clear();
  state = createState(t, newSeed());
  events.length = 0;
  dirty = true;
});

// ---------- screens ----------

let dirty = true;
const ctx = createCtx(() => state, t, sink, onEvent, () => (dirty = true));
const renders: (() => void)[] = [];

for (const [slot, screen] of Object.entries(CHROME)) {
  renders.push(screen.mount($(slot), ctx));
}

const tabButtons = new Map<string, HTMLButtonElement>();
const panes = new Map<string, HTMLElement>();
const tabRenders = new Map<string, () => void>();
for (const screen of TABS) {
  const pane = h('section', { class: 'screen', id: `screen-${screen.id}`, 'aria-label': screen.label });
  $('screens').append(pane);
  panes.set(screen.id, pane);
  tabRenders.set(screen.id, screen.mount(pane, ctx));
  const btn = h('button', { onclick: () => show(screen.id) }, screen.label);
  $('tabs').append(btn);
  tabButtons.set(screen.id, btn);
}

let current = '';
function show(id: string) {
  if (!panes.has(id)) id = TABS[0]?.id ?? '';
  if (current && current !== id) scrollTo(0, 0);
  current = id;
  for (const [k, pane] of panes) pane.hidden = k !== id;
  for (const [k, btn] of tabButtons) {
    if (k === id) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch {}
  dirty = true;
}
let savedTab = '';
try {
  savedTab = localStorage.getItem(TAB_KEY) ?? '';
} catch {}
show(savedTab);
if (TABS.length < 2) $('tabs').hidden = true;

function renderHeader() {
  text($('bananas'), f.count(state.bananas));
  text($('income'), f.rate(certifyTiers(state, t, editingPool(state, t), state.tierAllocation).income));
  text($('monkeys'), f.count(state.monkeys));
}

// Render at most once per tick (10 Hz) or after an action, not every frame.
let lastTick = -1;
startLoop(() => state, t, sink, () => {
  if (!dirty && state.tick === lastTick) return;
  dirty = false;
  lastTick = state.tick;
  renderHeader();
  for (const r of renders) r();
  tabRenders.get(current)?.();
});

// Dev-only console hook for testing screens at later game states. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    im: {
      state: () => state,
      setState: (next: GameState) => {
        state = next;
        dirty = true;
      },
      run: (seconds: number) => catchUp(state, t, sink, seconds),
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
  await persist.save(state);
  await updateSW(true);
});
