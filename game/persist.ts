// IndexedDB save adapter. The whole GameState is plain JSON; wall-clock time
// lives here, never in core/.
import type { GameState } from '../core/index.js';

export const SCHEMA_VERSION = 1;

export interface SaveRecord {
  schemaVersion: number;
  savedAt: number;
  state: GameState;
}

const DB = 'infinite-monkeys';
const STORE = 'saves';
const KEY = 'slot0';
/** Left over from the quarterly-budget trial; the budget is now the only game. */
const OLD_BUDGET_KEY = 'slot-budget';
const OLD_MODE_KEY = 'im:mode';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * One-time migration from the trial's two slots to one. If both exist, the later
 * `savedAt` wins slot0; if only the trial slot exists it moves to slot0. The trial
 * slot and the `im:mode` key are then removed. Safe to run on every load.
 */
export async function migrate(): Promise<void> {
  try {
    const trial = await tx<SaveRecord | undefined>('readonly', (s) => s.get(OLD_BUDGET_KEY));
    if (trial) {
      const main = await tx<SaveRecord | undefined>('readonly', (s) => s.get(KEY));
      if (!main || (trial.savedAt ?? 0) > (main.savedAt ?? 0)) await tx('readwrite', (s) => s.put(trial, KEY));
      await tx('readwrite', (s) => s.delete(OLD_BUDGET_KEY));
    }
  } catch {}
  try {
    localStorage.removeItem(OLD_MODE_KEY);
  } catch {}
}

/** Returns the saved record, or null if missing or from an incompatible schema. */
export async function load(): Promise<SaveRecord | null> {
  try {
    const rec = await tx<SaveRecord | undefined>('readonly', (s) => s.get(KEY));
    if (!rec || rec.schemaVersion !== SCHEMA_VERSION) return null;
    return rec;
  } catch {
    return null;
  }
}

export async function save(state: GameState): Promise<void> {
  const rec: SaveRecord = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), state };
  await tx('readwrite', (s) => s.put(rec, KEY));
}

export async function clear(): Promise<void> {
  await tx('readwrite', (s) => s.delete(KEY));
}
