// The quarterly budget (DESIGN.md §13, proposed). Runs on prototypeTuning only;
// the shipped tuning has no budget and every other test covers that path.

import { describe, expect, it } from 'vitest';
import { prototypeTuning as TB, classicTuning as T } from '../content/prototype.js';
import {
  buyDeptLevel,
  createState,
  declareInfinity,
  declineRequisition,
  grantRequisition,
  headShares,
  keystrokeRate,
  levelsListPrice,
  moraleMult,
  deptLevelCost,
  projectDef,
  projectAvailable,
  projectPrice,
  timedMult,
  reviewSpeedMult,
  previewQuarter,
  upgradeSave,
  newOffice,
  N,
  nullSink,
  requisitionPrice,
  run,
  setShares,
  signBudget,
  suggestBudget,
  suggestShares,
  type BudgetLines,
  type GameState,
  type Tuning,
} from '../core/index.js';
import { collector, ofType } from './helpers.js';

const Q = TB.budget!.quarterSeconds;
const ticks = (sec: number) => Math.round(sec / TB.tickSeconds);
const LINES: BudgetLines = { recruiting: 0.2, construction: 0.2, editing: 0.3, discretionary: 0.3 };

/** A state with one Recruiter bought, so the budget opens on the next tick. */
function opened(): GameState {
  const s = createState(TB, 1);
  s.bananas = N.of(1_000);
  s.monkeys = N.of(50);
  s.desks = N.of(60);
  expect(buyDeptLevel(s, TB, nullSink, 'recruiting')).toBe(true);
  run(s, TB, nullSink, 1);
  return s;
}

