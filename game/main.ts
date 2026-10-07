import { registerSW } from 'virtual:pwa-register';
import {
  N,
  buyDesk,
  catchUp,
  createState,
  deskCost,
  nullSink,
  tapHire,
  type GameEvent,
  type GameState,
  type Num,
} from '../core/index.js';
import { prototypeTuning as t } from '../content/prototype.js';
import { startLoop } from './loop.js';
import * as persist from './persist.js';

const SAVE_EVERY_MS = 5000;

// Events drive UI feedback later and are kept for the M6 export.
const events: GameEvent[] = [];
const sink = (e: GameEvent) => {
  events.push(e);
};

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: Num) => Math.floor(N.toNumber(n)).toLocaleString();

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

// Background tabs pause rAF: on return, save time is the baseline for catch-up.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    save();
  } else if (hiddenAt) {
    catchUp(state, t, sink, (Date.now() - hiddenAt) / 1000);
    hiddenAt = 0;
  }
});

$('hire').addEventListener('click', () => tapHire(state, t, sink));
$('desk').addEventListener('click', () => buyDesk(state, t, sink));
$('reset').addEventListener('click', async () => {
  await persist.clear();
  state = createState(t, newSeed());
  events.length = 0;
});

// Core decides what's allowed: dry-run the action on a clone (HANDOFF rule 3).
function allowed(action: (s: GameState, tt: typeof t, k: typeof nullSink) => boolean): boolean {
  return action(structuredClone(state), t, nullSink);
}

const hireBtn = $<HTMLButtonElement>('hire');
const deskBtn = $<HTMLButtonElement>('desk');
function render() {
  $('bananas').textContent = fmt(state.bananas);
  $('monkeys').textContent = fmt(state.monkeys);
  $('desks').textContent = fmt(state.desks);
  const cost = deskCost(state, t);
  $('desk-cost').textContent = `(${fmt(cost)})`;
  hireBtn.disabled = !allowed(tapHire);
  deskBtn.disabled = !allowed(buyDesk);
  $('tick').textContent = `tick ${state.tick}`;
}

startLoop(() => state, t, sink, render);

const updateSW = registerSW({
  onNeedRefresh() {
    $('update').hidden = false;
  },
});
$('reload').addEventListener('click', () => {
  save();
  void updateSW(true);
});
