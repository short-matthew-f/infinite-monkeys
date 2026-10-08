// The next-thing cue: which room just became relevant, and a short tag saying why.
//
// Guardrail (PROTOTYPE.md §1, docs/DISCOVERABILITY.md): the cue points at rooms
// and unlocks that became *available*, and at problems that became *visible*. It
// never ranks purchases or says which option is best, and it never uses the
// simulation bots' scoring. Availability comes from core via ctx.can dry-runs.
import {
  DEPTS,
  N,
  buyDeptLevel,
  buyDeptStage,
  buyDesk,
  buyTypingResearch,
  certifyTiers,
  editingPool,
  researchTier,
  tapHire,
  type GameState,
  type Tuning,
} from '../../core/index.js';
import type { Ctx } from '../ctx.js';

export interface Cue {
  /** Stable identity: once the player opens the room while this cue shows, it stays quiet. */
  key: string;
  room: 'personnel' | 'pool' | 'departments' | 'research' | 'director';
  /** Two or three words on the paper tab. */
  tag: string;
  /** One feed line, in the Bureau's voice. */
  memo: string;
  /** For Departments: which department's view to open. */
  view?: string;
}

/** Share of finds being discarded (0..1), from core's certification. */
export function discardShare(s: GameState, t: Tuning): number {
  const c = certifyTiers(s, t, editingPool(s, t), s.tierAllocation);
  const certified = N.toNumber(N.sum(Object.values(c.certified)));
  const discarded = N.toNumber(c.discarded);
  return certified + discarded > 0 ? discarded / (certified + discarded) : 0;
}

/**
 * Candidate cues in priority order (the finish line, the first hire, new unlocks, then problems),
 * matching the order the Departments Next card uses so the floor and the form agree; the first one the player hasn't acknowledged wins.
 * Every check reads state or asks core whether an action is allowed.
 */
export function cueCandidates(ctx: Ctx): Cue[] {
  const s = ctx.state(), t = ctx.t;
  if (s.phase !== 'finite') return [];
  const out: Cue[] = [];
  const seated = Math.floor(N.toNumber(s.monkeys)), desks = Math.floor(N.toNumber(s.desks));

  // The finish line, in its three phases.
  if (s.stability.permit) out.push({ key: 'permit', room: 'director', tag: 'Permit issued', memo: "Memo: the Infinity Permit is stamped. The Director's Office awaits your decision." });
  else if (s.stability.heldTicks > 0) out.push({ key: 'hold', room: 'director', tag: 'Hold steady', memo: 'Memo: all three meters are full. The Stability Window is counting.' });
  if (s.milestonesReached.includes('tall')) out.push({ key: 'tall', room: 'director', tag: 'Finish line', memo: "Memo: the building is tall enough to apply for an Infinity Permit. See the Director's Office." });

  // The first hire.
  if (seated <= 1) {
    if (desks > seated && ctx.can('tapHire', tapHire)) out.push({ key: 'first-hire', room: 'personnel', tag: 'Hire ready', memo: 'Memo: a desk is free in Personnel.' });
    else if (ctx.can('buyDesk', buyDesk)) out.push({ key: 'first-desk', room: 'personnel', tag: 'Desk ready', memo: 'Memo: Facilities can supply a second desk.' });
  }

  // New unlocks became available.
  for (const tier of t.tiers) {
    const ts = s.tiers[tier.id];
    if (!ts || ts.discoverable || tier.startsDiscovered) continue;
    if (ctx.can(`researchTier:${tier.id}`, (st, tt, k) => researchTier(st, tt, k, tier.id)))
      out.push({ key: `research:${tier.id}`, room: 'research', tag: 'Research open', memo: `Memo: the Records Library can now open research into ${tier.id}.` });
    // Research is the game's main lever, so it's announced as it comes within reach, not only once affordable.
    else if (N.toNumber(s.bananas) >= tier.researchCost * 0.6)
      out.push({ key: `research-soon:${tier.id}`, room: 'research', tag: 'Research soon', memo: `Memo: the Records Library is preparing research into ${tier.id}.` });
    break; // only the next tier in line
  }
  if (s.depts.recruiting.level === 0 && ctx.can('buyDeptLevel:recruiting', (st, tt, k) => buyDeptLevel(st, tt, k, 'recruiting')))
    out.push({ key: 'first-recruiter', room: 'departments', view: 'summary', tag: 'Recruiters', memo: 'Memo: Departments can now take on a Recruiter, who hires for you.' });
  for (const d of DEPTS) {
    const st = s.depts[d].stage;
    if (st < 4 && ctx.can(`buyDeptStage:${d}`, (gs, tt, k) => buyDeptStage(gs, tt, k, d)))
      out.push({ key: `stage:${d}:${st + 1}`, room: 'departments', view: d, tag: 'Stage ready', memo: `Memo: ${d[0]!.toUpperCase()}${d.slice(1)} can advance to stage ${st + 1}.` });
  }
  if (s.typingLevel === 0 && ctx.can('buyTypingResearch', buyTypingResearch))
    out.push({ key: 'typing:1', room: 'research', tag: 'New research', memo: 'Memo: the Records Library can fund faster typewriters.' });

  // A problem became visible: finds are being thrown away for want of Editors.
  const share = discardShare(s, t);
  if (share > 0.25 && ctx.can('buyDeptLevel:editing', (st, tt, k) => buyDeptLevel(st, tt, k, 'editing'))) {
    // One cue per order of magnitude of headcount, so it returns as the Bureau grows, not every level.
    const band = Math.floor(Math.log10(Math.max(1, seated)) * 2);
    out.push({ key: `discards:${band}`, room: 'departments', view: 'editing', tag: 'Editors needed', memo: `Memo: ${Math.round(share * 100)}% of finds are going unreviewed. Departments can add Editors.` });
  }

  return out;
}
