# Infinite Monkeys — Transition Prototype

Headless game engine (M1) and simulation harness (M2.2) for the transition
prototype in `docs/PROTOTYPE.md`. No UI yet: M3/M4 start from
`docs/HANDOFF-M3-M4.md`.

```
core/      the game engine: pure logic (no DOM, no clock, no unseeded randomness)
content/   prototype tuning (data only)
sim/       bots, first-hotel-decision evaluation, metrics, report
tests/     unit tests and sim assertions (Vitest)
scripts/   purity check for core/
docs/      DESIGN.md, PROTOTYPE.md, HANDOFF-M3-M4.md
```

## Run

```
npm install
npm run check     # typecheck + core purity + all tests (~1 min)
npm run sim       # simulation report
```

If `tsx`'s CLI is blocked in your environment, run the report with
`node --import tsx sim/report.ts`.

## Status

- **75 tests run green:** 54 unit, 21 sim assertions.
- **Green does not mean every acceptance criterion is met.** The dead-gap
  target (F2) is unmet and marked `it.fails`, so the suite turns red when
  it's fixed and the marker must come off.
- Simulation results compare **four fixed policies** that follow the
  suggested split and funding. They are not a search for optimal play.

## How the engine works now

These are the current rules. The UI should call `core/` for all of them,
never reimplement them.

### Finite phase
- **Production.** Each monkey types at a fixed rate. Every submission is
  classified into exactly one tier (its longest meaningful unit) and pays
  only there. Editors certify finds up to their capacity. Unreviewed
  submissions are discarded.
- **Editor-in-Chief.** The player's own stamp: fixed baseline capacity
  that reviews discoverable-but-undiscovered tiers first.
- **Discovery.** Research makes a tier discoverable. A deterministic
  accumulator of expected certified finds triggers discovery at 1.0.
  Discovery rewards are once per save.
- **Suggested tier split.** Optimal for Maximize bananas (water-fill by
  value per review unit).
- **Departments.** Recruiting, Construction, Editing. Each has permanent
  capability (levels, stages 1–4) and a funding share. Effective output =
  capability × share × 3, so equal shares give 1.0×. At stage 4 each
  department self-replicates at its own rate (Recruiting 0.4%/s,
  Construction 0.3%/s, Editing 0.35%/s), so balance drifts.
- **Suggested funding.** Editing gets enough to cover review demand plus
  headroom, capped at 50%. The rest balances Recruiting against
  Construction. A department with no capability gets no share.
- **Common research.** Faster typewriters (×1.25 typing, cost ×2.5 per
  level). Review research is implemented but not offered (F4).
- **Readiness.** Meters = (stage / 4) × pace × scale. Recruiting and
  Construction are paced against each other, Editing against review
  demand; full at 90% of parity; scale needs 50,000 monkeys. All three
  must hold full for 60 s (the Stability Window).

### Hotel phase
- **Markets.** Home (10 per review unit, best), Cyrillic (6), Greek (8).
  Supply is unlimited; Editors are the bottleneck.
- **Unlock chain.** Commission reward → bus (Bus Wranglers) → onboarding
  (Shift Crews) → online. Buses and onboarding store *remaining work*,
  spent at the current speed each tick, so upgrades and funding changes
  affect jobs already underway.
- **Crew speed.** Funded output relative to the department's capability at
  declaration. Equal funding gives 1×; starving a crew slows it (floor
  0.1×).
- **Suggested hotel funding.** Nothing pending: 100% Editing. A bus in
  transit or a market onboarding: 50% to that crew, 5% floor for the
  other.
- **Suggested market split.** Maximize bananas: all to home. A pinned
  Commission: fastest completion, split by remaining work, and **never**
  to a market that isn't online yet (capacity goes to online requirements
  or home until it is). Re-apply when a market comes online.
