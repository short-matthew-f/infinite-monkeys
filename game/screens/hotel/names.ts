// Hotel vocabulary: names and short copy keyed by id. Copy only; every number on screen comes from core.
import { busWaitTicks, hotelPool, onboardingTicks, onlineMarkets, bestMarket, type FrozenReward, type FrozenRewardData, type GameState, type Tuning } from '../../../core/index.js';
import * as f from '../../ui/format.js';

const cap = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** The five rooms keep their ids; after Infinity each takes a hotel name. */
export const HOTEL_ROOM_NAME: Record<string, string> = {
  personnel: 'Front Desk',
  pool: 'Typing Pool',
  departments: 'Staff',
  research: 'Records Library',
  director: "Director's Office",
};

const MARKET_NAME: Record<string, string> = { home: 'Home', cyrillic: 'Cyrillic', greek: 'Greek' };
/** The alphabet each market brings. */
export const MARKET_ALPHABET: Record<string, string> = {
  home: 'Latin alphabet · A B C D',
  cyrillic: 'Cyrillic alphabet · А Б В Г',
  greek: 'Greek alphabet · Α Β Γ Δ',
};
export const marketName = (id: string): string => MARKET_NAME[id] ?? cap(id);

const COMMISSION: Record<string, { title: string; about: string }> = {
  immediate: { title: 'Rush Job', about: 'Pays in bananas, at once' },
  permanent: { title: 'Archive Contract', about: 'Pays Golden Bananas for epic research' },
  expansion: { title: 'The Greek Route', about: 'Opens a new market' },
  greekVerse: { title: 'Greek Verse', about: 'Pays Golden Bananas for epic research' },
};
export const commissionTitle = (id: string): string => COMMISSION[id]?.title ?? cap(id);
export const commissionAbout = (id: string): string => COMMISSION[id]?.about ?? '';

const golden = (n: number) => `${f.count(n)} Golden ${n === 1 ? 'Banana' : 'Bananas'}`;

/** What a frozen Commission reward pays. */
export function rewardLine(r: FrozenReward): string {
  if (r.bananas !== null) return f.bananaText(r.bananas);
  if (r.golden !== null) return golden(r.golden);
  if (r.market !== null) return `Opens the ${marketName(r.market)} market`;
  return 'Nothing';
}
/** The same, from an event's plain numbers. */
export function rewardLineData(r: FrozenRewardData): string {
  if (r.bananas !== undefined) return f.bananaText(r.bananas);
  if (r.golden !== undefined) return golden(r.golden);
  if (r.market !== undefined) return `Opens the ${marketName(r.market)} market`;
  return 'Nothing';
}
export const goldenText = golden;

export const EPIC_NAME: Record<string, string> = {
  seniorEditors: 'Senior Editors',
  cyrillicSpecialists: 'Cyrillic Specialists',
  fasterShiftCrews: 'Faster Shift Crews',
};
export const epicName = (id: string): string => EPIC_NAME[id] ?? cap(id);

/** One short line per room for the Directory, in the hotel. */
export function hotelHint(s: GameState, t: Tuning, id: string): string {
  const h = s.hotel;
  if (!h) return '';
  switch (id) {
    case 'personnel': {
      const total = Object.keys(h.markets).length;
      return `${onlineMarkets(s).length} of ${total} markets online`;
    }
    case 'pool':
      return `Editors review ${f.rate(hotelPool(s, t))}`;
    case 'departments': {
      const l = h.upgradeLevels;
      return `Editors ${l.editors} · Buses ${l.busWranglers} · Crews ${l.shiftCrews}`;
    }
    case 'research':
      return `${f.count(s.save.golden)} Golden Bananas · ${s.save.epics.length} of ${t.epics.length} epics`;
    default: {
      if (s.objective.kind === 'commission') return `Pinned: ${commissionTitle(s.objective.id)}`;
      const best = bestMarket(s, t);
      return `Maximizing bananas${best ? ` in ${marketName(best)}` : ''}`;
    }
  }
}

/** Seconds of a full bus trip and a full onboarding at current speeds (core's estimates, in ticks). */
export function tripSeconds(s: GameState, t: Tuning): { bus: number; onboarding: number } {
  return { bus: busWaitTicks(s, t) * t.tickSeconds, onboarding: onboardingTicks(s, t) * t.tickSeconds };
}
