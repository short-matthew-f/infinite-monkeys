import { describe, expect, it } from 'vitest';
import {
  applySuggestedAllocation,
  buyDeptLevel,
  buyEpic,
  buyHotelUpgrade,
  hotelUpgradeCost,
  certifyMarkets,
  hotelPool,
  N,
  onboardingTicks,
  pinObjective,
  busWaitTicks,
  declareInfinity,
  previewCommission,
  previewMarketAllocation,
  referenceHotelPool,
  setMarketAllocation,
  run,
  setShares,
  suggestShares,
  suggestMarketAllocation,
  type GameEvent,
  type GameState,
  type Tuning,
  marketAutoOn,
  setMarketAuto,
  suggestHotelShares,
} from '../core/index.js';
import { collector, hotelState, lateFiniteState, ofType, runUntil, secs, T } from './helpers.js';

const IDS = ['immediate', 'permanent', 'expansion'] as const;

/** Applies the suggested market split and the suggested hotel funding. */
/** Hand-set staffing (the engine's manual mode), for tests of funding and custom splits. */
const TM: Tuning = { ...T, hotel: { ...T.hotel, autoStaff: false } };

function follow(s: GameState, sink: (e: GameEvent) => void) {
  applySuggestedAllocation(s, T, sink);
  setShares(s, T, sink, suggestShares(s, T));
}

/** Pins a Commission and follows the suggestions, re-applying when a bus arrives or a market comes online. */
function pinAndRun(s: GameState, id: string, sink = collector().sink) {
  const wrapped = (e: GameEvent) => {
    sink(e);
    if (e.type === 'marketOnline' || e.type === 'busArrived') follow(s, sink);
  };
  expect(pinObjective(s, T, wrapped, { kind: 'commission', id })).toBe(true);
  follow(s, wrapped);
  const deadline = T.hotel.commissions.find((c) => c.id === id)!.deadlineSeconds;
  return runUntil(s, wrapped, () => s.hotel!.commissions[id]!.status !== 'active', secs(deadline) + 10);
}

describe('the ceremony', () => {
  it('flips titles, enters the hotel, and keeps the home market as the best earner', () => {
    const { events, sink } = collector();
    const s = hotelState(1, sink);
    expect(s.phase).toBe('hotel');
    expect(ofType(events, 'titleFlipped').map((e) => e.to)).toEqual(['Shift Crew', 'Bus Wrangler']);
    expect(suggestMarketAllocation(s, T, { kind: 'bananas' }).home).toBe(1);
  });

  it('the first bus arrives within a minute, alongside all three offers', () => {
    const { events, sink } = collector();
    hotelState(1, sink);
    const declared = ofType(events, 'infinityDeclared')[0]!;
    const bus = ofType(events, 'busArrived')[0]!;
    expect((bus.tick - declared.tick) * T.tickSeconds).toBeLessThanOrEqual(60);
    const offers = ofType(events, 'commissionOffered');
    expect(offers.map((o) => o.id).sort()).toEqual([...IDS].sort());
    expect(offers.every((o) => o.tick === bus.tick)).toBe(true);
  });
});

describe('the first hotel decision', () => {
  it.each(IDS)('%s is playable and completes before its deadline with the suggested split', (id) => {
    const s = hotelState();
    expect(pinAndRun(s, id)).not.toBeNull();
    expect(s.hotel!.commissions[id]!.status).toBe('completed');
  });

  it.each(IDS)('%s diverts capacity from the home market', (id) => {
    const s = hotelState();
    const p = previewCommission(s, T, id)!;
    expect(p.productionIncomeForgone).toBeGreaterThan(0);
    expect(suggestMarketAllocation(s, T, { kind: 'commission', id }, 'planned')).not.toEqual(suggestMarketAllocation(s, T, { kind: 'bananas' }));
  });

  it('never suggests capacity for a market that is still onboarding', () => {
    const s = hotelState();
    expect(s.hotel!.markets.cyrillic!.status).not.toBe('online');
    const live = suggestMarketAllocation(s, T, { kind: 'commission', id: 'immediate' });
    expect(live.cyrillic).toBe(0);
    expect(live.home).toBe(1);
    const expansion = suggestMarketAllocation(s, T, { kind: 'commission', id: 'expansion' });
    expect(expansion.home).toBe(1); // works the home requirement while Cyrillic onboards
  });

  it('only the pinned Commission receives deliveries', () => {
    const { sink } = collector();
    const s = hotelState();
    pinObjective(s, T, sink, { kind: 'commission', id: 'permanent' });
    run(s, T, sink, secs(T.hotel.onboardingSeconds) + 1); // Cyrillic comes online
    applySuggestedAllocation(s, T, sink);
    run(s, T, sink, secs(60));
    expect(N.toNumber(s.hotel!.commissions.permanent!.delivered.cyrillic!)).toBeGreaterThan(0);
    expect(N.toNumber(s.hotel!.commissions.immediate!.delivered.cyrillic!)).toBe(0);
  });

  it('fails an active Commission whose deadline passes', () => {
    const { events, sink } = collector();
    const s = hotelState();
    pinObjective(s, T, sink, { kind: 'commission', id: 'immediate' });
    pinObjective(s, T, sink, { kind: 'bananas' }); // started, then abandoned
    run(s, T, sink, secs(301));
    expect(s.hotel!.commissions.immediate!.status).toBe('failed');
    expect(ofType(events, 'commissionFailed')).toHaveLength(1);
  });

  it('records production income forgone and the payout separately', () => {
    const { events, sink } = collector();
    const s = hotelState();
    pinAndRun(s, 'immediate', sink);
    const done = ofType(events, 'commissionCompleted')[0]!;
    expect(done.productionIncomeForgone).toBeGreaterThan(0);
    expect(done.reward.bananas).toBeGreaterThan(0);
  });
});

