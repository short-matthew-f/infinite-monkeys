// Accelerated prototype tuning (PROTOTYPE.md §3, §4). Data only.
// Every number here is a hypothesis for the M2 sim to validate.

import type { Tuning } from '../core/tuning.js';

// The economy without the quarterly budget: free funding shares the player sets
// at any time. Kept for tests and sims of that mode; the game runs prototypeTuning.
export const classicTuning: Tuning = {
  tickSeconds: 0.1,
  typingSpeed: 5,
  editorInChiefCapacity: 2,
  reviewSpeedPerEditor: 2,
  fundingScale: 3,
  suggestedEditingShareCap: 0.5,
  hire: { baseCooldownSeconds: 10, zenoCostBase: 25, zenoCostGrowth: 8 },
  desks: { start: 1, costBase: 10, costGrowth: 1.15, constructionBufferMin: 5, constructionBufferFrac: 0.1 },
  // M2 tuning. Pacing levers: stage costs gate the segments; uneven
  // self-replication rates make Readiness balance drift, so funding must be
  // rebalanced (DESIGN.md §3: "meters fill at uneven rates").
  // Editing scales harder at stages 3-4 because review demand tracks the
  // monkey *stock*, which outgrows the recruiting *flow* under replication.
  depts: {
    recruiting: { perLevel: 0.05, levelCostBase: 20, levelCostGrowth: 1.15, stageCosts: [20_000, 4_000_000, 40_000_000], stageMult: [1, 3, 8, 20], selfRepRate: 0.004 },
    construction: { perLevel: 0.05, levelCostBase: 20, levelCostGrowth: 1.15, stageCosts: [20_000, 4_000_000, 40_000_000], stageMult: [1, 3, 8, 20], selfRepRate: 0.003 },
    editing: { perLevel: 1, levelCostBase: 15, levelCostGrowth: 1.15, stageCosts: [20_000, 4_000_000, 40_000_000], stageMult: [1, 4, 40, 400], selfRepRate: 0.0035 },
  },

  // Exclusive classification: p is the rate of submissions whose longest
  // meaningful unit is this tier. Value per review unit rises with tier.
  tiers: [
    { id: 'letters', p: 0.2, reviewCost: 1, value: 1, startsDiscovered: true, researchCost: 0, discoveryBananas: 0, discoveryGolden: 0 },
    { id: 'words', p: 0.02, reviewCost: 3, value: 20, startsDiscovered: false, researchCost: 50, discoveryBananas: 50, discoveryGolden: 1 },
    { id: 'phrases', p: 0.002, reviewCost: 10, value: 400, startsDiscovered: false, researchCost: 1_000, discoveryBananas: 1_000, discoveryGolden: 1 },
    { id: 'sentences', p: 0.0002, reviewCost: 30, value: 8_000, startsDiscovered: false, researchCost: 20_000, discoveryBananas: 20_000, discoveryGolden: 2 },
  ],
  // Proposed in M2: mid-game research so the window between stages 3 and 4
  // has meaningful purchases (DESIGN.md §2 common research: typing speed).
  typingResearch: { costBase: 100_000, costGrowth: 2.5, mult: 1.25 },
  // Review research is implemented but not offered in the prototype: tried in
  // M2 to fill mid-game gaps, it barely helped (spare capacity only certifies
  // near-worthless letters) and it shifted the run's pacing and the bank at
  // declaration. See M2 findings F1 and F4.
  reviewResearch: { costBase: 150_000, costGrowth: 2.5, mult: 0.8 },
  milestones: [
    { id: 'office', desks: 2 },
    { id: 'building', desks: 11 },
    { id: 'tall', desks: 1_001 },
  ],
  readiness: { minMonkeys: 50_000, ratioThreshold: 0.9, stabilitySeconds: 60 },
  hotel: {
    homeMarket: 'home',
    ceremonyMarket: 'cyrillic',
    markets: [
      { id: 'home', value: 10, reviewCost: 1 },
      { id: 'cyrillic', value: 6, reviewCost: 1 },
      // Greek sits between Cyrillic and home (8 vs 6 vs 10 per review unit),
      // so later Commissions there cost less income than Cyrillic ones.
      { id: 'greek', value: 8, reviewCost: 1 },
    ],
    busWaitSeconds: 30,
    onboardingSeconds: 30,
    // Hotel upgrades re-price at the ceremony (proposed in M2). First level =
    // 450 s of reference home income: across arrival balances of 60-240 s,
    // this is the price where Immediate both beats ordinary publishing to the
    // next upgrade and pays off within 3 minutes (M2.2 sweep). 300 s only
    // works for balances under ~1 min; 600 s misses the payoff window.
    funding: { idleEditing: 1, referenceEditing: 0.9, pendingCrew: 0.5, minCrew: 0.05 },
    upgrades: { costSeconds: 450, costGrowth: 1.5, editingMult: 1.15, busWaitMult: 0.8, onboardingMult: 0.8 },
    commissions: [
      { id: 'immediate', kind: 'immediate', requirements: [{ market: 'cyrillic', capacityMinutes: 3 }], deadlineSeconds: 300, reward: { type: 'bananas', forgoneMultiplier: 1.5 } },
      { id: 'permanent', kind: 'permanent', requirements: [{ market: 'cyrillic', capacityMinutes: 8 }], deadlineSeconds: 720, reward: { type: 'golden', amount: 10 } },
      {
        id: 'expansion',
        kind: 'expansion',
        requirements: [
          { market: 'cyrillic', capacityMinutes: 5 },
          { market: 'home', capacityMinutes: 3 },
        ],
        deadlineSeconds: 720,
        reward: { type: 'market', market: 'greek' },
      },
      // Expansion's practical payoff: a Greek Commission offered when Greek
      // comes online, funding one epic item (M2.1, proposed).
      {
        id: 'greekVerse',
        kind: 'permanent',
        offerWhen: { marketOnline: 'greek' },
        requirements: [{ market: 'greek', capacityMinutes: 3 }],
        deadlineSeconds: 360,
        reward: { type: 'golden', amount: 10 },
      },
    ],
  },
  // Cyrillic Specialists must beat Senior Editors in Cyrillic:
  // cost ×0.65 is +54% Cyrillic throughput vs +15% everywhere.
  epics: [
    { id: 'seniorEditors', cost: 10, effect: { type: 'reviewSpeed', mult: 1.15 } },
    { id: 'cyrillicSpecialists', cost: 10, effect: { type: 'marketReviewCost', market: 'cyrillic', mult: 0.65 } },
    { id: 'fasterShiftCrews', cost: 10, effect: { type: 'onboardingTime', mult: 0.5 } },
  ],
  offlineCapSeconds: 4 * 3600,
};

