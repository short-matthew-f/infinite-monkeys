# Infinite Monkeys: Design Document

**Version:** v0.3.6. Supersedes v0.3.5 (handoff; see §0).
**Status:** Direction settled. Ready for the transition prototype (see `PROTOTYPE.md`).
**Working title:** unselected.
**Platform:** PWA, TypeScript.

All numbers are hypotheses until the prototype and simulation confirm them. Items marked **(proposed)** are Claude's recommendations not yet confirmed by Matt.

---

## 0. What Changed

### v0.3.6

Approved after review: first hotel upgrade at 450 s of reference income; Immediate at 1.5×; suggested hotel funding runs 100% Editing when crews have no work, while the reference share that freezes offers and prices stays at 90%. Previews assume the suggested funding, not the reference. Ready for UI work (`docs/HANDOFF-M3-M4.md`).

### v0.3.5

M2.2 (pending sign-off, `PROTOTYPE.md` §13 D7, D8): first hotel upgrade at 450 s of reference income, chosen from an arrival-balance sweep; the reference funding share is now a separate setting from the idle suggestion; previews of custom splits account for market readiness.

### v0.3.4

M2.1, after external review (pending sign-off, see `PROTOTYPE.md` §13 D6):

- **Reference pool.** Commission requirements, frozen rewards, and hotel upgrade prices are set from owned editorial capability at a reference funding share (the suggested idle Editing share), so moving funding around can't game them.
- **Hotel funding.** Recruiting and Construction matter only to buses and onboarding after infinity, so the suggestion runs Editing-heavy and shifts to a crew while its work is pending. Starving crews slows buses.
- **Greek's payoff.** Greek earns more per review unit than Cyrillic, and a Greek Commission is offered when it comes online.
- **Previews and timers** account for waiting; jobs underway speed up with upgrades.
- **Bank-based pricing withdrawn** (it would penalize saving).

### v0.3.3

M2 simulation findings, all pending decisions (see `PROTOTYPE.md` §13 and the repo README):

- **Hotel upgrades re-price at the ceremony.** After infinity, department levels cost a fraction of a second of income, so bananas bought nothing. Proposed: Editors, Bus Wranglers, and Shift Crews upgrades, first level at ~10 min of home income.
- **Immediate's two goals conflict at 1.5×** (winning banana rush vs paying off within 3 min).
- **The bank at declaration is fragile** and flips the Immediate result.
- **Letters dominate review demand,** so spare editing capacity only certifies near-worthless finds.
- **Faster-typewriters research** added as a mid-game goal (common research, §2).
- **Proposed metric definitions:** rebalancing episodes; rebalancing counts toward dead-gap actions.

### v0.3.2