describe('frozen offers', () => {
  it('upgrades bought after an offer shorten completion but never move the target or reward', () => {
    const base = hotelState();
    const baseTicks = pinAndRun(base, 'permanent')!;

    const s = hotelState();
    const before = structuredCopy(s.hotel!.commissions.permanent!);
    s.save.golden = 10;
    expect(buyEpic(s, T, collector().sink, 'seniorEditors')).toBe(true);
    expect(s.hotel!.commissions.permanent!.required).toEqual(before.required);
    expect(s.hotel!.commissions.permanent!.reward).toEqual(before.reward);
    const fasterTicks = pinAndRun(s, 'permanent')!;
    expect(fasterTicks).toBeLessThan(baseTicks);
  });
});

describe('epic research', () => {
  function cyrillicRate(epic: string | null) {
    const s = hotelState();
    run(s, T, collector().sink, secs(T.hotel.onboardingSeconds) + 1);
    if (epic) {
      s.save.golden = 10;
      buyEpic(s, T, collector().sink, epic);
    }
    return N.toNumber(certifyMarkets(s, T, hotelPool(s, T), { cyrillic: 1 }).certified.cyrillic!);
  }

  it('Cyrillic Specialists give a stronger Cyrillic benefit than Senior Editors', () => {
    const none = cyrillicRate(null);
    const senior = cyrillicRate('seniorEditors');
    const specialists = cyrillicRate('cyrillicSpecialists');
    expect(senior).toBeGreaterThan(none);
    expect(specialists).toBeGreaterThan(senior);
  });

  it('Faster Shift Crews shorten onboarding', () => {
    const s = hotelState();
    const before = onboardingTicks(s, T);
    s.save.golden = 10;
    buyEpic(s, T, collector().sink, 'fasterShiftCrews');
    expect(onboardingTicks(s, T)).toBeLessThan(before);
  });
});

describe('reward payoffs', () => {
  it('Expansion delivers Greek by bus, Shift Crews bring it online, and the reward counts as used', () => {
    const { events, sink } = collector();
    const s = hotelState(1, sink);
    pinAndRun(s, 'expansion', sink);
    const following = (e: GameEvent) => {
      sink(e);
      if (e.type === 'marketOnline' || e.type === 'busArrived') follow(s, sink);
    };
    follow(s, following); // the bus is on its way: suggested funding shifts to Bus Wranglers
    const ticks = runUntil(s, following, () => s.hotel!.markets.greek!.status === 'online', secs(180));
    expect(ticks).not.toBeNull();
    expect(ofType(events, 'busArrived').map((e) => e.market)).toContain('greek');
    expect(ofType(events, 'rewardUsed').some((e) => e.commission === 'expansion')).toBe(true);
    // Greek's practical payoff: its own Commission is offered as it comes online.
    expect(s.hotel!.commissions.greekVerse?.status).toBe('offered');
  });

  it('starving the crews slows the bus: hotel funding is a real tradeoff', () => {
    const s = hotelState();
    setShares(s, TM, collector().sink, { recruiting: 0.5, construction: 0.05, editing: 0.45 }); // the in-transit suggestion
    const fast = busWaitTicks(s, TM);
    expect(setShares(s, TM, collector().sink, { recruiting: 0.05, construction: 0.05, editing: 0.9 })).toBe(true);
    expect(busWaitTicks(s, TM)).toBeGreaterThan(fast);
  });
});