- **Reference pool.** Owned editorial capability at a fixed 90% Editing
  share. It freezes Commission requirements and rewards at offer time and
  prices hotel upgrades at declaration, so funding can't game either.
  Because suggested play runs Editing at 100% when idle, Commissions
  finish ~10% faster than their capacity-minutes imply.
- **Commissions.** Immediate (Cyrillic, 3 capacity-minutes, 5 min, 1.5×
  production income forgone); Permanent (Cyrillic, 8, 12 min, Golden
  Bananas for one epic); Expansion (Cyrillic 5 + home 3, 12 min, Greek);
  Greek Commission (Greek, 3, 6 min, Golden Bananas), offered when Greek
  comes online. Deadlines run from first pin; deliveries count only while
  pinned.
- **Hotel upgrades** replace department levels after the ceremony:
  Editors (+15% capacity), Bus Wranglers, Shift Crews (×0.8 time). The
  first level of each costs **450 s of reference home income**, ×1.5 per
  level.
- **Epic research** (Golden Bananas, persists across runs): Senior Editors
  (+15% review speed everywhere), Cyrillic Specialists (Cyrillic review
  cost ×0.65, +54% throughput), Faster Shift Crews (onboarding ×0.5).

### Previews
- **Commission preview** (offer screen): "ready in", production time, and
  a full ETA **assuming the suggested split and funding**. Matches actual
  completion within ~5% in the sim.
- **Allocation preview** (custom split): income now and the pinned
  Commission's ETA **assuming this split and current funding are kept**,
  including waiting for markets to come online. Matches actual completion
  within 1 s (unit test).

## Latest simulation report

```
# Finite phase

casual  declare 25.2 min | office 0.3 min building 1.7 min tall 7.5 min all-stage-4 19.2 min
        longest dead gap 350 s purchases only, 190 s counting rebalances | Readiness rebalances: 0 at Y=10%, 3 episodes
hard    declare 24.6 min | office 0.2 min building 1.3 min tall 7.4 min all-stage-4 18.8 min
        longest dead gap 348 s purchases only, 184 s counting rebalances | Readiness rebalances: 0 at Y=10%, 3 episodes
idler   declare 24.7 min | office 0.5 min building 1.9 min tall 7.8 min all-stage-4 19.3 min
        longest dead gap 310 s purchases only, 180 s counting rebalances | Readiness rebalances: 0 at Y=10%, 2 episodes

# First hotel decision (casual)

bank 59 s of income; banana-rush target 450 s of income

Four fixed policies following the suggested split and funding (not a search).

choice      banana rush  epic first  expansion first  completed  payoff  Greek Commission  forgone (s of income)
ordinary          363 s           —                —          —       —                 —  —
immediate         331 s           —                —      182 s   149 s                 —  72
permanent         536 s       452 s                —      452 s     0 s                 —  192
expansion         495 s       645 s            483 s      443 s    40 s             645 s  120

preview vs actual completion:
  immediate  preview 191 s actual 182 s
  permanent  preview 461 s actual 452 s
  expansion  preview 446 s actual 443 s

# Candidate: cheaper first hotel upgrade, across arrival balances (×1.5)

first upgrade (s of income) | bank at arrival (s of income) → ordinary / immediate to target, Immediate payoff
 300 s | 0s: 281 s/249 s pay 67 s ✓✓ | 60s: 227 s/195 s pay 13 s ✓✓ | 120s: 173 s/182 s pay 0 s ·✓ | 180s: 119 s/182 s pay 0 s ·✓ | 240s: 65 s/95 s pay 0 s ·✓
 450 s | 0s: 416 s/384 s pay 202 s ✓· | 60s: 362 s/330 s pay 148 s ✓✓ | 120s: 308 s/276 s pay 94 s ✓✓ | 180s: 254 s/222 s pay 40 s ✓✓ | 240s: 200 s/182 s pay 0 s ✓✓
 600 s | 0s: 551 s/519 s pay 337 s ✓· | 60s: 497 s/465 s pay 283 s ✓· | 120s: 443 s/411 s pay 229 s ✓· | 180s: 389 s/357 s pay 175 s ✓✓ | 240s: 335 s/303 s pay 121 s ✓✓
(✓✓ = Immediate wins banana rush AND pays off within 3 min)

# Suggested idle funding: 90% vs 100% Editing (reference share fixed at 90%; current: 100%)

choice      completed (90% / 100%)   banana rush (90% / 100%)   expansion first (90% / 100%)
ordinary    — / —                    401 s / 363 s              — / —
immediate   200 s / 182 s            365 s / 331 s              — / —
permanent   500 s / 452 s            593 s / 536 s              — / —
expansion   490 s / 443 s            544 s / 495 s              530 s / 483 s

# Immediate vs ordinary under banana rush: sensitivity

upgrade cost (s of income) × payout multiplier → ordinary / immediate (seconds to target)
 300 s   ×1.5: 228 s / 196 s ✓   ×2: 228 s / 182 s ✓   ×3: 228 s / 182 s ✓
 600 s   ×1.5: 498 s / 466 s ✓   ×2: 498 s / 433 s ✓   ×3: 498 s / 368 s ✓
 900 s   ×1.5: 768 s / 736 s ✓   ×2: 768 s / 703 s ✓   ×3: 768 s / 638 s ✓
```

