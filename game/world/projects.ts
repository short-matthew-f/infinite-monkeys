// The heads' vocabulary: who is asking, what each project is called, and the effect of each
// project stated as a fact. One module so the memo, the offices, the payoff scenes, the feed and the
// Chief Accountant's slides all say the same thing about the same project (MOBILE-UX rule 13).
//
// Every number comes from the project's definition in tuning (ProjectDef.effect), or from core
// (permMult for the morale fade). Nothing here says what to buy: facts only.
import { permMult, projectDef, type GameState, type HeadId, type ProjectDef, type Tuning } from '../../core/index.js';

/** The head who files each kind of request. */
export const HEAD_NAMES: Record<HeadId, string> = {
  recruiting: 'Head Recruiter',
  construction: 'Foreman',
  editing: 'Chief Editor',
  facilities: 'Facilities Manager',
  accounting: 'Chief Accountant',
  training: 'Training Officer',
};

export const DEPT_LABEL = { recruiting: 'Recruiting', construction: 'Construction', editing: 'Editing' } as const;

/** The three support offices, as the building and the Directory name them. */
export type OfficeId = 'facilities' | 'accounting' | 'training';
export const OFFICE_IDS: readonly OfficeId[] = ['facilities', 'accounting', 'training'];
export const OFFICE_NAMES: Record<OfficeId, string> = { facilities: 'Facilities Office', accounting: 'Accounting Office', training: 'Training Office' };
/** Short wing names for the building. */
export const OFFICE_SHORT: Record<OfficeId, string> = { facilities: 'Facilities', accounting: 'Accounting', training: 'Training' };

/** Which office a head's projects are listed in (the Foreman's amenities are listed under Facilities). */
export function officeOf(from: HeadId): OfficeId | null {
  if (from === 'facilities' || from === 'construction') return 'facilities';
  if (from === 'accounting') return 'accounting';
  if (from === 'training') return 'training';
  return null;
}

const TITLES: Record<string, string> = {
  pizzaParty: 'Friday pizza party',
  teamBuilding: 'Team-building exercise',
  escapeRoom: 'Escape room',
  bathrooms: 'More bathrooms',
  breakRoom: 'Break room',
  snackMachine: 'Snack machine',
  audit: 'Audit',
  efficiencyFinding: 'Efficiency finding',
  managers: 'Make managers',
  communicationClass: 'Communication class',
  speedReading: 'Speed-reading course',
};
export const projectTitle = (id: string): string => TITLES[id] ?? id;

/** Which payoff scene a project plays, when it plays one. */
export type SceneId = 'pizza' | 'team' | 'escape' | 'bath' | 'brk' | 'snack' | 'audit' | 'stamp' | 'mgr' | 'comm' | 'read';
export const SCENE_OF: Record<string, SceneId | undefined> = {
  pizzaParty: 'pizza',
  teamBuilding: 'team',
  escapeRoom: 'escape',
  bathrooms: 'bath',
  breakRoom: 'brk',
  snackMachine: 'snack',
  efficiencyFinding: 'stamp',
  managers: 'mgr',
  communicationClass: 'comm',
  speedReading: 'read',
};

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const whole = (v: number) => Math.round(v).toLocaleString();

/** "45 seconds", "1 minute", "2½ minutes", "3 minutes". Rounds to the nearest half minute from a minute up. */
export function aboutTime(seconds: number): string {
  if (seconds < 60) return `${whole(seconds)} ${plural(Math.round(seconds), 'second')}`;
  const half = Math.round(seconds / 30) / 2;
  const whole_ = Math.floor(half);
  const label = `${whole_ > 0 ? whole_ : ''}${half % 1 ? '½' : ''}`;
  return `${label} ${half === 1 ? 'minute' : 'minutes'}`;
}

/** "+2 h" / "+30 min". */
function allowance(seconds: number): string {
  if (seconds >= 3600) {
    const h = seconds / 3600;
    return `+${Number.isInteger(h) ? h : h.toFixed(1)} h`;
  }
  return `+${Math.round(seconds / 60)} min`;
}

export interface FactOpts {
  /** Which acceptance this describes: "1 of 3". Omit for none. */
  n?: number;
  /** Morale actually gained (capped); defaults to the project's own figure. */
  moraleGain?: number;
  /** permMult(s, t, 'moraleFade'): the snack machine slows the fade. */
  fadeMult?: number;
}

/** The project's effect as a plain sentence, with no advice. */
export function projectFact(t: Tuning, p: ProjectDef, o: FactOpts = {}): string {
  const e = p.effect;
  const of = o.n && p.max ? ` (${o.n} of ${p.max})` : '';
  switch (e.type) {
    case 'morale': {
      const gain = o.moraleGain ?? e.add;
      if (gain <= 0.0005) return 'Morale is already at its ceiling, so this adds nothing.';
      const fade = t.budget?.morale.fadePerSecond ?? 0;
      const secs = fade > 0 ? gain / (fade * (o.fadeMult ?? 1)) : 0;
      return `Morale +${whole(gain * 100)}%, fading back over about ${aboutTime(secs)}`;
    }
    case 'timed': {
      const who = e.target === 'review' ? 'Editors review' : 'Every department works';
      return `${who} ${whole((e.mult - 1) * 100)}% faster for ${aboutTime(e.seconds)}`;
    }
    case 'perm':
      switch (e.target) {
        case 'recruiting': return `Recruiting +${whole((e.mult - 1) * 100)}%, permanent${of}`;
        case 'review': return `Editors review ${whole((e.mult - 1) * 100)}% faster, permanent${of}`;
        case 'levelCost': return `Department levels ${whole((1 - e.mult) * 100)}% cheaper, permanent${of}`;
        case 'stageCost': return `Department stages ${whole((1 - e.mult) * 100)}% cheaper, permanent${of}`;
        case 'moraleFade': return `Morale fades at ${whole(e.mult * 100)}% of its usual speed, permanent${of}`;
      }
      return `Permanent upgrade${of}`;
    case 'offline':
      return `Time-away allowance ${allowance(e.seconds)}, permanent${of}`;
    case 'audit':
      return `Fee back ×${e.returnMult} into the pot in ${aboutTime(e.seconds)}`;
    case 'reviewResearch':
      return `One level of review research${of}`;
  }
}

/** The effect fact for a project id; '' when the id is unknown. */
export function factFor(t: Tuning, id: string, o: FactOpts = {}): string {
  const p = projectDef(t, id);
  return p ? projectFact(t, p, o) : '';
}

/** Fade multiplier from owned upgrades (the snack machine), straight from core. */
export const fadeMultOf = (s: GameState, t: Tuning): number => permMult(s, t, 'moraleFade');