describe('M2.1 fixes', () => {
  it('funding at offer time cannot shrink Commission targets or rewards', () => {
    const a = lateFiniteState(5), b = lateFiniteState(5);
    const { sink } = collector();
    for (const s of [a, b]) {
      run(s, T, sink, secs(T.readiness.stabilitySeconds) + 1);
      declareInfinity(s, T, sink);
    }
    setShares(b, T, sink, { recruiting: 0.4995, construction: 0.4995, editing: 0.001 });
    runUntil(a, sink, () => a.hotel!.offersMade, secs(120));
    runUntil(b, sink, () => b.hotel!.offersMade, secs(600));
    for (const id of IDS) {
      expect(b.hotel!.commissions[id]!.required).toEqual(a.hotel!.commissions[id]!.required);
      expect(b.hotel!.commissions[id]!.reward).toEqual(a.hotel!.commissions[id]!.reward);
    }
  });

  it('funding at declaration cannot make hotel upgrades cheaper', () => {
    const a = lateFiniteState(6), b = lateFiniteState(6);
    const { sink } = collector();
    for (const s of [a, b]) run(s, T, sink, secs(T.readiness.stabilitySeconds) + 1);
    setShares(b, T, sink, { recruiting: 0.4995, construction: 0.4995, editing: 0.001 });
    b.stability.permit = true; // the starved state would break the window; the price is what's under test
    declareInfinity(a, T, sink);
    declareInfinity(b, T, sink);
    expect(b.hotel!.upgradeCostBase).toBe(a.hotel!.upgradeCostBase);
  });

  it('an upgrade bought during onboarding speeds up the job already underway', () => {
    const run1 = hotelState(), run2 = hotelState();
    expect(run1.hotel!.markets.cyrillic!.status).toBe('onboarding');
    run2.save.golden = 10;
    buyEpic(run2, T, collector().sink, 'fasterShiftCrews');
    const t1 = runUntil(run1, collector().sink, () => run1.hotel!.markets.cyrillic!.status === 'online', secs(600))!;
    const t2 = runUntil(run2, collector().sink, () => run2.hotel!.markets.cyrillic!.status === 'online', secs(600))!;
    expect(t2).toBeLessThan(t1);
  });

  it.each(IDS)('the %s preview ETA matches actual completion, onboarding included', (id) => {
    const s = hotelState();
    follow(s, collector().sink);
    // Preview under the funding the player will actually run while pinned.
    const probe = JSON.parse(JSON.stringify(s)) as GameState;
    pinObjective(probe, T, collector().sink, { kind: 'commission', id });
    follow(probe, collector().sink);
    const eta = previewCommission(probe, T, id)!.etaSeconds;
    const actual = pinAndRun(s, id)! * T.tickSeconds;
    expect(Math.abs(actual - eta)).toBeLessThanOrEqual(Math.max(5, eta * 0.1));
  });

  it('a custom allocation preview matches actual completion when the split and funding are kept', () => {
    const s = hotelState();
    const { sink } = collector();
    expect(s.hotel!.markets.cyrillic!.status).toBe('onboarding');
    pinObjective(s, TM, sink, { kind: 'commission', id: 'permanent' });
    setShares(s, TM, sink, { recruiting: 0.05, construction: 0.15, editing: 0.8 }); // off-suggestion, kept throughout
    const split = { home: 0.1, cyrillic: 0.9 }; // custom: capacity on Cyrillic while it's still onboarding
    setMarketAllocation(s, TM, sink, split);
    const eta = previewMarketAllocation(s, TM, split).objectiveEtaSeconds!;
    const actual = runUntil(s, sink, () => s.hotel!.commissions.permanent!.status !== 'active', secs(2000), TM)! * T.tickSeconds;
    expect(s.hotel!.commissions.permanent!.status).toBe('completed');
    expect(Math.abs(actual - eta)).toBeLessThanOrEqual(1);
  });

  it('rejects non-finite or unknown allocation and funding values', () => {
    const s = hotelState();
    const { sink } = collector();
    expect(setMarketAllocation(s, T, sink, { home: Infinity })).toBe(false);
    expect(setMarketAllocation(s, T, sink, { home: NaN })).toBe(false);
    expect(setMarketAllocation(s, T, sink, { atlantis: 1 })).toBe(false);
    expect(setMarketAllocation(s, T, sink, { home: 0 })).toBe(false);
    expect(setShares(s, T, sink, { recruiting: Infinity, construction: 0, editing: 0 })).toBe(false);
    expect(s.hotel!.allocation.home).toBe(1);
  });

  it('Permanent pays Golden Bananas for exactly one epic item, and buying it counts as used', () => {
    const { events, sink } = collector();
    const s = hotelState(1, sink);
    pinAndRun(s, 'permanent', sink);
    expect(s.save.golden).toBe(10);
    expect(buyEpic(s, T, sink, 'seniorEditors')).toBe(true);
    expect(buyEpic(s, T, sink, 'cyrillicSpecialists')).toBe(false);
    expect(ofType(events, 'rewardUsed').some((e) => e.commission === 'permanent')).toBe(true);
  });

  it('Immediate pays bananas, and the next purchase counts as used', () => {
    const { events, sink } = collector();
    const s = hotelState(1, sink);
    const before = N.toNumber(s.bananas);
    pinAndRun(s, 'immediate', sink);
    expect(N.toNumber(s.bananas)).toBeGreaterThan(before);
    s.bananas = N.max(s.bananas, hotelUpgradeCost(s, T, 'editors')!);
    expect(buyHotelUpgrade(s, T, sink, 'editors')).toBe(true);
    expect(ofType(events, 'rewardUsed').some((e) => e.commission === 'immediate')).toBe(true);
  });
});