## §10 results

| Assertion | Result |
|---|---|
| Casual declares in 25–35 min | ✅ 25.2 min |
| All Commissions complete before deadline | ✅ 182 s, 452 s, 443 s |
| Every Commission diverts from home, own split | ✅ |
| Commission previews within 10% of actual | ✅ 191/182, 461/452, 446/443 |
| Custom allocation preview matches actual | ✅ within 1 s |
| Immediate beats ordinary under banana rush | ✅ 331 s vs 363 s |
| Permanent reaches the epic first; Expansion later via Greek | ✅ 452 s vs 645 s |
| Expansion wins expansion first | ✅ 483 s |
| Permanent and Expansion have a banana-rush sacrifice | ✅ |
| Greek has a practical payoff | ✅ Greek Commission at 645 s |
| All three pay off within 3 min | ✅ 149 s, 0 s, 40 s |
| No dead gap over 2 min | ❌ known failure, ~190 s (F2) |
| 2–3 rebalancing decisions in Readiness | ✅ 3 (episode definition) |

## Open findings

- **F2. Mid-game dead gap** of ~190 s between staggered stage unlocks
  (counting Readiness rebalancing as action). Kept visible; the UI should
  show whether players read it as understandable waiting or confusion
  before another mechanic is added.
- **F3. Arrival balance varies with tuning.** Immediate's advantage at
  450 s pricing holds for arrival balances of 60–240 s of income (sweep
  above), and slips at zero or very large balances.
- **F4. Letters dominate review demand.** Spare capacity only certifies
  near-worthless letters, so extra Editors and review research add little
  income, and the Readiness Editing meter mostly measures letters.
- **F6. Paired purchases.** Bots need Recruiting + Construction as a pair,
  and a first Recruiter + desk without tapping. The UI may need a
  "balanced buy" or a first-Recruiter prompt.

## History

- **M1:** headless core and event interface.
- **M2:** bots, report, sim assertions; hotel upgrades re-priced; faster
  typewriters; retuning; onboarding-aware suggested split.
- **M2.1** (external review): reference pool closes funding exploits;
  hotel funding suggestion; Greek payoff; previews include waiting; timers
  respond to upgrades; input validation; `tsx` dependency.
- **M2.2** (external review): allocation preview uses readiness; every
  policy buys the target epic; first hotel upgrade at 450 s (from an
  arrival-balance sweep; 300 s only worked for small balances).
- **Handoff:** idle hotel funding at 100% Editing with the reference share
  held at 90%; previews now assume the suggested idle funding rather than
  the reference share; README rewritten to current rules.

Detailed reasoning for each change is in `docs/PROTOTYPE.md` §0 and the
decision log in `docs/DESIGN.md`.
