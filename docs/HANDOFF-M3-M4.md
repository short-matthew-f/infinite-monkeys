# Handoff: M3 (Finite UI) and M4 (Transition)

For whoever builds the UI next (likely in Claude Code). Read this, then
`README.md` (current rules) and `docs/PROTOTYPE.md` §5, §6, §8.

## Ground rules

1. **The UI calls `core/`; it never reimplements game math.** Every number
   on screen comes from a core function: rates, previews, suggestions,
   costs, meters. If the UI needs a number core doesn't expose, add a pure
   function to `core/` with a test.
2. **Time.** Run `step()` at the fixed tick (10/s) from a render loop;
   interpolate for display. Never read the clock inside `core/`. On
   return from the background, call `catchUp()` with elapsed seconds.
3. **Actions.** Every player input is a core action (`tapHire`,
   `buyDeptStage`, `setShares`, `setMarketAllocation`, `pinObjective`,
   `declareInfinity`, ...). Actions validate and return `false` when not
   allowed; the UI should disable controls rather than rely on failures.
4. **Events.** Pass a sink that both drives UI feedback (celebrations,
   feed lines, title flips) and records events for the M6 export.
5. **Randomness.** Feed line selection draws from
   `state.rng.presentation` only. Never from the gameplay stream.
6. **Persistence.** Save the whole `GameState` to IndexedDB with a schema
   version. It's plain JSON.
7. **`npm run check` stays green** after every change. The one
   `it.fails` (F2) stays until the gap is fixed.

## M3: the finite operation

Screens (PROTOTYPE.md §6):

| Screen | Core functions |
|---|---|
| Diorama | `state.monkeys`, `state.desks`, `milestonesReached`; window view from desks |
| Hire button | `tapHire`, `hireCooldownSeconds`, `zenoCost` |
| Bars (typing vs editing per tier) | `certifyTiers` (certified, idle, discarded), `findRates`, `editingPool` |
| Allocation | `suggestTierAllocation`, `setTierAllocation`, `applySuggestedAllocation` |
| Departments | `capability`, `deptOutput`, `deptLevelCost`, `deptStageCost`, `buyDeptLevel`, `buyDeptStage` |
| Funding | `suggestShares`, `setShares`, `meters` (preview by computing on a cloned state) |
| Research | `researchTier`, `buyTypingResearch`, `typingResearchCost` |
| Readiness | `meters`, `state.stability`, `pinObjective({kind:'readiness'})` |

Requirements:
- Idle Editors and discarded submissions are visible on the bars, never
  hidden in a menu.
- Every funding or allocation change shows its effect before confirming
  (clone state, apply, read meters/income).
- **Paired purchases (F6):** consider a "balanced buy" for Recruiting +
  Construction, and a prompt for the first Recruiter + desk. Without them,
  a non-tapping player can stall.

## M4: the transition

- **Infinity ceremony** (PROTOTYPE.md §6 and DESIGN.md §4): permit stamp,
  Declare button, camera climb, counter flip to ℵ₀, title flips from the
  `titleFlipped` events, first bus within a minute.
- **Hotel screens** (needed for the end condition):
  - **Commission offers side by side:** requirement, deadline, reward, and
    `previewCommission` → "ready in", production time, full ETA, labeled
    **"assuming suggested split and funding"**, plus production income
    forgone.
  - **Allocation:** `previewMarketAllocation`, labeled **"keeping this
    split and current funding"**.
  - **Hotel funding:** `suggestShares` (hotel-aware). When a market comes
    online, prompt the player to re-apply the suggested split.
  - **Hotel upgrades and epics:** `hotelUpgradeCost`, `buyHotelUpgrade`,
    `buyEpic`.
- **End condition** (PROTOTYPE.md §5): a Commission completed, its payoff
  experienced, a different objective pinned and run for ~2 minutes.

## What the UI should help answer

- **F2:** does the ~190 s mid-game stretch read as understandable waiting
  or as confusion? Watch for it before adding a mechanic.
- Do players understand what a Commission delays before choosing it?
- Do the two preview labels make sense side by side?
- Is the ceremony, and the first hotel decision after it, rewarding?

## Not in scope for M3/M4

Shredder, Accounting, Continuum Annex, Publish, drones, boosts, offline
Break Room UI, views beyond the first two windows, tiers above sentences
(PROTOTYPE.md §2).