describe('hotel upgrades', () => {
  it('re-price at the ceremony to minutes of home income, and department levels close', () => {
    const s = hotelState();
    const homeIncome = N.toNumber(certifyMarkets(s, T, referenceHotelPool(s, T), { home: 1 }).income);
    expect(N.toNumber(hotelUpgradeCost(s, T, 'editors')!) / homeIncome).toBeCloseTo(T.hotel.upgrades.costSeconds, 0);
    s.bananas = N.of(1e30);
    expect(buyDeptLevel(s, T, collector().sink, 'editing')).toBe(false);
  });

  it('Editors upgrades raise capacity; Bus Wrangler and Shift Crew upgrades shorten waits', () => {
    const s = hotelState();
    s.bananas = N.of(1e30);
    const pool = N.toNumber(hotelPool(s, T));
    const onboard = onboardingTicks(s, T);
    buyHotelUpgrade(s, T, collector().sink, 'editors');
    buyHotelUpgrade(s, T, collector().sink, 'shiftCrews');
    expect(N.toNumber(hotelPool(s, T))).toBeGreaterThan(pool);
    expect(onboardingTicks(s, T)).toBeLessThan(onboard);
  });
});

describe('objectives and previews', () => {
  it('pinning a different objective after completion is recorded', () => {
    const { events, sink } = collector();
    const s = hotelState(1, sink);
    pinAndRun(s, 'immediate', sink);
    expect(pinObjective(s, T, sink, { kind: 'commission', id: 'permanent' })).toBe(true);
    const pins = ofType(events, 'objectivePinned');
    expect(pins.at(-1)!.previous).toEqual({ kind: 'commission', id: 'immediate' });
  });
});

function structuredCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe('auto staff (the shipped game)', () => {
  it('crews and the market split follow the suggestions every tick, and a hand-set split holds until automatic is back on', () => {
    const s = hotelState();
    const { sink } = collector();
    expect(s.shares).toEqual(suggestHotelShares(s, T));
    expect(setShares(s, T, sink, { recruiting: 0.2, construction: 0.2, editing: 0.6 })).toBe(false);
    expect(pinObjective(s, T, sink, { kind: 'commission', id: 'immediate' })).toBe(true);
    run(s, T, sink, 1);
    expect(marketAutoOn(s, T)).toBe(true);
    expect(s.hotel!.allocation).toEqual(suggestMarketAllocation(s, T, s.objective));
    expect(setMarketAllocation(s, T, sink, { home: 1, cyrillic: 0, greek: 0 })).toBe(true);
    run(s, T, sink, 50);
    expect(marketAutoOn(s, T)).toBe(false);
    expect(s.hotel!.allocation.home).toBe(1);
    expect(setMarketAuto(s, T, sink, true)).toBe(true);
    expect(s.hotel!.allocation).toEqual(suggestMarketAllocation(s, T, s.objective));
  });

  it('a pinned Commission completes on automatic alone, with no other input', () => {
    const s = hotelState();
    const { sink } = collector();
    pinObjective(s, T, sink, { kind: 'commission', id: 'immediate' });
    const eta = previewCommission(s, T, 'immediate')!.etaSeconds;
    const used = runUntil(s, sink, () => s.hotel!.commissions.immediate!.status !== 'active', secs(400))!;
    expect(s.hotel!.commissions.immediate!.status).toBe('completed');
    expect(Math.abs(used * T.tickSeconds - eta)).toBeLessThanOrEqual(Math.max(5, eta * 0.1));
  });
});