// The shipped tuning: the classic economy plus the quarterly budget (DESIGN.md §13).
export const prototypeTuning: Tuning = {
  ...classicTuning,
  // Stages cost 25% more than classic: the heads' projects (morale, managers, audits...)
  // speed the climb, and this keeps the casual game inside 25-35 minutes (sim, Oct 8 2026).
  depts: Object.fromEntries(Object.entries(classicTuning.depts).map(([d, v]) => [d, { ...v, stageCosts: v.stageCosts.map((c) => c * 1.25) }])) as Tuning['depts'],
  // Editing's self-replication catches up while it's behind on reviews (DESIGN.md §13): a department that reaches
  // stage 4 after the others would otherwise trail their exponential head start for 30+ minutes.
  readiness: { ...classicTuning.readiness, editingCatchUpMax: 4 },
  budget: { quarterSeconds: 180, suggestedDiscretionary: 0.7, minDiscretionary: 0.1, sweepShare: 1, editingShareCap: 0.35, readinessEditingShareCap: 0.8,
    requisitions: { levels: 3, priceFactor: 0.8, openSeconds: 60, cooldownSeconds: 10 },
    morale: { max: 1.6, fadePerSecond: 0.002 },
    // Projects the heads request mid-quarter. Price: share of a quarter's reference wallet income.
    projects: [
      { id: 'pizzaParty', from: 'facilities', price: 0.075, priceGrowth: 1, max: null, unlock: { milestone: 'building' }, effect: { type: 'morale', add: 0.3 } },
      { id: 'teamBuilding', from: 'facilities', price: 0.175, priceGrowth: 1, max: null, unlock: { minStage: 2 }, effect: { type: 'timed', target: 'output', mult: 1.5, seconds: 180 } },
      { id: 'escapeRoom', from: 'facilities', price: 0.15, priceGrowth: 1, max: null, unlock: { minStage: 2 }, effect: { type: 'timed', target: 'review', mult: 1.4, seconds: 180 } },
      { id: 'bathrooms', from: 'construction', price: 0.2, priceGrowth: 1.6, max: 3, unlock: { milestone: 'building' }, effect: { type: 'perm', target: 'recruiting', mult: 1.25 } },
      { id: 'breakRoom', from: 'construction', price: 0.1, priceGrowth: 1, max: 1, unlock: { milestone: 'building' }, effect: { type: 'offline', seconds: 2 * 3600 } },
      { id: 'snackMachine', from: 'construction', price: 0.125, priceGrowth: 1, max: 1, unlock: { milestone: 'building' }, effect: { type: 'perm', target: 'moraleFade', mult: 0.5 } },
      { id: 'audit', from: 'accounting', price: 0.2, priceGrowth: 1, max: null, unlock: { minStage: 2 }, effect: { type: 'audit', returnMult: 1.5, seconds: 60 } },
      { id: 'efficiencyFinding', from: 'accounting', price: 0.25, priceGrowth: 1.6, max: 5, unlock: { minStage: 2 }, effect: { type: 'perm', target: 'levelCost', mult: 0.9 } },
      { id: 'managers', from: 'training', price: 0.25, priceGrowth: 1.6, max: 3, unlock: { milestone: 'building' }, effect: { type: 'perm', target: 'stageCost', mult: 0.75 } },
      { id: 'communicationClass', from: 'training', price: 0.2, priceGrowth: 1.6, max: 3, unlock: { minStage: 2 }, effect: { type: 'perm', target: 'review', mult: 1.15 } },
      { id: 'speedReading', from: 'training', price: 0.2, priceGrowth: 1.6, max: 3, unlock: { minStage: 2 }, effect: { type: 'reviewResearch' } },
    ] },
};
