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
/** Two independent slots, so trying one mode never destroys the other save. */
export type Mode = 'classic' | 'budget';
const KEYS: Record<Mode, string> = { classic: 'slot0', budget: 'slot-budget' };
const MODE_KEY = 'im:mode';

/** The active mode, kept in localStorage (default classic; never throws). */
export function getMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'budget' ? 'budget' : 'classic';
  } catch {
    return 'classic';
  }
}

export function setMode(mode: Mode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

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

/** Returns the saved record, or null if missing or from an incompatible schema. */
export async function load(mode: Mode = getMode()): Promise<SaveRecord | null> {
  try {
    const rec = await tx<SaveRecord | undefined>('readonly', (s) => s.get(KEYS[mode]));
    if (!rec || rec.schemaVersion !== SCHEMA_VERSION) return null;
    return rec;
  } catch {
    return null;
  }
}

export async function save(state: GameState, mode: Mode = getMode()): Promise<void> {
  const rec: SaveRecord = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), state };
  await tx('readwrite', (s) => s.put(rec, KEYS[mode]));
}

/** Erases one mode's slot only. */
export async function clear(mode: Mode = getMode()): Promise<void> {
  await tx('readwrite', (s) => s.delete(KEYS[mode]));
}