- **Golden Bananas confirmed** as the epic research currency, earned only from Commissions and first discoveries, never purchasable.
- **Window views confirmed:** Street level → City skyline → Above the clouds → Low orbit → Deep space → Parallel universes.
- **Commission offers freeze when made** (requirement and reward). Logged as a design rule (#44).
- **Specialist upgrades must beat global upgrades in their own market** (#45).

### v0.3.1

- **Home market.** The finite operation carries over into the hotel as the familiar-language market, with the best baseline income. New markets are lower-ratio and matter because Commissions demand them (C20).
- **First bus framing.** The ceremony's bus arrives alongside the first Commission offers, so a lower-ratio market reads as "where the Commissions are" (C20).
- **Allocation assertion tightened.** Each Commission's suggested allocation must differ from Maximize bananas, not from other Commissions (C21).
- **Non-dominance uses declared strategy profiles** instead of any plausible weighting (C21).
- Fixed this section's v0.3 summary, which said C11 to C16 when the table runs to C18 (C22).

### v0.3


- **Phase identity reframed.** Before ℵ₀ the player keeps departments supplied. After ℵ₀ the player chooses publishing objectives. (Replaces "how much vs which.")
- **Post-ℵ₀ markets are stable.** Tradeoffs come from competing Commissions, not demand decay (deferred).
- **Production accounting fixed.** Each submission classifies into exactly one tier. Discovery is a deterministic accumulator.
- **Editor-in-Chief.** The opening stamp is the player: fixed baseline editorial capacity under normal rules.
- **Funding shares.** Permanent department upgrades plus freely adjustable shares replace the vague payroll budget.
- **Objectives.** One pinned objective at a time. Auto-allocation follows it. Previews show what's given up.
- **Unlock chain.** Commissions unlock market access; buses deliver unlocked markets; Shift Crews bring them online.
- **Clue gate** gets a deterministic fallback.
- **Power Set** targets the room set. The Annex's own power set is a post-v1 hook.
- **Zones become the view outside the windows.**
- Corrections C11 to C18 added; decision log extended.

---

## 1. Premise and Pillars

An idle game about the infinite monkey theorem. You start as the Editor-in-Chief with one monkey at one desk. You end up running a hotel with infinitely many rooms, then discover that infinity comes in sizes.

**Pillars**

1. **Egg, Inc. feel.** Tap-to-hire, visible bottleneck bars, Commissions, prestige, offline silos, a diorama that grows.
2. **Infinity changes the job.** Before ℵ₀: grow production and keep departments supplied. After ℵ₀: choose publishing objectives and organize an infinite supply to fulfill them.
3. **Show consequences, then automate the routine.** Arithmetic is fine. The player must understand what a choice accomplishes and what it delays.
4. **Humor lives in presentation.** The feed and the bureaucracy carry the jokes. Mechanics stay readable without the math.
5. **Humor ratio.** Gentle whimsy is always present (decision 47); absurdity escalates with height. Human moments in the feed are rare (~1 line in 40).
6. **Prove the payoff before tuning the climb.** The transition prototype comes before long-curve balancing.

---

## 2. Production Model

### Roles in the loop

| Egg, Inc. | This game |
|---|---|
| Chickens | **Monkeys**, hired by tap with a cooldown |
| Eggs | **Keystrokes** |
| Housing | **Desks** |
| Shipping | **Editors** (certification capacity) |
| Cash | **Bananas** |

### Production rules

1. **Expected-value base earnings.** Rates are computed, not rolled. Progression never depends on luck.
2. **Rare finds are celebrations.** Rolled bonus events on top of the base stream. Never required.
3. **Exclusive classification.** Typing produces submissions. Each submission is classified into exactly **one** tier: the longest meaningful unit it contains. A sentence pays as a sentence, never also as its words.
4. **Unreviewed submissions are discarded.** No backlog. Waste is shown on the bars.
5. **Editors are the output cap.** Certification is the bottleneck in both phases.

### The Editor-in-Chief

The opening stamp is the player. It provides a fixed **baseline editorial capacity** under exactly the same rules as hired Editors. Hired Editors add to it. Because it never scales, it naturally shrinks into irrelevance as the department grows.

The Editor-in-Chief always reviews discoverable-but-undiscovered tiers first, so discovery progress never stalls.

### Finite-phase formula

For each tier *t*:

```
find_rate[t]       = keystrokes_per_sec × p(t)
review_capacity[t] = editing_capacity × allocation[t] / review_cost[t]
certified[t]       = min(find_rate[t], review_capacity[t])
income             = Σ certified[t] × value[t]
```

- `p(t)` = expected submissions classified into tier *t* per keystroke. Falls steeply with tier.
- `editing_capacity` = Editor-in-Chief baseline + hired Editors × review speed × funding effect (§3).
- `review_cost[t]` rises with tier. `value[t]` rises faster.
- Allocation is a supply-matching problem: Editors assigned to a tier with too few finds sit idle.

### Discovery

1. **Research makes a tier discoverable.**
2. A **discovery accumulator** sums expected certified finds for that tier. It advances deterministically.
3. **Crossing 1.0 triggers discovery:** the tier unlocks for normal production and pays a one-time reward.
4. **Discovery rewards (including Golden Bananas) are once per save**, not once per run, so resets can't farm them.

### Tier ladder (finite strings only)

1. Letters / syllables
2. Real words
3. Phrases
4. Sentences
5. Verse
6. Chapters
7. *Hamlet*
8. The Library of Babel

Longer finite books never produce the uncountable leap. That comes from infinite manuscripts and subsets (§5).

### Objectives and allocation

- **One objective is pinned at a time.** Default: **Maximize bananas.** Others: a specific Commission, or Infinity Readiness.
- **Allocation previews** show the effect of a change on income and on the pinned objective's ETA. The player sees what a choice delays before making it.
- **Suggested split.** The game always shows a recommended allocation for the pinned objective.
- **Auto-allocate** (mid-game research) applies the suggested split continuously. Different objectives produce different splits. Automation handles staffing; the player keeps the publishing decision.

### Currencies

| Currency | Source | Use |
|---|---|---|
| **Bananas** | Certified finds | Common research, staff, capacity |
| **Golden Bananas** | Commissions; first discoveries (once per save) | Epic research (permanent). Never purchasable. |
| **Acclaim** | Publish | Prestige multiplier |

### Research

- **Common research:** typing speed, review speed, review cost reduction, desk capacity, banana value, offline efficiency, hire cooldown, tier discoverability. Bananas.
- **Epic research:** permanent, carries across Publishes. Golden Bananas.

### Side systems

- **Commissions:** time-limited objectives. Rewards are bananas, Golden Bananas, or (post-ℵ₀) market access. Several compete at once.
- **Boosts:** Coffee (typing), Banana Smoothie (editing).
- **Drones:** a tourist, a parrot, an interloper crosses the screen. Tap for a bonus. Post-ℵ₀ the Concierge handles them.
- **Break Room:** offline duration.

### The feed

Ticker of rejected transcripts: mostly gibberish with accidental matches highlighted, near-misses ("to be or not to bee"), and rare human moments.

---

## 3. Phase 1: The Finite Climb

**The job:** grow production and keep departments supplied.

**Capacity ladder:** one desk → office → building → floors → infinitely tall building ("don't ask questions").

### Three departments

| Department | Controls | Upgrade lines folded in |
|---|---|---|
| **Recruiting** | How fast available desks fill | Hire cooldown (Zeno), HR capacity |
| **Construction** | How fast capacity grows | Elevators, permits, floor height |
| **Editing** | How fast submissions become bananas | Review speed, review cost, allocation tools |

Elevators, HR, and permits are upgrade lines inside departments, not independent mechanics.

**Each department scales in four stages:** individuals → teams with managers → departments → self-replicating. Stage 4 is the on-ramp to infinity.

### Funding shares

Two separate layers:

| Layer | What it is | Cost |
|---|---|---|
| **Capability** | Permanent department upgrades (staff, stages, research) | Bananas. Purchases are never lost. |
| **Funding shares** | How the payroll is split across departments, summing to 100% | Free to adjust at any time |

- **Effective output = capability × funding effect.** Equal shares give each department its base output. Shifting share up boosts one department and slows the others.
- **Overshoot is waste, not punishment.** A department producing more than its neighbors can absorb wastes output, shown on the bars:
  - Recruiting beyond available desks: hires wait in the lobby.
  - Construction beyond incoming hires: empty floors.
  - Editing beyond available submissions: idle Editors.
- **Preview before purchase and before reallocation.** Every change shows its effect on all three meters and on the pinned objective.

### Infinity Readiness

Appears in the late Phase 1.

1. Three meters (Recruiting, Construction, Editing) fill toward **self-sustaining**: stage 4 running, with output keeping pace with demand from the other two.
2. Pinning Readiness makes suggested shares target the meters rather than income.
3. **Stability Window:** all three full for ~60 s. **Accrues offline** if conditions stay satisfied.
4. **Infinity Permit:** presentation only, stamped automatically when the window completes.
5. **Declare Infinity.**

Target 2 to 3 rebalancing decisions in the last stretch.

---

## 4. Phase 2: The Hotel (ℵ₀)

**The job:** choose publishing objectives and organize the infinite supply to fulfill them.

### The infinity ceremony

1. Stability Window completes; the Infinity Permit stamps.
2. Player taps **Declare Infinity**.
3. Camera pans up an endless building.
4. Monkey counter spins and flips to **ℵ₀**.
5. Job titles flip one by one. The roster keeps "formerly: Builder."
6. The ceremony grants access to a **first new market**. Its bus arrives within the first minute, **alongside the first Commission offers**, so the new loop starts immediately and the new market's purpose is obvious on arrival.

### Staff transformation

| Before | After | Role |
|---|---|---|
| Builders | **Shift Crews** | Bring delivered markets online (seating arrivals: room n to 2n) |
| Recruiters | **Bus Wranglers** | Set how long a bus takes to arrive after access is unlocked; later, buses of buses (prime-power trick) |
| Editors | Editors | Certify output. The bottleneck. |
| (new) | **Concierge** | Drone events and tap bonuses |
| Elevator Operators | Retired | Farewell party that never ends (no top floor) |

Funding shares continue across the three transformed departments.

### The hotel economy

**Principle:** the infinite population is symbolic. Spendable production is **certified editorial throughput**, which stays finite.

- The hotel supplies **unlimited candidate manuscripts** in every online market. Find rate no longer limits anything.
- **The home market carries over.** The finite operation becomes the familiar-language market, with the best baseline income. New markets have lower ratios; their value comes from the Commissions that require them.
- **Markets are stable.** Each has a fixed value and review cost.

```
certified[m] = editing_capacity × allocation[m] / review_cost[m]
income       = Σ certified[m] × value[m]
```

- Under "Maximize bananas," the home market wins outright. **That's intended.** Every Commission diverts Editors from it, so every Commission has a production cost.

### The unlock chain

```
Commission reward → market access → bus arrives (Bus Wranglers set the wait)
                  → Shift Crews bring it online → market available for allocation
```

- **Buses only arrive for markets you've unlocked.** A bus is never ceremony.
- Each bus visually carries a **character set** (an alphabet, a typeface). The alphabet is the visual; the market is the mechanic.

### Competing Commissions

Several Commissions are offered at once, each requiring certified deliveries in a specific market within a time limit. Typical reward types:

| Reward | What it gives | What it costs |
|---|---|---|
| **Immediate** | A large banana payout | Short-term only |
| **Permanent** | Golden Bananas for epic research | Income now for strength later |
| **Expansion** | Access to a new market | Income now for future options |

Pinning a Commission moves Editors off the best-ratio market. The preview shows the income lost and the ETA. The intended moment: *"I chose permanent research over immediate income, and I understood what that would delay."*

### Shredder (Ross-Littlewood)

Editors add and shred transcripts forever:

- **Oldest-first:** the archive ends empty. No clutter.
- **Newest-first:** infinitely many survivors. Rare finds kept.

### The Uncountable Bus

Late in Phase 2, a bus arrives that can't be unloaded. Shifting fails for the first time. This opens Phase 3.

---

## 5. Phase 3: The Continuum Annex

No number of extra monkeys reaches an uncountable collection.

- **Diagonalists** take the list of every monkey's infinite manuscript and write one that differs from monkey n's at position n. Each is a **Diagonal Manuscript**, the new currency.
- **The Continuum Annex** is built by taking the **Power Set of the hotel's room set**. It has the size of the continuum, 2^ℵ₀.

| Operation | Target | Effect |
|---|---|---|
| **Double the Annex** | The Annex | Nothing. Doubling an infinite set preserves size. Facilities reports "no change." Cheap joke upgrade, once. |
| **Power Set** | The room set | Builds the Annex at continuum size. The real operation. |
| Power Set of the Annex | The Annex | Strictly larger than the continuum. **Post-v1 hook only.** |

### The proof (convergence)

1. Assume the list of manuscripts is complete.
2. Build the diagonal.
3. Find the contradiction: the collection is uncountable.
4. Administrative ruling (under Axiom A): the Annex is ℵ₁.

Step 4 is presented as a ruling, which sets up the later reveal.

### Publish (prestige)

Completing the proof is the **first Publish**.

- **Resets:** bananas, building, staff, Annex.
- **Earns:** Acclaim, scaled by Diagonal Manuscripts.
- **Persists:** epic research, Golden Bananas, once-per-save discovery records, collected clues. Later runs reach ℵ₀ much faster.

---

## 6. Late Game and v1 Scope

### Axiom B (post-v1)

Players live in Axiom A (the continuum equals ℵ₁) without it being named. Axiom B is the negation of CH: the continuum is larger than ℵ₁, with intermediate sizes between ℵ₀ and the continuum. ℵ₁ is still the next size after ℵ₀; what changes is the Annex's identity.

**Discovery gate (two keys):**

- **Third Publish**, and
- **3 clues.** Guaranteed clues appear in runs 2 and 3. The third is a rare find from any run, with a **deterministic fallback**: if it hasn't appeared by the end of run 4, it arrives through a scripted event.

**Unlock:** **Forcing** research (Cohen's technique). **Forcers** build a different hotel next door, where the Annex is bigger than ℵ₁.

**Reveal tone:** calm panic. The Editors realize their ruling was one of two valid rulings.

**After discovery:** pick A or B per run at each Publish.

### v1 scope

- **v1 ends on a complete arc:** the climb, ℵ₀, the hotel, the Continuum Annex, Publish, and replaying under Axiom A.
- **Forcing is hidden in v1.** No locked node, no "requires funding" text.
- **Clues ship as feed flavor** with no implied unlock. **Collected clues persist in the save** so the update recognizes them. The Clue Binder ships with the update.

---

## 7. Paradox Register

**Placement rule:** at most one paradox per view (§8). A paradox earns a mechanic slot only if it changes a decision; otherwise it goes to the feed.

| Paradox | What it does | Where | Status |
|---|---|---|---|
| **Zeno's cooldown** | Each upgrade halves the remaining cooldown. Never reaches zero. | Early | **In** |
| **Grandi's ledger** | Accounting's books read 1 − 1 + 1... "Creative Accounting" chooses the grouping. Accounting insists 1 + 2 + 3... = −1/12. | Mid | **In** |
| **Ross-Littlewood shredder** | Oldest-first empties the archive; newest-first leaves infinitely many survivors. | Phase 2 | **In** |
| **Hilbert doubling** | "Double the Annex" changes nothing. | Phase 3 | **In** |
| **Banach-Tarski** | Duplication upgrade. Must duplicate Editors or character sets, never monkeys. | Phase 2 | Maybe |
| **Ordinal order** (ω+1 vs 1+ω) | Queue puzzle for Shift Crews. | Phase 2 | Maybe |
| **Russell's Index** | Catalog of catalogs that don't list themselves. | Mid | Feed-only |
| **Infinite hats** | Rare event minigame. | Event | Prototype-dependent |

---

## 8. Presentation

### Layout (portrait)

- **Top:** feed ticker, one line at a time; tap to expand history.
- **Center:** the operation as a side-view cross-section diorama. Monkeys type; Editors stamp approved pages.
- **Below center:** bottleneck bars, then department meters.
- **Bottom:** the **Hire** button, with research, staff, and Commission tabs.

### Views through the windows (replaces zones)

Zones are the world outside the windows, changing as the building rises. The first camera pullback reveals the first window.

1. Street level
2. City skyline
3. Above the clouds
4. Low orbit
5. Deep space
6. Parallel universes (visible only near ℵ₀)

### Camera

- Opens tight on one desk.
- Pulls back as capacity grows. Once floors exist, the building scrolls vertically.
- At ℵ₀, pans upward through floors that blur into an endless column.

### Feedback

- Every purchase changes the diorama.
- Certified finds float up from Editors' desks as stamped pages, sized by tier.
- First discoveries get a short celebration and a feed line.
- Wasted output and idle staff are visible on the bars, never hidden in a menu.

---

## 9. Numbers (Hypotheses)

### Rhythm and run targets

**Check-in rhythm:** 3 to 4 times per day.

| Milestone | Casual | Hard |
|---|---|---|
| ℵ₀ | ~5 days | ~2 days |
| First Publish | ~10 days | ~4 days |

### Phase 1 stage pacing (casual)

| Stage | Range | Time |
|---|---|---|
| Desk | 1 monkey | Second desk at ~30 s |
| Office | up to ~10 | 10 min to 1 hr |
| Building floors | ~10 to ~1,000 | 1 to 8 hrs |
| Tall building | ~1,000 to ~1M | 8 to 36 hrs |
| Staffing convergence | ~1M to "unbounded" | 1.5 to 4 days |
| Infinity Readiness | last ~10% | ~8 to 12 hrs plus the Stability Window |

The playthrough (Appendix A) runs faster than this table in the first hour. Both remain hypotheses; the prototype decides which early pace satisfies.

### Phase 2 and 3 pacing (casual)

| Stage | Time |
|---|---|
| Hotel economy | ~3 days |
| Continuum Annex and proof | ~2 days |

### Cost and output

- Within a tier: cost ×1.15 per purchase.
- Tier jumps: capacity ×~10, cost ×~50.
- Output per monkey flat early; growth from multipliers.
- Display: plain to 1M, named suffixes, then scientific. ℵ₀ replaces the number.

### Zeno's cooldown

- Base 10 s, `10 / 2ⁿ`, cost ×8 per level.
- Faster than tapping by level ~6. Further levels are vanity. Recruiters automate hiring later.

### Offline (Break Room)

- Starts at ~4 hrs (daytime gaps at 3 to 4 check-ins).
- ~10 hrs by mid Phase 1 (overnight).
- ~12 hrs by the end of Phase 1.

### Pacing risk

The middle of Phase 1 is where idle games sag. One new system or view change roughly every 6 hours.

---

## 10. Simulation Spec

### Architecture

```
core/      pure logic: state, formulas, tick, offline catch-up, seeded RNG, number wrapper
sim/       bots, runner, metrics, golden runs
game/      UI, service worker, persistence adapter
content/   feed lines, staff titles, research, tuning tables (data only)
```

- `game/` and `sim/` import `core/`. Nothing in `core/` imports from either.
- All pacing lives in `content/` tuning tables, so the accelerated prototype and the full game run the same code.

### Core purity (lint-enforced)

- No DOM, no `Date.now()`, no `Math.random()` in `core/`.
- Time injected as a tick count.
- Offline catch-up is a core function, called identically by game and bots.
- One big-number type behind a thin wrapper (`break_infinity.js` preferred).

### Randomness

| Stream | Drives | Rule |
|---|---|---|
| **Gameplay** | Drones, rare finds, clue drops | Affects economy |
| **Presentation** | Feed lines, cosmetics | Never affects economy (tested) |

### Determinism

- Fixed tick (~10/s); render interpolates.
- Same seed, same run. Random events across ~200 seeds, reporting p10/p50/p90.

### Offline equivalence

The same elapsed time under the same actions produces equivalent economic results, within tolerance, whether processed continuously or through catch-up (subject to the Break Room cap).

### Bots

| Bot | Policy |
|---|---|
| **Casual** | 3 to 4 check-ins/day; follows the suggested split; ignores drones half the time |
| **Hard** | Every ~10 min; takes every drone |
| **Idler** | Never taps |
| **Strategy searcher** | Searches purchase orders and objective choices, including saving for unlocks. Not assumed optimal. |

### Metric definitions

- **Meaningful purchase:** changes the binding bottleneck; unlocks a tier, market, or system; or raises progress toward the pinned objective by at least X% (start 5%).
- **Rebalancing decision:** a funding or allocation change that improves progress toward the **current objective** (income, a Commission, or Readiness) by at least Y% (start 10%), made after the previous setting had become suboptimal. A move that lowers income but advances the objective counts.
- **Dead gap:** time between meaningful purchases in an active session.

### Assertions

- Casual reaches ℵ₀ in 4 to 6 days and first Publish in 8 to 12 days.
- No dead gap over X minutes in an active session.
- 2 to 3 rebalancing decisions during Infinity Readiness.
- Offline equivalence within tolerance.
- Presentation stream changes don't alter the economy.
- **Each Commission's suggested allocation differs from Maximize bananas.** Commissions may share an allocation with each other (e.g. two in the same market for different durations).
- **No Commission reward type is dominant,** tested against **declared strategy profiles** fixed before tuning (e.g. next banana-funded upgrade fastest; a specified epic upgrade fastest; next market fastest). Each offer must show a credible advantage under at least one profile and a measurable sacrifice under the others. Weightings may not be adjusted after the fact to make a reward win.
- Discovery accumulator always progresses once a tier is discoverable (Editor-in-Chief guarantee).

### Reporting and golden runs

Each run reports time per stage, dead gaps, binding bottleneck and share, payback per upgrade, allocation over time, and rebalancing decisions. Baselines saved per bot; curve changes print a stage-time diff.

### Math sanity first

Closed-form estimate before simming a curve. If they disagree, find out which is wrong.

### Stack

- TypeScript strict; Vitest.
- IndexedDB saves, versioned schema, migration from day one.
- Offline from last-seen timestamp, clamped against backward clock jumps.
- Web push post-v1. DOM/CSS UI; canvas only for drones if needed.

---

## 11. Corrections

Recorded so they aren't reintroduced.

### Mathematical (v0.1)

| # | Original claim | Correction | Design change |
|---|---|---|---|
| C1 | Axiom B adds sizes between ℵ₀ and "the next size." | ℵ₁ is always next after ℵ₀. CH asks whether the continuum equals ℵ₁. Under ¬CH, intermediate sizes lie between ℵ₀ and the continuum. | Destination is the Continuum Annex, identified as ℵ₁ under Axiom A. |
| C2 | Diagonalization reaches ℵ₁. | It proves uncountability. Identifying ℵ₁ uses Axiom A. | Proof has a separate ruling step. |
| C3 | Each Annex upgrade "doubles" it via power set. | Doubling preserves infinite size; power set enlarges it. | Separate Double (joke) and Power Set (real). |
| C4 | Early tiers become trivially instant; longer books lead to the uncountable. | Finite strings almost surely appear by the time their length is typed, but certification still costs time. Uncountability comes from infinite manuscripts and subsets. | Editors are the post-ℵ₀ bottleneck; tier ladder is finite strings. |
| C5 | Random shredding keeps the archive full. | Random removal empties it with probability one. Newest-first leaves infinitely many survivors. | Oldest-first vs newest-first. |

### Design consistency (v0.1)

| # | Issue | Fix |
|---|---|---|
| C6 | Contradictory check-in rhythm and a 2 hr Break Room. | 3 to 4 check-ins; Break Room starts ~4 hrs. |
| C7 | One clue per Publish satisfied the gate automatically. | Guaranteed clues in runs 2 and 3 only. |
| C8 | Undefined premium currency. | Golden Bananas. |
| C9 | "Fraction of rooms productive" undefined. | Dropped. |
| C10 | Readiness overshoot had no cause or recovery. | Funding shares, preview, free reallocation. |

### v0.2

| # | Issue | Fix |
|---|---|---|
| C11 | Post-ℵ₀ allocation had a dominant strategy (all Editors to the best ratio). Demand decay would reward frequent checking over the 3 to 4 check-in rhythm. | Stable markets plus competing Commissions. Demand decay deferred. |
| C12 | First-discovery unlock was circular (can't review a locked tier). | Research makes a tier discoverable; a deterministic accumulator triggers discovery at 1.0. |
| C13 | "No double counting" wasn't implemented by the formula. | Exclusive classification: each submission pays at its longest matched tier only. |
| C14 | The third clue relied on a rare drop, contradicting "never depends on luck." | Deterministic fallback by the end of run 4. |
| C15 | Power Set had no stated target; applied to the Annex it overshoots the destination. | Power Set targets the room set. |
| C16 | The zone list (Backyard Shed, Zoo...) contradicted the office-ladder premise. | Zones became the view through the windows. |
| C17 | "How much vs which" didn't distinguish the phases (tiers already ask which). | Supplied departments vs chosen objectives. |
| C18 | Rebalancing metric required improved income, missing moves that advance Readiness. | Measured against the current objective. |

### v0.3

| # | Issue | Fix |
|---|---|---|
| C19 | (Prototype) Opening hotel content deadlocked: only one Commission was playable. Logged in `PROTOTYPE.md` P1. | Home market plus first-bus market plus expansion market. |
| C20 | New markets had no defined relationship to the finite operation, and the best-ratio market was the new one, so a Commission there cost nothing. | Home market carries over with the best ratio; new markets are Commission-driven. |
| C21 | "Allocation differs between objectives" was looser than intended, and non-dominance under "any plausible weighting" was too easy to satisfy. | Differs from Maximize bananas; declared strategy profiles. |
| C22 | §0 summary listed C11 to C16; the table ran to C18. | Fixed. |

---

## 12. Decision Log

### Decided

| # | Decision | Reason | Rejected |
|---|---|---|---|
| 1 | Egg, Inc. as the structural model | Preferred flow, pacing, presentation | n/a |
| 2 | Editors are the output cap | Characterful, nameable bottleneck; both reviews endorsed | Paper/ribbon supply |
| 3 | Infinity changes the job, not just the number | Core premise | ℵ₀ as a bigger number |
| 4 | ℵ₀ is a milestone inside a run | Prestiging as the game gets interesting feels bad | ℵ₀ as first prestige |
| 5 | Phase 1 is a three-department staffing problem | Late Phase 1 feels like orchestration | Pure purchase grind |
| 6 | Builders and Recruiters transform after ℵ₀ | Preserves investment | Obsolescence |
| 7 | Elevator Operators retire | No top floor | Keeping them |
| 8 | 60 s Stability Window, accruing offline | Stops spikes; doesn't punish absence | Instant; online-only |
| 9 | Completing the Continuum proof is the first Publish | Rules truly change | Another milestone |
| 10 | Single Acclaim currency | Easy to split later | Split Acclaim |
| 11 | Axiom A only for v1 | Scope | Both axioms |
| 12 | Axiom B is discovered | Stronger reveal; mirrors Gödel then Cohen | Menu choice |
| 13 | Discovery needs clues and the third Publish | Can't be rushed | Either key alone |
| 14 | A/B per run after discovery | Nobody locked out | Permanent choice |
| 15 | One paradox per view; mechanics before jokes | Humor ratio | Front-loading |
| 16 | Sim and game share one codebase | Prevents drift | Separate Python sim |
| 17 | PWA (TypeScript chosen by Claude) | Node and browser | Engine builds |
| 18 | 3 to 4 check-ins per day | Split the difference | 2-3; 4-5 |
| 19 | First Publish ~10 days, ℵ₀ ~5 | Equal weight to post-ℵ₀ | No run target |
| 20 | Prototype the transition first | The payoff must justify the climb | Phase 1 tuning first |
| 21 | Spendable output is certified throughput | Infinite rooms × rate isn't income | Output per room |
| 22 | Elevators, HR, permits fold into departments | Avoids warning-removal purchases | Independent mechanics |
| 23 | Expected-value production, exclusive classification, discarded backlog | Progression never depends on luck; clean accounting | Rolled finds; overlapping tiers; backlogs |
| 24 | Allocation exists in both phases; the job changes | Continuity plus a real shift | Unrelated per-phase decisions |
| 25 | v1 complete arc; Forcing hidden | A locked node reads like a paywall | "Requires funding" teaser |
| 26 | Separate gameplay and presentation RNG | Feed changes can't alter economy | One stream |
| 27 | Strategy searcher | Greedy misses saving for unlocks | Assumed-optimal bot |
| 28 | Stable markets plus competing Commissions | Avoids dominance and check-in pressure | Demand decay (deferred) |
| 29 | Deterministic discovery accumulator | Simpler than a separate exploratory process | Exploratory review process |
| 30 | Editor-in-Chief baseline capacity | Opening uses the same rules as the rest | Special-case opening stamp |
| 31 | Capability plus free funding shares | Purchases preserved; rebalancing understandable | Undefined payroll budget |
| 32 | One pinned objective; auto-allocation follows it | Automation handles staffing; player keeps the decision | Income-only automation |
| 33 | Commissions unlock access; buses deliver unlocked markets only | Links both unlock mechanisms; buses never ceremony | Buses bringing random markets |
| 34 | Discovery rewards once per save | Prevents reset farming | Per-run rewards |
| 35 | Clue fallback by end of run 4 | Discovery can't be missed | Pure rare drop |
| 36 | Power Set targets the room set | Lands exactly on the continuum | Power Set of the Annex |
| 37 | Zones are views through windows | Reconciles zones with the building | Separate locations |
| 38 | Clues persist in save during v1 | The update can recognize them | Discarding v1 clues |
| 39 | Arithmetic allocation is fine if consequences are shown | Genre-appropriate; visibility over removal | Removing allocation math |
| 40 | Home market carries over with the best baseline income | Continuity with the finite phase; every Commission costs production | New market as best ratio |
| 41 | Non-dominance tested against declared strategy profiles | Prevents tuning weights to fit the result | Any plausible weighting |
| 42 | Golden Bananas: epic currency from Commissions and first discoveries, never purchasable | Gives permanent research a clear purpose | Purchasable premium currency |
| 43 | Window views as the zone progression | Gives the growing building a visible journey | Separate locations |
| 44 | Commission requirements and rewards freeze when offered | Upgrades should shorten completion, never move the target | Live-scaling requirements |
| 45 | Specialist upgrades beat global upgrades in their own market | Otherwise the global upgrade dominates | Equal-strength upgrades |
| 46 | The place is the interface: a pop-up floor plan per floor, rooms open their own sheets (Matt, Oct 7 2026) | Roomy, no menu buttons; Egg, Inc.'s map model | Tab bar; cutaway dollhouse; paper theater |
| 47 | Whimsy is always present, from the first desk (Matt, Oct 7 2026) | Charm carries the early game | Straight-faced early game (amends #15 and §1 pillar 5: absurdity still rises with height, but the floor is never joyless) |
| 48 | Roomy means space between spaces, not ceiling height (Matt, Oct 7 2026) | Zones breathe; ceilings can stay low until the ceremony | Tall rooms |
| 49 | Adopted: the building of floors is the map; each room opens full screen with an exit door; no panning (Matt, Oct 8 2026; mockup `design/explorations/tower/`; game port in progress) | Clear organisation, wings and heads, quarterly rhythm | Pannable pop-up floor with two zoom levels (#46 stays until adopted) |
| 50 | Adopted (Matt, Oct 8 2026): a quarterly budget with discretionary income replaces the free funding slider (§13) | Make the budget count; leftover goes back into the budget | Free shares (today); lines as locked operating funding only |

### Open

- Working title.
- Banach-Tarski (duplicating Editors or character sets), ordinal order, infinite hats.
- Demand decay: revisit only if Commissions alone feel thin.
- Detailed Phase 2 and 3 curves (blocked on prototype).
- Number library final pick.
- Remaining M2 decisions (`PROTOTYPE.md` §13): rebalancing definition (D3), mid-game gaps (D4, F2), letters in Readiness (D5), M2.1 rules (D6), and whether to move the reference share to 100%.

### Cut

| Item | Reason |
|---|---|
| "Fraction of rooms productive" | Undefined over infinite rooms |
| Independent Elevator, HR, Permit mechanics | Folded into departments |
| Random-removal shredder keeping the archive full | Mathematically wrong (C5) |
| Locked "requires funding" Forcing node | Reads like a paywall |
| Separate exploratory discovery process | Replaced by accumulator (C12) |
| Original zone list as locations | Became window views (C16) |

---

## 13. Quarterly Budget (adopted Oct 8 2026)

Status: the game. `prototypeTuning` includes the budget; `classicTuning` is the
old free-shares economy, kept for tests and comparison sims
(`sim/budget-report.ts`). Saves from the classic game load as is: the budget
opens on the next tick, with a review waiting. Game pieces: the roof
quarter-clock and department account plates (`game/world/tower.ts`), the
quarter-end ceremony (`ceremony.ts`), requisition memos (`memo.ts`) and the
water cooler (`cooler.ts`). Mockup: `design/explorations/tower/`.

**Why.** Free funding shares were a solved knob: "Suggested" was nearly always
right, so the player pressed it whenever something drifted (Matt: "everything
feels a little chaotic"). The budget makes money allocation the decision, on a
rhythm.

**Rules.**
- The budget opens the first time a department exists. Until then every banana
  goes to the wallet, as today.
- A quarter lasts `quarterSeconds`. A signed budget has four lines that sum
  to 1: Recruiting, Construction, Editing and Discretionary (at least
  `minDiscretionary`).
- Income splits live by the lines. Discretionary fills the wallet
  (`s.bananas`), which pays for every manual purchase. Department lines fill
  department accounts, and each department buys its own levels from its
  account (`purchase` events with `by: 'department'`).
- At quarter end the unspent wallet (`sweepShare` of it) is swept into the
  pot, and a review opens. Signing splits the pot by the new lines. To save
  for a stage, sign a high discretionary share.
- Nothing waits for the player. A review left unsigned for a whole quarter
  closes on the previous lines (`missedReviews`). Offline catch-up runs the
  same ticks.
- The heads coordinate how hard each department works: funding shares follow
  `headShares` every tick, and `setShares` is refused in this mode. That's the
  `suggestShares` rule with the budget's own Editing cap (`editingShareCap`,
  0.35), raised to `readinessEditingShareCap` (0.8) once every department is
  at stage 4. The raise keys on stages, not on pinning Readiness, because the
  game never asks the player to pin. The budget decides growth; the free
  slider is gone.
- **Requisitions.** Mid-quarter, the head of the short department files a
  requisition: `levels` levels (3) at `priceFactor` (0.8) of their list price,
  paid from the wallet. Short means Editing while review demand outruns the
  pool, otherwise the lower-capability of Recruiting and Construction. One is
  open at a time. It expires after `openSeconds` (45 s) and never outlives its
  quarter. The next one waits `cooldownSeconds` (40 s) after the last closes.
  Grant (`grantRequisition`) or decline (`declineRequisition`). Outcomes go in
  the quarter report. The memo states the need and the price, never advice.
- Each quarter keeps a report (`QuarterReport`: income, hires, desks, finds
  certified and discarded, auto-levels, wallet spent, swept), so the review
  and the heads' presentations are a pure snapshot from core.
- At the ceremony the budget closes: the accounts and the pot return to the
  wallet, and the hotel phase is unchanged.
- `suggestBudget` applies the `suggestShares` rule to growth money. After the
  tuned discretionary share, it plans the quarter level by level: Editing's
  projected demand at quarter end first, then Recruiting and Construction
  together. It's a suggestion. Reports and heads state facts and never say
  which lines to sign.

**Projects and the support offices** (Oct 8 2026, from Matt's brief: "enough
weight to make people want to accept them, but enough drain on the budget that
you can't always accept everything").
- The heads' mid-quarter requests are one at a time. A request stays open for
  60 s, and the next one comes 10 s after the last closes. The gameplay random
  stream picks the next kind: a level block from the short department, or any
  available project. The same kind is never offered twice in a row.
- Projects come from Facilities, Construction (amenities), Accounting and
  Training. Their price is a share of a quarter's reference wallet income,
  which is income × quarter length × suggested discretionary, so the signed
  lines can't game it. The price is quoted when the memo is filed and paid from
  the wallet. Declining costs nothing.
- Effects (`core/office.ts`, finite phase only):
  - Morale is 1 normally. A pizza party raises it by 0.3, up to 1.6, and it
    fades back by 0.002/s, never below 1. Morale multiplies typing and
    department output.
  - Timed boosts last 180 s: team building gives department output ×1.5, and
    the escape room gives review speed ×1.4.
  - Permanent stacks:
    - bathrooms: Recruiting ×1.25, up to 3
    - efficiency findings: level cost ×0.9, up to 5
    - managers: stage cost ×0.75, up to 3
    - communication class: review ×1.15, up to 3
    - snack machine: morale fades at half speed
  - Break room: time-away allowance +2 h.
  - Audit: the fee comes back ×1.5 into the pot after 60 s.
  - Speed-reading: one level of review research.
- The quarter report lists every request and how it closed, plus funds that
  audits found, for the Chief Accountant's quarter-end slides.
- At the ceremony the heads hand funding back as an even split. Their last
  finite split used to carry into the hotel, which skewed the Commission
  previews by about 10%.
- Stages cost 25% more than classic, so the casual game stays inside 25–35
  minutes with projects.

**Sim with projects (Oct 8 2026).** The bots spend greedily, so most requests
arrive when their wallet is short. A "memo reader" bot weighs an open request
first and saves up for it when it's worth having.

| Bot | Declare | Requests accepted | Longest gap (counting decisions) |
|---|---|---|---|
| casual | 25.7 min | 10 of 22 | 270 s |
| memo reader | 25.8 min | 9 of 24 | 160 s |
| hard | 26.4 min | 6 of 22 | 280 s |
| idler | 27.0 min | 7 of 22 | 290 s |

About a third to a half of requests are accepted, so they are worth wanting,
and the drain is real. F2 is still unmet for the greedy bots.

**Not built.** A separate emergency review. Lifting the Editing cap at stage 4
closed the Readiness drag that it was meant to fix, and requisitions are the
mid-quarter lever. Growth-triggered quarters are not built either.

**Alternative noted, not built.** Lines as operating funding only (today's
multiplier, locked per quarter, with no department accounts).

**Sim (Oct 8 2026).** Run with `node --import tsx sim/budget-report.ts <bot> [grid|sweep|caps|requisitions]`.

| Bot | Today: declare | Today: gap (purchases / all decisions) | Budget: declare | Budget: gap |
|---|---|---|---|---|
| casual | 25.2 min | 350 s / 190 s | 25.5 min | 270 s |
| hard | 24.6 min | 348 s / 184 s | 25.5 min | 284 s |
| idler | 24.7 min | 310 s / 180 s | 27.0 min | 290 s |

- **The Readiness drag was the Editing cap.** With heads at the free-shares
  cap (0.5), Editing sat pinned at half the effort through Readiness.
  Recruiting and Construction meters were full, and Editing crawled for about
  10 minutes (declare at 33 min). Raising the cap to 0.8 at stage 4 brings
  Readiness back to about 5 minutes. A lower cap before stage 4 (0.35) gives
  growth more effort and saves another 2 minutes (`caps` mode).
- **Discretionary stays high (0.7).** At 30% the game often never declares,
  because departments' mechanical auto-buys are worse spenders than the
  player's own purchases.
- **Sweeping matters little:** sweep 0, ½ or 1 changes declare by under
  2 minutes.
- **Reviews are rubber stamps for a bot:** only 2 of 9 move the suggested
  lines by 5% or more.
- **Requisitions are pacing-neutral, and bots mostly decline them** (0 to 2
  paid of 17). Varying levels (3, 5 or 10) and price (0.6 to 1×) changes
  declare by under 20 s. The lookahead bot spends its wallet every decision,
  so a lump price rarely fits. For a player they're a prompt and a wallet
  trade-off, not a pacing lever. Whether people answer them is a playtest
  question.
- **The budget's dead gap is shorter than today's purchases-only gap.** Today's
  "all decisions" figure counts rebalancing the free slider, which no longer
  exists in this mode.

## Appendix A: Playthrough (Hypothesis)

A casual player's experience. Timing is a hypothesis, faster than §9 in the first hour.

| When | Doing | Horizon | Surprise |
|---|---|---|---|
| Minute 1 | One monkey, one desk. The Editor-in-Chief stamps a letter; first banana. | Second desk | The first real word certified is "no." |
| Minute 5 | Six monkeys. First Editor hired. First allocation: letters or words? | "Phrases" accumulator nearing 1.0 | The camera pulls back; the first window appears. |
| Minute 10 | First Commission. A parrot crosses the screen. | Second floor in dotted lines | n/a |
| Minute 30 | First Builder; three bars. Zeno at 1.25 s. | Sentences discoverable | The first sentence is grammatically perfect and meaningless. |
| Hour 1 | Hundreds of monkeys. First elevator upgrade. Zeno in vanity territory. | Teams upgrades | n/a |
| First evening | Funding shares set before bed. | Overnight earnings | A monkey's note asks if anyone else hears the elevator. |
| Day 2 | Teams, departments. Verse. Accounting opens. | Self-replication | Accounting insists lifetime earnings are −1/12 bananas. |
| Days 3-4 | Self-replicating departments. Readiness screen appears. | The greyed-out button | n/a |
| Day 5 | Window completes overnight. Declare Infinity. | First bus | Titles flip; a bus arrives full of monkeys typing only in Cyrillic. |
| Days 5-8 | Hotel. Competing Commissions: cash, Golden Bananas, new market. Shredder choice. | More markets | The Uncountable Bus can't be unloaded. |
| Days 8-10 | Diagonalists. Power Set of the rooms builds the Annex. "Double the Annex" does nothing. Proof, ruling, Publish. | Run 2 | Run 2's climb flies by. |
| Runs 2-3 | Faster ℵ₀, more Acclaim, odd feed lines. | n/a | A monkey insists he lives in Room ℵ½. |

---

## Appendix B: Sample Feed Lines

**Staffing**
- "Now hiring: recruiters to hire recruiters."
- "The builders' union has filed a grievance: 'infinite floors, finite lunch breaks.'"

**ℵ₀ transition**
- "Per the new org chart, floor construction is complete. Forever. Please redirect all questions to Shifting."
- "Recruiter #4 has been reassigned to Bus Operations. He says the buses just keep coming."

**Hotel**
- "Room 7 has been relocated 40 times today."
- "Bus 12 has arrived. Everyone on it types exclusively in Cyrillic."

**Continuum**
- "Facilities has doubled the Annex. Facilities reports no change."
- "A Diagonalist has been seen muttering 'that's not on the list' at the buffet."
- "By administrative ruling, the Annex is ℵ₁. The ruling was unanimous. The committee was one person."

**v1 clue flavor**
- "Diagonalist 3 reports a gap in the Annex. Management reports it as 'fine.'"
- "A monkey has filed a complaint about Room ℵ½. Facilities says it does not exist. The monkey says he lives there."