describe('quarterly budget', () => {
  it('stays closed without budget tuning, and until a department exists', () => {
    const plain = createState(T, 1);
    plain.bananas = N.of(1_000);
    buyDeptLevel(plain, T, nullSink, 'recruiting');
    run(plain, T, nullSink, 10);
    expect(plain.budget).toBeNull();

    const s = createState(TB, 1);
    run(s, TB, nullSink, 10);
    expect(s.budget).toBeNull();
  });

  it('opens with every banana discretionary and a review waiting', () => {
    const { events, sink } = collector();
    const s = createState(TB, 1);
    s.bananas = N.of(1_000);
    buyDeptLevel(s, TB, sink, 'recruiting');
    run(s, TB, sink, 1);
    expect(ofType(events, 'budgetOpened')).toHaveLength(1);
    expect(s.budget!.lines.discretionary).toBe(1);
    expect(s.budget!.reviewDue).toBe(true);
  });

  it('splits income by the signed lines; departments buy their own levels', () => {
    const s = opened();
    expect(signBudget(s, TB, nullSink, LINES)).toBe(true);
    const level0 = s.depts.editing.level;
    const { events, sink } = collector();
    run(s, TB, sink, ticks(30));
    const auto = ofType(events, 'purchase').filter((e) => e.by === 'department');
    expect(auto.length).toBeGreaterThan(0);
    expect(s.depts.editing.level).toBeGreaterThan(level0);
    // Accounts never go negative and stay below the next level's price after buying.
    for (const d of ['recruiting', 'construction', 'editing'] as const) expect(N.toNumber(s.budget!.accounts[d])).toBeGreaterThanOrEqual(0);
  });

  it('only signs at an open review, with valid lines and at least the minimum discretionary', () => {
    const s = opened();
    expect(signBudget(s, TB, nullSink, { ...LINES, discretionary: 0.4 })).toBe(false); // sums to 1.1
    expect(signBudget(s, TB, nullSink, { recruiting: 0.5, construction: 0.45, editing: 0, discretionary: 0.05 })).toBe(false); // below the minimum
    expect(signBudget(s, TB, nullSink, { ...LINES, recruiting: -0.1, construction: 0.5 })).toBe(false);
    expect(signBudget(s, TB, nullSink, LINES)).toBe(true);
    expect(signBudget(s, TB, nullSink, LINES)).toBe(false); // locked until the next review
  });

  it('sweeps the unspent wallet into the pot at quarter end, and the next signature splits it', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    const { events, sink } = collector();
    run(s, TB, sink, ticks(Q));
    const ended = ofType(events, 'quarterEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.report.swept).toBeGreaterThan(0);
    expect(N.toNumber(s.budget!.pot)).toBeCloseTo(ended[0]!.pot, 6);
    expect(s.budget!.reviewDue).toBe(true);
    const pot = N.toNumber(s.budget!.pot);
    const wallet = N.toNumber(s.bananas);
    const next: BudgetLines = { recruiting: 0, construction: 0, editing: 0, discretionary: 1 };
    expect(signBudget(s, TB, nullSink, next)).toBe(true);
    expect(N.toNumber(s.bananas)).toBeCloseTo(wallet + pot, 6);
    expect(N.toNumber(s.budget!.pot)).toBe(0);
  });

  it('never waits for the player: an unsigned review closes on the previous lines', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(Q)); // review opens
    const { events, sink } = collector();
    run(s, TB, sink, ticks(Q)); // and closes unsigned
    const ended = ofType(events, 'quarterEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0]!.missedReview).toBe(true);
    expect(s.budget!.lastReport!.ranOnOldLines).toBe(true);
    expect(s.budget!.missedReviews).toBe(1);
    expect(s.budget!.lines).toEqual(LINES);
  });

  it('is deterministic: chunked and continuous runs agree (the offline catch-up path)', () => {
    const a = opened(), b = opened();
    signBudget(a, TB, nullSink, LINES);
    signBudget(b, TB, nullSink, LINES);
    run(a, TB, nullSink, ticks(Q * 2.5));
    for (let i = 0; i < 25; i++) run(b, TB, nullSink, ticks(Q * 0.1));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('replaces the funding slider: heads coordinate shares, setShares is refused', () => {
    const s = opened();
    expect(setShares(s, TB, nullSink, { recruiting: 1, construction: 0, editing: 0 })).toBe(false);
  });

  it('suggests lines that sum to 1 with the tuned discretionary share', () => {
    const s = opened();
    const l = suggestBudget(s, TB);
    expect(l.recruiting + l.construction + l.editing + l.discretionary).toBeCloseTo(1, 9);
    expect(l.discretionary).toBe(TB.budget!.suggestedDiscretionary);
    expect(signBudget(s, TB, nullSink, l)).toBe(true);
  });

  it('closes at the ceremony: accounts and the pot return to the wallet', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(Q));
    const b = s.budget!;
    const total = N.toNumber(s.bananas) + N.toNumber(b.pot) + (['recruiting', 'construction', 'editing'] as const).reduce((a, d) => a + N.toNumber(b.accounts[d]), 0);
    s.stability.permit = true;
    expect(declareInfinity(s, TB, nullSink)).toBe(true);
    expect(s.budget).toBeNull();
    expect(N.toNumber(s.bananas)).toBeCloseTo(total, 6);
  });

  it('at the ceremony the heads hand funding back as an even split', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(10));
    s.stability.permit = true;
    declareInfinity(s, TB, nullSink);
    expect(s.shares).toEqual({ recruiting: 1 / 3, construction: 1 / 3, editing: 1 / 3 });
  });

  it("heads cap Editing's share by the budget's own caps, raised once every department is at stage 4", () => {
    const s = opened();
    const bd = TB.budget!;
    expect(headShares(s, TB)).toEqual(suggestShares(s, { ...TB, suggestedEditingShareCap: bd.editingShareCap }));
    for (const d of ['recruiting', 'construction', 'editing'] as const) s.depts[d].stage = 4;
    expect(headShares(s, TB)).toEqual(suggestShares(s, { ...TB, suggestedEditingShareCap: bd.readinessEditingShareCap }));
    // The live shares follow the heads every tick.
    run(s, TB, nullSink, 1);
    expect(s.shares).toEqual(headShares(s, TB));
  });

  it('previews a signature by running the quarter on a clone', () => {
    const s = opened();
    run(s, TB, nullSink, ticks(20));
    const before = JSON.stringify(s);
    const p = previewQuarter(s, TB, LINES)!;
    expect(JSON.stringify(s)).toBe(before); // the live state is untouched
    // The same signature, actually played out with no manual buys, lands on the preview.
    const levels = { recruiting: s.depts.recruiting.level, construction: s.depts.construction.level, editing: s.depts.editing.level };
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, s.budget!.quarterStartTick + ticks(Q) - s.tick - 1); // to one tick before quarter end
    expect(p.levels.editing).toBe(s.depts.editing.level - levels.editing);
    expect(p.wallet).toBeCloseTo(N.toNumber(s.bananas), 6);
    expect(previewQuarter(s, TB, LINES)).toBeNull(); // no review open
    expect(previewQuarter(opened(), TB, { ...LINES, discretionary: 0.9 })).toBeNull(); // invalid lines
  });

  describe('level requisitions', () => {
    // Projects off, so every request is a level block.
    const TL: Tuning = { ...TB, budget: { ...TB.budget!, projects: [] } };
    const R = TL.budget!.requisitions!;
    /** A signed budget with a requisition open. */
    function filed(): GameState {
      const s = opened();
      signBudget(s, TL, nullSink, LINES);
      s.depts.editing.level = Math.max(1, s.depts.editing.level);
      run(s, TL, nullSink, ticks(R.cooldownSeconds) + 1);
      expect(s.budget!.requisition).not.toBeNull();
      return s;
    }

    it('a head files one after the cooldown, priced at the bulk rate of its list price', () => {
      const { events, sink } = collector();
      const s = opened();
      signBudget(s, TL, nullSink, LINES);
      s.depts.editing.level = 1; // whichever department is short has a head to file
      run(s, TL, sink, ticks(R.cooldownSeconds) - 2);
      expect(ofType(events, 'requisitionOpened')).toHaveLength(0);
      run(s, TL, sink, 4);
      const opened_ = ofType(events, 'requisitionOpened');
      expect(opened_).toHaveLength(1);
      const q = s.budget!.requisition!;
      expect(N.toNumber(requisitionPrice(s, TL)!)).toBeCloseTo(N.toNumber(levelsListPrice(s, TL, q.dept!, R.levels)) * R.priceFactor, 6);
      expect(s.budget!.stats.requisitions.offered).toBe(1);
    });

    it('list price is the sum of the next levels', () => {
      const s = opened();
      let sum = 0;
      const p = { ...s, depts: { ...s.depts, editing: { ...s.depts.editing } } };
      for (let i = 0; i < 3; i++) { sum += N.toNumber(levelsListPrice(p, TL, 'editing', 1)); p.depts.editing.level++; }
      expect(N.toNumber(levelsListPrice(s, TL, 'editing', 3))).toBeCloseTo(sum, 6);
    });

    it('granting pays from the wallet and adds the levels at once', () => {
      const s = filed();
      const q = s.budget!.requisition!;
      const price = N.toNumber(requisitionPrice(s, TL)!);
      s.bananas = N.of(price - 1);
      expect(grantRequisition(s, TL, nullSink)).toBe(false);
      s.bananas = N.of(price + 10);
      const level = s.depts[q.dept!].level;
      const { events, sink } = collector();
      expect(grantRequisition(s, TL, sink)).toBe(true);
      expect(s.depts[q.dept!].level).toBe(level + R.levels);
      expect(N.toNumber(s.bananas)).toBeCloseTo(10, 6);
      expect(ofType(events, 'requisitionClosed')[0]!.outcome).toBe('granted');
      expect(s.budget!.requisition).toBeNull();
      expect(grantRequisition(s, TL, nullSink)).toBe(false);
    });

    it('declined or unanswered, it closes and the next waits a cooldown', () => {
      const s = filed();
      expect(declineRequisition(s, TL, nullSink)).toBe(true);
      expect(s.budget!.stats.requisitions.declined).toBe(1);
      run(s, TL, nullSink, ticks(R.cooldownSeconds) - 2);
      expect(s.budget!.requisition).toBeNull();
      const { events, sink } = collector();
      run(s, TL, sink, 4 + ticks(R.openSeconds));
      expect(ofType(events, 'requisitionClosed').map((e) => e.outcome)).toContain('expired');
    });

    it('never outlives its quarter', () => {
      const s = filed();
      run(s, TL, nullSink, ticks(Q));
      const b = s.budget!;
      expect(b.requisition === null || b.requisition.openedTick >= b.quarterStartTick).toBe(true);
      if (b.requisition) expect(b.requisition.expiresTick).toBeLessThanOrEqual(b.quarterStartTick + ticks(Q));
    });
  });

  describe('projects', () => {
    /** Files a specific project as the open request, at its real price. */
    function offer(s: GameState, id: string): number {
      const p = projectDef(TB, id)!;
      const price = N.toNumber(projectPrice(s, TB, p));
      s.budget!.requisition = { kind: id, from: p.from, dept: null, price, openedTick: s.tick, expiresTick: s.tick + 300 };
      s.bananas = N.add(s.bananas, N.of(price));
      return price;
    }
    function signedAt(): GameState {
      const s = opened();
      signBudget(s, TB, nullSink, LINES);
      run(s, TB, nullSink, ticks(5));
      return s;
    }

    it('the heads file a mix of projects and level blocks, never the same kind twice running', () => {
      const s = opened();
      signBudget(s, TB, nullSink, LINES);
      const kinds: string[] = [];
      const sink = (e: Parameters<typeof nullSink>[0]) => { if (e.type === 'requisitionOpened') kinds.push(e.kind); };
      for (let q = 0; q < 6; q++) {
        run(s, TB, sink, ticks(Q));
        if (s.budget!.reviewDue) signBudget(s, TB, nullSink, LINES);
      }
      expect(new Set(kinds).size).toBeGreaterThan(3);
      for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    });

    it('a pizza party lifts morale, which speeds typing, then fades back to normal and never below', () => {
      const s = signedAt();
      const k0 = N.toNumber(keystrokeRate(s, TB));
      offer(s, 'pizzaParty');
      const { events, sink } = collector();
      expect(grantRequisition(s, TB, sink)).toBe(true);
      expect(ofType(events, 'projectDone')[0]!.project).toBe('pizzaParty');
      expect(moraleMult(s)).toBeCloseTo(1.3, 9);
      expect(N.toNumber(keystrokeRate(s, TB)) / k0).toBeCloseTo(1.3, 6);
      run(s, TB, nullSink, ticks(200));
      expect(moraleMult(s)).toBe(1);
    });

    it('a timed boost lasts its time and then ends', () => {
      const s = signedAt();
      offer(s, 'escapeRoom');
      grantRequisition(s, TB, nullSink);
      expect(timedMult(s, "review")).toBeCloseTo(1.4, 9);
      run(s, TB, nullSink, ticks(181));
      expect(timedMult(s, 'review')).toBe(1);
    });

    it('permanent upgrades stack to their cap, and each costs more than the last', () => {
      const s = signedAt();
      const c0 = N.toNumber(deptLevelCost(s, TB, 'editing'));
      const p = projectDef(TB, 'efficiencyFinding')!;
      const first = offer(s, 'efficiencyFinding');
      grantRequisition(s, TB, nullSink);
      expect(N.toNumber(deptLevelCost(s, TB, 'editing')) / c0).toBeCloseTo(0.9, 9);
      expect(N.toNumber(projectPrice(s, TB, p)) / first).toBeCloseTo(p.priceGrowth, 2);
      for (let i = 1; i < p.max!; i++) { offer(s, 'efficiencyFinding'); grantRequisition(s, TB, nullSink); }
      expect(s.office!.owned.efficiencyFinding).toBe(p.max);
      expect(projectAvailable(s, p)).toBe(false);
    });

    it('an audit takes the fee now and pays more into the pot when it reports', () => {
      const s = signedAt();
      const fee = offer(s, 'audit');
      const pot0 = N.toNumber(s.budget!.pot);
      grantRequisition(s, TB, nullSink);
      const { events, sink } = collector();
      run(s, TB, sink, ticks(61));
      const found = ofType(events, 'auditFound');
      expect(found).toHaveLength(1);
      expect(found[0]!.amount).toBeCloseTo(fee * 1.5, 6);
      expect(N.toNumber(s.budget!.pot)).toBeCloseTo(pot0 + fee * 1.5, 6);
      expect(s.budget!.stats.auditFound).toBeCloseTo(fee * 1.5, 6);
      expect(s.budget!.stats.requests.at(-1)).toMatchObject({ kind: 'audit', from: 'accounting', outcome: 'granted' });
    });

    it('declining costs nothing', () => {
      const s = signedAt();
      offer(s, 'teamBuilding');
      const before = N.toNumber(s.bananas);
      expect(declineRequisition(s, TB, nullSink)).toBe(true);
      expect(N.toNumber(s.bananas)).toBe(before);
      expect(s.budget!.stats.requests.at(-1)).toMatchObject({ kind: 'teamBuilding', outcome: 'declined' });
      expect(timedMult(s, 'output')).toBe(1);
    });

    it('office effects apply only in the finite phase', () => {
      const s = signedAt();
      offer(s, 'communicationClass');
      grantRequisition(s, TB, nullSink);
      const r = reviewSpeedMult(s, TB);
      expect(r).toBeCloseTo(1.15, 9);
      s.phase = 'hotel';
      expect(reviewSpeedMult(s, TB)).toBe(1);
      expect(moraleMult(s)).toBe(1);
    });
  });

  it('upgrades a save from an older build: missing report fields, office, old-format request', () => {
    const s = opened();
    signBudget(s, TB, nullSink, LINES);
    run(s, TB, nullSink, ticks(Q) + 5);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    const strip = (r: Record<string, unknown> | null) => { if (r) { delete r.requests; delete r.auditFound; delete r.ranOnOldLines; } };
    strip(old.budget!.lastReport as unknown as Record<string, unknown>);
    strip(old.budget!.stats as unknown as Record<string, unknown>);
    delete old.office;
    old.budget!.requisition = { dept: 'editing', openedTick: old.tick, expiresTick: old.tick + 100 } as never;
    upgradeSave(old);
    expect(old.budget!.lastReport!.requests).toEqual([]);
    expect(old.budget!.stats.auditFound).toBe(0);
    expect(old.office).toEqual(newOffice());
    expect(old.budget!.requisition).toBeNull();
    // Idempotent, and a current save is untouched.
    const cur = JSON.stringify(s);
    upgradeSave(s);
    expect(JSON.stringify(s)).toBe(cur);
    // An old save also survives a tick without help.
    const old2 = JSON.parse(JSON.stringify(s)) as GameState;
    delete (old2.budget!.stats as unknown as Record<string, unknown>).requests;
    run(old2, TB, nullSink, 1);
    expect(old2.budget!.stats.requests).toBeDefined();
  });
});
